import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCAN_BUDGET_MS } from '../shared/api'
import { DEFAULT_TIMEOUT_MS, type ServerConfig } from './config'
import { buildRequestBody, extractBill, forgetPromptOnlyModels, readContent, UpstreamError } from './nvidia'
import { isAcceptableReply } from './parse'
import { BILL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt'
import { BILL, chatResponse, errorResponse, hangingFetch, JPEG_DATA_URL, sentBody, TEST_KEY, testConfig } from './testing'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  forgetPromptOnlyModels()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function failure(promise: Promise<unknown>): Promise<UpstreamError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  if (!(error instanceof UpstreamError)) throw new Error(`Expected an UpstreamError, got ${String(error)}`)
  return error
}

describe('buildRequestBody', () => {
  it('sends the prompts, the image and the JSON schema', () => {
    const body = buildRequestBody('google/gemma-4-31b-it', JPEG_DATA_URL, true)
    expect(body).toEqual({
      model: 'google/gemma-4-31b-it',
      temperature: 0.1,
      top_p: 0.95,
      max_tokens: 4096,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: JPEG_DATA_URL } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'bill', strict: true, schema: BILL_SCHEMA } },
    })
  })

  it('turns thinking off only for Nemotron', () => {
    expect(buildRequestBody('nvidia/nemotron-3.5-super-vl-120b-a12b', JPEG_DATA_URL, true)).toHaveProperty('chat_template_kwargs', {
      enable_thinking: false,
    })
    expect(buildRequestBody('meta/llama-3.2-90b-vision-instruct', JPEG_DATA_URL, true)).not.toHaveProperty('chat_template_kwargs')
  })

  it('omits response_format for prompt-only attempts', () => {
    expect(buildRequestBody('a/b', JPEG_DATA_URL, false)).not.toHaveProperty('response_format')
  })
})

describe('readContent', () => {
  it('reads string content', () => {
    expect(readContent({ choices: [{ message: { content: '{"a":1}' } }] }, 'm')).toBe('{"a":1}')
  })

  it('joins text parts and ignores reasoning', () => {
    const payload = {
      choices: [
        {
          message: {
            reasoning_content: 'thinking {"items": []}',
            content: [
              { type: 'text', text: '{"items": ' },
              { type: 'image_url', image_url: { url: 'x' } },
              { type: 'text', text: '[]}' },
            ],
          },
        },
      ],
    }
    expect(readContent(payload, 'm')).toBe('{"items": []}')
  })

  it('throws bad_output for empty or malformed payloads', () => {
    for (const payload of [null, {}, { choices: [] }, { choices: [{ message: { content: '   ' } }] }, { choices: [{ message: { content: null } }] }]) {
      expect(() => readContent(payload, 'm')).toThrow(UpstreamError)
    }
  })
})

