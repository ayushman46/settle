/**
 * Talking to our API. Every failure becomes a `ScanError` whose `message` is friendly and
 * safe to show as-is; `code` lets the UI pick the right next step.
 */
import {
  isCategoryId,
  LICENSE_HEADER,
  SCAN_BUDGET_MS,
  SCANNED_FEE_KINDS,
  type ApiErrorCode,
  type HealthResponse,
  type ScannedFee,
  type ScannedFeeKind,
  type ScanResponse,
  type ScannedItem,
} from '../../shared/api'
import { licenseHeaders } from '../pro/store'
import { callApi, isOffline, isRecord, PRO_ALLOWANCE_MIN_WAIT_SECONDS, waitPhrase, type CallResult } from './http'

/** What can go wrong with a scan: the API's scan-related codes plus our own transport ones. */
export type ScanErrorCode = Exclude<ApiErrorCode, 'not_a_split' | 'billing_unavailable' | 'rates_unavailable'> | 'network' | 'aborted'

/**
 * What we tell diners for every error. The server's own `message` is never shown: these are written
 * for the person holding the phone (no keys, env files or "server"), whatever answers `/api/scan`.
 */
export const SCAN_ERROR_MESSAGES: Readonly<Record<ScanErrorCode, string>> = {
  bad_request: "Something about that photo didn't work. Please try another one.",
  unsupported_image: 'Please use a JPG or PNG photo.',
  image_too_large: 'That photo is too large. Try a smaller one — or take a screenshot of it.',
  not_a_bill: "That doesn't look like a bill. Try a clear photo of the full receipt.",
  unreadable: "We couldn't read any items. Try a clearer, well-lit photo — or enter them manually.",
  not_configured: "Photo scanning isn't available right now — you can type the items in.",
  upstream_auth: "Photo scanning isn't working right now — you can type the items in.",
  rate_limited: 'Too many scans right now. Try again in a few minutes — or type the items in.',
  timeout: 'Reading the bill took too long. Try again with a sharper, closer photo.',
  upstream_error: "Couldn't reach the AI service. Please try again.",
  network: 'You seem to be offline. Check your connection and try again.',
  aborted: 'Scan cancelled.',
}

/** A short wait (the server's in-flight cap, or a brief upstream back-off): nobody did anything wrong. */
export const SCANS_BUSY_MESSAGE = 'Lots of bills are being read right now — try again in a moment.'

/**
 * The `rate_limited` copy for a `Retry-After` of `seconds`: a short wait is "busy", a long one is our
 * per-device limit ("about N minutes") — or, for a scan sent with Pro (`pro`), the day's fair-use
 * allowance. Without the header, the catalog copy.
 */
export function rateLimitedMessage(seconds: number | null, pro = false): string {
  if (seconds === null) return SCAN_ERROR_MESSAGES.rate_limited
  if (seconds < 60) return SCANS_BUSY_MESSAGE
  if (pro && seconds > PRO_ALLOWANCE_MIN_WAIT_SECONDS) {
    return `You've reached today's fair-use AI limit. It resets in ${waitPhrase(seconds)} — you can still type the items in.`
  }
  return `Too many scans. Try again in ${waitPhrase(seconds)} — or type the items in.`
}

/** Shown instead of trying at all when the browser knows it's offline. */
export const OFFLINE_MESSAGE = "You're offline — you can still type the items in."

const SCAN_API_CODES: ReadonlySet<string> = new Set<ScanErrorCode>([
  'bad_request',
  'unsupported_image',
  'image_too_large',
  'not_a_bill',
  'unreadable',
  'not_configured',
  'upstream_auth',
  'rate_limited',
  'timeout',
  'upstream_error',
])

export class ScanError extends Error {
  readonly code: ScanErrorCode

  constructor(code: ScanErrorCode, message: string = SCAN_ERROR_MESSAGES[code]) {
    super(message)
    this.name = 'ScanError'
    this.code = code
  }
}

/**
 * The whole scan request may take this long: the server's own budget across every model
 * (`SCAN_BUDGET_MS`) plus room for the upload and its answer, so the server always gets to reply.
 */
export const SCAN_TIMEOUT_MS = SCAN_BUDGET_MS + 10_000

