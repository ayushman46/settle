import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { apiOrigin, CLIENT_IP_HEADER, EDGE_MESSAGES, forwardHeaders, PROXIED_HEADER, PROXY_SECRET_HEADER, proxyToApi } from './edgeProxy'
import { clientKey } from './ratelimit'
import { createApp } from './app'
import { silentLogger, testConfig } from './testing'

const SECRET = 'k3Y-0123456789abcdefghijklmnop'
const ORIGIN = 'https://settle-api.onrender.com'
const PAGES = 'https://settle.pages.dev'

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** A fetch that records what it was asked and answers with `answer`. */
function recordingFetch(answer: () => Response = () => Response.json({ ok: true })) {
  return vi.fn<Fetch>(async () => answer())
}

const call = (mock: ReturnType<typeof recordingFetch>) => {
  const args = mock.mock.calls[0]
  if (!args) throw new Error('fetch was not called')
  const [url, init = {}] = args
  return { url: url.toString(), init: init as RequestInit & { duplex?: string }, headers: new Headers(init.headers) }
}

describe('apiOrigin', () => {
  it.each([
    ['https://settle-api.onrender.com', 'https://settle-api.onrender.com'],
    ['  https://settle-api.onrender.com/  ', 'https://settle-api.onrender.com'],
    ['https://settle-api.onrender.com/some/path?x=1', 'https://settle-api.onrender.com'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
  ])('%j → %j', (raw, origin) => {
    expect(apiOrigin(raw)).toBe(origin)
  })

  it.each([undefined, '', '   ', 'settle-api.onrender.com', 'ftp://example.com', 'javascript:alert(1)', 'https://user:pass@example.com'])(
    'rejects %j',
    (raw) => {
      expect(apiOrigin(raw)).toBeNull()
    },
  )
})

describe('forwardHeaders', () => {
  const request = (headers: Record<string, string>) => new Request(`${PAGES}/api/scan`, { method: 'POST', headers })

  it('passes what the API reads and sets the client address from CF-Connecting-IP', () => {
    const headers = forwardHeaders(
      request({
        'content-type': 'application/json',
        accept: 'application/json',
        'sec-fetch-site': 'same-origin',
        'x-settle-license': 'SETTLE1.a.b',
        'cf-connecting-ip': '203.0.113.9',
      }),
      { PROXY_SECRET: SECRET },
    )
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('sec-fetch-site')).toBe('same-origin')
    expect(headers.get('x-settle-license')).toBe('SETTLE1.a.b')
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.9')
    expect(headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.9')
    expect(headers.get(PROXY_SECRET_HEADER)).toBe(SECRET)
    expect(headers.get('x-forwarded-proto')).toBe('https')
    expect(headers.get('x-forwarded-host')).toBe('settle.pages.dev')
    expect(headers.get(PROXIED_HEADER)).toBe('1')
    expect(headers.has('cf-connecting-ip')).toBe(false)
  })

  it('drops whatever a client claims about its address, our own headers and per-connection ones', () => {
    const headers = forwardHeaders(
      request({
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '1.2.3.4',
        'true-client-ip': '1.2.3.4',
        forwarded: 'for=1.2.3.4',
        [CLIENT_IP_HEADER]: '1.2.3.4',
        [PROXY_SECRET_HEADER]: 'guess',
        cookie: '__cf_bm=abc',
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
        'cf-ray': '8abc',
        'cf-ipcountry': 'IN',
      }),
      { PROXY_SECRET: SECRET },
    )
    for (const name of ['x-forwarded-for', 'x-real-ip', 'true-client-ip', 'forwarded', CLIENT_IP_HEADER, PROXY_SECRET_HEADER, 'cookie', 'connection', 'keep-alive', 'cf-ray', 'cf-ipcountry']) {
      expect(headers.has(name), name).toBe(false)
    }
  })

  it('sends no secret when none is set, and no address when Cloudflare gave none (or junk)', () => {
    const noSecret = forwardHeaders(request({ 'cf-connecting-ip': '2001:db8::7' }), {})
    expect(noSecret.get('x-forwarded-for')).toBe('2001:db8::7')
    expect(noSecret.has(CLIENT_IP_HEADER)).toBe(false)
    expect(noSecret.has(PROXY_SECRET_HEADER)).toBe(false)

    const junk = forwardHeaders(request({ 'cf-connecting-ip': '1.2.3.4, 5.6.7.8' }), { PROXY_SECRET: SECRET })
    expect(junk.has('x-forwarded-for')).toBe(false)
    expect(junk.has(CLIENT_IP_HEADER)).toBe(false)
    expect(junk.has(PROXY_SECRET_HEADER)).toBe(false)
  })
})

describe('proxyToApi', () => {
  it('forwards method, path, query and a streamed body to API_ORIGIN', async () => {
    const fetchMock = recordingFetch()
    const body = JSON.stringify({ text: 'Cab 840 with Riya' })
    const request = new Request(`${PAGES}/api/describe?debug=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
      body,
    })
    const response = await proxyToApi(request, { API_ORIGIN: ORIGIN, PROXY_SECRET: SECRET }, { fetch: fetchMock })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })

    const sent = call(fetchMock)
    expect(sent.url).toBe(`${ORIGIN}/api/describe?debug=1`)
    expect(sent.init.method).toBe('POST')
    expect(sent.init.redirect).toBe('manual')
    expect(sent.init.duplex).toBe('half')
    expect(sent.init.body).toBeInstanceOf(ReadableStream)
    expect(await new Response(sent.init.body).text()).toBe(body)
    expect(sent.headers.get(PROXY_SECRET_HEADER)).toBe(SECRET)
  })

  it('sends no body for GET and HEAD', async () => {
    for (const method of ['GET', 'HEAD']) {
      const fetchMock = recordingFetch()
      await proxyToApi(new Request(`${PAGES}/api/health`, { method }), { API_ORIGIN: ORIGIN }, { fetch: fetchMock })
      const sent = call(fetchMock)
      expect(sent.init.method).toBe(method)
      expect(sent.init.body).toBeNull()
      expect(sent.init.duplex).toBeUndefined()
    }
  })

  it('relays status, headers and body untouched, minus per-connection headers', async () => {
    const fetchMock = recordingFetch(
      () =>
        new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Too many' } }), {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '45',
            'ratelimit-remaining': '0',
            'cache-control': 'no-store',
            'content-security-policy': "default-src 'self'",
            connection: 'close',
            'keep-alive': 'timeout=5',
          },
        }),
    )
    const response = await proxyToApi(new Request(`${PAGES}/api/scan`, { method: 'POST', body: '{}' }), { API_ORIGIN: ORIGIN }, { fetch: fetchMock })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('45')
    expect(response.headers.get('ratelimit-remaining')).toBe('0')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'")
    expect(response.headers.has('connection')).toBe(false)
    expect(response.headers.has('keep-alive')).toBe(false)
    expect(await response.json()).toEqual({ error: { code: 'rate_limited', message: 'Too many' } })
  })

  it('answers in the API error shape when API_ORIGIN is missing or wrong', async () => {
    for (const env of [{}, { API_ORIGIN: '' }, { API_ORIGIN: 'not a url' }]) {
      const fetchMock = recordingFetch()
      const response = await proxyToApi(new Request(`${PAGES}/api/health`), env, { fetch: fetchMock })
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: { code: 'not_configured', message: EDGE_MESSAGES.notConfigured } })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  })

  it('answers 502 in the API error shape when the server is unreachable', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const response = await proxyToApi(new Request(`${PAGES}/api/health`), { API_ORIGIN: ORIGIN }, { fetch: failing })
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: { code: 'upstream_error', message: EDGE_MESSAGES.unreachable } })
  })

  it('refuses to proxy to itself or to go round twice', async () => {
    const fetchMock = recordingFetch()
    const self = await proxyToApi(new Request(`${PAGES}/api/health`), { API_ORIGIN: PAGES }, { fetch: fetchMock })
    expect(self.status).toBe(508)
    const twice = await proxyToApi(new Request(`${PAGES}/api/health`, { headers: { [PROXIED_HEADER]: '1' } }), { API_ORIGIN: ORIGIN }, { fetch: fetchMock })
    expect(twice.status).toBe(508)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not follow redirects (the browser sees them as they are)', async () => {
    const fetchMock = recordingFetch(() => new Response(null, { status: 301, headers: { location: 'https://elsewhere.example/' } }))
    const response = await proxyToApi(new Request(`${PAGES}/api/old`), { API_ORIGIN: ORIGIN }, { fetch: fetchMock })
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://elsewhere.example/')
  })
})

describe('edge proxy → server, end to end', () => {
  /** The real API app behind the proxy, reached without a network. */
  function behindProxy(proxySecret: string | null, trustProxy = 1) {
    const log = silentLogger()
    const api = createApp(testConfig({ proxySecret, trustProxy, rateLimit: { max: 1, windowMs: 60_000 }, apiKey: null }), { logger: log })
    const toServer = vi.fn<Fetch>(async (url, init) => api.request(url.toString(), init))
    const visit = (ip: string) =>
      proxyToApi(
        new Request(`${PAGES}/api/describe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': ip },
          body: JSON.stringify({ text: 'Cab 840 with Riya' }),
        }),
        { API_ORIGIN: ORIGIN, PROXY_SECRET: SECRET },
        { fetch: toServer },
      )
    return { visit, log }
  }

  it('gives each visitor their own allowance when the secrets match', async () => {
    const { visit, log } = behindProxy(SECRET)
    // AI is off (no key), so an allowed request answers 503 and a limited one 429.
    expect((await visit('203.0.113.1')).status).toBe(503)
    expect((await visit('203.0.113.1')).status).toBe(429)
    expect((await visit('203.0.113.2')).status).toBe(503)
    expect(log.warn).not.toHaveBeenCalled()
  })

  it("warns the operator once when the server's secret differs (or is missing)", async () => {
    for (const serverSecret of ['a-completely-different-secret-value', null]) {
      const { visit, log } = behindProxy(serverSecret)
      await visit('203.0.113.1')
      await visit('203.0.113.2')
      expect(log.warn).toHaveBeenCalledTimes(1)
      expect(log.warn.mock.calls[0]?.[0]).toMatch(/PROXY_SECRET/)
    }
  })

  it('trusts X-Settle-Client-IP only with the secret', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text(clientKey(c, { trustProxy: 0, proxySecret: SECRET })))
    const keyOf = async (headers: Record<string, string>) => (await app.request('/', { headers })).text()
    expect(await keyOf({ [CLIENT_IP_HEADER]: '203.0.113.5', [PROXY_SECRET_HEADER]: SECRET })).toBe('203.0.113.5')
    expect(await keyOf({ [CLIENT_IP_HEADER]: '203.0.113.5', [PROXY_SECRET_HEADER]: ` ${SECRET} ` })).toBe('203.0.113.5')
    expect(await keyOf({ [CLIENT_IP_HEADER]: '203.0.113.5', [PROXY_SECRET_HEADER]: 'wrong' })).toBe('anon')
    expect(await keyOf({ [CLIENT_IP_HEADER]: '203.0.113.5' })).toBe('anon')
    expect(await keyOf({ [CLIENT_IP_HEADER]: 'unknown', [PROXY_SECRET_HEADER]: SECRET })).toBe('anon')
    expect(await keyOf({ [CLIENT_IP_HEADER]: '2001:db8:abcd:12::99', [PROXY_SECRET_HEADER]: SECRET })).toBe('2001:db8:abcd:12::/64')
  })

  it('without a server secret, falls back to TRUST_PROXY and X-Forwarded-For', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text(clientKey(c, { trustProxy: 1, proxySecret: null })))
    const response = await app.request('/', { headers: { 'x-forwarded-for': '198.51.100.4', [CLIENT_IP_HEADER]: '203.0.113.5', [PROXY_SECRET_HEADER]: SECRET } })
    expect(await response.text()).toBe('198.51.100.4')
  })
})
