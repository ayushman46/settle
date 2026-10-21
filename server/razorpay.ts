/**
 * The two Razorpay calls Settle needs (create an order, fetch it back) and the checkout
 * signature check. One-time orders only: nothing renews, nothing is stored.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { redactSecrets, type RazorpayKeys } from './config'

export type RazorpayErrorKind =
  /** 401/403: the key id or secret is wrong. */
  | 'auth'
  /** 400/404: Razorpay refused the request (e.g. an unknown order). */
  | 'rejected'
  /** 429, 5xx, a network failure or a reply we can't read. */
  | 'unavailable'
  /** Razorpay took too long. */
  | 'timeout'

export class RazorpayError extends Error {
  override readonly name = 'RazorpayError'
  readonly kind: RazorpayErrorKind
  readonly status: number | null
  /** Start of Razorpay's error body (redacted), for server logs only. */
  readonly detail: string

  constructor(kind: RazorpayErrorKind, message: string, details: { status?: number | null; detail?: string; cause?: unknown } = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause })
    this.kind = kind
    this.status = details.status ?? null
    this.detail = details.detail ?? ''
  }
}

export interface RazorpayClient {
  keys: RazorpayKeys
  /** e.g. https://api.razorpay.com/v1 (no trailing slash). */
  baseUrl: string
  timeoutMs: number
}

const OrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  amount_paid: z.number().int().nonnegative().catch(0),
  currency: z.string(),
  status: z.string(),
  // Razorpay sends `[]` for an order without notes.
  notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).catch({}),
  created_at: z.number().int().positive().nullish(),
})

export interface RazorpayOrder {
  id: string
  /** Paise. */
  amount: number
  amountPaid: number
  currency: string
  /** created → attempted → paid. */
  status: string
  notes: Record<string, string>
  /** Epoch seconds. */
  createdAt: number | null
}

export const DEFAULT_RAZORPAY_TIMEOUT_MS = 10_000
const MAX_DETAIL_CHARS = 300

export async function createOrder(
  client: RazorpayClient,
  order: { amount: number; currency: string; receipt: string; notes: Record<string, string> },
  signal?: AbortSignal,
): Promise<RazorpayOrder> {
  return request(client, 'POST', '/orders', order, signal)
}

export async function fetchOrder(client: RazorpayClient, orderId: string, signal?: AbortSignal): Promise<RazorpayOrder> {
  return request(client, 'GET', `/orders/${encodeURIComponent(orderId)}`, undefined, signal)
}

/** Whether an order has been paid in full. */
export function isPaid(order: RazorpayOrder): boolean {
  return order.status === 'paid' || (order.amount > 0 && order.amountPaid >= order.amount)
}

/**
 * Razorpay Checkout's proof of payment: HMAC-SHA256 of `${orderId}|${paymentId}` with the key
 * secret, as lowercase hex. Compared in constant time.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

async function request(client: RazorpayClient, method: 'GET' | 'POST', path: string, body: unknown, signal?: AbortSignal): Promise<RazorpayOrder> {
  const { keyId, keySecret } = client.keys
  const redact = (text: string) => redactSecrets(text, keySecret)
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new Error(`Timed out after ${client.timeoutMs} ms`))
  }, client.timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) onAbort()

  try {
    const response = await fetch(`${client.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail = ''
      try {
        detail = redact((await response.text()).slice(0, MAX_DETAIL_CHARS))
      } catch {
        // Only for logs.
      }
      const { status } = response
      const kind: RazorpayErrorKind = status === 401 || status === 403 ? 'auth' : status === 400 || status === 404 ? 'rejected' : 'unavailable'
      throw new RazorpayError(kind, `Razorpay ${method} ${path} answered HTTP ${status}.`, { status, detail })
    }
    const parsed = OrderSchema.safeParse(await response.json())
    if (!parsed.success) throw new RazorpayError('unavailable', `Razorpay ${method} ${path} sent an order we can't read.`, { status: response.status })
    const { id, amount, amount_paid, currency, status, notes, created_at } = parsed.data
    return {
      id,
      amount,
      amountPaid: amount_paid,
      currency,
      status,
      notes: Array.isArray(notes) ? {} : Object.fromEntries(Object.entries(notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      createdAt: created_at ?? null,
    }
  } catch (error) {
    if (error instanceof RazorpayError) throw error
    if (timedOut) throw new RazorpayError('timeout', `Razorpay took longer than ${client.timeoutMs} ms.`, { cause: error })
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    throw new RazorpayError('unavailable', `Couldn't reach Razorpay: ${redact(message)}`, { cause: error })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
