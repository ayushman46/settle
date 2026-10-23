import { describe, expect, it, vi } from 'vitest'
import { ECB_XML } from './testing'
import { createRatesSource, ECB_URL, NEWER_DAY_REFRESH_MS, parseEcbXml, ratesCacheControl, REFRESH_MS, withPegs } from './rates'

const FRI_NOON = Date.UTC(2026, 9, 16, 12)

function source(fetchImpl: typeof fetch, start = FRI_NOON) {
  let time = start
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const rates = createRatesSource({ fetchImpl, now: () => time, log })
  return { rates, log, advance: (ms: number) => (time += ms) }
}

const ok = () => vi.fn(async () => new Response(ECB_XML, { status: 200 }))

describe('parseEcbXml', () => {
  it('reads each business day, either quote style, skipping broken entries', () => {
    const days = parseEcbXml(ECB_XML)
    expect([...days.keys()]).toEqual(['2026-10-16', '2026-10-15', '2026-10-14'])
    expect(days.get('2026-10-16')).toEqual({ EUR: 1, USD: 1.0812, JPY: 163.42, INR: 90.4321, THB: 37.512 })
    expect(days.get('2026-10-15')).toEqual({ EUR: 1, USD: 1.0799, INR: 90.1 })
  })

  it('reads nothing from something else', () => {
    expect(parseEcbXml('<html>maintenance</html>').size).toBe(0)
    expect(parseEcbXml('<Cube time="2026-02-30"><Cube currency="USD" rate="1"/></Cube>').size).toBe(0)
  })
})

describe('withPegs', () => {
  it('derives pegged currencies exactly from their base', () => {
    const { rates, pegged } = withPegs({ EUR: 1, USD: 1.0812, INR: 90.4321 })
    expect(rates.AED).toBe(1.0812 * 3.6725)
    expect(rates.SAR).toBe(1.0812 * 3.75)
    expect(rates.NPR).toBe(90.4321 * 1.6)
    expect(rates.BTN).toBe(90.4321)
    expect(pegged.AED).toEqual({ to: 'USD', peg: 3.6725 })
    expect(pegged.NPR).toEqual({ to: 'INR', peg: 1.6 })
  })

  it('skips a peg whose base is missing that day', () => {
    const { rates, pegged } = withPegs({ EUR: 1, USD: 1.08 })
    expect(rates.NPR).toBeUndefined()
    expect(pegged.NPR).toBeUndefined()
    expect(pegged.AED).toBeDefined()
  })
})

describe('createRatesSource', () => {
  it('answers with the newest business day at or before the asked one (Sunday → Friday)', async () => {
    const fetchImpl = ok()
    const { rates } = source(fetchImpl, Date.UTC(2026, 9, 18, 12))
    const sunday = await rates.lookup('2026-10-18')
    expect(sunday).toMatchObject({ ok: true, newest: true, body: { date: '2026-10-16', base: 'EUR' } })
    expect(await rates.lookup('2026-10-15')).toMatchObject({ ok: true, newest: false, body: { date: '2026-10-15' } })
    expect(await rates.lookup(null)).toMatchObject({ ok: true, body: { date: '2026-10-16' } })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe(ECB_URL)
  })

  it('includes the pegs in the answer', async () => {
    const { rates } = source(ok())
    const result = await rates.lookup('2026-10-16')
    expect(result.ok && result.body.rates.AED).toBe(1.0812 * 3.6725)
    expect(result.ok && result.body.pegged.NPR).toEqual({ to: 'INR', peg: 1.6 })
  })

  it('says unavailable for a day before the oldest it has', async () => {
    const { rates } = source(ok())
    expect(await rates.lookup('2026-10-13')).toEqual({ ok: false, code: 'rates_unavailable' })
  })

  it.each(['yesterday', '2026-13-01', '2026-02-30', '1998-12-31', '2026-10-18', '16-10-2026'])('refuses %s as a date', async (date) => {
    const { rates } = source(ok())
    expect(await rates.lookup(date)).toEqual({ ok: false, code: 'bad_request' })
  })

  it('refreshes after 6 hours, or after 15 minutes when asked for a newer day', async () => {
    const fetchImpl = ok()
    const { rates, advance } = source(fetchImpl)
    await rates.lookup('2026-10-16')
    advance(REFRESH_MS - 1)
    await rates.lookup('2026-10-16')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    advance(2)
    await rates.lookup('2026-10-16')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // Tomorrow's question: a newer day than the newest we have.
    advance(NEWER_DAY_REFRESH_MS - 1)
    await rates.lookup('2026-10-17')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    advance(2)
    await rates.lookup('2026-10-17')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('serves the cache when a refresh fails, and says why in the log', async () => {
    const fetchImpl = vi.fn(async () => new Response(ECB_XML)).mockResolvedValueOnce(new Response(ECB_XML)).mockRejectedValueOnce(new Error('network down'))
    const { rates, advance, log } = source(fetchImpl as unknown as typeof fetch)
    await rates.lookup(null)
    advance(REFRESH_MS + 1)
    expect(await rates.lookup('2026-10-16')).toMatchObject({ ok: true, body: { date: '2026-10-16' } })
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('network down'))
    expect(log.info).toHaveBeenCalledWith(expect.stringMatching(/^\[rates\] ok · 2026-10-16 · 4 currencies · \d+ ms$/))
  })

  it('is unavailable with no cache and no answer', async () => {
    const { rates } = source(vi.fn(async () => new Response('busy', { status: 503 })) as unknown as typeof fetch)
    expect(await rates.lookup('2026-10-16')).toEqual({ ok: false, code: 'rates_unavailable' })
  })

  it('keeps one fetch in flight for many questions', async () => {
    let release: (() => void) | null = null
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => (release = () => resolve(new Response(ECB_XML)))))
    const { rates } = source(fetchImpl as unknown as typeof fetch)
    const answers = Promise.all([rates.lookup('2026-10-16'), rates.lookup('2026-10-15'), rates.lookup(null)])
    await Promise.resolve()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    ;(release as unknown as () => void)()
    expect((await answers).every((a) => a.ok)).toBe(true)
  })
})

describe('ratesCacheControl', () => {
  it('keeps past days long and the newest briefly', () => {
    expect(ratesCacheControl(false)).toBe('public, max-age=3600, stale-while-revalidate=86400')
    expect(ratesCacheControl(true)).toBe('public, max-age=900')
  })
})

