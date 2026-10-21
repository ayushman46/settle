/**
 * One JSON round trip to our own API, with a deadline and the caller's abort signal.
 * Never throws: every outcome is a value, so each caller (scan, describe, billing, licences)
 * maps failures onto its own friendly copy instead of leaking transport details.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True only when the browser is sure it has no connection. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/** `Retry-After` in seconds (delta-seconds or an HTTP date), or null when absent or unreadable. */
export function retryAfterSeconds(response: Response, now: number = Date.now()): number | null {
  const raw = response.headers.get('Retry-After')?.trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw)
  const at = Date.parse(raw)
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 1000)) : null
}

export type CallFailureKind = 'timeout' | 'aborted' | 'network' | 'bad_body'

export type CallResult =
  | { ok: true; status: number; body: unknown }
  /** The server answered with an error status. `code` is `error.code` from the body when present. */
  | { ok: false; kind: 'http'; status: number; code: string | null; retryAfter: number | null }
  /**
   * timeout: our deadline passed · aborted: the caller cancelled · network: no answer at all
   * (offline, DNS, CORS…) · bad_body: a 2xx whose body isn't JSON.
   */
  | { ok: false; kind: CallFailureKind }

export interface CallOptions {
  method?: 'GET' | 'POST'
  /** JSON-encoded as the request body when present. */
  body?: unknown
  headers?: Readonly<Record<string, string>>
  /** Gives up after this long (covers the response body too). */
  timeoutMs: number
  signal?: AbortSignal
}

async function errorCode(response: Response): Promise<string | null> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return null
  }
  const error = isRecord(body) ? body.error : undefined
  return isRecord(error) && typeof error.code === 'string' ? error.code : null
}

/**
 * Calls `url` and reads its JSON. Doesn't touch the network when the caller has already
 * cancelled or the browser knows it's offline.
 */
export async function callApi(url: string, opts: CallOptions): Promise<CallResult> {
  const { signal } = opts
  if (signal?.aborted) return { ok: false, kind: 'aborted' }
  if (isOffline()) return { ok: false, kind: 'network' }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, opts.timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  const failure = (error: unknown, otherwise: CallFailureKind): CallResult => {
    if (timedOut) return { ok: false, kind: 'timeout' }
    if (signal?.aborted || isAbortError(error)) return { ok: false, kind: 'aborted' }
    return { ok: false, kind: otherwise }
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await fetch(url, {
        method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
        headers,
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        signal: controller.signal,
      })
    } catch (error) {
      return failure(error, 'network')
    }

    if (!response.ok) {
      const code = await errorCode(response)
      return { ok: false, kind: 'http', status: response.status, code, retryAfter: retryAfterSeconds(response) }
    }

    try {
      return { ok: true, status: response.status, body: (await response.json()) as unknown }
    } catch (error) {
      return failure(error, 'bad_body')
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
