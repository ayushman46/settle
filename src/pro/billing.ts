/**
 * Buying Pro: a one-time Razorpay order (UPI, cards, netbanking), never a subscription.
 *
 *   POST /api/billing/order → Razorpay Checkout (script loaded on demand) → POST /api/billing/verify
 *   → signed license stored on this device.
 *
 * Every way it can end is a plain result for the paywall to show — never an exception.
 */
import type { OrderResponse } from '../../shared/api'
import { BRAND, type License, type PlanId } from '../domain/types'
import { callApi, isOffline, isRecord } from '../api/http'
import { t, type MessageKey } from '../i18n'
import { hasFreshBillingConfig, loadBillingConfig, planById } from './config'
import { claimPayment } from './store'
import { isPlanId } from './token'

export {
  FALLBACK_BILLING_CONFIG,
  hasFreshBillingConfig,
  loadBillingConfig,
  planById,
  planMonths,
  planPerMonth,
  useBillingConfig,
  type BillingConfig,
  type Plan,
} from './config'

export type CheckoutResult =
  | { status: 'success'; license: License }
  /** The buyer closed the payment window without paying. */
  | { status: 'cancelled' }
  /** `message` is friendly and safe to show as-is. */
  | { status: 'failed'; message: string }
  /** Checkout isn't set up on this server — offer "Redeem a code" instead. */
  | { status: 'unavailable' }

export interface CheckoutOptions {
  /** Pre-fills the payment form. */
  name?: string
  /** Phone number, pre-filled for UPI/OTP. */
  contact?: string
}

export const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
export const RAZORPAY_LOAD_TIMEOUT_MS = 20_000
export const ORDER_TIMEOUT_MS = 15_000

export const CHECKOUT_MESSAGES = {
  offline: "You're offline. Connect to the internet to get Pro.",
  network: "Couldn't reach Settle. Check your connection and try again.",
  busy: 'Too many tries in a row. Wait a minute, then try again.',
  planMissing: "That plan isn't available right now.",
  orderFailed: "Couldn't start the payment. Please try again in a moment.",
  script: "Couldn't open the payment window. Check your connection and try again.",
  paymentFailed: "The payment didn't go through. Try again, or pick another way to pay.",
  pending: "Payment received! We're still switching on Pro — it'll finish by itself once you're back online.",
} as const

const CHECKOUT_KEYS = {
  offline: 'pro.checkout.error.offline',
  network: 'pro.checkout.error.network',
  busy: 'pro.checkout.error.busy',
  planMissing: 'pro.checkout.error.planMissing',
  orderFailed: 'pro.checkout.error.orderFailed',
  script: 'pro.checkout.error.script',
  paymentFailed: 'pro.checkout.error.paymentFailed',
  pending: 'pro.checkout.pending',
} as const satisfies Record<keyof typeof CHECKOUT_MESSAGES, MessageKey>

/** A checkout message in the UI language (`CHECKOUT_MESSAGES` is the English copy). */
export function checkoutMessage(which: keyof typeof CHECKOUT_MESSAGES): string {
  return t(CHECKOUT_KEYS[which])
}

/** When the server couldn't confirm a payment Razorpay says went through. */
export function unconfirmedPaymentMessage(paymentId: string): string {
  return t('pro.checkout.unconfirmed', { paymentId })
}

/* ------------------------------------------------------------------ Razorpay Checkout (typed surface we use) */

interface RazorpaySuccess {
  razorpay_payment_id: string
  razorpay_order_id?: string
  razorpay_signature: string
}

interface RazorpayFailure {
  error?: { code?: string; description?: string; reason?: string }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  image?: string
  prefill?: { name?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean }
  handler: (response: RazorpaySuccess) => void
}

interface RazorpayInstance {
  open(): void
  on(event: 'payment.failed', handler: (response: RazorpayFailure) => void): void
}

export type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance

function razorpayGlobal(): RazorpayConstructor | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { Razorpay?: unknown }).Razorpay
  return typeof candidate === 'function' ? (candidate as RazorpayConstructor) : null
}

let loading: Promise<RazorpayConstructor | null> | null = null

/**
 * Loads Razorpay's Checkout script once, on first use (nobody who never buys downloads it).
 * Resolves to null when it can't load (offline, blocked, too slow); the next call tries again.
 */
export function loadRazorpay(): Promise<RazorpayConstructor | null> {
  const ready = razorpayGlobal()
  if (ready) return Promise.resolve(ready)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.async = true
    const finish = (loaded: boolean) => {
      clearTimeout(timer)
      script.onload = null
      script.onerror = null
      const constructor = loaded ? razorpayGlobal() : null
      if (!constructor) {
        script.remove()
        loading = null
      }
      resolve(constructor)
    }
    const timer = setTimeout(() => finish(false), RAZORPAY_LOAD_TIMEOUT_MS)
    script.onload = () => finish(true)
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })
  return loading
}

/* ------------------------------------------------------------------ checkout */

type OrderOutcome = { ok: true; order: OrderResponse } | { ok: false; result: CheckoutResult }

function failed(message: string): CheckoutResult {
  return { status: 'failed', message }
}

