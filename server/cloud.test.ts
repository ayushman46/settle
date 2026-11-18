import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import { CLOUD_SESSION_COOKIE } from './cloud'
import { testConfig } from './testing'

const TOKEN = 'a'.repeat(43)
const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined }

function setup(reply: (url: string, init: RequestInit) => Response | Promise<Response>, cloudUrl: string | null = 'https://cloud.test/fn') {
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => reply(String(input), init ?? {}))
  const app = createApp(testConfig({ cloudUrl }), { fetchImpl: fetchImpl as unknown as typeof fetch, logger: quiet })
  return { app, fetchImpl }
}

const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-settle-csrf': '1', origin: 'http://localhost', ...headers },
  body: JSON.stringify(body),
})

describe('/api/cloud', () => {
  it('passes a request on with the page origin and keeps a new session in an HttpOnly cookie only', async () => {
    const { app, fetchImpl } = setup(() => json({ me: { id: 'u1' } }, { 'x-settle-session-set': TOKEN }))
    const res = await app.request('http://localhost/api/cloud/auth/login/verify?x=1', post({ challengeId: 'c' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ me: { id: 'u1' } })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe('https://cloud.test/fn/auth/login/verify?x=1')
    const sent = init!.headers as Record<string, string>
    expect(sent['x-settle-origin']).toBe('http://localhost')
    expect(sent['x-settle-client-ip']).toBeTruthy()
    expect(sent['x-settle-session']).toBeUndefined()
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${CLOUD_SESSION_COOKIE}=${TOKEN}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/api/cloud')
    expect(cookie).toContain('SameSite=Lax')
    expect(res.headers.get('x-settle-session-set')).toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('sends pay requests and notification sign-ups to settle-notify, next to settle-api', async () => {
    const { app, fetchImpl } = setup(() => json({ requests: [] }), 'https://x.supabase.co/functions/v1/settle-api')
    const cookie = { cookie: `${CLOUD_SESSION_COOKIE}=${TOKEN}` }
    await app.request('http://localhost/api/cloud/requests', { headers: cookie })
    await app.request('http://localhost/api/cloud/push/subscribe', post({ endpoint: 'https://push.test/1' }, cookie))
    await app.request('http://localhost/api/cloud/requestsx', { headers: cookie })
    await app.request('http://localhost/api/cloud/me', { headers: cookie })
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://x.supabase.co/functions/v1/settle-notify/requests',
      'https://x.supabase.co/functions/v1/settle-notify/push/subscribe',
      'https://x.supabase.co/functions/v1/settle-api/requestsx',
      'https://x.supabase.co/functions/v1/settle-api/me',
    ])
    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['x-settle-session']).toBe(TOKEN)
  })

  it('sends the cookie on as the session header, and clears it when the account says so', async () => {
    const { app, fetchImpl } = setup(() => json({ error: { code: 'unauthenticated' } }, { 'x-settle-session-clear': '1' }, 401))
    const res = await app.request('http://localhost/api/cloud/me', { headers: { cookie: `${CLOUD_SESSION_COOKIE}=${TOKEN}` } })
    expect(res.status).toBe(401)
    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['x-settle-session']).toBe(TOKEN)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${CLOUD_SESSION_COOKIE}=;.*Max-Age=0`))
  })

  it('ignores a cookie that isn’t shaped like a session token', async () => {
    const { app, fetchImpl } = setup(() => json({}))
    await app.request('http://localhost/api/cloud/me', { headers: { cookie: `${CLOUD_SESSION_COOKIE}=../../etc` } })
    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['x-settle-session']).toBeUndefined()
  })

  it('refuses changes without the page’s own header, from another site, or that aren’t JSON', async () => {
    const { app, fetchImpl } = setup(() => json({}))
    const noHeader = await app.request('http://localhost/api/cloud/groups', { ...post({}), headers: { 'content-type': 'application/json', origin: 'http://localhost' } })
    expect(noHeader.status).toBe(403)
    const otherSite = await app.request('http://localhost/api/cloud/groups', post({}, { origin: 'https://evil.example' }))
    expect(otherSite.status).toBe(403)
    const crossSite = await app.request('http://localhost/api/cloud/groups', post({}, { 'sec-fetch-site': 'cross-site' }))
    expect(crossSite.status).toBe(403)
    const notJson = await app.request('http://localhost/api/cloud/groups', post({}, { 'content-type': 'text/plain' }))
    expect(notJson.status).toBe(415)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('says so when the account service is off or unreachable', async () => {
    const off = setup(() => json({}), null)
    expect((await off.app.request('http://localhost/api/cloud/me')).status).toBe(503)
    const down = setup(() => {
      throw new TypeError('fetch failed')
    })
    const res = await down.app.request('http://localhost/api/cloud/me')
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('cloud_down')
  })
})
