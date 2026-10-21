import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody, ApiErrorCode, BillingConfig, LicenseVerifyResponse, OrderResponse, VerifyResponse } from '../shared/api'
import { createApp, type AppOptions } from './app'
import { BILLING_MESSAGES } from './billing'
import type { ServerConfig } from './config'
import { NO_LICENSE_KEYS, signLicense, verifyLicense } from './license'
import { fromSocket, OTHER_LICENSE_KEYS, silentLogger, TEST_LICENSE_KEYS, TEST_RAZORPAY, testBilling, testConfig } from './testing'

const fetchMock = vi.fn<typeof fetch>()
let logger = silentLogger()
const NOW_SECONDS = 1_790_000_000
const DAY = 86_400

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  logger = silentLogger()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeApp(overrides: Partial<ServerConfig> = {}, options: AppOptions = {}) {
  return createApp(testConfig(overrides), { logger, now: () => NOW_SECONDS * 1000, ...options })
}

function post(app: ReturnType<typeof createApp>, path: string, body: unknown, headers: Record<string, string> = {}, socket = '198.51.100.7') {
  return app.request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) },
    fromSocket(socket),
  )
}

async function expectError(response: Response, status: number, code: ApiErrorCode, message?: string) {
  expect(response.status).toBe(status)
  const body = (await response.json()) as ApiErrorBody
  expect(body.error.code).toBe(code)
  if (message !== undefined) expect(body.error.message).toBe(message)
  return body
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ORDER_ID = 'order_Q1w2E3r4T5y6U7'
const PAYMENT_ID = 'pay_A1s2D3f4G5h6J7'
const signature = (orderId = ORDER_ID, paymentId = PAYMENT_ID, secret: string = TEST_RAZORPAY.keySecret) =>
  createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

function razorpayOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    entity: 'order',
    amount: 39900,
    amount_paid: 39900,
    currency: 'INR',
    status: 'paid',
    notes: { product: 'settle_pro', plan: 'pro_yearly' },
    created_at: NOW_SECONDS - 120,
    ...overrides,
  }
}

const allLogs = () => [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls].flat().join('\n')

/* ---------------------------------------------------------------- config */

describe('GET /api/billing/config', () => {
  it('describes checkout, the plans and the license key', async () => {
    const response = await makeApp().request('/api/billing/config')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()) as BillingConfig).toEqual({
      checkout: 'razorpay',
      keyId: TEST_RAZORPAY.keyId,
      currency: 'INR',
      plans: [
        { id: 'pro_monthly', name: 'Monthly', amount: 4900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
        { id: 'pro_yearly', name: 'Yearly', amount: 39900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 32 },
        { id: 'pro_lifetime', name: 'Lifetime', amount: 99900, currency: 'INR', days: null, badge: 'Pay once', savingsPercent: null },
      ],
      licensePublicKey: TEST_LICENSE_KEYS.publicKeySpki,
      proAiPerDay: 0,
    })
  })

  it('still shows plans with checkout off — and never the secret', async () => {
    const off = await (await makeApp({ billing: testBilling({ razorpay: null }) }).request('/api/billing/config')).json()
    expect(off).toMatchObject({ checkout: null, keyId: null, licensePublicKey: TEST_LICENSE_KEYS.publicKeySpki })
    expect((off as BillingConfig).plans).toHaveLength(3)

    const noKeys = await (await makeApp({ license: NO_LICENSE_KEYS }).request('/api/billing/config')).json()
    expect(noKeys).toMatchObject({ checkout: null, keyId: null, licensePublicKey: null })

    expect(await (await makeApp().request('/api/billing/config')).text()).not.toContain(TEST_RAZORPAY.keySecret)
  })

  it('uses the configured prices', async () => {
    const config = (await (await makeApp({ billing: testBilling({ prices: { pro_monthly: 9900, pro_yearly: 79900, pro_lifetime: 199900 } }) }).request('/api/billing/config')).json()) as BillingConfig
    expect(config.plans.map((plan) => plan.amount)).toEqual([9900, 79900, 199900])
    expect(config.plans[1]?.savingsPercent).toBe(32)
  })
})

/* ---------------------------------------------------------------- orders */

