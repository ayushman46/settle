/**
 * A payment Razorpay confirmed but our server hasn't turned into a license yet (the connection
 * dropped at the worst moment). It's kept on the device and claimed again on the next visit or
 * when the connection returns, so nobody pays without getting Pro.
 */
import type { VerifyRequest } from '../../shared/api'
import type { PlanId } from '../domain/types'
import { isPlanId } from './token'

export const PENDING_PAYMENT_KEY = 'settle.v3.pending-payment'

export interface PendingPayment extends VerifyRequest {
  plan: PlanId
  /** When the payment went through (epoch ms). */
  at: number
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function shortText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = storage()?.getItem(PENDING_PAYMENT_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { orderId, paymentId, signature, plan, at } = value as Record<string, unknown>
    if (!shortText(orderId) || !shortText(paymentId) || !shortText(signature) || !isPlanId(plan)) return null
    return { orderId, paymentId, signature, plan, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 }
  } catch {
    return null
  }
}

export function savePendingPayment(payment: PendingPayment): void {
  try {
    storage()?.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment))
  } catch {
    // Storage blocked: the claim is retried in this visit only.
  }
}

export function clearPendingPayment(): void {
  try {
    storage()?.removeItem(PENDING_PAYMENT_KEY)
  } catch {
    // Nothing to do.
  }
}
