import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LICENSE_HEADER, SCAN_BUDGET_MS } from '../../shared/api'
import { createTestSigner, installLicense, resetProModulesForTests, type TestSigner } from '../pro/testKit'
import {
  getHealth,
  OFFLINE_MESSAGE,
  parseScanResponse,
  rateLimitedMessage,
  SCAN_ERROR_MESSAGES,
  SCAN_TIMEOUT_MS,
  scanBill,
  ScanError,
  SCANS_BUSY_MESSAGE,
} from './client'
import { SAMPLE_SCAN } from './sample'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let signer: TestSigner

beforeAll(async () => {
  signer = await createTestSigner()
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  resetProModulesForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function scanError(promise: Promise<unknown>): Promise<ScanError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ScanError) return error
    throw error
  }
  throw new Error('expected a ScanError')
}

describe('scanBill', () => {
  it('posts the image and returns the parsed scan', async () => {
    fetchMock.mockResolvedValue(json(SAMPLE_SCAN))
    const result = await scanBill('data:image/jpeg;base64,AAAA')
    expect(result).toEqual(SAMPLE_SCAN)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/scan')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ image: 'data:image/jpeg;base64,AAAA' })
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('sends the Pro license along while it is active', async () => {
    installLicense(await signer.token(), signer.publicKey)
    fetchMock.mockResolvedValue(json(SAMPLE_SCAN))
    await scanBill('data:image/jpeg;base64,AAAA')
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get(LICENSE_HEADER)).toMatch(/^SETTLE1\./)
  })

  it('sends no license without Pro, or once the pass has run out', async () => {
    fetchMock.mockImplementation(async () => json(SAMPLE_SCAN))
    await scanBill('data:x')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has(LICENSE_HEADER)).toBe(false)

    installLicense(await signer.token({ iat: 1000, exp: 2000 }), signer.publicKey)
    await scanBill('data:x')
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has(LICENSE_HEADER)).toBe(false)
  })

  it('maps API errors to ScanError with our own copy, never the server message', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'not_a_bill', message: 'Not a bill, sorry.' } }, 422))
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('not_a_bill')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.not_a_bill)
  })

  it('keeps operator hints from an older server away from diners', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'not_configured', message: "Check NVIDIA_API_KEY in the server's .env" } }, 503),
    )
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('not_configured')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.not_configured)
    for (const message of Object.values(SCAN_ERROR_MESSAGES)) {
      expect(message).not.toMatch(/NVIDIA_API_KEY|\.env|API key|server/i)
    }
  })

  it('uses the catalog copy for rate_limited without a Retry-After', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'rate_limited' } }, 429))
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('rate_limited')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.rate_limited)
  })

  it.each([
    ['10', SCANS_BUSY_MESSAGE],
    ['59', SCANS_BUSY_MESSAGE],
    ['60', 'Too many scans. Try again in about a minute — or type the items in.'],
    ['600', 'Too many scans. Try again in about 10 minutes — or type the items in.'],
    ['541', 'Too many scans. Try again in about 10 minutes — or type the items in.'],
  ])('words rate_limited by its Retry-After (%s s)', async (retryAfter, message) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'server copy' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
      }),
    )
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('rate_limited')
    expect(error.message).toBe(message)
  })

  it('reads an HTTP-date Retry-After and ignores a garbled one', async () => {
    const limited = (retryAfter: string) =>
      new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
      })
    fetchMock.mockResolvedValueOnce(limited(new Date(Date.now() + 5 * 60_000).toUTCString()))
    expect((await scanError(scanBill('data:x'))).message).toBe(
      'Too many scans. Try again in about 5 minutes — or type the items in.',
    )
    fetchMock.mockResolvedValueOnce(limited('soon'))
    expect((await scanError(scanBill('data:x'))).message).toBe(SCAN_ERROR_MESSAGES.rate_limited)

    expect(rateLimitedMessage(null)).toBe(SCAN_ERROR_MESSAGES.rate_limited)
    expect(rateLimitedMessage(0)).toBe(SCANS_BUSY_MESSAGE)
    expect(rateLimitedMessage(61)).toBe('Too many scans. Try again in about 2 minutes — or type the items in.')
  })

  it('words a long wait in hours', () => {
    expect(rateLimitedMessage(3 * 3600)).toBe('Too many scans. Try again in about 3 hours — or type the items in.')
  })

  it("tells Pro when the day's fair-use allowance is used up", async () => {
    installLicense(await signer.token(), signer.publicKey)
    const limited = (retryAfter: string) =>
      new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
      })
    fetchMock.mockResolvedValueOnce(limited(String(5 * 3600 + 120)))
    expect((await scanError(scanBill('data:x'))).message).toBe(
      "You've reached today's fair-use AI limit. It resets in about 6 hours — you can still type the items in.",
    )
    // A short wait is still just busy, Pro or not.
    fetchMock.mockResolvedValueOnce(limited('10'))
    expect((await scanError(scanBill('data:x'))).message).toBe(SCANS_BUSY_MESSAGE)
    fetchMock.mockResolvedValueOnce(limited('300'))
    expect((await scanError(scanBill('data:x'))).message).toBe('Too many scans. Try again in about 5 minutes — or type the items in.')
  })

  it("never calls a free scan's wait the Pro allowance", () => {
    expect(rateLimitedMessage(5 * 3600, false)).toBe('Too many scans. Try again in about 5 hours — or type the items in.')
    expect(rateLimitedMessage(5 * 3600, true)).toMatch(/^You've reached today's fair-use AI limit/)
  })

  it('waits longer than the server spends on one scan', () => {
    expect(SCAN_TIMEOUT_MS).toBe(SCAN_BUDGET_MS + 10_000)
  })

  it.each([
    [413, 'image_too_large'],
    [415, 'unsupported_image'],
    [429, 'rate_limited'],
    [503, 'not_configured'],
    [504, 'timeout'],
    [400, 'bad_request'],
    [500, 'upstream_error'],
    [502, 'upstream_error'],
  ] as const)('maps a malformed %i error body to %s', async (status, code) => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status }))
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe(code)
    expect(error.message).toBe(SCAN_ERROR_MESSAGES[code])
  })

  it('ignores unknown error codes from the server', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'kaboom', message: 'Stack trace…' } }, 500))
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('upstream_error')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.upstream_error)
  })

  it("treats other endpoints' codes as unknown for scans", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'not_a_split' } }, 422))
    expect((await scanError(scanBill('data:x'))).code).toBe('upstream_error')
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'billing_unavailable' } }, 503))
    expect((await scanError(scanBill('data:x'))).code).toBe('not_configured')
  })

  it('treats a malformed success body as upstream_error', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))
    expect((await scanError(scanBill('data:x'))).code).toBe('upstream_error')
    fetchMock.mockResolvedValue(json({ items: 'nope' }))
    expect((await scanError(scanBill('data:x'))).code).toBe('upstream_error')
  })

  it('maps network failures to network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('network')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.network)
  })

  it("doesn't even try when the browser is offline", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const error = await scanError(scanBill('data:x'))
    expect(error.code).toBe('network')
    expect(error.message).toBe(OFFLINE_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels with the caller signal', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const controller = new AbortController()
    const promise = scanBill('data:x', controller.signal)
    controller.abort()
    expect((await scanError(promise)).code).toBe('aborted')
  })

  it('rejects immediately when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect((await scanError(scanBill('data:x', controller.signal))).code).toBe('aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('times out after SCAN_TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const promise = scanError(scanBill('data:x'))
    await vi.advanceTimersByTimeAsync(SCAN_TIMEOUT_MS)
    const error = await promise
    expect(error.code).toBe('timeout')
    expect(error.message).toBe(SCAN_ERROR_MESSAGES.timeout)
  })
})

