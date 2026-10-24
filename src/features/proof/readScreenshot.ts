/**
 * Sends a payment screenshot to `POST /api/proof` and reads the answer. Failures come back as the
 * API's error code (or our own transport kinds), which the screen turns into friendly copy.
 */
import { callApi, isRecord } from '../../api/http'
import { PAYMENT_APPS, PAYMENT_STATUSES, type PaymentApp, type PaymentStatus, type ProofResponse } from '../../../shared/api'
import { licenseHeaders } from '../../pro/store'

/** The server spends at most 60 s on the models; the browser waits a little longer than that. */
export const PROOF_TIMEOUT_MS = 70_000

export type ReadOutcome = { ok: true; proof: ProofResponse } | { ok: false; code: string }

/** The reading the server sent, checked field by field; anything odd is no reading at all. */
export function parseProof(body: unknown): ProofResponse | null {
  if (!isRecord(body)) return null
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  if (typeof body.app !== 'string' || !(PAYMENT_APPS as readonly string[]).includes(body.app)) return null
  if (typeof body.status !== 'string' || !(PAYMENT_STATUSES as readonly string[]).includes(body.status)) return null
  return {
    app: body.app as PaymentApp,
    status: body.status as PaymentStatus,
    amount: num(body.amount),
    currency: str(body.currency),
    payerName: str(body.payerName),
    payeeName: str(body.payeeName),
    payeeUpi: str(body.payeeUpi),
    utr: str(body.utr),
    date: str(body.date),
    time: str(body.time),
    model: str(body.model) ?? '',
  }
}

/** Reads one screenshot. `dataUrl` is a JPEG data URL (see `prepareImage`). */
export async function readPaymentScreenshot(dataUrl: string, signal?: AbortSignal): Promise<ReadOutcome> {
  const result = await callApi('/api/proof', {
    method: 'POST',
    body: { image: dataUrl },
    headers: licenseHeaders(),
    timeoutMs: PROOF_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) {
    if (result.kind === 'http') return { ok: false, code: result.code ?? 'upstream_error' }
    return { ok: false, code: result.kind === 'network' ? 'network' : result.kind === 'timeout' ? 'timeout' : 'upstream_error' }
  }
  const proof = parseProof(result.body)
  return proof ? { ok: true, proof } : { ok: false, code: 'upstream_error' }
}
