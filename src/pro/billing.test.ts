import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingConfig } from '../../shared/api'
import {
  CHECKOUT_MESSAGES,
  loadRazorpay,
  RAZORPAY_LOAD_TIMEOUT_MS,
  RAZORPAY_SCRIPT_URL,
  resetBillingForTests,
  startCheckout,
  unconfirmedPaymentMessage,
  type CheckoutResult,
  type RazorpayConstructor,
} from './billing'
import { FALLBACK_BILLING_CONFIG } from './config'
import { readPendingPayment } from './pending'
import { CLAIM_RETRY_DELAYS_MS, proState } from './store'
import { createTestSigner, resetProModulesForTests, type TestSigner } from './testKit'

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

const fetchMock = vi.fn<typeof fetch>()
let routes: Record<string, Handler> = {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function calls(url: string): Array<RequestInit | undefined> {
  return fetchMock.mock.calls.filter(([u]) => u === url).map(([, init]) => init)
}

/* ------------------------------------------------------------------ a fake Razorpay Checkout */

interface FakeCheckout {
  options: Record<string, unknown> & {
    handler: (r: unknown) => void
    modal: { ondismiss: () => void }
  }
  failed: Array<(r: unknown) => void>
  opened: boolean
  pay(paymentId?: string): void
  fail(description?: string): void
  dismiss(): void
}

let checkouts: FakeCheckout[] = []
let constructorThrows = false

const FakeRazorpay = function (this: unknown, options: FakeCheckout['options']) {
  if (constructorThrows) throw new Error('Invalid key')
  const checkout: FakeCheckout = {
    options,
    failed: [],
    opened: false,
    pay: (paymentId = 'pay_123') =>
      options.handler({ razorpay_payment_id: paymentId, razorpay_order_id: 'order_1', razorpay_signature: 'sig_ok' }),
    fail: (description) => {
      for (const listener of checkout.failed) listener({ error: { code: 'BAD_REQUEST_ERROR', description } })
    },
    dismiss: () => options.modal.ondismiss(),
  }
  checkouts.push(checkout)
  return {
    open: () => {
      checkout.opened = true
    },
    on: (_event: string, listener: (r: unknown) => void) => {
      checkout.failed.push(listener)
    },
  }
} as unknown as RazorpayConstructor

function installRazorpay(): void {
  ;(window as unknown as { Razorpay?: unknown }).Razorpay = FakeRazorpay
}

function uninstallRazorpay(): void {
  delete (window as unknown as { Razorpay?: unknown }).Razorpay
}

function scriptTags(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_URL}"]`))
}

/** Waits until Checkout is open (the order and script steps are async). */
async function opened(): Promise<FakeCheckout> {
  await vi.waitFor(() => expect(checkouts.at(-1)?.opened).toBe(true))
  const checkout = checkouts.at(-1)
  if (!checkout) throw new Error('no checkout')
  return checkout
}

/* ------------------------------------------------------------------ setup */

let signer: TestSigner
let other: TestSigner

beforeAll(async () => {
  signer = await createTestSigner()
  other = await createTestSigner()
})

const LIVE: BillingConfig = {
  ...FALLBACK_BILLING_CONFIG,
  checkout: 'razorpay',
  keyId: 'rzp_test_abc',
  licensePublicKey: null,
}

function serve(config: Partial<BillingConfig> = {}): void {
  routes['/api/billing/config'] = () => json({ ...LIVE, licensePublicKey: signer.publicKey, ...config })
  routes['/api/billing/order'] = async (init) => {
    const { plan } = JSON.parse(String(init?.body)) as { plan: string }
    const amount = FALLBACK_BILLING_CONFIG.plans.find((p) => p.id === plan)?.amount ?? 0
    return json({ orderId: 'order_1', amount, currency: 'INR', keyId: 'rzp_test_abc', plan })
  }
}

