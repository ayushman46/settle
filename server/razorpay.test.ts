import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder, fetchOrder, isPaid, RazorpayError, verifyPaymentSignature, type RazorpayClient, type RazorpayOrder } from './razorpay'
import { hangingFetch, TEST_RAZORPAY } from './testing'

const fetchMock = vi.fn<typeof fetch>()
const client: RazorpayClient = { keys: { ...TEST_RAZORPAY }, baseUrl: 'https://razorpay.test/v1', timeoutMs: 1_000 }

const ORDER = {
  id: 'order_Q1w2E3r4T5y6U7',
  entity: 'order',
  amount: 39900,
  amount_paid: 0,
  amount_due: 39900,
  currency: 'INR',
  receipt: 'settle_pro_yearly_abc',
  status: 'created',
  attempts: 0,
  notes: { product: 'settle_pro', plan: 'pro_yearly' },
  created_at: 1_790_000_000,
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function failure(promise: Promise<unknown>): Promise<RazorpayError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  if (!(error instanceof RazorpayError)) throw new Error(`Expected a RazorpayError, got ${String(error)}`)
  return error
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('verifyPaymentSignature', () => {
  const sign = (orderId: string, paymentId: string, secret: string = TEST_RAZORPAY.keySecret) =>
    createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

  it("accepts Razorpay's HMAC of order|payment, in either case", () => {
    const signature = sign('order_ABC123', 'pay_XYZ789')
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', signature, TEST_RAZORPAY.keySecret)).toBe(true)
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', signature.toUpperCase(), TEST_RAZORPAY.keySecret)).toBe(true)
  })

  it('rejects a signature for another order or payment, or made with another secret', () => {
    const signature = sign('order_ABC123', 'pay_XYZ789')
    expect(verifyPaymentSignature('order_ABC124', 'pay_XYZ789', signature, TEST_RAZORPAY.keySecret)).toBe(false)
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ780', signature, TEST_RAZORPAY.keySecret)).toBe(false)
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', sign('order_ABC123', 'pay_XYZ789', 'another-secret'), TEST_RAZORPAY.keySecret)).toBe(false)
  })

  it('rejects anything that is not 64 hex characters without comparing', () => {
    for (const signature of ['', 'abc', 'z'.repeat(64), `${'a'.repeat(63)}`, `${'a'.repeat(65)}`]) {
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', signature, TEST_RAZORPAY.keySecret)).toBe(false)
    }
  })
})

describe('createOrder', () => {
  it('posts the order with basic auth and reads it back', async () => {
    fetchMock.mockResolvedValueOnce(json(ORDER))
    const order = await createOrder(client, { amount: 39900, currency: 'INR', receipt: 'settle_pro_yearly_abc', notes: { product: 'settle_pro', plan: 'pro_yearly' } })
    expect(order).toEqual<RazorpayOrder>({
      id: 'order_Q1w2E3r4T5y6U7',
      amount: 39900,
      amountPaid: 0,
      currency: 'INR',
      status: 'created',
      notes: { product: 'settle_pro', plan: 'pro_yearly' },
      createdAt: 1_790_000_000,
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://razorpay.test/v1/orders')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      Authorization: `Basic ${Buffer.from(`${TEST_RAZORPAY.keyId}:${TEST_RAZORPAY.keySecret}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init?.body))).toEqual({ amount: 39900, currency: 'INR', receipt: 'settle_pro_yearly_abc', notes: { product: 'settle_pro', plan: 'pro_yearly' } })
  })
})

describe('fetchOrder', () => {
  it('gets the order by id', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...ORDER, status: 'paid', amount_paid: 39900 }))
    const order = await fetchOrder(client, 'order_Q1w2E3r4T5y6U7')
    expect(order).toMatchObject({ status: 'paid', amountPaid: 39900 })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://razorpay.test/v1/orders/order_Q1w2E3r4T5y6U7')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect(init?.headers).not.toHaveProperty('Content-Type')
  })

  it('reads notes sent as [] (Razorpay does that for none) and keeps only text notes', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...ORDER, notes: [] }))
    expect((await fetchOrder(client, 'order_X')).notes).toEqual({})
    fetchMock.mockResolvedValueOnce(json({ ...ORDER, notes: { plan: 'pro_yearly', count: 3 } }))
    expect((await fetchOrder(client, 'order_X')).notes).toEqual({ plan: 'pro_yearly' })
  })

  it('tolerates a missing amount_paid / created_at', async () => {
    const { amount_paid: _paid, created_at: _created, ...bare } = ORDER
    fetchMock.mockResolvedValueOnce(json(bare))
    expect(await fetchOrder(client, 'order_X')).toMatchObject({ amountPaid: 0, createdAt: null })
  })
})

describe('errors', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [400, 'rejected'],
    [404, 'rejected'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [502, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'BAD', description: 'nope' } }, status))
    const error = await failure(fetchOrder(client, 'order_X'))
    expect(error).toMatchObject({ kind, status })
    expect(error.detail).toContain('nope')
  })

  it('keeps the key secret out of error details', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { description: `bad secret ${TEST_RAZORPAY.keySecret}` } }, 401))
    const error = await failure(fetchOrder(client, 'order_X'))
    expect(error.detail).not.toContain(TEST_RAZORPAY.keySecret)
    expect(error.message).not.toContain(TEST_RAZORPAY.keySecret)
  })

  it('treats an unreadable reply, a network failure and a slow answer as unavailable / timeout', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }))
    expect((await failure(fetchOrder(client, 'order_X'))).kind).toBe('unavailable')
    fetchMock.mockResolvedValueOnce(json({ id: 'order_X' }))
    expect((await failure(fetchOrder(client, 'order_X'))).kind).toBe('unavailable')
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect((await failure(fetchOrder(client, 'order_X'))).kind).toBe('unavailable')
    fetchMock.mockImplementationOnce(hangingFetch())
    expect((await failure(fetchOrder({ ...client, timeoutMs: 20 }, 'order_X'))).kind).toBe('timeout')
  })

  it('stops when the caller goes away', async () => {
    fetchMock.mockImplementationOnce(hangingFetch())
    const controller = new AbortController()
    const pending = fetchOrder(client, 'order_X', controller.signal)
    controller.abort()
    expect((await failure(pending)).kind).toBe('unavailable')
  })
})

describe('isPaid', () => {
  const order = (overrides: Partial<RazorpayOrder>): RazorpayOrder => ({
    id: 'order_X',
    amount: 39900,
    amountPaid: 0,
    currency: 'INR',
    status: 'created',
    notes: {},
    createdAt: null,
    ...overrides,
  })

  it('needs the order paid in full', () => {
    expect(isPaid(order({ status: 'paid', amountPaid: 39900 }))).toBe(true)
    expect(isPaid(order({ status: 'paid' }))).toBe(true)
    expect(isPaid(order({ status: 'attempted', amountPaid: 39900 }))).toBe(true)
    expect(isPaid(order({ status: 'attempted', amountPaid: 100 }))).toBe(false)
    expect(isPaid(order({ status: 'created' }))).toBe(false)
  })
})
