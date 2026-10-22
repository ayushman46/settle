/**
 * The edge half of a split deployment: Cloudflare Pages serves the app, and a tiny Pages
 * Function (`functions/api/[[path]].ts`) hands every `/api/*` request to the Node server on
 * Render through `proxyToApi`. The browser only ever talks to the Pages origin, so the app stays
 * same-origin (its CSP allows `connect-src 'self'`), and the server still sees who is asking.
 *
 * Who is asking: Cloudflare puts the visitor's address in `CF-Connecting-IP` (a client can't
 * forge it). We pass it on as `X-Forwarded-For`, and — when `PROXY_SECRET` is set on both sides —
 * as `X-Settle-Client-IP` next to the shared secret, which the server trusts no matter how many
 * proxies sit in between (see `clientKey` in ratelimit.ts). Anything a client sends in those
 * headers itself is dropped.
 *
 * Plain Web APIs only (Request, Response, Headers, fetch): it runs on Cloudflare's runtime and
 * in Node's tests alike.
 */

/** Settings of the Pages project (Settings → Variables and Secrets). */
export interface EdgeProxyEnv {
  /** The Node server's address, e.g. `https://settle-api.onrender.com` (no path). */
  API_ORIGIN?: string
  /** The same value as the server's `PROXY_SECRET`: proves the client address header is ours. */
  PROXY_SECRET?: string
}

/** The visitor's address, as the edge saw it. Only trusted alongside a matching `PROXY_SECRET_HEADER`. */
export const CLIENT_IP_HEADER = 'x-settle-client-ip'
/** Carries `PROXY_SECRET` from the edge to the server. */
export const PROXY_SECRET_HEADER = 'x-settle-proxy-secret'
/** Set on every forwarded request, so a proxy pointed at itself stops after one hop. */
export const PROXIED_HEADER = 'x-settle-proxied'

/** Headers that describe one connection, never forwarded (RFC 9110 §7.6.1), plus the ones `fetch` sets itself. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

/**
 * Request headers a client could use to pose as someone else, or that only mean something to
 * Cloudflare. We set the trustworthy versions ourselves. Cookies: the API has none to read.
 */
const NOT_FROM_CLIENTS = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'true-client-ip',
  'cookie',
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  PROXIED_HEADER,
])

/** IPv4 / IPv6 only: CF-Connecting-IP is always one, but never forward anything else. */
const PLAUSIBLE_ADDRESS = /^[0-9a-f:.]{2,45}$/i

export const EDGE_MESSAGES = {
  notConfigured: "Settle's server isn't connected yet. Everything on this phone still works — try AI and Pro again later.",
  unreachable: "Couldn't reach Settle's server. Please try again in a minute.",
  loop: 'The API proxy is pointed at itself. Set API_ORIGIN to the Render address.',
} as const

/** `API_ORIGIN` as a URL origin (`https://host[:port]`), or null when it's missing or not a web address. */
export function apiOrigin(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (value === '') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username !== '' || url.password !== '') return null
    return url.origin
  } catch {
    return null
  }
}

/** A JSON error in the API's own shape (`ApiErrorBody`), so the app shows its usual message. */
function failure(status: number, code: 'not_configured' | 'upstream_error', message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** The headers to send upstream: the client's, minus spoofable and per-connection ones, plus ours. */
export function forwardHeaders(request: Request, env: EdgeProxyEnv): Headers {
  const headers = new Headers()
  for (const [name, value] of request.headers) {
    const key = name.toLowerCase()
    if (HOP_BY_HOP.has(key) || NOT_FROM_CLIENTS.has(key) || key.startsWith('cf-')) continue
    headers.append(name, value)
  }
  const url = new URL(request.url)
  const client = request.headers.get('cf-connecting-ip')?.trim() ?? ''
  if (PLAUSIBLE_ADDRESS.test(client)) {
    headers.set('X-Forwarded-For', client)
    const secret = env.PROXY_SECRET?.trim() ?? ''
    if (secret !== '') {
      headers.set(CLIENT_IP_HEADER, client)
      headers.set(PROXY_SECRET_HEADER, secret)
    }
  }
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''))
  headers.set('X-Forwarded-Host', url.host)
  headers.set(PROXIED_HEADER, '1')
  return headers
}

/** The upstream response for the browser: the same status and body (streamed), minus per-connection headers. */
function relay(upstream: Response): Response {
  const headers = new Headers()
  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers.append(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}

export interface ProxyOptions {
  /** Defaults to the global `fetch` (tests pass their own). */
  fetch?: typeof fetch
}

/**
 * Forwards one `/api/*` request to `API_ORIGIN` and streams the answer back. Bodies (photos of
 * up to 12 MB) are streamed both ways, never buffered. Never throws: an unreachable or unset
 * server becomes a JSON error the app already knows how to show.
 */
export async function proxyToApi(request: Request, env: EdgeProxyEnv, options: ProxyOptions = {}): Promise<Response> {
  const origin = apiOrigin(env.API_ORIGIN)
  if (origin === null) return failure(503, 'not_configured', EDGE_MESSAGES.notConfigured)

  const url = new URL(request.url)
  if (request.headers.has(PROXIED_HEADER) || origin === url.origin) return failure(508, 'upstream_error', EDGE_MESSAGES.loop)

  const target = new URL(`${url.pathname}${url.search}`, origin)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: forwardHeaders(request, env),
    body: hasBody ? request.body : null,
    redirect: 'manual',
    signal: request.signal,
  }
  // A streamed request body needs half-duplex in Node; Cloudflare accepts the flag too.
  if (hasBody) init.duplex = 'half'

  try {
    return relay(await (options.fetch ?? fetch)(target, init))
  } catch {
    return failure(502, 'upstream_error', EDGE_MESSAGES.unreachable)
  }
}
