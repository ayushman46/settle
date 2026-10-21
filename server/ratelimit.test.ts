import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { clientKey, concurrencyLimit, createRateLimiter, normalizeAddress, rateLimit, tieredRateLimit } from './ratelimit'
import { fromSocket } from './testing'

function clock(start = 1_000_000) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe('createRateLimiter', () => {
  it('allows `max` hits per window, then blocks until the window ends', () => {
    const time = clock()
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 }, time.now)
    expect([1, 2, 3].map(() => limiter.hit('a').allowed)).toEqual([true, true, true])
    const blocked = limiter.hit('a')
    expect(blocked).toEqual({ allowed: false, limit: 3, remaining: 0, resetAt: 1_001_000 })
    time.advance(999)
    expect(limiter.hit('a').allowed).toBe(false)
    time.advance(1)
    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 2 })
  })

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 }, clock().now)
    expect(limiter.hit('a').allowed).toBe(true)
    expect(limiter.hit('b').allowed).toBe(true)
    expect(limiter.hit('a').allowed).toBe(false)
  })

  it('prunes expired windows', () => {
    const time = clock()
    const limiter = createRateLimiter({ max: 5, windowMs: 1000 }, time.now)
    for (let i = 0; i < 50; i++) limiter.hit(`ip-${i}`)
    expect(limiter.size).toBe(50)
    time.advance(1001)
    limiter.hit('fresh')
    expect(limiter.size).toBe(1)
  })

  it('never tracks more than 10,000 keys', () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 }, clock().now)
    for (let i = 0; i < 10_050; i++) limiter.hit(`ip-${i}`)
    expect(limiter.size).toBeLessThanOrEqual(10_000)
  })
})

describe('normalizeAddress', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['203.0.113.7:51234', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:abcd:12:1:2:3:4', '2001:db8:abcd:12::/64'],
    ['2001:DB8:ABCD:0012::9', '2001:db8:abcd:12::/64'],
    ['[2001:db8::1]:443', '2001:db8:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeAddress(input)).toBe(expected)
  })
})

describe('clientKey', () => {
  const keyOf = async (headers: Record<string, string>, trustProxy?: number, socket?: string) => {
    const app = new Hono()
    app.get('/', (c) => c.text(clientKey(c, trustProxy)))
    return (await app.request('/', { headers }, socket === undefined ? undefined : fromSocket(socket))).text()
  }

  it('uses the socket address and ignores X-Forwarded-For by default (anyone can send it)', async () => {
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4' }, undefined, '203.0.113.50')).toBe('203.0.113.50')
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4' }, 0, '::ffff:203.0.113.50')).toBe('203.0.113.50')
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4' }, 0)).toBe('anon')
  })

  it('behind one proxy, uses the hop that proxy appended, not what the client claimed', async () => {
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4' }, 1, '10.0.0.2')).toBe('198.51.100.4')
    expect(await keyOf({ 'x-forwarded-for': '1.2.3.4, 198.51.100.4' }, 1, '10.0.0.2')).toBe('198.51.100.4')
    expect(await keyOf({ 'x-forwarded-for': '1.2.3.4,198.51.100.4 ' }, 1, '10.0.0.2')).toBe('198.51.100.4')
  })

  it('behind N proxies, counts N hops from the end', async () => {
    expect(await keyOf({ 'x-forwarded-for': '1.2.3.4, 198.51.100.4, 10.0.0.9' }, 2, '10.0.0.2')).toBe('198.51.100.4')
  })

  it('groups IPv6 clients by /64', async () => {
    expect(await keyOf({ 'x-forwarded-for': '2001:db8:abcd:12::99' }, 1)).toBe('2001:db8:abcd:12::/64')
  })

  it('falls back to the socket when the header is too short or junk, and to "anon" without one', async () => {
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4' }, 2, '10.0.0.2')).toBe('10.0.0.2')
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4, unknown' }, 1, '10.0.0.2')).toBe('10.0.0.2')
    expect(await keyOf({ 'x-forwarded-for': '198.51.100.4, ' }, 1, '10.0.0.2')).toBe('10.0.0.2')
    expect(await keyOf({ 'x-forwarded-for': 'unknown' }, 1)).toBe('anon')
    expect(await keyOf({})).toBe('anon')
  })
})

