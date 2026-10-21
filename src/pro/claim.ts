/** Turning a confirmed Razorpay payment into a signed license (`POST /api/billing/verify`). */
import type { VerifyRequest } from '../../shared/api'
import { callApi, isRecord } from '../api/http'
import { MAX_TOKEN_LENGTH } from './token'

export const CLAIM_TIMEOUT_MS = 20_000

export type ClaimResult =
  | { ok: true; token: string }
  /** `retriable`: worth asking again later (offline, timeout, server busy); false: the server said no. */
  | { ok: false; retriable: boolean }

/** Statuses that are a final "no" about this payment rather than a passing problem. */
const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 422])

export async function exchangePayment(payment: VerifyRequest, signal?: AbortSignal): Promise<ClaimResult> {
  const result = await callApi('/api/billing/verify', {
    body: { orderId: payment.orderId, paymentId: payment.paymentId, signature: payment.signature },
    timeoutMs: CLAIM_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) {
    if (result.kind === 'aborted') return { ok: false, retriable: true }
    return { ok: false, retriable: !(result.kind === 'http' && FINAL_STATUSES.has(result.status)) }
  }
  const token = isRecord(result.body) ? result.body.license : null
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) return { ok: false, retriable: true }
  return { ok: true, token }
}
