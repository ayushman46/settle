import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callApi, isOffline, isRecord, PRO_ALLOWANCE_MIN_WAIT_SECONDS, retryAfterSeconds, waitPhrase } from './http'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

/** A fetch that never answers but honours the abort signal, like a real hung request. */
function hang(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('callApi', () => {
  it('GETs without a body and returns the JSON', async () => {
    fetchMock.mockResolvedValue(json({ hello: 'world' }))
    await expect(callApi('/api/x', { timeoutMs: 1000 })).resolves.toEqual({ ok: true, status: 200, body: { hello: 'world' } })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/x')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    const headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('POSTs a JSON body with extra headers', async () => {
    fetchMock.mockResolvedValue(json({ ok: 1 }, 201))
    const result = await callApi('/api/y', { body: { a: 1 }, headers: { 'X-Settle-License': 'tok' }, timeoutMs: 1000 })
    expect(result).toEqual({ ok: true, status: 201, body: { ok: 1 } })
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ a: 1 })
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Settle-License')).toBe('tok')
  })

  it('reports error statuses with the body code and Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'rate_limited', message: 'x' } }, 429, { 'Retry-After': '120' }))
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toEqual({
      ok: false,
      kind: 'http',
      status: 429,
      code: 'rate_limited',
      retryAfter: 120,
    })
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }))
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toEqual({
      ok: false,
      kind: 'http',
      status: 502,
      code: null,
      retryAfter: null,
    })
    fetchMock.mockResolvedValueOnce(json({ error: 'flat string' }, 500))
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toMatchObject({ code: null })
  })

  it('calls a 2xx without JSON a bad body', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toEqual({ ok: false, kind: 'bad_body' })
  })

  it('maps a failed fetch to network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toEqual({ ok: false, kind: 'network' })
  })

  it("doesn't call out when offline or already cancelled", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(callApi('/api/z', { timeoutMs: 1000, signal: controller.signal })).resolves.toEqual({ ok: false, kind: 'aborted' })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(isOffline()).toBe(true)
    await expect(callApi('/api/z', { timeoutMs: 1000 })).resolves.toEqual({ ok: false, kind: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels with the caller signal', async () => {
    fetchMock.mockImplementation(hang)
    const controller = new AbortController()
    const promise = callApi('/api/z', { timeoutMs: 10_000, signal: controller.signal })
    controller.abort()
    await expect(promise).resolves.toEqual({ ok: false, kind: 'aborted' })
  })

  it('gives up at the deadline', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hang)
    const promise = callApi('/api/z', { timeoutMs: 5000 })
    await vi.advanceTimersByTimeAsync(4999)
    let settled = false
    void promise.then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ ok: false, kind: 'timeout' })
  })

  it('times out a body that never finishes arriving', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(async (_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'))
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body, { status: 200 })
    })
    const promise = callApi('/api/z', { timeoutMs: 3000 })
    await vi.advanceTimersByTimeAsync(3000)
    await expect(promise).resolves.toEqual({ ok: false, kind: 'timeout' })
  })

  it('cleans up its timer and abort listener', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    fetchMock.mockResolvedValue(json({}))
    await callApi('/api/z', { timeoutMs: 1000, signal: controller.signal })
    expect(clear).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})

describe('retryAfterSeconds', () => {
  const withHeader = (value: string) => new Response(null, { status: 429, headers: { 'Retry-After': value } })

  it('reads delta-seconds and HTTP dates, ignores junk', () => {
    const now = Date.UTC(2026, 9, 21, 12, 0, 0)
    expect(retryAfterSeconds(withHeader('30'), now)).toBe(30)
    expect(retryAfterSeconds(withHeader(new Date(now + 90_000).toUTCString()), now)).toBe(90)
    expect(retryAfterSeconds(withHeader(new Date(now - 90_000).toUTCString()), now)).toBe(0)
    expect(retryAfterSeconds(withHeader('soon'), now)).toBeNull()
    expect(retryAfterSeconds(new Response(null, { status: 429 }), now)).toBeNull()
  })
})

describe('waitPhrase', () => {
  it('names the wait in minutes, then hours, always rounding up', () => {
    expect(waitPhrase(0)).toBe('about a minute')
    expect(waitPhrase(60)).toBe('about a minute')
    expect(waitPhrase(61)).toBe('about 2 minutes')
    expect(waitPhrase(600)).toBe('about 10 minutes')
    expect(waitPhrase(89 * 60)).toBe('about 89 minutes')
    expect(waitPhrase(90 * 60)).toBe('about 2 hours')
    expect(waitPhrase(6 * 3600 - 1)).toBe('about 6 hours')
    expect(waitPhrase(86_400)).toBe('about 24 hours')
  })

  it('leaves room for every non-Pro limit below the fair-use threshold', () => {
    // The free per-device window (10 minutes by default) never reads as the Pro allowance.
    expect(PRO_ALLOWANCE_MIN_WAIT_SECONDS).toBe(600)
  })
})

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })
})