function parseOrder(body: unknown): OrderResponse | null {
  if (!isRecord(body)) return null
  const { orderId, amount, currency, keyId, plan } = body
  if (typeof orderId !== 'string' || !orderId || typeof keyId !== 'string' || !keyId || !isPlanId(plan)) return null
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
  if (currency !== 'INR') return null
  return { orderId, amount, currency, keyId, plan }
}

async function createOrder(plan: PlanId): Promise<OrderOutcome> {
  const result = await callApi('/api/billing/order', { body: { plan }, timeoutMs: ORDER_TIMEOUT_MS })
  if (result.ok) {
    const order = parseOrder(result.body)
    return order ? { ok: true, order } : { ok: false, result: failed(checkoutMessage('orderFailed')) }
  }
  if (result.kind === 'http') {
    if (result.code === 'billing_unavailable' || result.status === 503) return { ok: false, result: { status: 'unavailable' } }
    if (result.status === 429) return { ok: false, result: failed(checkoutMessage('busy')) }
    return { ok: false, result: failed(checkoutMessage('orderFailed')) }
  }
  if (result.kind === 'network' || result.kind === 'timeout') {
    return { ok: false, result: failed(isOffline() ? checkoutMessage('offline') : checkoutMessage('network')) }
  }
  return { ok: false, result: failed(checkoutMessage('orderFailed')) }
}

type PaymentOutcome =
  | { kind: 'paid'; response: RazorpaySuccess }
  /** Closed without paying; `error` is the last failed attempt's description, if any. */
  | { kind: 'dismissed'; error: string | null }
  | { kind: 'broken' }

/** Opens Checkout and waits for it to end. Failed attempts don't end it — Razorpay lets them retry. */
function pay(Razorpay: RazorpayConstructor, order: OrderResponse, planName: string, opts: CheckoutOptions): Promise<PaymentOutcome> {
  return new Promise((resolve) => {
    let lastError: string | null = null
    let done = false
    const finish = (outcome: PaymentOutcome) => {
      if (done) return
      done = true
      resolve(outcome)
    }
    const prefill: { name?: string; contact?: string } = {}
    if (opts.name?.trim()) prefill.name = opts.name.trim()
    if (opts.contact?.trim()) prefill.contact = opts.contact.trim()
    try {
      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: BRAND.name,
        description: `${BRAND.name} Pro · ${planName}`,
        image: `${window.location.origin}/icon-192.png`,
        prefill,
        theme: { color: '#0E1013' },
        modal: { ondismiss: () => finish({ kind: 'dismissed', error: lastError }), escape: true, backdropclose: false },
        handler: (response) => {
          if (isRecord(response) && typeof response.razorpay_payment_id === 'string' && typeof response.razorpay_signature === 'string') {
            finish({ kind: 'paid', response })
          } else {
            finish({ kind: 'broken' })
          }
        },
      })
      checkout.on('payment.failed', (response) => {
        const description = response.error?.description?.trim()
        lastError = description && description.length <= 200 ? description : checkoutMessage('paymentFailed')
      })
      checkout.open()
    } catch {
      finish({ kind: 'broken' })
    }
  })
}

async function runCheckout(planId: PlanId, opts: CheckoutOptions): Promise<CheckoutResult> {
  if (isOffline()) return failed(checkoutMessage('offline'))
  const config = await loadBillingConfig({ fresh: true })
  if (config.checkout !== 'razorpay') {
    // Only the server's own answer means "not set up"; a remembered or built-in config can't tell.
    return hasFreshBillingConfig() ? { status: 'unavailable' } : failed(checkoutMessage('network'))
  }
  const plan = planById(config, planId)
  if (!plan) return failed(checkoutMessage('planMissing'))

  const ordered = await createOrder(planId)
  if (!ordered.ok) return ordered.result
  const { order } = ordered

  const Razorpay = await loadRazorpay()
  if (!Razorpay) return failed(checkoutMessage('script'))

  const outcome = await pay(Razorpay, order, plan.name, opts)
  if (outcome.kind === 'broken') return failed(checkoutMessage('orderFailed'))
  if (outcome.kind === 'dismissed') return outcome.error ? failed(outcome.error) : { status: 'cancelled' }

  const paymentId = outcome.response.razorpay_payment_id
  const claim = await claimPayment({
    orderId: order.orderId,
    paymentId,
    signature: outcome.response.razorpay_signature,
    plan: order.plan,
    at: Date.now(),
  })
  if (claim.ok) return { status: 'success', license: claim.license }
  return failed(claim.pending ? checkoutMessage('pending') : unconfirmedPaymentMessage(paymentId))
}

let inflight: Promise<CheckoutResult> | null = null

/**
 * Buys `plan`: creates the order, opens Razorpay Checkout, confirms the payment with the server
 * and stores the license. A second call while one is open returns the same promise (double taps).
 */
export function startCheckout(plan: PlanId, opts: CheckoutOptions = {}): Promise<CheckoutResult> {
  if (inflight) return inflight
  const run = runCheckout(plan, opts).catch((): CheckoutResult => failed(checkoutMessage('orderFailed')))
  inflight = run.finally(() => {
    inflight = null
  })
  return inflight
}

/** Forgets a half-loaded script and any open checkout (tests). */
export function resetBillingForTests(): void {
  loading = null
  inflight = null
}