describe('parseScanResponse', () => {
  it('tolerates missing optional fields and drops bad items', () => {
    const parsed = parseScanResponse({
      items: [{ name: 'Tea', amount: 20 }, { name: 'Bad', amount: 'x' }, null, { amount: 5 }, { name: 'Two', quantity: -1, amount: 3 }],
      currency: 'INR',
      total: Number.NaN,
      warnings: ['ok', 5],
    })
    expect(parsed).toEqual({
      merchant: null,
      date: null,
      currency: 'INR',
      category: null,
      items: [
        { name: 'Tea', quantity: 1, amount: 20 },
        { name: 'Two', quantity: 1, amount: 3 },
      ],
      subtotal: null,
      tax: null,
      serviceCharge: null,
      discount: null,
      tip: null,
      total: null,
      warnings: ['ok'],
      model: 'unknown',
    })
  })

  it('keeps a known category and drops anything else', () => {
    expect(parseScanResponse({ items: [], total: 1840, category: 'utilities' })?.category).toBe('utilities')
    expect(parseScanResponse({ items: [], category: 'Utilities' })?.category).toBeNull()
    expect(parseScanResponse({ items: [], category: 7 })?.category).toBeNull()
  })

  it('accepts a service bill with no items but a total', () => {
    expect(parseScanResponse({ merchant: 'BESCOM', items: [], total: 1840.5, category: 'utilities' })).toMatchObject({
      merchant: 'BESCOM',
      items: [],
      total: 1840.5,
      category: 'utilities',
    })
  })

  it('rejects non-scans', () => {
    expect(parseScanResponse(null)).toBeNull()
    expect(parseScanResponse([])).toBeNull()
    expect(parseScanResponse({})).toBeNull()
  })
})

describe('getHealth', () => {
  it('returns the health response', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, configured: true, models: ['m1', 2] }))
    await expect(getHealth()).resolves.toEqual({ ok: true, configured: true, models: ['m1'] })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health')
  })

  it('returns null on any failure', async () => {
    fetchMock.mockResolvedValue(json({ error: {} }, 500))
    await expect(getHealth()).resolves.toBeNull()
    fetchMock.mockResolvedValue(json({ ok: false }))
    await expect(getHealth()).resolves.toBeNull()
    fetchMock.mockResolvedValue(new Response('nope'))
    await expect(getHealth()).resolves.toBeNull()
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(getHealth()).resolves.toBeNull()
  })
})
