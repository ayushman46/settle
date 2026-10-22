/**
 * Settle Pro without a database: `GET /api/billing/config`, `POST /api/billing/order`,
 * `POST /api/billing/verify` and `POST /api/license/verify`.
 *
 * A purchase is a Razorpay one-time order. Once Checkout reports success we check its
 * signature, fetch the order back from Razorpay to confirm it is paid (and read the plan from
 * the order, never from the client), then sign a license. The license is the only record —
 * it lives on the buyer's device.
 */
import type { Context, Hono, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { BillingConfig, LicenseVerifyResponse, OrderResponse, VerifyResponse } from '../shared/api'
import { checkoutReady, type ServerConfig } from './config'
import { fail, NOT_JSON, readJson, type Logger } from './http'
import { licenseExpiry, MAX_TOKEN_LENGTH, signLicense, verifyLicense } from './license'
import { buildPlans, isPlanId } from './plans'
import { createOrder, DEFAULT_RAZORPAY_TIMEOUT_MS, fetchOrder, isPaid, RazorpayError, verifyPaymentSignature, type RazorpayClient } from './razorpay'
import { clientKey, rateLimit } from './ratelimit'

export const BILLING_MESSAGES = {
  malformed: 'Something went wrong. Please try again.',
  badPlan: "That plan isn't available. Please pick one of the plans shown.",
  checkoutOff: "Checkout isn't set up yet — you can still redeem a code.",
  checkoutDown: "Checkout isn't available right now. Please try again in a little while.",
  licensingOff: "Codes can't be checked right now. Please try again later.",
  unreachable: "Couldn't reach the payment service. Please try again.",
  badPayment: "We couldn't confirm that payment. If money left your account, write to us with the payment ID — we'll sort it out.",
  notPaid: "That payment hasn't come through yet. Try again in a minute — if it never completes, any money taken is refunded automatically.",
  notOurs: "That payment isn't for Settle Pro. If you were charged, write to us with the payment ID.",
  tooMany: 'Too many attempts. Please wait a few minutes and try again.',
} as const

/** Tags our orders, so a payment for anything else on the same Razorpay account never unlocks Pro. */
export const ORDER_PRODUCT = 'settle_pro'

const OrderRequestSchema = z.object({ plan: z.string().max(40) })
const VerifyRequestSchema = z.object({
  orderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  signature: z.string().regex(/^[0-9a-fA-F]{64}$/),
})
const LicenseRequestSchema = z.object({ license: z.string().max(MAX_TOKEN_LENGTH * 2) })

/**
 * Billing bodies are a plan id, three Razorpay ids or one license token: a few hundred bytes.
 * Anything bigger is refused before it is read, so nobody can fill the server's memory with it.
 */
export const MAX_BILLING_BODY_BYTES = 8 * 1024

export interface BillingOptions {
  config: ServerConfig
  log: Logger
  now: () => number
  /** Rejects cross-site and non-JSON requests (see http.ts). */
  ownPageOnly: MiddlewareHandler
}

export function registerBilling(app: Hono, { config, log, now, ownPageOnly }: BillingOptions): void {
  const ready = checkoutReady(config)
  const razorpay: RazorpayClient | null = config.billing.razorpay
    ? { keys: config.billing.razorpay, baseUrl: config.billing.razorpayBaseUrl, timeoutMs: DEFAULT_RAZORPAY_TIMEOUT_MS }
    : null
  const plans = buildPlans(config.billing.prices)
  const billingConfig: BillingConfig = {
    checkout: ready ? 'razorpay' : null,
    keyId: ready ? (config.billing.razorpay?.keyId ?? null) : null,
    currency: 'INR',
    plans,
    licensePublicKey: config.license.publicKeySpki,
    proAiPerDay: config.proAiPerDay,
  }
  const limited = rateLimit(config.billing.rateLimit, {
    now,
    keyFor: (c) => clientKey(c, config),
    onLimited: (c) => fail(c, 'rate_limited', { message: BILLING_MESSAGES.tooMany }),
  })
  const nowSeconds = () => Math.floor(now() / 1000)
  const small = bodyLimit({
    maxSize: MAX_BILLING_BODY_BYTES,
    onError: (c) => fail(c, 'bad_request', { status: 413, message: BILLING_MESSAGES.malformed }),
  })

  function razorpayFailure(c: Context, error: RazorpayError, action: string) {
    const summary = `${error.message}${error.detail ? ` · razorpay said: ${error.detail.replace(/\s+/g, ' ')}` : ''}`
    switch (error.kind) {
      case 'auth':
        log.error(`[billing] ${action}: ${summary} — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.`)
        return fail(c, 'billing_unavailable', { message: BILLING_MESSAGES.checkoutDown })
      case 'timeout':
        log.error(`[billing] ${action}: ${summary}`)
        return fail(c, 'timeout', { message: BILLING_MESSAGES.unreachable })
      case 'rejected':
      case 'unavailable':
        log.error(`[billing] ${action}: ${summary}`)
        return fail(c, 'upstream_error', { message: BILLING_MESSAGES.unreachable })
    }
  }

  app.get('/api/billing/config', (c) => c.json(billingConfig))

  app.post('/api/billing/order', ownPageOnly, limited, small, async (c) => {
    const json = await readJson(c)
    const body = json === NOT_JSON ? null : OrderRequestSchema.safeParse(json)
    if (!body?.success) return fail(c, 'bad_request', { message: BILLING_MESSAGES.malformed })
    const { plan } = body.data
    if (!isPlanId(plan)) return fail(c, 'bad_request', { message: BILLING_MESSAGES.badPlan })
    if (!ready || razorpay === null) return fail(c, 'billing_unavailable', { message: BILLING_MESSAGES.checkoutOff })

    try {
      const order = await createOrder(
        razorpay,
        {
          amount: config.billing.prices[plan],
          currency: 'INR',
          receipt: `settle_${plan}_${randomBytes(6).toString('hex')}`,
          notes: { product: ORDER_PRODUCT, plan },
        },
        c.req.raw.signal,
      )
      log.info(`[billing] order ${order.id} · ${plan} · ${order.amount} paise`)
      const response: OrderResponse = { orderId: order.id, amount: order.amount, currency: 'INR', keyId: razorpay.keys.keyId, plan }
      return c.json(response)
    } catch (error) {
      if (error instanceof RazorpayError) return razorpayFailure(c, error, 'creating an order')
      throw error
    }
  })

  app.post('/api/billing/verify', ownPageOnly, limited, small, async (c) => {
    const json = await readJson(c)
    const body = json === NOT_JSON ? null : VerifyRequestSchema.safeParse(json)
    if (!body?.success) return fail(c, 'bad_request', { message: BILLING_MESSAGES.malformed })
    if (!ready || razorpay === null || config.license.privateKey === null) {
      return fail(c, 'billing_unavailable', { message: BILLING_MESSAGES.checkoutOff })
    }
    const { orderId, paymentId, signature } = body.data

    if (!verifyPaymentSignature(orderId, paymentId, signature, razorpay.keys.keySecret)) {
      log.warn(`[billing] signature mismatch for ${orderId} / ${paymentId}`)
      return fail(c, 'bad_request', { message: BILLING_MESSAGES.badPayment })
    }

    let order
    try {
      order = await fetchOrder(razorpay, orderId, c.req.raw.signal)
    } catch (error) {
      if (!(error instanceof RazorpayError)) throw error
      if (error.kind === 'rejected') {
        log.warn(`[billing] ${orderId} couldn't be fetched: ${error.message}`)
        return fail(c, 'bad_request', { message: BILLING_MESSAGES.badPayment })
      }
      return razorpayFailure(c, error, `fetching ${orderId}`)
    }

    // The plan comes from the order we created, never from the client.
    const plan = order.notes.plan
    if (order.id !== orderId || order.notes.product !== ORDER_PRODUCT || !isPlanId(plan)) {
      log.warn(`[billing] ${orderId} is not a Settle Pro order (notes: ${JSON.stringify(order.notes).slice(0, 200)})`)
      return fail(c, 'bad_request', { message: BILLING_MESSAGES.notOurs })
    }
    if (!isPaid(order)) {
      log.info(`[billing] ${orderId} not paid yet (status ${order.status})`)
      return fail(c, 'bad_request', { status: 409, message: BILLING_MESSAGES.notPaid })
    }

    // Dated from the order, so verifying the same payment again can't stretch the pass.
    const iat = order.createdAt ?? nowSeconds()
    const license = signLicense({ id: paymentId, plan, iat, exp: licenseExpiry(plan, iat) }, config.license.privateKey)
    log.info(`[billing] license issued · ${plan} · ${paymentId}`)
    const response: VerifyResponse = { license }
    return c.json(response)
  })

  app.post('/api/license/verify', ownPageOnly, limited, small, async (c) => {
    const json = await readJson(c)
    const body = json === NOT_JSON ? null : LicenseRequestSchema.safeParse(json)
    if (!body?.success) return fail(c, 'bad_request', { message: BILLING_MESSAGES.malformed })
    if (config.license.publicKey === null) return fail(c, 'billing_unavailable', { message: BILLING_MESSAGES.licensingOff })
    const check = verifyLicense(body.data.license, config.license.publicKey, nowSeconds())
    const response: LicenseVerifyResponse = { valid: check.valid, active: check.active, license: check.license }
    return c.json(response)
  })

  const methodNotAllowed = (allow: string) => (c: Context) => {
    c.header('Allow', allow)
    return fail(c, 'bad_request', { status: 405, message: `Use ${allow.split(',')[0]} here.` })
  }
  app.on(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/api/billing/config', methodNotAllowed('GET, HEAD'))
  for (const path of ['/api/billing/order', '/api/billing/verify', '/api/license/verify']) {
    app.on(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], path, methodNotAllowed('POST'))
  }
}