function fallbackCode(status: number): ScanErrorCode {
  if (status === 413) return 'image_too_large'
  if (status === 415) return 'unsupported_image'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'not_configured'
  if (status === 504 || status === 408) return 'timeout'
  if (status === 400) return 'bad_request'
  return 'upstream_error'
}

/** The ScanError for a failed call: our own copy for every code, never the server's words. */
function scanErrorFrom(result: Exclude<CallResult, { ok: true }>, pro: boolean): ScanError {
  switch (result.kind) {
    case 'timeout':
      return new ScanError('timeout')
    case 'aborted':
      return new ScanError('aborted')
    case 'network':
      return new ScanError('network', isOffline() ? OFFLINE_MESSAGE : SCAN_ERROR_MESSAGES.network)
    case 'bad_body':
      return new ScanError('upstream_error')
    case 'http': {
      const code =
        result.code !== null && SCAN_API_CODES.has(result.code) ? (result.code as ScanErrorCode) : fallbackCode(result.status)
      if (code === 'rate_limited') return new ScanError(code, rateLimitedMessage(result.retryAfter, pro))
      return new ScanError(code)
    }
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

const FEE_KINDS: ReadonlySet<unknown> = new Set(SCANNED_FEE_KINDS)

/** Delivery-app fees in a scan answer: objects with a label and a positive amount (older servers send none). */
function parseFees(value: unknown): ScannedFee[] {
  if (!Array.isArray(value)) return []
  const fees: ScannedFee[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const amount = finiteOrNull(raw.amount)
    if (amount === null || amount <= 0) continue
    const label = typeof raw.label === 'string' ? raw.label : ''
    fees.push({ label, kind: FEE_KINDS.has(raw.kind) ? (raw.kind as ScannedFeeKind) : 'other', amount })
  }
  return fees
}

/** Checks the 200 body really is a `ScanResponse`; tolerant of missing optional bits. */
export function parseScanResponse(body: unknown): ScanResponse | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null
  const items: ScannedItem[] = []
  for (const raw of body.items) {
    if (!isRecord(raw) || typeof raw.name !== 'string') continue
    const amount = finiteOrNull(raw.amount)
    if (amount === null) continue
    const quantity = finiteOrNull(raw.quantity)
    items.push({ name: raw.name, quantity: quantity !== null && quantity > 0 ? quantity : 1, amount })
  }
  return {
    merchant: stringOrNull(body.merchant),
    date: stringOrNull(body.date),
    currency: stringOrNull(body.currency),
    category: isCategoryId(body.category) ? body.category : null,
    items,
    subtotal: finiteOrNull(body.subtotal),
    tax: finiteOrNull(body.tax),
    serviceCharge: finiteOrNull(body.serviceCharge),
    fees: parseFees(body.fees),
    discount: finiteOrNull(body.discount),
    tip: finiteOrNull(body.tip),
    total: finiteOrNull(body.total),
    warnings: Array.isArray(body.warnings) ? body.warnings.filter((w): w is string => typeof w === 'string') : [],
    model: typeof body.model === 'string' ? body.model : 'unknown',
  }
}

/**
 * Sends the photo to `POST /api/scan` and returns what the AI read. With Pro, the license goes
 * along (`X-Settle-License`) so the server applies the Pro allowance.
 * Cancel with `signal` (→ `ScanError('aborted')`); gives up after `SCAN_TIMEOUT_MS` (→ `timeout`).
 * @throws ScanError
 */
export async function scanBill(dataUrl: string, signal?: AbortSignal): Promise<ScanResponse> {
  const headers = licenseHeaders()
  const result = await callApi('/api/scan', {
    method: 'POST',
    body: { image: dataUrl },
    headers,
    timeoutMs: SCAN_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) throw scanErrorFrom(result, LICENSE_HEADER in headers)
  const parsed = parseScanResponse(result.body)
  if (!parsed) throw new ScanError('upstream_error')
  return parsed
}

/** `GET /api/health`; null when the server can't be reached or answers oddly. Never throws. */
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse | null> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' }, signal })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (!isRecord(body) || body.ok !== true || typeof body.configured !== 'boolean') return null
    const models = Array.isArray(body.models) ? body.models.filter((m): m is string => typeof m === 'string') : []
    return { ok: true, configured: body.configured, models }
  } catch {
    return null
  }
}