describe('extractBill', () => {
  it('calls the first model with the key and returns its JSON', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    const result = await extractBill(testConfig(), JPEG_DATA_URL)

    expect(result).toEqual({ raw: BILL, model: 'nvidia/nemotron-test-vl' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://nvidia.test/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ Authorization: `Bearer ${TEST_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(sentBody(fetchMock)).toMatchObject({ model: 'nvidia/nemotron-test-vl', chat_template_kwargs: { enable_thinking: false } })
  })

  it('accepts JSON wrapped in prose and fences', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(`Here you go:\n\`\`\`json\n${JSON.stringify(BILL)}\n\`\`\``))
    expect((await extractBill(testConfig(), JPEG_DATA_URL)).raw).toEqual(BILL)
  })

  it.each([
    ['404 (unknown model)', () => errorResponse(404, 'Function not found')],
    ['500', () => errorResponse(500, 'Internal error')],
    ['503', () => errorResponse(503, 'Service unavailable')],
    ['400 unrelated to the schema', () => errorResponse(400, 'Image could not be decoded')],
    ['unparseable output', () => chatResponse('I am unable to read this image.')],
    ['empty output', () => chatResponse('')],
    ['a non-JSON body', () => new Response('<html>502 Bad Gateway</html>', { status: 200 })],
  ])('falls back to the next model on %s', async (_label, makeResponse) => {
    fetchMock.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce(chatResponse(BILL))
    const result = await extractBill(testConfig(), JPEG_DATA_URL)
    expect(result.model).toBe('google/gemma-test')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentBody(fetchMock, 1)).toMatchObject({ model: 'google/gemma-test' })
    expect(sentBody(fetchMock, 1)).not.toHaveProperty('chat_template_kwargs')
  })

  it('falls back on network errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(chatResponse(BILL))
    const onAttemptFailed = vi.fn()
    const result = await extractBill(testConfig(), JPEG_DATA_URL, { onAttemptFailed })
    expect(result.model).toBe('google/gemma-test')
    expect(onAttemptFailed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unavailable', model: 'nvidia/nemotron-test-vl' }))
  })

  it.each([
    [400, 'response_format is not supported for this model'],
    [422, 'Unsupported: json_schema'],
    [400, 'guided decoding backend failed'],
  ])('retries the same model without response_format on %i "%s"', async (status, message) => {
    fetchMock.mockResolvedValueOnce(errorResponse(status, message)).mockResolvedValueOnce(chatResponse(BILL))
    const result = await extractBill(testConfig(), JPEG_DATA_URL)
    expect(result.model).toBe('nvidia/nemotron-test-vl')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentBody(fetchMock, 0)).toHaveProperty('response_format')
    expect(sentBody(fetchMock, 1)).not.toHaveProperty('response_format')
    expect(sentBody(fetchMock, 1)).toMatchObject({ model: 'nvidia/nemotron-test-vl' })
  })

  it('retries without the schema only once per model', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(400, 'response_format unsupported'))
      .mockResolvedValueOnce(errorResponse(400, 'schema still unsupported'))
      .mockResolvedValueOnce(chatResponse(BILL))
    const result = await extractBill(testConfig(), JPEG_DATA_URL)
    expect(result.model).toBe('google/gemma-test')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sentBody(fetchMock, 2)).toHaveProperty('response_format')
  })

  it.each([401, 403])('fails fast on %i without trying other models', async (status) => {
    fetchMock.mockResolvedValue(errorResponse(status, 'Authentication failed'))
    const error = await failure(extractBill(testConfig(), JPEG_DATA_URL))
    expect(error.kind).toBe('auth')
    expect(error.status).toBe(status)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails fast on 429 and passes Retry-After along', async () => {
    fetchMock.mockResolvedValue(errorResponse(429, 'Too many requests', { 'retry-after': '17' }))
    const error = await failure(extractBill(testConfig(), JPEG_DATA_URL))
    expect(error).toMatchObject({ kind: 'rate_limited', status: 429, retryAfter: 17 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('times out a slow model and moves on to the next', async () => {
    fetchMock.mockImplementationOnce(hangingFetch()).mockResolvedValueOnce(chatResponse(BILL))
    const result = await extractBill(testConfig({ timeoutMs: 30 }), JPEG_DATA_URL)
    expect(result.model).toBe('google/gemma-test')
  })

  it('times out while the body is still downloading', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"choices": ['))
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body, { status: 200 })
    })
    const error = await failure(extractBill(testConfig({ timeoutMs: 30 }), JPEG_DATA_URL))
    expect(error.kind).toBe('timeout')
  })

  it('reports a timeout when every model is slow', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const error = await failure(extractBill(testConfig({ timeoutMs: 20 }), JPEG_DATA_URL))
    expect(error.kind).toBe('timeout')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('prefers the most informative failure', async () => {
    fetchMock.mockImplementationOnce(hangingFetch()).mockResolvedValueOnce(errorResponse(500, 'boom'))
    expect((await failure(extractBill(testConfig({ timeoutMs: 20 }), JPEG_DATA_URL))).kind).toBe('timeout')

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(errorResponse(404, 'nope')).mockResolvedValueOnce(chatResponse('no json here'))
    expect((await failure(extractBill(testConfig(), JPEG_DATA_URL))).kind).toBe('bad_output')

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(errorResponse(502, 'bad gateway'))
    const error = await failure(extractBill(testConfig(), JPEG_DATA_URL))
    expect(error).toMatchObject({ kind: 'unavailable', status: 502 })
  })

  it('stops when the caller aborts', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const controller = new AbortController()
    const pending = extractBill(testConfig(), JPEG_DATA_URL, { signal: controller.signal })
    setTimeout(() => controller.abort(), 10)
    const error = await failure(pending)
    expect(error.kind).toBe('aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await failure(extractBill(testConfig(), JPEG_DATA_URL, { signal: controller.signal }))
    expect(error.kind).toBe('aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tries another model when a reply is not acceptable, keeping it as a last resort', async () => {
    const empty = { ...BILL, items: [] }
    fetchMock.mockResolvedValueOnce(chatResponse(empty)).mockResolvedValueOnce(chatResponse(BILL))
    const better = await extractBill(testConfig(), JPEG_DATA_URL, { accept: isAcceptableReply })
    expect(better).toEqual({ raw: BILL, model: 'google/gemma-test' })

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(chatResponse(empty)).mockResolvedValueOnce(errorResponse(500, 'down'))
    const fallback = await extractBill(testConfig(), JPEG_DATA_URL, { accept: isAcceptableReply })
    expect(fallback).toEqual({ raw: empty, model: 'nvidia/nemotron-test-vl' })
  })

  it('returns the last-resort reply rather than a later quota error', async () => {
    const empty = { ...BILL, items: [] }
    fetchMock.mockResolvedValueOnce(chatResponse(empty)).mockResolvedValueOnce(errorResponse(429, 'slow down'))
    expect(await extractBill(testConfig(), JPEG_DATA_URL, { accept: isAcceptableReply })).toEqual({ raw: empty, model: 'nvidia/nemotron-test-vl' })
  })

  it('accepts a confident "not a bill" straight away', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse({ isBill: false, items: [] }))
    const result = await extractBill(testConfig(), JPEG_DATA_URL, { accept: isAcceptableReply })
    expect(result.model).toBe('nvidia/nemotron-test-vl')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses to run without a key', async () => {
    const error = await failure(extractBill(testConfig({ apiKey: null }), JPEG_DATA_URL))
    expect(error.kind).toBe('not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the key out of error details', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, `Invalid key ${TEST_KEY}`))
    const error = await failure(extractBill(testConfig(), JPEG_DATA_URL))
    expect(error.detail).not.toContain(TEST_KEY)
    expect(error.message).not.toContain(TEST_KEY)
  })
})

