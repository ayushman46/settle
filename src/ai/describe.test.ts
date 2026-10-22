import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DESCRIBE_BUDGET_MS, DESCRIBE_LIMITS, LICENSE_HEADER } from '../../shared/api'
import { createTestSigner, installLicense, resetProModulesForTests, type TestSigner } from '../pro/testKit'
import {
  DESCRIBE_ERROR_MESSAGES,
  DESCRIBE_OFFLINE_MESSAGE,
  DESCRIBE_TIMEOUT_MS,
  DESCRIBE_TOO_LONG_MESSAGE,
  DescribeError,
  describeRateLimitedMessage,
  describeRequest,
  describeSplit,
  parseDescribeResponse,
  type DescribeErrorCode,
  type DescribeHints,
} from './describe'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

const HINTS: DescribeHints = { currency: 'INR', people: ['Riya', 'Sam'], today: '2026-10-21' }

const ANSWER = {
  title: 'Cab',
  category: 'transport',
  amount: 840,
  currency: null,
  mode: 'shares',
  payer: null,
  people: [
    { name: 'Me', value: 1 },
    { name: 'Riya', value: 1 },
    { name: 'Sam', value: 2 },
  ],
  headcount: null,
  date: null,
  model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
}

async function describeError(promise: Promise<unknown>): Promise<DescribeError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof DescribeError) return error
    throw error
  }
  throw new Error('expected a DescribeError')
}

