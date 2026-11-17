/**
 * Mocked services, by route interception in the browser: the app's AI endpoints (which would
 * call NVIDIA), exchange rates (which would call the ECB) and Razorpay Checkout (its script plus
 * our billing endpoints). Nothing reaches any of them from a test.
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
  HistoryRequest,
  HistoryResponse,
  OrderRequest,
  OrderResponse,
  PlanId,
  ProofRequest,
  ProofResponse,
  RatesResponse,
  ScanRequest,
  ScanResponse,
  VerifyRequest,
  VerifyResponse,
} from '../../shared/api'
import { PEGS } from '../../shared/api'
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

/**
 * A Swiggy order as the vision model would read it (spec 08 §4.1): items ₹857, tax ₹42.85, four
 * fees (₹90), a ₹100 coupon → ₹889.85 paid.
 */
export const SAMPLE_DELIVERY_SCAN: ScanResponse = {
  merchant: 'Behrouz Biryani',
  date: '2026-10-21',
  currency: 'INR',
  category: 'food',
  items: [
    { name: 'Chicken Biryani', quantity: 1, amount: 349 },
    { name: 'Paneer Butter Masala', quantity: 1, amount: 289 },
    { name: 'Garlic Naan', quantity: 2, amount: 120 },
    { name: 'Gulab Jamun (2 pcs)', quantity: 1, amount: 99 },
  ],
  subtotal: 857,
  tax: 42.85,
  serviceCharge: null,
  fees: [
    { label: 'Delivery partner fee', kind: 'delivery', amount: 35 },
    { label: 'Platform fee', kind: 'platform', amount: 10 },
    { label: 'Restaurant packaging', kind: 'packaging', amount: 25 },
    { label: 'Rain fee', kind: 'surge', amount: 20 },
  ],
  discount: 100,
  tip: null,
  total: 889.85,
  warnings: [],
  model: MOCK_MODEL,
}

/** The day the rates mock answers for when none is asked. */
export const MOCK_RATES_DATE = '2026-10-21'

/** Units per 1 EUR — the spec's fixture table (spec 06 §4), not real rates. */
export const MOCK_ECB_RATES: Readonly<Record<string, number>> = { EUR: 1, USD: 1.0812, JPY: 163.42, INR: 90.4321, THB: 37.512, SGD: 1.4103, IDR: 17012.5, GBP: 0.8364 }

