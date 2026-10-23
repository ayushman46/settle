import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody, ApiErrorCode, DescribeResponse, HealthResponse, ScanResponse } from '../shared/api'
import { API_LIMITS, LICENSE_HEADER } from '../shared/api'
import { createApp, DESCRIBE_MESSAGES, ERROR_MESSAGES, loadConfig, type AppOptions } from './app'
import type { ServerConfig } from './config'
import { REQUEST_MESSAGES } from './describe'
import { NO_LICENSE_KEYS, signLicense } from './license'
import { forgetPromptOnlyModels } from './nvidia'
import {
  BILL,
  chatResponse,
  errorResponse,
  fromSocket,
  GIF_BYTES_AS_PNG,
  hangingFetch,
  JPEG_DATA_URL,
  OTHER_LICENSE_KEYS,
  PNG_DATA_URL,
  sentBody,
  silentLogger,
  TEST_KEY,
  TEST_LICENSE_KEYS,
  testConfig,
} from './testing'

const fetchMock = vi.fn<typeof fetch>()
let logger = silentLogger()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  logger = silentLogger()
  forgetPromptOnlyModels()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeApp(overrides: Partial<ServerConfig> = {}, options: AppOptions = {}) {
  return createApp(testConfig(overrides), { logger, ...options })
}

function postScan(app: ReturnType<typeof createApp>, body: unknown, headers: Record<string, string> = {}, socket = '198.51.100.1') {
  return app.request(
    '/api/scan',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    fromSocket(socket),
  )
}

async function expectError(response: Response, status: number, code: ApiErrorCode) {
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  const body = (await response.json()) as ApiErrorBody
  expect(body.error.code).toBe(code)
  expect(typeof body.error.message).toBe('string')
  expect(body.error.message.length).toBeGreaterThan(0)
  return body
}

function allLogs(): string {
  return [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls].flat().join('\n')
}

describe('error copy', () => {
  it('never shows diners operator hints (env vars, keys, files)', () => {
    for (const message of [...Object.values(ERROR_MESSAGES), ...Object.values(DESCRIBE_MESSAGES)]) {
      expect(message).not.toMatch(/NVIDIA_API_KEY|\.env\b|API key|server/i)
    }
    expect(ERROR_MESSAGES.not_configured).toBe("Photo scanning isn't available right now — you can type the items in.")
    expect(ERROR_MESSAGES.upstream_auth).toBe("Photo scanning isn't working right now — you can type the items in.")
    expect(ERROR_MESSAGES.rate_limited).toBe('Too many scans right now. Try again in a few minutes — or type the items in.')
  })
})

describe('module shape (used by vite.config.ts)', () => {
  it('exports loadConfig and createApp', () => {
    const app = createApp(loadConfig({}))
    expect(typeof app.fetch).toBe('function')
  })
})

