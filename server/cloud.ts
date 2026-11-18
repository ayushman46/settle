/**
 * Settle accounts: `/api/cloud/*` passes requests to the `settle-api` Edge Function on Supabase
 * (supabase/functions/settle-api; pay requests and phone notifications go to its sibling,
 * settle-notify) and keeps the passkey session in an HttpOnly cookie on our own domain, so page
 * scripts never see it.
 *
 * The function answers a new session in `x-settle-session-set` (or `x-settle-session-clear`);
 * those headers become the cookie here and are never passed to the browser. State-changing
 * requests must come from our own page: a custom header no other site can send without a
 * preflight we never allow, plus Origin and Fetch-Metadata checks.
 */
import type { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Logger } from './http'
import { clientKey, type ProxyTrust } from './ratelimit'

export const CLOUD_SESSION_COOKIE = 'settle_session'
export const CLOUD_CSRF_HEADER = 'x-settle-csrf'
const COOKIE_PATH = '/api/cloud'
const SESSION_SECONDS = 30 * 86_400
const MAX_BODY_BYTES = 64 * 1024
/** A sync push carries a batch of expenses, itemized bills included. */
const MAX_SYNC_BYTES = 1_500_000
const UPSTREAM_TIMEOUT_MS = 20_000
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/
const METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE'])
/** Pay requests and phone notifications live in a sibling function, settle-notify. */
const NOTIFY_PATHS = /^\/(?:requests|push)(?:\/|$)/

/** settle-notify's URL next to settle-api's (null when settle-api is somewhere else). */
export function notifyUrl(apiUrl: string): string | null {
  return apiUrl.endsWith('/settle-api') ? `${apiUrl.slice(0, -'/settle-api'.length)}/settle-notify` : null
}

export interface CloudOptions {
  /** The Edge Function's URL, without a trailing slash; null turns accounts off. */
  url: string | null
  trust: ProxyTrust
  log: Logger
  fetchImpl?: typeof fetch
}

function problem(c: Context, status: 403 | 405 | 413 | 415 | 502 | 503, code: string, message: string): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({ error: { code, message } }, status)
}

/** The page's own origin as the browser names it (https behind Vercel's edge). */
function ownOrigin(c: Context): string {
  const host = c.req.header('host') ?? new URL(c.req.url).host
  const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim() || new URL(c.req.url).protocol.replace(':', '')
  return `${proto}://${host}`
}

function secure(c: Context): boolean {
  return ownOrigin(c).startsWith('https://')
}

export function registerCloud(app: Hono, { url, trust, log, fetchImpl = fetch }: CloudOptions): void {
  app.all('/api/cloud/*', async (c) => {
    if (url === null) return problem(c, 503, 'cloud_off', 'Settle accounts aren’t available on this server.')
    const method = c.req.method
    if (!METHODS.has(method)) return problem(c, 405, 'bad_request', 'That isn’t supported.')

    const origin = c.req.header('origin') ?? null
    if (method !== 'GET') {
      const site = c.req.header('sec-fetch-site')?.trim().toLowerCase()
      const sameHost = origin === null || (URL.canParse(origin) && new URL(origin).host === (c.req.header('host') ?? new URL(c.req.url).host))
      if (c.req.header(CLOUD_CSRF_HEADER) !== '1' || (site !== undefined && site !== 'same-origin' && site !== 'none') || !sameHost) {
        return problem(c, 403, 'forbidden', 'Requests from other sites are not allowed.')
      }
    }

    let body: string | undefined
    if (method === 'POST' || method === 'PATCH') {
      if (!/^application\/json\b/i.test(c.req.header('content-type')?.trim() ?? '')) return problem(c, 415, 'bad_request', 'Please send JSON.')
      body = await c.req.text()
      if (new TextEncoder().encode(body).length > (c.req.path === '/api/cloud/sync/push' ? MAX_SYNC_BYTES : MAX_BODY_BYTES)) return problem(c, 413, 'bad_request', 'That request is too big.')
    }

    const headers: Record<string, string> = {
      'x-settle-client-ip': clientKey(c, trust),
      'x-settle-origin': origin ?? ownOrigin(c),
      'user-agent': (c.req.header('user-agent') ?? '').slice(0, 200),
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const token = getCookie(c, CLOUD_SESSION_COOKIE)
    if (token && TOKEN.test(token)) headers['x-settle-session'] = token

    const search = new URL(c.req.url).search
    const sub = c.req.path.slice(COOKIE_PATH.length)
    const base = NOTIFY_PATHS.test(sub) ? (notifyUrl(url) ?? url) : url
    let upstream: Response
    try {
      upstream = await fetchImpl(`${base}${sub}${search}`, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
    } catch (err) {
      log.warn(`[cloud] upstream unreachable: ${err instanceof Error ? err.name : 'error'}`)
      return problem(c, 502, 'cloud_down', 'Couldn’t reach your Settle account. Check your connection and try again.')
    }

    const next = upstream.headers.get('x-settle-session-set')
    if (next && TOKEN.test(next)) {
      setCookie(c, CLOUD_SESSION_COOKIE, next, { path: COOKIE_PATH, httpOnly: true, secure: secure(c), sameSite: 'Lax', maxAge: SESSION_SECONDS })
    } else if (upstream.headers.get('x-settle-session-clear') === '1' && token) {
      deleteCookie(c, CLOUD_SESSION_COOKIE, { path: COOKIE_PATH, httpOnly: true, secure: secure(c), sameSite: 'Lax' })
    }
    c.header('Cache-Control', 'no-store')
    const text = await upstream.text()
    const status = upstream.status >= 200 && upstream.status < 600 ? upstream.status : 502
    return c.body(text, status as 200, { 'Content-Type': 'application/json; charset=utf-8' })
  })
}
