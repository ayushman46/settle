/**
 * Mocked services, by route interception in the browser: the app's AI endpoints (which would
 * call NVIDIA) and Razorpay Checkout (its script plus our billing endpoints). Nothing reaches
 * either service from a test.
 *
 * One `MockApi` per browser context. Its routes are registered once; tests change what they
 * answer by setting a reply (`api.describe = …`), and read what the app sent from `api.calls`.
 */
import type { BrowserContext, Route } from '@playwright/test'
import type {
  ApiErrorBody,
  ApiErrorCode,
  BillingConfig,
  DescribeRequest,
  DescribeResponse,
  HealthResponse,
  OrderRequest,
  OrderResponse,
  PlanId,
  ScanRequest,
  ScanResponse,
  VerifyRequest,
  VerifyResponse,
} from '../../shared/api'
import { buildPlans, DEFAULT_PRICES } from '../../server/plans'
import { TEST_LICENSE_PUBLIC_KEY, testLicense } from './license'

/** What a mocked endpoint answers: a body with a status, after an optional delay. */
export interface Reply<T> {
  status?: number
  body: T | ApiErrorBody
  /** Network + model time to simulate, in ms. */
  delayMs?: number
  headers?: Record<string, string>
}

/** `{ error: { code, message } }` with the status the server uses for that code. */
export function apiError(code: ApiErrorCode, message = 'Mocked failure', status = ERROR_STATUS[code]): Reply<never> {
  return { status, body: { error: { code, message } } }
}

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unsupported_image: 415,
  image_too_large: 413,
  not_a_bill: 422,
  unreadable: 422,
  not_a_split: 422,
  not_configured: 503,
  upstream_auth: 502,
  rate_limited: 429,
  timeout: 504,
  upstream_error: 502,
  billing_unavailable: 503,
  rates_unavailable: 503,
}

export const MOCK_MODEL = 'e2e/mock-model'

/** A restaurant bill as the vision model would read it (amounts in rupees). */
export const SAMPLE_SCAN: ScanResponse = {
  merchant: 'Saffron Table',
  date: '2026-10-18',
  currency: 'INR',
  category: 'food',
  items: [
    { name: 'Paneer Tikka', quantity: 1, amount: 345 },
    { name: 'Garlic Naan', quantity: 4, amount: 300 },
    { name: 'Dal Makhani', quantity: 1, amount: 295 },
    { name: 'Masala Chaas', quantity: 2, amount: 160 },
  ],
  subtotal: 1100,
  tax: 55,
  serviceCharge: null,
  fees: [],
  discount: null,
  tip: null,
  total: 1155,
  warnings: [],
  model: MOCK_MODEL,
}

/** "Cab 840 with Riya and Sam, Sam pays double" as the text model would read it. */
export const SAMPLE_DESCRIBE: DescribeResponse = {
  title: 'Cab',
  category: 'transport',
  amount: 840,
  currency: 'INR',
  mode: 'shares',
  payer: 'Me',
  people: [
    { name: 'Me', value: 1 },
    { name: 'Riya', value: 1 },
    { name: 'Sam', value: 2 },
  ],
  headcount: null,
  date: null,
  model: MOCK_MODEL,
}

export const MOCK_RAZORPAY_KEY_ID = 'rzp_test_E2eMockKey0001'

export type CheckoutOutcome = 'paid' | 'dismissed' | 'failed'