describe('GET /api/health', () => {
  it('reports configured: true with the model list', async () => {
    const response = await makeApp().request('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()) as HealthResponse).toEqual({ ok: true, configured: true, models: ['nvidia/nemotron-test-vl', 'google/gemma-test'] })
  })

  it('reports configured: false without a key and never leaks the key', async () => {
    expect(await (await makeApp({ apiKey: null }).request('/api/health')).json()).toEqual({
      ok: true,
      configured: false,
      models: ['nvidia/nemotron-test-vl', 'google/gemma-test'],
    })
    expect(await (await makeApp().request('/api/health')).text()).not.toContain(TEST_KEY)
  })

  it('answers HEAD', async () => {
    expect((await makeApp().request('/api/health', { method: 'HEAD' })).status).toBe(200)
  })
})

describe('POST /api/scan — happy path', () => {
  it('reads the bill with NVIDIA and returns a clean ScanResponse', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()) as ScanResponse).toEqual({
      merchant: 'Saffron Table',
      date: '2026-10-18',
      currency: 'INR',
      category: null,
      items: [
        { name: 'Paneer Tikka', quantity: 1, amount: 345 },
        { name: 'Garlic Naan', quantity: 4, amount: 300 },
      ],
      subtotal: 645,
      tax: 32.25,
      serviceCharge: null,
      fees: [],
      discount: null,
      tip: null,
      total: 677,
      warnings: [],
      model: 'nvidia/nemotron-test-vl',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://nvidia.test/v1/chat/completions')
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TEST_KEY}` })
    const body = sentBody(fetchMock)
    expect(body).toMatchObject({
      model: 'nvidia/nemotron-test-vl',
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
      response_format: { type: 'json_schema', json_schema: { name: 'bill', strict: true } },
      chat_template_kwargs: { enable_thinking: false },
    })
    const messages = body.messages as Array<{ role: string; content: unknown }>
    expect(messages[0]?.role).toBe('system')
    expect(messages[1]?.content).toEqual([expect.objectContaining({ type: 'text' }), { type: 'image_url', image_url: { url: JPEG_DATA_URL } }])
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[scan] ok'))
  })

  it('sends PNG photos too', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    expect((await postScan(makeApp(), { image: PNG_DATA_URL })).status).toBe(200)
  })

  it('omits chat_template_kwargs for non-Nemotron models', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    await postScan(makeApp({ models: ['meta/llama-3.2-90b-vision-instruct'] }), { image: JPEG_DATA_URL })
    expect(sentBody(fetchMock)).not.toHaveProperty('chat_template_kwargs')
  })

  it('falls back to the next model on 404', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404, 'Function not found for account')).mockResolvedValueOnce(chatResponse(BILL))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect(((await response.json()) as ScanResponse).model).toBe('google/gemma-test')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 404'))
  })

  it('retries without response_format when the model rejects it', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, "Unsupported parameter: 'response_format'")).mockResolvedValueOnce(chatResponse(BILL))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect(((await response.json()) as ScanResponse).model).toBe('nvidia/nemotron-test-vl')
    expect(sentBody(fetchMock, 1)).not.toHaveProperty('response_format')
  })

  it('tries another model when the first finds no items', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ ...BILL, items: [] })).mockResolvedValueOnce(chatResponse(BILL))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect(((await response.json()) as ScanResponse).items).toHaveLength(2)
  })
})

describe('POST /api/scan — upstream failures', () => {
  it('maps 401 to upstream_auth without trying other models, and keeps the key out of logs', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, `Invalid API key ${TEST_KEY}`))
    const body = await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 502, 'upstream_auth')
    expect(body.error.message).toBe(ERROR_MESSAGES.upstream_auth)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalled()
    expect(allLogs()).not.toContain(TEST_KEY)
  })

  it('reports scanning as off on /api/health for 10 minutes after NVIDIA rejects the key', async () => {
    let time = 1_000_000
    const app = makeApp({}, { now: () => time })
    const configured = async () => ((await (await app.request('/api/health')).json()) as HealthResponse).configured
    expect(await configured()).toBe(true)

    fetchMock.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
    await expectError(await postScan(app, { image: JPEG_DATA_URL }), 502, 'upstream_auth')
    expect(await configured()).toBe(false)
    time += 9 * 60_000
    expect(await configured()).toBe(false)
    time += 60_000
    expect(await configured()).toBe(true)

    // A scan that works clears it straight away.
    fetchMock.mockResolvedValueOnce(errorResponse(403, 'Forbidden')).mockResolvedValueOnce(chatResponse(BILL))
    await postScan(app, { image: JPEG_DATA_URL })
    expect(await configured()).toBe(false)
    expect((await postScan(app, { image: JPEG_DATA_URL })).status).toBe(200)
    expect(await configured()).toBe(true)
  })

  it('maps 403 to upstream_auth', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'Forbidden'))
    await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 502, 'upstream_auth')
  })

  it('maps NVIDIA 429 to rate_limited with Retry-After', async () => {
    fetchMock.mockResolvedValue(errorResponse(429, 'Too Many Requests', { 'retry-after': '30' }))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    await expectError(response, 429, 'rate_limited')
    expect(response.headers.get('retry-after')).toBe('30')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps a timeout to 504 timeout', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const body = await expectError(await postScan(makeApp({ timeoutMs: 25 }), { image: JPEG_DATA_URL }), 504, 'timeout')
    expect(body.error.message).toBe(ERROR_MESSAGES.timeout)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps network failures and 5xx everywhere to upstream_error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(errorResponse(503, 'unavailable'))
    await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 502, 'upstream_error')
  })

  it('maps replies without JSON from every model to unreadable', async () => {
    fetchMock.mockResolvedValue(chatResponse('Sorry, I cannot help with that.'))
    await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 422, 'unreadable')
  })

  it("never logs what a malformed reply said (it can echo someone's bill or sentence)", async () => {
    fetchMock.mockResolvedValue(chatResponse('Riya Sharma owes 840 for the cab to 221B Baker Street'))
    await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 422, 'unreadable')
    await expectError(await postDescribe(makeApp(), { text: 'Cab 840 with Riya Sharma' }), 422, 'unreadable')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('the reply itself is not logged'))
    expect(allLogs()).not.toMatch(/Riya|Sharma|Baker/)
  })

  it('answers not_a_bill when the model says so', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ isBill: false, merchant: null, items: [], total: null }))
    const body = await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 422, 'not_a_bill')
    expect(body.error.message).toBe(ERROR_MESSAGES.not_a_bill)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers unreadable when no model finds usable items', async () => {
    fetchMock.mockResolvedValue(chatResponse({ isBill: true, items: [{ name: 'Something' }], total: null }))
    const body = await expectError(await postScan(makeApp(), { image: JPEG_DATA_URL }), 422, 'unreadable')
    expect(body.error.message).toBe(ERROR_MESSAGES.unreadable)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/scan — request validation', () => {
  it.each([
    ['malformed JSON', '{"image": '],
    ['an empty body', ''],
    ['a missing image', {}],
    ['a non-string image', { image: 42 }],
    ['an empty image', { image: '' }],
    ['a JSON array', [JPEG_DATA_URL]],
  ])('rejects %s with 400 bad_request', async (_label, body) => {
    await expectError(await postScan(makeApp(), body), 400, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a URL', { image: 'https://example.com/bill.jpg' }],
    ['a GIF', { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }],
    ['wrong magic bytes', { image: GIF_BYTES_AS_PNG }],
    ['corrupt base64', { image: 'data:image/jpeg;base64,/9j/*4AAQ' }],
  ])('rejects %s with 415 unsupported_image', async (_label, body) => {
    const response = await expectError(await postScan(makeApp(), body), 415, 'unsupported_image')
    expect(response.error.message).toBe('Please use a JPG or PNG photo.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a body over the limit with 413 image_too_large', async () => {
    const huge = `data:image/jpeg;base64,/9j/${'A'.repeat(API_LIMITS.maxBodyBytes)}`
    await expectError(await postScan(makeApp(), { image: huge }), 413, 'image_too_large')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a decoded image over the limit with 413 even when the body fits', async () => {
    const bytes = Buffer.alloc(API_LIMITS.maxImageBytes + 3, 0)
    bytes.set([0xff, 0xd8, 0xff])
    const image = `data:image/jpeg;base64,${bytes.toString('base64')}`
    expect(image.length).toBeLessThan(API_LIMITS.maxBodyBytes)
    await expectError(await postScan(makeApp(), { image }), 413, 'image_too_large')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 not_configured when there is no key (after validating the photo)', async () => {
    const app = makeApp({ apiKey: null })
    await expectError(await postScan(app, { image: 'nope' }), 415, 'unsupported_image')
    const body = await expectError(await postScan(app, { image: JPEG_DATA_URL }), 503, 'not_configured')
    expect(body.error.message).toBe(ERROR_MESSAGES.not_configured)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/scan — rate limiting', () => {
  it('allows `max` scans per window per client, then 429 rate_limited', async () => {
    let time = 0
    const app = makeApp({ rateLimit: { max: 2, windowMs: 60_000 } }, { now: () => time })
    expect((await postScan(app, {}, {}, '203.0.113.9')).status).toBe(400)
    expect((await postScan(app, {}, {}, '203.0.113.9')).status).toBe(400)

    const limited = await postScan(app, {}, {}, '203.0.113.9')
    const body = await expectError(limited, 429, 'rate_limited')
    expect(body.error.message).toBe(ERROR_MESSAGES.rate_limited)
    expect(limited.headers.get('retry-after')).toBe('60')

    expect((await postScan(app, {}, {}, '203.0.113.10')).status).toBe(400)
    time += 60_000
    expect((await postScan(app, {}, {}, '203.0.113.9')).status).toBe(400)
  })

  it('ignores X-Forwarded-For by default, so a client cannot dodge the limit by faking it', async () => {
    const app = makeApp({ rateLimit: { max: 3, windowMs: 60_000 } })
    const statuses: number[] = []
    for (let i = 1; i <= 5; i++) statuses.push((await postScan(app, {}, { 'x-forwarded-for': `10.0.0.${i}` }, '203.0.113.9')).status)
    expect(statuses).toEqual([400, 400, 400, 429, 429])
  })

  it('with TRUST_PROXY=1, keys on the address our proxy appended, not the ones the client sent', async () => {
    const app = makeApp({ rateLimit: { max: 3, windowMs: 60_000 }, trustProxy: 1 })
    const statuses: number[] = []
    for (let i = 1; i <= 5; i++) {
      statuses.push((await postScan(app, {}, { 'x-forwarded-for': `203.0.113.${i}, 10.0.0.1` }, '10.9.9.9')).status)
    }
    expect(statuses).toEqual([400, 400, 400, 429, 429])
    // Another client behind the same proxy has its own allowance.
    expect((await postScan(app, {}, { 'x-forwarded-for': '10.0.0.2' }, '10.9.9.9')).status).toBe(400)
  })

  it('tells the operator once when requests come through a proxy it does not trust', async () => {
    const app = makeApp()
    await postScan(app, {}, { 'x-forwarded-for': '203.0.113.1' })
    await postScan(app, {}, { 'x-forwarded-for': '203.0.113.2' })
    const warnings = logger.warn.mock.calls.flat().filter((message) => message.includes('TRUST_PROXY'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Set TRUST_PROXY=1 when running behind one proxy')

    logger = silentLogger()
    await postScan(makeApp({ trustProxy: 1 }), {}, { 'x-forwarded-for': '203.0.113.1' })
    await postScan(makeApp(), {})
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('does not rate-limit health checks', async () => {
    const app = makeApp({ rateLimit: { max: 1, windowMs: 60_000 } })
    for (let i = 0; i < 3; i++) expect((await app.request('/api/health')).status).toBe(200)
  })
})

describe('POST /api/scan — only our own page may scan', () => {
  it('rejects bodies that are not JSON with 415, before they count toward the limit', async () => {
    const app = makeApp({ rateLimit: { max: 1, windowMs: 60_000 } })
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonp']) {
      await expectError(await postScan(app, { image: JPEG_DATA_URL }, { 'content-type': type }), 415, 'bad_request')
    }
    const untyped = await app.request('/api/scan', { method: 'POST', body: new Blob([JSON.stringify({ image: JPEG_DATA_URL })]) })
    await expectError(untyped, 415, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()

    // The one scan this window allows is still there...
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    expect((await postScan(app, { image: JPEG_DATA_URL }, { 'content-type': 'application/json; charset=utf-8' })).status).toBe(200)
    // ...and now it's used up.
    await expectError(await postScan(app, { image: JPEG_DATA_URL }), 429, 'rate_limited')
  })

  it('rejects cross-site requests with 403, and allows same-origin, same-site and direct ones', async () => {
    const app = makeApp({ rateLimit: { max: 1, windowMs: 60_000 } })
    await expectError(await postScan(app, { image: JPEG_DATA_URL }, { 'sec-fetch-site': 'cross-site' }), 403, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockImplementation(async () => chatResponse(BILL))
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect((await postScan(makeApp(), { image: JPEG_DATA_URL }, { 'sec-fetch-site': site })).status).toBe(200)
    }
    // The rejected request didn't use up the allowance.
    expect((await postScan(app, { image: JPEG_DATA_URL })).status).toBe(200)
  })
})

describe('POST /api/scan — scans in flight', () => {
  it('answers 429 straight away when every slot is busy, and frees the slot when a scan ends', async () => {
    let finish: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)))
    const app = makeApp({ maxConcurrentScans: 1 })

    const first = postScan(app, { image: JPEG_DATA_URL })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const busy = await postScan(app, { image: JPEG_DATA_URL }, {}, '198.51.100.2')
    const body = await expectError(busy, 429, 'rate_limited')
    expect(body.error.message).toBe('Lots of bills are being read right now — try again in a moment.')
    expect(Number(busy.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    finish(chatResponse(BILL))
    expect((await first).status).toBe(200)
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    expect((await postScan(app, { image: JPEG_DATA_URL }, {}, '198.51.100.2')).status).toBe(200)
  })

  it('frees the slot after a failed scan too', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'down'))
    const app = makeApp({ maxConcurrentScans: 1 })
    await expectError(await postScan(app, { image: JPEG_DATA_URL }), 502, 'upstream_error')
    await expectError(await postScan(app, { image: 'nope' }), 415, 'unsupported_image')
    await expectError(await postScan(app, { image: JPEG_DATA_URL }), 502, 'upstream_error')
  })
})

describe('routing and errors', () => {
  it('answers unknown /api routes with a JSON 404', async () => {
    const response = await makeApp().request('/api/nope')
    await expectError(response, 404, 'bad_request')
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expectError(await makeApp().request('/api/scan/extra', { method: 'POST' }), 404, 'bad_request')
  })

  it('answers wrong methods with 405 and an Allow header', async () => {
    const getScan = await makeApp().request('/api/scan')
    await expectError(getScan, 405, 'bad_request')
    expect(getScan.headers.get('allow')).toBe('POST')
    const postHealth = await makeApp().request('/api/health', { method: 'POST' })
    await expectError(postHealth, 405, 'bad_request')
    expect(postHealth.headers.get('allow')).toBe('GET, HEAD')
  })

  it('turns unexpected exceptions into a safe JSON 500 and logs them redacted', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    logger.info.mockImplementation(() => {
      throw new Error(`logger exploded near ${TEST_KEY}`)
    })
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    const body = await expectError(response, 500, 'upstream_error')
    expect(JSON.stringify(body)).not.toContain('exploded')
    expect(JSON.stringify(body)).not.toContain(TEST_KEY)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('logger exploded'))
    expect(allLogs()).not.toContain(TEST_KEY)
  })
})

/* ------------------------------------------------------------------ v3: categories, describe, Pro allowance */

describe('POST /api/scan — categories and total-only bills', () => {
  it('returns the category the model read', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ ...BILL, category: 'food' }))
    expect(((await (await postScan(makeApp(), { image: JPEG_DATA_URL })).json()) as ScanResponse).category).toBe('food')
  })

  it('answers a service bill with its total and no items', async () => {
    const electricity = {
      isBill: true,
      merchant: 'BESCOM',
      category: 'utilities',
      date: '2026-10-05',
      currency: 'INR',
      items: [],
      subtotal: null,
      tax: 50,
      serviceCharge: null,
      discount: null,
      tip: null,
      total: 1230,
    }
    fetchMock.mockResolvedValueOnce(chatResponse(electricity))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect((await response.json()) as ScanResponse).toMatchObject({ merchant: 'BESCOM', category: 'utilities', items: [], total: 1230, warnings: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('total only · utilities'))
  })

  it('asks the next model for the items of a restaurant bill read as a total, and keeps the total if it can do no better', async () => {
    const totalOnly = { ...BILL, category: 'food', items: [] }
    fetchMock.mockResolvedValueOnce(chatResponse(totalOnly)).mockResolvedValueOnce(errorResponse(503, 'ResourceExhausted'))
    const response = await postScan(makeApp(), { image: JPEG_DATA_URL })
    expect(response.status).toBe(200)
    expect((await response.json()) as ScanResponse).toMatchObject({ items: [], total: 677, category: 'food' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

const CAB_REPLY = {
  isExpense: true,
  title: 'Cab',
  category: 'transport',
  amount: 840,
  currency: 'USD',
  payer: 'Sam',
  mode: 'shares',
  people: [
    { name: 'Me', value: 1 },
    { name: 'Riya', value: 1 },
    { name: 'Sam', value: 2 },
  ],
  headcount: null,
  date: null,
}

function postDescribe(app: ReturnType<typeof createApp>, body: unknown, headers: Record<string, string> = {}, socket = '198.51.100.1') {
  return app.request(
    '/api/describe',
    { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) },
    fromSocket(socket),
  )
}

describe('POST /api/describe', () => {
  it('turns a sentence into a checked split draft', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(CAB_REPLY))
    const response = await postDescribe(makeApp(), {
      text: 'Cab 840 with Riya and Sam, Sam pays double',
      currency: 'INR',
      people: ['Riya Sharma', 'Sam'],
      today: '2026-10-21',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()) as DescribeResponse).toEqual({
      title: 'Cab',
      category: 'transport',
      amount: 840,
      currency: null,
      mode: 'shares',
      payer: null,
      people: [
        { name: 'Me', value: 1 },
        { name: 'Riya Sharma', value: 1 },
        { name: 'Sam', value: 2 },
      ],
      headcount: null,
      date: null,
      model: 'nvidia/nemotron-test-text',
    })
    expect(sentBody(fetchMock)).toMatchObject({ model: 'nvidia/nemotron-test-text', max_tokens: 800, response_format: { json_schema: { name: 'split' } } })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[describe] ok · nvidia/nemotron-test-text · shares · 3 people'))
  })

  it('reads a UTF-8 body end to end: "₹" names the currency, "I paid" the payer, "last night" the date', async () => {
    // What Lightning answered for this sentence in the live run (it left the currency out).
    fetchMock.mockResolvedValueOnce(
      chatResponse({
        isExpense: true,
        title: 'Swiggy order',
        category: 'food',
        amount: 1260,
        currency: null,
        payer: 'Me',
        mode: 'equal',
        people: [
          { name: 'Me', value: null },
          { name: 'riya', value: null },
          { name: 'sam', value: null },
        ],
        headcount: null,
        date: null,
      }),
    )
    const text = 'Swiggy order ₹1,260 last night with riya & sam, I paid'
    const bytes = new TextEncoder().encode(JSON.stringify({ text, people: ['Riya Sharma', 'Sam'], currency: 'INR', today: '2026-10-21' }))
    const response = await makeApp().request(
      '/api/describe',
      { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: bytes },
      fromSocket('198.51.100.1'),
    )
    expect(response.status).toBe(200)
    expect((await response.json()) as DescribeResponse).toEqual({
      title: 'Swiggy Order',
      category: 'food',
      amount: 1260,
      currency: 'INR',
      mode: 'equal',
      payer: 'Me',
      people: [
        { name: 'Me', value: null },
        { name: 'Riya Sharma', value: null },
        { name: 'Sam', value: null },
      ],
      headcount: null,
      date: '2026-10-20',
      model: 'nvidia/nemotron-test-text',
    })
    expect(JSON.stringify(sentBody(fetchMock))).toContain('₹1,260')
  })

  it("resolves dates from the client's today, or the server's when it sends none", async () => {
    fetchMock.mockImplementation(async () => chatResponse({ ...CAB_REPLY, date: null }))
    const withToday = (await (await postDescribe(makeApp(), { text: 'Cab 840 with Riya yesterday', today: '2026-10-21' })).json()) as DescribeResponse
    expect(withToday.date).toBe('2026-10-20')
    const serverApp = makeApp({}, { now: () => Date.UTC(2026, 0, 10, 12) })
    const serverToday = (await (await postDescribe(serverApp, { text: 'Cab 840 with Riya yesterday' })).json()) as DescribeResponse
    expect(serverToday.date).toBe('2026-01-09')
  })

  it('answers 422 not_a_split for anything that is not an expense', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ ...CAB_REPLY, isExpense: false }))
    const body = await expectError(await postDescribe(makeApp(), { text: 'tell me a joke' }), 422, 'not_a_split')
    expect(body.error.message).toBe(ERROR_MESSAGES.not_a_split)
    expect(body.error.message).toBe("That doesn't read like an expense — try 'Dinner 2400 with Riya and Sam'.")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['malformed JSON', '{"text": ', REQUEST_MESSAGES.malformed],
    ['a missing text', {}, REQUEST_MESSAGES.malformed],
    ['a non-string text', { text: 42 }, REQUEST_MESSAGES.malformed],
    ['an empty text', { text: '  ' }, REQUEST_MESSAGES.empty],
    ['a text over 500 characters', { text: 'a'.repeat(501) }, REQUEST_MESSAGES.tooLong],
    ['more than 50 people', { text: 'Cab 840', people: Array.from({ length: 51 }, (_, i) => `P${i}`) }, REQUEST_MESSAGES.tooManyPeople],
  ])('rejects %s with 400', async (_label, body, message) => {
    const response = await expectError(await postDescribe(makeApp(), body), 400, 'bad_request')
    expect(response.error.message).toBe(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 413', async () => {
    await expectError(await postDescribe(makeApp(), { text: 'Cab', padding: 'x'.repeat(20_000) }), 413, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 not_configured without a key, after validating', async () => {
    const app = makeApp({ apiKey: null })
    await expectError(await postDescribe(app, { text: '' }), 400, 'bad_request')
    const body = await expectError(await postDescribe(app, { text: 'Cab 840 with Riya' }), 503, 'not_configured')
    expect(body.error.message).toBe(DESCRIBE_MESSAGES.not_configured)
  })

  it('maps upstream failures with describe wording', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'Unauthorized'))
    expect((await expectError(await postDescribe(makeApp(), { text: 'Cab 840' }), 502, 'upstream_auth')).error.message).toBe(DESCRIBE_MESSAGES.upstream_auth)

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(errorResponse(429, 'slow down', { 'retry-after': '20' }))
    const limited = await postDescribe(makeApp(), { text: 'Cab 840' })
    expect((await expectError(limited, 429, 'rate_limited')).error.message).toBe('The AI service is busy right now. Try again in a minute — or fill it in yourself.')
    expect(limited.headers.get('retry-after')).toBe('20')

    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => chatResponse('no json at all'))
    expect((await expectError(await postDescribe(makeApp(), { text: 'Cab 840' }), 422, 'unreadable')).error.message).toBe(DESCRIBE_MESSAGES.unreadable)

    fetchMock.mockReset()
    fetchMock.mockImplementation(hangingFetch())
    const slow = await postDescribe(makeApp({ describeTimeoutMs: 20 }), { text: 'Cab 840' })
    expect((await expectError(slow, 504, 'timeout')).error.message).toBe(DESCRIBE_MESSAGES.timeout)

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(errorResponse(500, 'down'))
    await expectError(await postDescribe(makeApp(), { text: 'Cab 840' }), 502, 'upstream_error')
  })

  it('reports AI as off on /api/health after the key is rejected here too', async () => {
    const app = makeApp()
    fetchMock.mockResolvedValueOnce(errorResponse(403, 'Forbidden'))
    await postDescribe(app, { text: 'Cab 840' })
    expect(((await (await app.request('/api/health')).json()) as HealthResponse).configured).toBe(false)
  })

  it('only takes requests from our own page', async () => {
    await expectError(await postDescribe(makeApp(), { text: 'Cab 840' }, { 'sec-fetch-site': 'cross-site' }), 403, 'bad_request')
    await expectError(await postDescribe(makeApp(), { text: 'Cab 840' }, { 'content-type': 'text/plain' }), 415, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers GET with 405', async () => {
    const response = await makeApp().request('/api/describe')
    await expectError(response, 405, 'bad_request')
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('caps describes in flight separately from scans', async () => {
    let finish: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)))
    const app = makeApp({ maxConcurrentScans: 1 })
    const first = postDescribe(app, { text: 'Cab 840 with Riya' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const busy = await postDescribe(app, { text: 'Cab 840 with Riya' }, {}, '198.51.100.2')
    expect((await expectError(busy, 429, 'rate_limited')).error.message).toBe('Lots of people are using AI right now — try again in a moment.')

    // A scan still has its own slot.
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    expect((await postScan(app, { image: JPEG_DATA_URL }, {}, '198.51.100.3')).status).toBe(200)
    finish(chatResponse(CAB_REPLY))
    expect((await first).status).toBe(200)
  })
})

describe('AI allowances — free per address, Pro per license', () => {
  const nowMs = Date.UTC(2026, 9, 21, 12)
  const nowSeconds = Math.floor(nowMs / 1000)
  const license = (id: string, exp: number | null = nowSeconds + 30 * 86_400, keys = TEST_LICENSE_KEYS) => {
    if (keys.privateKey === null) throw new Error('test keys must sign')
    return signLicense({ id, plan: 'pro_monthly', iat: nowSeconds - 60, exp }, keys.privateKey)
  }

  function limitedApp(time: { now: number }, overrides: Partial<ServerConfig> = {}) {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: { json_schema?: { name?: string } } }
      return chatResponse(body.response_format?.json_schema?.name === 'split' ? CAB_REPLY : BILL)
    })
    return makeApp({ rateLimit: { max: 2, windowMs: 600_000 }, proAiPerDay: 3, ...overrides }, { now: () => time.now })
  }

  it('shares one free allowance between scans and describes', async () => {
    const app = limitedApp({ now: nowMs })
    expect((await postScan(app, { image: JPEG_DATA_URL })).status).toBe(200)
    expect((await postDescribe(app, { text: 'Cab 840 with Riya' })).status).toBe(200)
    const limited = await postDescribe(app, { text: 'Cab 840 with Riya' })
    expect((await expectError(limited, 429, 'rate_limited')).error.message).toBe(DESCRIBE_MESSAGES.rate_limited)
    expect(limited.headers.get('ratelimit-limit')).toBe('2')
    await expectError(await postScan(app, { image: JPEG_DATA_URL }), 429, 'rate_limited')
  })

  it('gives an active Pro license its own daily allowance, wherever it is used from', async () => {
    const time = { now: nowMs }
    const app = limitedApp(time)
    const token = license('pay_Pro123')
    for (let i = 0; i < 3; i++) {
      const response = await postDescribe(app, { text: 'Cab 840 with Riya' }, { [LICENSE_HEADER]: token }, `203.0.113.${i}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('ratelimit-limit')).toBe('3')
    }
    const limited = await postScan(app, { image: JPEG_DATA_URL }, { 'x-settle-license': token })
    const body = await expectError(limited, 429, 'rate_limited')
    expect(body.error.message).toContain('fair-use limit')
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(80_000)

    // The free allowance of that address is untouched, and the day rolls over.
    expect((await postScan(app, { image: JPEG_DATA_URL })).status).toBe(200)
    time.now += 86_400_000
    expect((await postScan(app, { image: JPEG_DATA_URL }, { [LICENSE_HEADER]: token }, '203.0.113.9')).status).toBe(200)
  })

  it('keeps separate allowances for separate licenses', async () => {
    const app = limitedApp({ now: nowMs })
    for (let i = 0; i < 3; i++) await postDescribe(app, { text: 'Cab 840' }, { [LICENSE_HEADER]: license('pay_A') })
    await expectError(await postDescribe(app, { text: 'Cab 840' }, { [LICENSE_HEADER]: license('pay_A') }), 429, 'rate_limited')
    expect((await postDescribe(app, { text: 'Cab 840' }, { [LICENSE_HEADER]: license('pay_B') })).status).toBe(200)
  })

  it('treats expired, forged and junk licenses as free users', async () => {
    const app = limitedApp({ now: nowMs })
    const tokens = [license('pay_Old', nowSeconds - 1), license('pay_Fake', null, OTHER_LICENSE_KEYS), 'SETTLE1.junk.junk', 'x'.repeat(5000)]
    for (const token of tokens) {
      const response = await postDescribe(app, { text: 'Cab 840' }, { [LICENSE_HEADER]: token }, '198.51.100.50')
      expect(response.headers.get('ratelimit-limit')).toBe('2')
    }
  })

  it('lifts the Pro cap with PRO_AI_PER_DAY=0, and the free one with RATE_LIMIT_MAX=0', async () => {
    const proUnlimited = limitedApp({ now: nowMs }, { proAiPerDay: 0 })
    for (let i = 0; i < 5; i++) {
      const response = await postDescribe(proUnlimited, { text: 'Cab 840' }, { [LICENSE_HEADER]: license('pay_Big') })
      expect(response.status).toBe(200)
      expect(response.headers.has('ratelimit-limit')).toBe(false)
    }
    const freeUnlimited = limitedApp({ now: nowMs }, { rateLimit: { max: 0, windowMs: 60_000 } })
    for (let i = 0; i < 5; i++) expect((await postDescribe(freeUnlimited, { text: 'Cab 840' })).status).toBe(200)
  })

  it('counts licenses as free when the server has no license key', async () => {
    const app = limitedApp({ now: nowMs }, { license: NO_LICENSE_KEYS })
    const response = await postDescribe(app, { text: 'Cab 840' }, { [LICENSE_HEADER]: license('pay_Pro123') })
    expect(response.headers.get('ratelimit-limit')).toBe('2')
  })
})