describe('extractBill — one time budget for the whole scan', () => {
  const THREE_MODELS = ['nvidia/nemotron-test-vl', 'google/gemma-test', 'meta/llama-test']

  /** Runs a scan on fake timers to the end of the budget; resolves with what it ended with and when. */
  async function runOut(config: ServerConfig) {
    vi.useFakeTimers()
    const started = Date.now()
    let endedAt = Number.NaN
    const pending = extractBill(config, JPEG_DATA_URL).finally(() => {
      endedAt = Date.now()
    })
    const outcome = pending.then(
      (result) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error }),
    )
    await vi.advanceTimersByTimeAsync(SCAN_BUDGET_MS + 60_000)
    return { ...(await outcome), elapsed: endedAt - started }
  }

  it('gives the client our answer before it gives up: every attempt fits in SCAN_BUDGET_MS', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const { error, elapsed } = await runOut(testConfig({ models: THREE_MODELS, timeoutMs: DEFAULT_TIMEOUT_MS }))
    expect(error).toBeInstanceOf(UpstreamError)
    expect((error as UpstreamError).kind).toBe('timeout')
    expect(elapsed).toBeLessThanOrEqual(SCAN_BUDGET_MS)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 35 s + 35 s + the last 10 s
  })

  it('cuts the last attempt short, and skips models it has no time left for', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const { error, elapsed } = await runOut(testConfig({ models: THREE_MODELS, timeoutMs: 60_000 }))
    expect((error as UpstreamError).kind).toBe('timeout')
    expect(elapsed).toBe(SCAN_BUDGET_MS) // 60 s, then the 20 s that were left
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not start an attempt with less than 5 s to go', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const { error, elapsed } = await runOut(testConfig({ models: THREE_MODELS, timeoutMs: SCAN_BUDGET_MS - 3_000 }))
    expect((error as UpstreamError).kind).toBe('timeout')
    expect(elapsed).toBe(SCAN_BUDGET_MS - 3_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a timeout when the budget ends during the retry without the schema', async () => {
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => setTimeout(() => resolve(errorResponse(400, 'response_format unsupported')), SCAN_BUDGET_MS - 1_000)),
    )
    const { error } = await runOut(testConfig({ models: THREE_MODELS, timeoutMs: SCAN_BUDGET_MS }))
    expect(error).toMatchObject({ kind: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lets the next model succeed in the time left after a timeout', async () => {
    fetchMock.mockImplementationOnce(hangingFetch()).mockResolvedValueOnce(chatResponse(BILL))
    const { result, elapsed } = await runOut(testConfig({ models: THREE_MODELS, timeoutMs: DEFAULT_TIMEOUT_MS }))
    expect(result).toEqual({ raw: BILL, model: 'google/gemma-test' })
    expect(elapsed).toBe(DEFAULT_TIMEOUT_MS)
  })

  it('still answers with a weak reply from an earlier model when time runs out', async () => {
    const empty = { ...BILL, items: [] }
    fetchMock.mockResolvedValueOnce(chatResponse(empty)).mockImplementation(hangingFetch())
    vi.useFakeTimers()
    const pending = extractBill(testConfig({ models: THREE_MODELS, timeoutMs: SCAN_BUDGET_MS - 3_000 }), JPEG_DATA_URL, {
      accept: isAcceptableReply,
    })
    await vi.advanceTimersByTimeAsync(SCAN_BUDGET_MS)
    expect(await pending).toEqual({ raw: empty, model: 'nvidia/nemotron-test-vl' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('extractBill — remembering models that refuse response_format', () => {
  it('goes straight to prompt-only JSON for that model on later scans', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, "Unsupported parameter: 'response_format'")).mockResolvedValueOnce(chatResponse(BILL))
    expect((await extractBill(testConfig(), JPEG_DATA_URL)).model).toBe('nvidia/nemotron-test-vl')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    expect((await extractBill(testConfig(), JPEG_DATA_URL)).model).toBe('nvidia/nemotron-test-vl')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(fetchMock)).not.toHaveProperty('response_format')
  })

  it('keeps the schema for other models and other endpoints', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, 'response_format unsupported')).mockResolvedValueOnce(chatResponse(BILL))
    await extractBill(testConfig(), JPEG_DATA_URL)

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(errorResponse(404, 'gone')).mockResolvedValueOnce(chatResponse(BILL))
    await extractBill(testConfig(), JPEG_DATA_URL)
    expect(sentBody(fetchMock, 0)).not.toHaveProperty('response_format')
    expect(sentBody(fetchMock, 1)).toMatchObject({ model: 'google/gemma-test', response_format: { type: 'json_schema' } })

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    await extractBill(testConfig({ baseUrl: 'https://other.test/v1' }), JPEG_DATA_URL)
    expect(sentBody(fetchMock)).toHaveProperty('response_format')
  })

  it('tries the schema again after an hour (the refusal may have been a passing backend fault)', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(errorResponse(400, 'guided decoding backend failed')).mockResolvedValueOnce(chatResponse(BILL))
    await extractBill(testConfig(), JPEG_DATA_URL)

    vi.setSystemTime(Date.now() + 61 * 60_000)
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(chatResponse(BILL))
    await extractBill(testConfig(), JPEG_DATA_URL)
    expect(sentBody(fetchMock)).toHaveProperty('response_format')
  })
})