export interface MockApi {
  /** `GET /api/health`; null makes the server unreachable. Default: AI on. */
  health: Reply<HealthResponse> | null
  /** `POST /api/describe`. Default: `SAMPLE_DESCRIBE`. */
  describe: Reply<DescribeResponse>
  /** `POST /api/scan`. Default: `SAMPLE_SCAN`. */
  scan: Reply<ScanResponse>
  /**
   * Razorpay Checkout. null (default) leaves `/api/billing/*` to the real server (checkout off,
   * codes on). Set it to make checkout available and decide how the payment ends.
   */
  checkout: CheckoutOutcome | null
  /** What the app sent, oldest first. */
  readonly calls: {
    describe: DescribeRequest[]
    scan: ScanRequest[]
    order: OrderRequest[]
    verify: VerifyRequest[]
    /** License header values sent with AI calls (null when none). */
    licenseHeaders: Array<string | null>
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fulfill<T>(route: Route, reply: Reply<T>): Promise<void> {
  if (reply.delayMs) await delay(reply.delayMs)
  await route.fulfill({
    status: reply.status ?? 200,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store', ...reply.headers },
    body: JSON.stringify(reply.body),
  })
}

function bodyOf<T>(route: Route): T {
  try {
    return route.request().postDataJSON() as T
  } catch {
    return {} as T
  }
}

/** A stand-in for checkout.razorpay.com/v1/checkout.js: "pays", "fails" or is closed at once. */
function razorpayScript(outcome: CheckoutOutcome): string {
  return `(() => {
  window.Razorpay = function (options) {
    const handlers = {}
    return {
      on(event, fn) { handlers[event] = fn },
      open() {
        window.__e2eRazorpayOptions = { key: options.key, amount: options.amount, currency: options.currency, order_id: options.order_id, description: options.description }
        setTimeout(() => {
          const outcome = ${JSON.stringify(outcome)}
          if (outcome === 'paid') {
            options.handler({ razorpay_payment_id: 'pay_E2eTest00000001', razorpay_order_id: options.order_id, razorpay_signature: '${'a'.repeat(64)}' })
          } else {
            if (outcome === 'failed' && handlers['payment.failed']) handlers['payment.failed']({ error: { description: 'Your bank declined this test payment.' } })
            if (options.modal && options.modal.ondismiss) options.modal.ondismiss()
          }
        }, 60)
      },
    }
  }
})()`
}

/** Registers the mocked endpoints on `context` and returns their controls. */
export async function installMockApi(context: BrowserContext): Promise<MockApi> {
  const api: MockApi = {
    health: { body: { ok: true, configured: true, models: [MOCK_MODEL] } },
    describe: { body: SAMPLE_DESCRIBE, delayMs: 300 },
    scan: { body: SAMPLE_SCAN, delayMs: 600 },
    checkout: null,
    calls: { describe: [], scan: [], order: [], verify: [], licenseHeaders: [] },
  }

  await context.route('**/api/health', async (route) => {
    if (api.health === null) return route.abort('connectionrefused')
    return fulfill(route, api.health)
  })

  await context.route('**/api/describe', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    api.calls.describe.push(bodyOf<DescribeRequest>(route))
    api.calls.licenseHeaders.push(route.request().headers()['x-settle-license'] ?? null)
    return fulfill(route, api.describe)
  })

  await context.route('**/api/scan', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    api.calls.scan.push(bodyOf<ScanRequest>(route))
    api.calls.licenseHeaders.push(route.request().headers()['x-settle-license'] ?? null)
    return fulfill(route, api.scan)
  })

  await context.route('**/api/billing/config', async (route) => {
    if (api.checkout === null) return route.fallback()
    const config: BillingConfig = {
      checkout: 'razorpay',
      keyId: MOCK_RAZORPAY_KEY_ID,
      currency: 'INR',
      plans: buildPlans(DEFAULT_PRICES),
      licensePublicKey: TEST_LICENSE_PUBLIC_KEY,
      proAiPerDay: 200,
    }
    return fulfill(route, { body: config })
  })

  await context.route('**/api/billing/order', async (route) => {
    if (api.checkout === null) return route.fallback()
    const request = bodyOf<OrderRequest>(route)
    api.calls.order.push(request)
    const plan: PlanId = request.plan
    const order: OrderResponse = {
      orderId: 'order_E2eTest00000001',
      amount: DEFAULT_PRICES[plan],
      currency: 'INR',
      keyId: MOCK_RAZORPAY_KEY_ID,
      plan,
    }
    return fulfill(route, { body: order, delayMs: 150 })
  })

  await context.route('**/api/billing/verify', async (route) => {
    if (api.checkout === null) return route.fallback()
    api.calls.verify.push(bodyOf<VerifyRequest>(route))
    const plan = api.calls.order.at(-1)?.plan ?? 'pro_yearly'
    const verified: VerifyResponse = { license: testLicense(plan, { id: 'pay_E2eTest00000001' }) }
    return fulfill(route, { body: verified, delayMs: 150 })
  })

  await context.route('https://checkout.razorpay.com/**', async (route) => {
    if (api.checkout === null) return route.abort('blockedbyclient')
    return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: razorpayScript(api.checkout) })
  })

  return api
}