beforeEach(() => {
  routes = {}
  checkouts = []
  constructorThrows = false
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url, init) => {
    const handler = routes[String(url)]
    if (!handler) throw new TypeError(`Failed to fetch ${String(url)}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  resetProModulesForTests()
  resetBillingForTests()
  installRazorpay()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  uninstallRazorpay()
  for (const script of scriptTags()) script.remove()
  resetProModulesForTests()
  resetBillingForTests()
})

/* ------------------------------------------------------------------ tests */

describe('startCheckout', () => {
  it('orders, opens Checkout, confirms the payment and unlocks Pro', async () => {
    serve()
    const token = await signer.token({ id: 'pay_123', plan: 'pro_yearly' })
    routes['/api/billing/verify'] = () => json({ license: token })

    const promise = startCheckout('pro_yearly', { name: '  Riya ', contact: '9876543210' })
    const checkout = await opened()
    expect(JSON.parse(String(calls('/api/billing/order')[0]?.body))).toEqual({ plan: 'pro_yearly' })
    expect(checkout.options).toMatchObject({
      key: 'rzp_test_abc',
      amount: 39900,
      currency: 'INR',
      order_id: 'order_1',
      name: 'Settle',
      description: 'Settle Pro · Yearly',
      prefill: { name: 'Riya', contact: '9876543210' },
      theme: { color: '#0E1013' },
    })

    checkout.pay('pay_123')
    await expect(promise).resolves.toEqual({
      status: 'success',
      license: expect.objectContaining({ id: 'pay_123', plan: 'pro_yearly' }) as unknown,
    })
    expect(JSON.parse(String(calls('/api/billing/verify')[0]?.body))).toEqual({
      orderId: 'order_1',
      paymentId: 'pay_123',
      signature: 'sig_ok',
    })
    expect(proState().status).toBe('pro')
    expect(readPendingPayment()).toBeNull()
  })

  it('leaves the prefill empty when nothing is known', async () => {
    serve()
    void startCheckout('pro_monthly')
    const checkout = await opened()
    expect(checkout.options.prefill).toEqual({})
    expect(checkout.options.amount).toBe(4900)
    checkout.dismiss()
  })

  it('is cancelled when the buyer closes the window', async () => {
    serve()
    const promise = startCheckout('pro_lifetime')
    ;(await opened()).dismiss()
    await expect(promise).resolves.toEqual({ status: 'cancelled' })
    expect(calls('/api/billing/verify')).toHaveLength(0)
    expect(proState().status).toBe('free')
  })

  it('reports the last failed attempt when the buyer gives up after it', async () => {
    serve()
    const promise = startCheckout('pro_monthly')
    const checkout = await opened()
    checkout.fail('Your payment was declined by the bank.')
    checkout.dismiss()
    await expect(promise).resolves.toEqual({ status: 'failed', message: 'Your payment was declined by the bank.' })
  })

  it('uses our own copy when the failure has no usable description', async () => {
    serve()
    const promise = startCheckout('pro_monthly')
    const checkout = await opened()
    checkout.fail('x'.repeat(300))
    checkout.dismiss()
    await expect(promise).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.paymentFailed })
  })

  it('keeps going when a failed attempt is retried successfully in the same window', async () => {
    serve()
    routes['/api/billing/verify'] = async () => json({ license: await signer.token({ id: 'pay_2' }) })
    const promise = startCheckout('pro_yearly')
    const checkout = await opened()
    checkout.fail('UPI request expired.')
    checkout.pay('pay_2')
    await expect(promise).resolves.toMatchObject({ status: 'success', license: { id: 'pay_2' } })
  })

  it('returns the same checkout for a double tap', async () => {
    serve()
    const first = startCheckout('pro_yearly')
    const second = startCheckout('pro_lifetime')
    expect(second).toBe(first)
    ;(await opened()).dismiss()
    await first
    expect(checkouts).toHaveLength(1)
    expect(calls('/api/billing/order')).toHaveLength(1)
  })

  it('is unavailable when the server has no checkout', async () => {
    routes['/api/billing/config'] = () => json({ ...FALLBACK_BILLING_CONFIG })
    await expect(startCheckout('pro_yearly')).resolves.toEqual({ status: 'unavailable' })
    expect(calls('/api/billing/order')).toHaveLength(0)
  })

  it('is unavailable when the server cannot be reached and only the built-in plans are known', async () => {
    await expect(startCheckout('pro_yearly')).resolves.toEqual({ status: 'unavailable' })
  })

  it('is unavailable when billing is switched off between config and order', async () => {
    serve()
    routes['/api/billing/order'] = () => json({ error: { code: 'billing_unavailable' } }, 503)
    await expect(startCheckout('pro_yearly')).resolves.toEqual({ status: 'unavailable' })
  })

  it('says so when offline, without calling anyone', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(startCheckout('pro_yearly')).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.offline })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each<[string, Handler, CheckoutResult]>([
    ['busy', () => json({ error: { code: 'rate_limited' } }, 429), { status: 'failed', message: CHECKOUT_MESSAGES.busy }],
    ['broken', () => json({ error: { code: 'upstream_error' } }, 502), { status: 'failed', message: CHECKOUT_MESSAGES.orderFailed }],
    ['garbled', () => json({ orderId: 'order_1', amount: -5 }), { status: 'failed', message: CHECKOUT_MESSAGES.orderFailed }],
    ['wrong currency', () => json({ orderId: 'o', amount: 4900, currency: 'USD', keyId: 'k', plan: 'pro_monthly' }), { status: 'failed', message: CHECKOUT_MESSAGES.orderFailed }],
    ['unreachable', () => Promise.reject(new TypeError('Failed to fetch')), { status: 'failed', message: CHECKOUT_MESSAGES.network }],
  ])('explains a %s order', async (_label, handler, expected) => {
    serve()
    routes['/api/billing/order'] = handler
    await expect(startCheckout('pro_monthly')).resolves.toEqual(expected)
    expect(checkouts).toHaveLength(0)
  })

  it('refuses a plan the server no longer sells', async () => {
    serve({ plans: FALLBACK_BILLING_CONFIG.plans.filter((p) => p.id !== 'pro_lifetime') })
    await expect(startCheckout('pro_lifetime')).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.planMissing })
  })

  it('explains a payment window that will not open', async () => {
    serve()
    constructorThrows = true
    await expect(startCheckout('pro_yearly')).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.orderFailed })
  })

  it('treats a garbled success callback as broken', async () => {
    serve()
    const promise = startCheckout('pro_yearly')
    ;(await opened()).options.handler({ razorpay_payment_id: 42 })
    await expect(promise).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.orderFailed })
  })

  it('keeps a paid order safe when the confirmation cannot get through', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    serve()
    routes['/api/billing/verify'] = () => json({}, 503)
    const promise = startCheckout('pro_yearly')
    const checkout = await opened()
    checkout.pay('pay_9')
    for (const delay of CLAIM_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay)
    await expect(promise).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.pending })
    expect(readPendingPayment()).toMatchObject({ orderId: 'order_1', paymentId: 'pay_9', plan: 'pro_yearly' })
  })

  it('gives the payment id when the server will not confirm it', async () => {
    serve()
    routes['/api/billing/verify'] = () => json({ error: { code: 'bad_request' } }, 400)
    const promise = startCheckout('pro_yearly')
    ;(await opened()).pay('pay_77')
    await expect(promise).resolves.toEqual({ status: 'failed', message: unconfirmedPaymentMessage('pay_77') })
    expect(unconfirmedPaymentMessage('pay_77')).toContain('pay_77')
  })

  it('refuses a license that is not genuine', async () => {
    serve()
    routes['/api/billing/verify'] = async () => json({ license: await other.token() })
    const promise = startCheckout('pro_yearly')
    ;(await opened()).pay('pay_5')
    await expect(promise).resolves.toEqual({ status: 'failed', message: unconfirmedPaymentMessage('pay_5') })
    expect(proState().status).toBe('free')
  })
})

describe('loadRazorpay', () => {
  beforeEach(() => {
    uninstallRazorpay()
  })

  it('uses Checkout when it is already on the page', async () => {
    installRazorpay()
    await expect(loadRazorpay()).resolves.toBe(FakeRazorpay)
    expect(scriptTags()).toHaveLength(0)
  })

  it('adds the script once, on demand', async () => {
    const first = loadRazorpay()
    const second = loadRazorpay()
    expect(second).toBe(first)
    const [script] = scriptTags()
    expect(scriptTags()).toHaveLength(1)
    expect(script?.async).toBe(true)
    installRazorpay()
    script?.dispatchEvent(new Event('load'))
    await expect(first).resolves.toBe(FakeRazorpay)
    expect(scriptTags()).toHaveLength(1)
  })

  it('gives up on a script that fails to load and tries afresh next time', async () => {
    const first = loadRazorpay()
    scriptTags()[0]?.dispatchEvent(new Event('error'))
    await expect(first).resolves.toBeNull()
    expect(scriptTags()).toHaveLength(0)
    const second = loadRazorpay()
    expect(second).not.toBe(first)
    expect(scriptTags()).toHaveLength(1)
  })

  it('treats a script that loads without Checkout as a failure', async () => {
    const promise = loadRazorpay()
    scriptTags()[0]?.dispatchEvent(new Event('load'))
    await expect(promise).resolves.toBeNull()
  })

  it('gives up on a script that takes too long', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = loadRazorpay()
    await vi.advanceTimersByTimeAsync(RAZORPAY_LOAD_TIMEOUT_MS)
    await expect(promise).resolves.toBeNull()
    expect(scriptTags()).toHaveLength(0)
  })

  it('makes checkout explain a blocked script', async () => {
    serve()
    const promise = startCheckout('pro_yearly')
    await vi.waitFor(() => expect(scriptTags()).toHaveLength(1))
    scriptTags()[0]?.dispatchEvent(new Event('error'))
    await expect(promise).resolves.toEqual({ status: 'failed', message: CHECKOUT_MESSAGES.script })
  })
})