describe('POST /api/billing/order', () => {
  it('creates a Razorpay order for the plan at its price', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ status: 'created', amount_paid: 0 })))
    const response = await post(makeApp(), '/api/billing/order', { plan: 'pro_yearly' })
    expect(response.status).toBe(200)
    expect((await response.json()) as OrderResponse).toEqual({ orderId: ORDER_ID, amount: 39900, currency: 'INR', keyId: TEST_RAZORPAY.keyId, plan: 'pro_yearly' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://razorpay.test/v1/orders')
    expect(init?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from(`${TEST_RAZORPAY.keyId}:${TEST_RAZORPAY.keySecret}`).toString('base64')}` })
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(sent).toMatchObject({ amount: 39900, currency: 'INR', notes: { product: 'settle_pro', plan: 'pro_yearly' } })
    expect(sent.receipt).toMatch(/^settle_pro_yearly_[0-9a-f]{12}$/)
    expect(String(sent.receipt).length).toBeLessThanOrEqual(40)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[billing] order ${ORDER_ID}`))
  })

  it('charges the server price, whatever else the client sends', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ status: 'created', amount: 4900 })))
    await post(makeApp(), '/api/billing/order', { plan: 'pro_monthly', amount: 1 })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ amount: 4900 })
  })

  it.each([[{}], [{ plan: 'pro_forever' }], [{ plan: 5 }], ['{"plan":']])('rejects %j', async (body) => {
    const response = await post(makeApp(), '/api/billing/order', body)
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('names the problem for an unknown plan', async () => {
    await expectError(await post(makeApp(), '/api/billing/order', { plan: 'pro_weekly' }), 400, 'bad_request', BILLING_MESSAGES.badPlan)
  })

  it('answers 503 billing_unavailable when checkout is off', async () => {
    await expectError(await post(makeApp({ billing: testBilling({ razorpay: null }) }), '/api/billing/order', { plan: 'pro_yearly' }), 503, 'billing_unavailable', BILLING_MESSAGES.checkoutOff)
    await expectError(await post(makeApp({ license: NO_LICENSE_KEYS }), '/api/billing/order', { plan: 'pro_yearly' }), 503, 'billing_unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps Razorpay failures to calm messages and logs the cause', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { description: 'Authentication failed' } }, 401))
    await expectError(await post(makeApp(), '/api/billing/order', { plan: 'pro_yearly' }), 503, 'billing_unavailable', BILLING_MESSAGES.checkoutDown)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET'))

    fetchMock.mockResolvedValueOnce(json({ error: {} }, 500))
    await expectError(await post(makeApp(), '/api/billing/order', { plan: 'pro_yearly' }), 502, 'upstream_error', BILLING_MESSAGES.unreachable)

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expectError(await post(makeApp(), '/api/billing/order', { plan: 'pro_yearly' }), 502, 'upstream_error')
    expect(allLogs()).not.toContain(TEST_RAZORPAY.keySecret)
  })
})

/* ---------------------------------------------------------------- verify */