/** What `GET /api/rates` answers in tests: the fixture table plus the pegs, for `date`. */
export function mockRates(date: string = MOCK_RATES_DATE): RatesResponse {
  const rates: Record<string, number> = { ...MOCK_ECB_RATES }
  const pegged: Record<string, { to: string; peg: number }> = {}
  for (const [code, [base, peg]] of Object.entries(PEGS)) {
    const baseRate = rates[base]
    if (baseRate === undefined) continue
    rates[code] = baseRate * peg
    pegged[code] = { to: base, peg }
  }
  return { date, base: 'EUR', rates, pegged }
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

/** A finished GPay payment of ₹420 from Riya to the owner (the reading the server gives for a clear screenshot). */
export const SAMPLE_PROOF: ProofResponse = {
  app: 'gpay',
  status: 'success',
  amount: 420,
  currency: 'INR',
  payerName: 'Riya Sharma',
  payeeName: 'Ayush',
  payeeUpi: null,
  utr: '431287654321',
  date: '2026-10-23',
  time: '18:42',
  model: MOCK_MODEL,
}

/** A Google Pay history screenshot, filtered to money received: Sam paid ₹420; one payment went out. */
export const SAMPLE_HISTORY: HistoryResponse = {
  app: 'gpay',
  rows: [{ name: 'Sam D', handle: null, amount: 420, date: '2026-10-24', status: 'success', cue: 'received_word', utr: null, cutOff: false }],
  skippedOutgoing: 1,
  model: MOCK_MODEL,
}

export const MOCK_RAZORPAY_KEY_ID = 'rzp_test_E2eMockKey0001'

export type CheckoutOutcome = 'paid' | 'dismissed' | 'failed'

export interface MockApi {
  /** `GET /api/health`; null makes the server unreachable. Default: AI on. */
  health: Reply<HealthResponse> | null
  /** `POST /api/describe`. Default: `SAMPLE_DESCRIBE`. */
  describe: Reply<DescribeResponse>
  /** `POST /api/scan`. Default: `SAMPLE_SCAN` (`SAMPLE_DELIVERY_SCAN` for a delivery order). */
  scan: Reply<ScanResponse>
  /** `POST /api/proof` (a payment screenshot). Default: `SAMPLE_PROOF` (a finished GPay payment of ₹420 to the owner). */
  proof: Reply<ProofResponse>
  /** `POST /api/history` (screenshots of a UPI app's history). Default: `SAMPLE_HISTORY`. */
  history: Reply<HistoryResponse>
  /**
   * `GET /api/rates`. 'fixture' (default) answers `mockRates(asked date or MOCK_RATES_DATE)`; a
   * Reply answers as given; null makes the request fail like a phone that's offline.
   */
  rates: Reply<RatesResponse> | 'fixture' | null
  /**
   * Razorpay Checkout. null (default) leaves `/api/billing/*` to the real server (checkout off,
   * codes on). Set it to make checkout available and decide how the payment ends.
   */
  checkout: CheckoutOutcome | null
  /**
   * The Settle account (`/api/cloud/*`). 'signedIn' (default): a signed-in account whose database
   * starts empty and takes every sync; 'signedOut': nobody signed in (the app asks for a passkey).
   */
  cloud: 'signedIn' | 'signedOut'
  /** The signed-in account `/api/cloud/me` answers; passkey changes and deletion change it. */
  me: AccountMock
  /** What `/api/cloud/dashboard` answers (account groups, and payments under way). */
  dashboard: { owe: number; owed: number; net: number; groups: Array<Record<string, unknown>>; open: Array<Record<string, unknown>> }
  /** What the app sent, oldest first. */
  readonly calls: {
    /** Each request body as sent (including `lang` and `source` when the app sends them). */
    describe: DescribeRequest[]
    scan: ScanRequest[]
    proof: ProofRequest[]
    history: HistoryRequest[]
    /** The `date` asked for on each `GET /api/rates` (null when none). */
    rates: Array<string | null>
    order: OrderRequest[]
    verify: VerifyRequest[]
    /** License header values sent with AI calls (null when none). */
    licenseHeaders: Array<string | null>
    /** Each `POST /api/cloud/sync/push` body. */
    cloudPush: Array<Record<string, unknown[]>>
    /** Each `POST /api/cloud/me/delete` body. */
    cloudDelete: Array<Record<string, unknown>>
    /** Each `DELETE /api/cloud/passkeys/:id`, by id. */
    passkeyDelete: string[]
  }
}

export type AccountMock = typeof MOCK_ME

/** The signed-in account the mocked `/api/cloud/me` answers. */
export const MOCK_ME = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Ayush',
  phoneNumber: '+919876543210',
  phoneVerified: false,
  createdAt: '2026-11-16T00:00:00Z',
  passkeys: [{ id: '00000000-0000-4000-8000-000000000002', credentialId: 'mock-credential-0001', nickname: null as string | null, provider: 'Google Password Manager' as string | null, current: true, deviceType: 'multiDevice', backedUp: true, createdAt: '2026-11-16T00:00:00Z', lastUsedAt: null as string | null }],
  paymentMethods: [],
  freshUntil: '2026-11-16T00:05:00Z',
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
    proof: { body: SAMPLE_PROOF, delayMs: 300 },
    history: { body: SAMPLE_HISTORY, delayMs: 300 },
    rates: 'fixture',
    checkout: null,
    cloud: 'signedIn',
    me: structuredClone(MOCK_ME),
    dashboard: { owe: 0, owed: 0, net: 0, groups: [], open: [] },
    calls: { describe: [], scan: [], proof: [], history: [], rates: [], order: [], verify: [], licenseHeaders: [], cloudPush: [], cloudDelete: [], passkeyDelete: [] },
  }

  // The account: never the real one from a test. Pulls answer empty; pushes are recorded.
  await context.route((url) => url.pathname.startsWith('/api/cloud/'), async (route) => {
    const path = new URL(route.request().url()).pathname.slice('/api/cloud'.length)
    const method = route.request().method()
    if (method === 'GET' && path === '/me') {
      return api.cloud === 'signedIn'
        ? fulfill(route, { body: { me: api.me } })
        : fulfill(route, { status: 401, body: { error: { code: 'unauthenticated', message: 'Please sign in with your passkey.' } } })
    }
    if (method === 'GET' && path === '/sync/pull') return fulfill(route, { body: { friends: [], groups: [], expenses: [], stores: [], cursor: 0, more: false } })
    if (method === 'POST' && path === '/sync/push') {
      const body = bodyOf<Record<string, unknown[]>>(route)
      api.calls.cloudPush.push(body)
      const written = Object.values(body).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0)
      return fulfill(route, { body: { written } })
    }
    if (method === 'POST' && path.startsWith('/auth/logout')) return fulfill(route, { body: { ok: true } })
    if (method === 'GET' && path === '/dashboard') return fulfill(route, { body: api.dashboard })
    const passkey = /^\/passkeys\/([^/]+)$/.exec(path)
    if (passkey && method === 'PATCH') {
      const nickname = bodyOf<{ nickname: string | null }>(route).nickname
      api.me = { ...api.me, passkeys: api.me.passkeys.map((p) => (p.id === passkey[1] ? { ...p, nickname } : p)) }
      return fulfill(route, { body: { me: api.me } })
    }
    if (passkey && method === 'DELETE') {
      api.calls.passkeyDelete.push(passkey[1]!)
      api.me = { ...api.me, passkeys: api.me.passkeys.filter((p) => p.id !== passkey[1]) }
      return fulfill(route, { body: { me: api.me } })
    }
    if (method === 'POST' && path === '/me/delete') {
      api.calls.cloudDelete.push(bodyOf<Record<string, unknown>>(route))
      const credentialIds = api.me.passkeys.map((p) => p.credentialId)
      api.cloud = 'signedOut'
      return fulfill(route, { body: { ok: true, credentialIds } })
    }
    return fulfill(route, { status: 404, body: { error: { code: 'not_found', message: 'Not mocked' } } })
  })

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

  await context.route('**/api/proof', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    api.calls.proof.push(bodyOf<ProofRequest>(route))
    api.calls.licenseHeaders.push(route.request().headers()['x-settle-license'] ?? null)
    return fulfill(route, api.proof)
  })

  await context.route('**/api/history', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    api.calls.history.push(bodyOf<HistoryRequest>(route))
    api.calls.licenseHeaders.push(route.request().headers()['x-settle-license'] ?? null)
    return fulfill(route, api.history)
  })

  await context.route('**/api/scan', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    api.calls.scan.push(bodyOf<ScanRequest>(route))
    api.calls.licenseHeaders.push(route.request().headers()['x-settle-license'] ?? null)
    return fulfill(route, api.scan)
  })

  // The API path only: a glob like `**/api/rates**` also caught the dev server's `/src/api/rates.ts`.
  await context.route((url) => url.pathname === '/api/rates', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const asked = new URL(route.request().url()).searchParams.get('date')
    api.calls.rates.push(asked)
    if (api.rates === null) return route.abort('internetdisconnected')
    if (api.rates === 'fixture') return fulfill(route, { body: mockRates(asked ?? MOCK_RATES_DATE), delayMs: 120, headers: { 'cache-control': 'public, max-age=900' } })
    return fulfill(route, api.rates)
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