/** A fetch that never answers but honours the abort signal. */
function hang(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
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

describe('describeSplit', () => {
  it('posts the sentence with hints and returns the draft', async () => {
    fetchMock.mockResolvedValue(json(ANSWER))
    const draft = await describeSplit('  Cab 840 with Riya and Sam,\n Sam pays double ', HINTS)
    expect(draft).toEqual(ANSWER)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/describe')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'Cab 840 with Riya and Sam, Sam pays double',
      currency: 'INR',
      people: ['Riya', 'Sam'],
      today: '2026-10-21',
    })
    expect(new Headers(init?.headers).has(LICENSE_HEADER)).toBe(false)
  })

  it('sends the Pro license along while it is active', async () => {
    const token = await signer.token()
    installLicense(token, signer.publicKey)
    fetchMock.mockResolvedValue(json(ANSWER))
    await describeSplit('Cab 840 with Riya', HINTS)
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get(LICENSE_HEADER)).toBe(token)
  })

  it.each(['', '   ', '?!…', '\n\t'])('asks for something to read when given %j', async (text) => {
    const error = await describeError(describeSplit(text, HINTS))
    expect(error.code).toBe('bad_request')
    expect(error.message).toBe(DESCRIBE_ERROR_MESSAGES.bad_request)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops at the length limit, counting characters not UTF-16 units', async () => {
    const error = await describeError(describeSplit('a'.repeat(DESCRIBE_LIMITS.maxTextChars + 1), HINTS))
    expect(error).toMatchObject({ code: 'bad_request', message: DESCRIBE_TOO_LONG_MESSAGE })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue(json(ANSWER))
    await expect(describeSplit(`Dinner 500 ${'🍕'.repeat(DESCRIBE_LIMITS.maxTextChars - 11)}`, HINTS)).resolves.toBeTruthy()
  })

  it.each<[string, Response, DescribeErrorCode, string]>([
    ['not a split', json({ error: { code: 'not_a_split', message: 'server copy' } }, 422), 'not_a_split', DESCRIBE_ERROR_MESSAGES.not_a_split],
    ['unreadable', json({ error: { code: 'unreadable' } }, 422), 'unreadable', DESCRIBE_ERROR_MESSAGES.unreadable],
    ['bad request', json({ error: { code: 'bad_request', message: 'too long' } }, 400), 'bad_request', DESCRIBE_ERROR_MESSAGES.bad_request],
    ['not configured', json({ error: { code: 'not_configured', message: 'Set NVIDIA_API_KEY' } }, 503), 'not_configured', DESCRIBE_ERROR_MESSAGES.not_configured],
    ['key rejected', json({ error: { code: 'upstream_auth' } }, 502), 'upstream_auth', DESCRIBE_ERROR_MESSAGES.upstream_auth],
    ['timeout', json({ error: { code: 'timeout' } }, 504), 'timeout', DESCRIBE_ERROR_MESSAGES.timeout],
    ['upstream', json({ error: { code: 'upstream_error' } }, 502), 'upstream_error', DESCRIBE_ERROR_MESSAGES.upstream_error],
    ['a scan-only code', json({ error: { code: 'not_a_bill' } }, 422), 'not_a_split', DESCRIBE_ERROR_MESSAGES.not_a_split],
    ['an unknown code', json({ error: { code: 'kaboom' } }, 500), 'upstream_error', DESCRIBE_ERROR_MESSAGES.upstream_error],
    ['an HTML 413', new Response('<html>', { status: 413 }), 'bad_request', DESCRIBE_ERROR_MESSAGES.bad_request],
    ['an HTML 503', new Response('<html>', { status: 503 }), 'not_configured', DESCRIBE_ERROR_MESSAGES.not_configured],
    ['an HTML 408', new Response('<html>', { status: 408 }), 'timeout', DESCRIBE_ERROR_MESSAGES.timeout],
  ])('maps %s to our own copy', async (_label, response, code, message) => {
    fetchMock.mockResolvedValue(response)
    const error = await describeError(describeSplit('Dinner 2400 with Riya', HINTS))
    expect(error.code).toBe(code)
    expect(error.message).toBe(message)
  })

  it('words rate limits by how long the wait is', async () => {
    const limited = (retryAfter?: string) =>
      json({ error: { code: 'rate_limited' } }, 429, retryAfter === undefined ? {} : { 'Retry-After': retryAfter })
    fetchMock.mockResolvedValueOnce(limited())
    expect((await describeError(describeSplit('Tea 40', HINTS))).message).toBe(DESCRIBE_ERROR_MESSAGES.rate_limited)
    fetchMock.mockResolvedValueOnce(limited('20'))
    expect((await describeError(describeSplit('Tea 40', HINTS))).message).toBe(DESCRIBE_ERROR_MESSAGES.rate_limited)
    fetchMock.mockResolvedValueOnce(limited('600'))
    expect((await describeError(describeSplit('Tea 40', HINTS))).message).toBe(
      'Too many AI splits for now. Try again in about 10 minutes — or split it by hand.',
    )
    expect(describeRateLimitedMessage(60)).toBe('Too many AI splits for now. Try again in about a minute — or split it by hand.')
  })

  it("words a long wait in hours, and tells Pro when the day's fair-use allowance is used up", async () => {
    expect(describeRateLimitedMessage(2 * 3600)).toBe('Too many AI splits for now. Try again in about 2 hours — or split it by hand.')
    installLicense(await signer.token(), signer.publicKey)
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'rate_limited' } }, 429, { 'Retry-After': '40000' }))
    expect((await describeError(describeSplit('Tea 40', HINTS))).message).toBe(
      "You've reached today's fair-use AI limit. It resets in about 12 hours — you can still split it by hand.",
    )
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'rate_limited' } }, 429, { 'Retry-After': '10' }))
    expect((await describeError(describeSplit('Tea 40', HINTS))).message).toBe(DESCRIBE_ERROR_MESSAGES.rate_limited)
    expect(describeRateLimitedMessage(40_000, false)).toBe('Too many AI splits for now. Try again in about 12 hours — or split it by hand.')
  })

  it('treats a malformed answer as an upstream error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    expect((await describeError(describeSplit('Tea 40', HINTS))).code).toBe('upstream_error')
    fetchMock.mockResolvedValueOnce(json({ title: 'x', people: 'Riya' }))
    expect((await describeError(describeSplit('Tea 40', HINTS))).code).toBe('upstream_error')
  })

  it('maps network failures to network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await describeError(describeSplit('Tea 40', HINTS))
    expect(error).toMatchObject({ code: 'network', message: DESCRIBE_ERROR_MESSAGES.network })
  })

  it("doesn't even try when the browser is offline", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const error = await describeError(describeSplit('Tea 40', HINTS))
    expect(error).toMatchObject({ code: 'network', message: DESCRIBE_OFFLINE_MESSAGE })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels with the caller signal', async () => {
    fetchMock.mockImplementation(hang)
    const controller = new AbortController()
    const promise = describeSplit('Tea 40', HINTS, controller.signal)
    controller.abort()
    expect((await describeError(promise)).code).toBe('aborted')
  })

  it('rejects straight away when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    expect((await describeError(describeSplit('Tea 40', HINTS, controller.signal))).code).toBe('aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gives up a little after the server would have', async () => {
    expect(DESCRIBE_TIMEOUT_MS).toBe(DESCRIBE_BUDGET_MS + 10_000)
    vi.useFakeTimers()
    fetchMock.mockImplementation(hang)
    const promise = describeError(describeSplit('Tea 40', HINTS))
    await vi.advanceTimersByTimeAsync(DESCRIBE_TIMEOUT_MS)
    expect(await promise).toMatchObject({ code: 'timeout', message: DESCRIBE_ERROR_MESSAGES.timeout })
  })

  it('never shows operator details', () => {
    for (const message of [...Object.values(DESCRIBE_ERROR_MESSAGES), DESCRIBE_OFFLINE_MESSAGE, DESCRIBE_TOO_LONG_MESSAGE]) {
      expect(message).not.toMatch(/NVIDIA|\.env|API key|server|model/i)
    }
  })
})