describe('POST /api/billing/verify', () => {
  const verifyBody = (overrides: Record<string, unknown> = {}) => ({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: signature(), ...overrides })

  it('checks the signature, confirms the order is paid and returns a license for its plan', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder()))
    const response = await post(makeApp(), '/api/billing/verify', verifyBody())
    expect(response.status).toBe(200)
    const { license } = (await response.json()) as VerifyResponse
    const check = verifyLicense(license, TEST_LICENSE_KEYS.publicKey!, NOW_SECONDS)
    const iat = NOW_SECONDS - 120
    expect(check).toEqual({ valid: true, active: true, license: { id: PAYMENT_ID, plan: 'pro_yearly', iat, exp: iat + 365 * DAY } })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://razorpay.test/v1/orders/${ORDER_ID}`)
    expect(logger.info).toHaveBeenCalledWith(`[billing] license issued · pro_yearly · ${PAYMENT_ID}`)
  })

  it('reads the plan from the order, never from the client', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ amount: 4900, amount_paid: 4900, notes: { product: 'settle_pro', plan: 'pro_monthly' } })))
    const response = await post(makeApp(), '/api/billing/verify', verifyBody({ plan: 'pro_lifetime' }))
    const { license } = (await response.json()) as VerifyResponse
    expect(verifyLicense(license, TEST_LICENSE_KEYS.publicKey!, NOW_SECONDS).license?.plan).toBe('pro_monthly')
  })

  it('issues lifetime licenses that never expire', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ amount: 99900, amount_paid: 99900, notes: { product: 'settle_pro', plan: 'pro_lifetime' } })))
    const { license } = (await (await post(makeApp(), '/api/billing/verify', verifyBody())).json()) as VerifyResponse
    expect(verifyLicense(license, TEST_LICENSE_KEYS.publicKey!, NOW_SECONDS + 100 * 365 * DAY)).toMatchObject({ active: true, license: { exp: null } })
  })

  it('gives the same pass however often the same payment is verified (no stretching it later)', async () => {
    fetchMock.mockImplementation(async () => json(razorpayOrder()))
    const first = ((await (await post(makeApp(), '/api/billing/verify', verifyBody())).json()) as VerifyResponse).license
    const muchLater = createApp(testConfig(), { logger, now: () => (NOW_SECONDS + 400 * DAY) * 1000 })
    const second = ((await (await post(muchLater, '/api/billing/verify', verifyBody())).json()) as VerifyResponse).license
    expect(second).toBe(first)
    expect(verifyLicense(second, TEST_LICENSE_KEYS.publicKey!, NOW_SECONDS + 400 * DAY).active).toBe(false)
  })

  it('rejects a forged or mismatched signature before calling Razorpay', async () => {
    for (const body of [
      verifyBody({ signature: signature(ORDER_ID, 'pay_Other123456') }),
      verifyBody({ signature: signature(ORDER_ID, PAYMENT_ID, 'not-the-secret') }),
      verifyBody({ signature: '0'.repeat(64) }),
    ]) {
      await expectError(await post(makeApp(), '/api/billing/verify', body), 400, 'bad_request', BILLING_MESSAGES.badPayment)
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('signature mismatch'))
  })

  it.each([
    [{}],
    [{ orderId: ORDER_ID, paymentId: PAYMENT_ID }],
    [{ orderId: 'order_', paymentId: PAYMENT_ID, signature: signature() }],
    [{ orderId: ORDER_ID, paymentId: 'payment-1', signature: signature() }],
    [{ orderId: `${ORDER_ID}/../x`, paymentId: PAYMENT_ID, signature: signature() }],
    [{ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: 'xyz' }],
  ])('rejects malformed body %j', async (body) => {
    await expectError(await post(makeApp(), '/api/billing/verify', body), 400, 'bad_request', BILLING_MESSAGES.malformed)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 409 while the order is not paid yet', async () => {
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ status: 'attempted', amount_paid: 0 })))
    await expectError(await post(makeApp(), '/api/billing/verify', verifyBody()), 409, 'bad_request', BILLING_MESSAGES.notPaid)
  })

  it("refuses orders that aren't Settle Pro orders", async () => {
    for (const notes of [{ plan: 'pro_yearly' }, { product: 'other', plan: 'pro_yearly' }, { product: 'settle_pro', plan: 'pro_forever' }, []]) {
      fetchMock.mockResolvedValueOnce(json(razorpayOrder({ notes })))
      await expectError(await post(makeApp(), '/api/billing/verify', verifyBody()), 400, 'bad_request', BILLING_MESSAGES.notOurs)
    }
    fetchMock.mockResolvedValueOnce(json(razorpayOrder({ id: 'order_SomethingElse1' })))
    await expectError(await post(makeApp(), '/api/billing/verify', verifyBody()), 400, 'bad_request', BILLING_MESSAGES.notOurs)
  })

  it('treats an order Razorpay does not know as a bad payment, and an outage as retryable', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { description: 'The id provided does not exist' } }, 400))
    await expectError(await post(makeApp(), '/api/billing/verify', verifyBody()), 400, 'bad_request', BILLING_MESSAGES.badPayment)
    fetchMock.mockResolvedValueOnce(json({}, 503))
    await expectError(await post(makeApp(), '/api/billing/verify', verifyBody()), 502, 'upstream_error', BILLING_MESSAGES.unreachable)
  })

  it('answers 503 when checkout is off', async () => {
    await expectError(await post(makeApp({ billing: testBilling({ razorpay: null }) }), '/api/billing/verify', verifyBody()), 503, 'billing_unavailable')
  })
})