describe('rateLimit middleware', () => {
  function app(max: number, time = clock()) {
    const hono = new Hono()
    hono.post(
      '/scan',
      rateLimit({ max, windowMs: 60_000 }, { now: time.now, onLimited: (c, retryAfter) => c.json({ limited: true, retryAfter }, 429) }),
      (c) => c.json({ ok: true }),
    )
    return hono
  }
  const post = (hono: Hono, ip = '198.51.100.1') => hono.request('/scan', { method: 'POST' }, fromSocket(ip))

  it('sets RateLimit headers and answers 429 with Retry-After once exhausted', async () => {
    const time = clock()
    const hono = app(2, time)
    const first = await post(hono)
    expect(first.status).toBe(200)
    expect(first.headers.get('RateLimit-Limit')).toBe('2')
    expect(first.headers.get('RateLimit-Remaining')).toBe('1')
    expect(first.headers.get('RateLimit-Reset')).toBe('60')
    expect((await post(hono)).status).toBe(200)

    time.advance(15_000)
    const limited = await post(hono)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('45')
    expect(await limited.json()).toEqual({ limited: true, retryAfter: 45 })
    expect((await post(hono, '198.51.100.2')).status).toBe(200)
  })

  it('is a no-op when max is 0', async () => {
    const hono = app(0)
    for (let i = 0; i < 5; i++) {
      const response = await post(hono)
      expect(response.status).toBe(200)
      expect(response.headers.has('RateLimit-Limit')).toBe(false)
    }
  })
})

describe('concurrencyLimit middleware', () => {
  function app(max: number) {
    const gates: Array<() => void> = []
    const hono = new Hono()
    hono.post(
      '/scan',
      concurrencyLimit(max, (c) => c.json({ busy: true }, 429)),
      async (c) => {
        await new Promise<void>((resolve) => gates.push(resolve))
        if (c.req.query('explode') !== undefined) throw new Error('boom')
        return c.json({ ok: true })
      },
    )
    hono.onError((_error, c) => c.json({ failed: true }, 500))
    const post = (query = '') => hono.request(`/scan${query}`, { method: 'POST' })
    /** Lets the oldest request in flight finish. */
    const release = async () => {
      await vi.waitFor(() => expect(gates.length).toBeGreaterThan(0))
      gates.shift()?.()
    }
    return { post, release }
  }

  it('answers at once when every slot is taken, and frees slots as requests finish', async () => {
    const { post, release } = app(2)
    const first = post()
    const second = post()
    expect((await post()).status).toBe(429)

    await release()
    expect((await first).status).toBe(200)
    const third = post()
    await release()
    await release()
    expect((await second).status).toBe(200)
    expect((await third).status).toBe(200)
  })

  it('frees the slot when the handler throws', async () => {
    const { post, release } = app(1)
    const failing = post('?explode')
    await release()
    expect((await failing).status).toBe(500)
    const next = post()
    await release()
    expect((await next).status).toBe(200)
  })

  it('is a no-op when max is 0', async () => {
    const { post, release } = app(0)
    const pending = [post(), post(), post()]
    for (let i = 0; i < pending.length; i++) await release()
    expect((await Promise.all(pending)).map((response) => response.status)).toEqual([200, 200, 200])
  })
})

describe('tieredRateLimit middleware', () => {
  function app(time = clock()) {
    const free = createRateLimiter({ max: 1, windowMs: 60_000 }, time.now)
    const pro = createRateLimiter({ max: 3, windowMs: 86_400_000 }, time.now)
    const hono = new Hono()
    hono.post(
      '/ai',
      tieredRateLimit<'free' | 'pro'>({
        now: time.now,
        choose: (c) => {
          const license = c.req.header('x-license')
          if (license === 'unlimited') return null
          return license ? { limiter: pro, key: `license:${license}`, tier: 'pro' } : { limiter: free, key: clientKey(c), tier: 'free' }
        },
        onLimited: (c, retryAfter, tier) => c.json({ limited: tier, retryAfter }, 429),
      }),
      (c) => c.json({ ok: true }),
    )
    return hono
  }
  const post = (hono: Hono, headers: Record<string, string> = {}, ip = '198.51.100.1') => hono.request('/ai', { method: 'POST', headers }, fromSocket(ip))

  it('draws each request from the allowance its tier chose', async () => {
    const hono = app()
    expect((await post(hono)).status).toBe(200)
    expect(await (await post(hono)).json()).toEqual({ limited: 'free', retryAfter: 60 })

    // Same address, but a license: its own, bigger allowance.
    for (let i = 0; i < 3; i++) expect((await post(hono, { 'x-license': 'abc' })).status).toBe(200)
    const limited = await post(hono, { 'x-license': 'abc' })
    expect(await limited.json()).toEqual({ limited: 'pro', retryAfter: 86_400 })
    expect(limited.headers.get('RateLimit-Limit')).toBe('3')

    // A different license has its own allowance, wherever it comes from.
    expect((await post(hono, { 'x-license': 'def' }, '203.0.113.5')).status).toBe(200)
  })

  it('skips limiting (and its headers) when the tier is unlimited', async () => {
    const hono = app()
    for (let i = 0; i < 5; i++) {
      const response = await post(hono, { 'x-license': 'unlimited' })
      expect(response.status).toBe(200)
      expect(response.headers.has('RateLimit-Limit')).toBe(false)
    }
  })
})