describe('describeRequest', () => {
  it('tidies the names it sends as hints', () => {
    const body = describeRequest('Lunch 600', {
      currency: 'INR',
      people: ['  Riya  ', 'riya', 'RIYA', '', '   ', 'José', 'jose', 'x'.repeat(60), ...Array.from({ length: 80 }, (_, i) => `P${i}`)],
      today: '2026-10-21',
    })
    expect(body.people?.slice(0, 3)).toEqual(['Riya', 'José', 'x'.repeat(24)])
    expect(body.people).toHaveLength(DESCRIBE_LIMITS.maxPeople)
  })

  it('leaves out hints it cannot vouch for', () => {
    expect(describeRequest('Lunch 600', { currency: 'rupees', people: [], today: 'yesterday' })).toEqual({ text: 'Lunch 600' })
    expect(describeRequest('Lunch 600', { currency: 'usd', people: [], today: '2026-02-30' })).toEqual({ text: 'Lunch 600' })
  })
})

describe('parseDescribeResponse', () => {
  it('accepts a full answer', () => {
    expect(parseDescribeResponse(ANSWER)).toEqual(ANSWER)
  })

  it('fills in what is missing and drops what is wrong', () => {
    expect(
      parseDescribeResponse({
        title: '  Goa   trip ',
        category: 'Travel',
        amount: -10,
        currency: 'usd',
        mode: 'items',
        payer: '   ',
        people: [{ name: ' Riya ', value: '30' }, { name: '' }, null, 'Sam', { name: 'Sam', value: Number.POSITIVE_INFINITY }, { name: 'Me', value: 2 }],
        headcount: 2.5,
        date: '2026-13-01',
      }),
    ).toEqual({
      title: 'Goa trip',
      category: 'other',
      amount: null,
      currency: 'USD',
      mode: 'equal',
      payer: null,
      people: [
        { name: 'Riya', value: null },
        { name: 'Sam', value: null },
        { name: 'Me', value: 2 },
      ],
      headcount: null,
      date: null,
      model: 'unknown',
    })
  })

  it('keeps a valid headcount, date and currency', () => {
    expect(parseDescribeResponse({ people: [], headcount: 4, date: '2026-10-20', currency: 'EUR', amount: 0 })).toMatchObject({
      headcount: 4,
      date: '2026-10-20',
      currency: 'EUR',
      amount: null,
    })
    expect(parseDescribeResponse({ people: [], currency: 'XYZ' })?.currency).toBeNull()
  })

  it('rejects things that are not drafts', () => {
    expect(parseDescribeResponse(null)).toBeNull()
    expect(parseDescribeResponse([])).toBeNull()
    expect(parseDescribeResponse({ title: 'x' })).toBeNull()
  })
})

describe('describeRequest — language and source hints (spec 03 §5.1)', () => {
  const base = { currency: 'INR', people: ['Riya'], today: '2026-10-21' }

  it('sends the language and how the text arrived', () => {
    expect(describeRequest('dhai hazaar dinner', { ...base, lang: 'hi-IN', source: 'voice' })).toMatchObject({ lang: 'hi-IN', source: 'voice' })
    expect(describeRequest('Swiggy 250', { ...base, source: 'sms' })).toMatchObject({ source: 'sms' })
  })

  it('leaves them out when unknown or not given', () => {
    const body = describeRequest('Cab 840', { ...base, lang: 'fr-FR' as never, source: 'fax' as never })
    expect(body).not.toHaveProperty('lang')
    expect(body).not.toHaveProperty('source')
    expect(describeRequest('Cab 840', base)).toEqual({ text: 'Cab 840', currency: 'INR', people: ['Riya'], today: '2026-10-21' })
  })
})