/* ---------------------------------------------------------------- license check */

describe('POST /api/license/verify', () => {
  const issue = (exp: number | null, keys = TEST_LICENSE_KEYS) => signLicense({ id: 'code-test', plan: 'pro_yearly', iat: NOW_SECONDS - DAY, exp }, keys.privateKey!)

  it('reports a valid, active license', async () => {
    const response = await post(makeApp(), '/api/license/verify', { license: issue(NOW_SECONDS + DAY) })
    expect((await response.json()) as LicenseVerifyResponse).toEqual({
      valid: true,
      active: true,
      license: { id: 'code-test', plan: 'pro_yearly', iat: NOW_SECONDS - DAY, exp: NOW_SECONDS + DAY },
    })
  })

  it('reports an expired license as valid but not active', async () => {
    const body = (await (await post(makeApp(), '/api/license/verify', { license: issue(NOW_SECONDS - 1) })).json()) as LicenseVerifyResponse
    expect(body).toMatchObject({ valid: true, active: false })
  })

  it('reports forged or garbled codes as invalid', async () => {
    for (const license of [issue(null, OTHER_LICENSE_KEYS), 'SETTLE1.nope.nope', 'hello']) {
      expect(await (await post(makeApp(), '/api/license/verify', { license })).json()).toEqual({ valid: false, active: false, license: null })
    }
  })

  it('checks with the public key alone', async () => {
    const verifyOnly = { privateKey: null, publicKey: TEST_LICENSE_KEYS.publicKey, publicKeySpki: TEST_LICENSE_KEYS.publicKeySpki }
    expect(await (await post(makeApp({ license: verifyOnly }), '/api/license/verify', { license: issue(null) })).json()).toMatchObject({ valid: true, active: true })
  })

  it('rejects a malformed body and answers 503 without a key', async () => {
    await expectError(await post(makeApp(), '/api/license/verify', { license: 5 }), 400, 'bad_request')
    await expectError(await post(makeApp(), '/api/license/verify', { license: 'x'.repeat(5000) }), 400, 'bad_request')
    await expectError(await post(makeApp({ license: NO_LICENSE_KEYS }), '/api/license/verify', { license: issue(null) }), 503, 'billing_unavailable', BILLING_MESSAGES.licensingOff)
  })
})

/* ---------------------------------------------------------------- guards */

describe('billing guards', () => {
  it('rate-limits order, verify and license checks per client together', async () => {
    const app = makeApp({ billing: testBilling({ rateLimit: { max: 2, windowMs: 60_000 } }) })
    expect((await post(app, '/api/license/verify', { license: 'x' })).status).toBe(200)
    expect((await post(app, '/api/billing/order', { plan: 'nope' })).status).toBe(400)
    const limited = await post(app, '/api/billing/verify', {})
    await expectError(limited, 429, 'rate_limited', BILLING_MESSAGES.tooMany)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await post(app, '/api/billing/verify', {}, {}, '198.51.100.99')).status).toBe(400)
    // The config stays readable.
    expect((await app.request('/api/billing/config')).status).toBe(200)
  })

  it('rejects cross-site and non-JSON requests', async () => {
    await expectError(await post(makeApp(), '/api/billing/order', { plan: 'pro_yearly' }, { 'sec-fetch-site': 'cross-site' }), 403, 'bad_request')
    await expectError(await post(makeApp(), '/api/billing/verify', { plan: 'pro_yearly' }, { 'content-type': 'text/plain' }), 415, 'bad_request')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers wrong methods with 405 and an Allow header', async () => {
    const getOrder = await makeApp().request('/api/billing/order')
    await expectError(getOrder, 405, 'bad_request')
    expect(getOrder.headers.get('allow')).toBe('POST')
    const postConfig = await makeApp().request('/api/billing/config', { method: 'POST' })
    await expectError(postConfig, 405, 'bad_request')
    expect(postConfig.headers.get('allow')).toBe('GET, HEAD')
    expect((await makeApp().request('/api/license/verify')).headers.get('allow')).toBe('POST')
  })
})
