/**
 * Reads a UPI payment screenshot for `POST /api/proof` ("Paid? Drop the screenshot"): the vision
 * model's JSON becomes a clean `ProofResponse`. Same models, budget and fallbacks as bills
 * (see nvidia.ts `completeJson`); the answer is only a reading — the client decides what to trust.
 */
import { z } from 'zod'
import { PAYMENT_APPS, PAYMENT_STATUSES, type PaymentApp, type PaymentStatus, type ProofResponse } from '../shared/api'
import type { ServerConfig } from './config'
import { cleanText, extractJson, normalizeCurrency, normalizeDate, parseNumber, roundMoney } from './parse'
import { completeJson, type CompletionOptions, type CompletionTask } from './nvidia'

/** Same budget as a bill: a screenshot is small, the models are the same. */
const PROOF_TIMEOUT_MS = 35_000
const PROOF_BUDGET_MS = 60_000
const PROOF_MIN_ATTEMPT_MS = 5_000
const MAX_TOKENS = 1024
const MAX_NAME = 80

/** What the 422 `not_a_payment` answer says. */
export const NOT_A_PAYMENT_MESSAGE = "That doesn't look like a UPI payment screenshot. Try the success screen from your payment app."

/** The JSON the model must return: every key, in this order. */
export const PROOF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_payment', 'app', 'status', 'amount', 'currency', 'payer_name', 'payee_name', 'payee_upi', 'utr', 'date', 'time'],
  properties: {
    is_payment: { type: 'boolean' },
    app: { type: 'string', enum: [...PAYMENT_APPS] },
    status: { type: 'string', enum: [...PAYMENT_STATUSES] },
    amount: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    payer_name: { type: ['string', 'null'] },
    payee_name: { type: ['string', 'null'] },
    payee_upi: { type: ['string', 'null'] },
    utr: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    time: { type: ['string', 'null'] },
  },
} as const

export const PROOF_SYSTEM_PROMPT = `You read screenshots from Indian UPI payment apps (Google Pay, PhonePe, Paytm, BHIM, and bank apps such as SBI, HDFC, ICICI, Axis, Kotak, Yes Bank) and return strict JSON. Accuracy matters: a wrong amount or a wrong reference number leads to a real person being marked as paid. When a value is not clearly printed on the screen, return null for it. Never guess a reference number.`

export const PROOF_USER_PROMPT = `Read this screenshot and return one JSON object that follows this schema exactly, keys in this order:
{
  "is_payment": boolean,     // true only if the screen is about a UPI / bank payment (sent or received): a success, pending or failed payment screen, or its receipt. false for chats, bills, shop pages, QR codes, balance screens, or anything else.
  "app": "gpay" | "phonepe" | "paytm" | "bhim" | "bank" | "other" | "unknown",
  "status": "success" | "pending" | "failed" | "unknown",   // success = "Paid", "Money sent", "Payment successful", "Completed". pending = "Pending", "Processing", "In progress". failed = "Failed", "Declined", "Payment unsuccessful".
  "amount": number | null,   // the amount paid as a plain number in rupees, e.g. 420 or 1250.5 (no ₹ sign, no commas). Lakh grouping like "1,25,000" means 125000.
  "currency": "INR" | null,
  "payer_name": string | null,   // who sent the money, as shown ("From" / "Paid by")
  "payee_name": string | null,   // who received it, as shown ("To" / "Paid to" / the name under the payee)
  "payee_upi": string | null,    // the receiver's UPI ID exactly as shown, e.g. "riya.k@okicici", lower case; null if no UPI ID is shown
  "utr": string | null,          // the UPI transaction reference / UTR / transaction ID: usually 12 digits, digits only, no spaces. Labels: "UPI transaction ID", "UTR", "UPI Ref. No.", "Transaction ID", "Ref No.". null if not shown.
  "date": "YYYY-MM-DD" | null,   // the payment date, year first
  "time": "HH:MM" | null         // the payment time in 24-hour form, e.g. "18:42"
}
Return only the JSON object.`

export const PROOF_BUDGET = { timeoutMs: PROOF_TIMEOUT_MS, budgetMs: PROOF_BUDGET_MS, minAttemptMs: PROOF_MIN_ATTEMPT_MS }

/** The chat-completions request body for one screenshot. */
export function buildProofBody(model: string, dataUrl: string, structured: boolean): Record<string, unknown> {
  return {
    model,
    temperature: 0.05,
    top_p: 0.9,
    max_tokens: MAX_TOKENS,
    stream: false,
    messages: [
      { role: 'system', content: PROOF_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: PROOF_USER_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: 'payment', strict: true, schema: PROOF_SCHEMA } } } : {}),
    ...(/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  }
}

const looksLikeProof = (value: Record<string, unknown>): boolean => 'is_payment' in value

const ProofReplySchema = z.object({ is_payment: z.boolean() }).passthrough()

/** Only a JSON object that says whether it's a payment counts as an answer; anything else tries the next model. */
export function isProofReply(raw: unknown): boolean {
  return ProofReplySchema.safeParse(raw).success
}

/** Outcome of reading one screenshot: a payment reading, or "this isn't a payment". */
export type ProofOutcome = { kind: 'payment'; proof: Omit<ProofResponse, 'model'> } | { kind: 'not_a_payment' }

const APPS: ReadonlySet<string> = new Set(PAYMENT_APPS)

/** Maps what the model wrote onto the small status set; anything unclear is `unknown`, never `success`. */
export function normalizeStatus(value: unknown): PaymentStatus {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if ((PAYMENT_STATUSES as readonly string[]).includes(text)) return text as PaymentStatus
  // "unsuccessful" contains "successful": the failure words are checked first.
  if (/fail|declin|unsuccess|error/.test(text)) return 'failed'
  if (/success|complete|paid|sent|debited/.test(text)) return 'success'
  if (/pending|processing|progress|initiated/.test(text)) return 'pending'
  return 'unknown'
}

/** A UPI reference: digits only, 10 to 22 of them (12 on most apps); anything else is not a reference. */
export function normalizeUtr(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const digits = String(value).replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 22 ? digits : null
}

/** `name@bank`, lower case. */
export function normalizeUpi(value: unknown): string | null {
  const text = cleanText(value)?.toLowerCase().replace(/\s+/g, '') ?? null
  if (text === null) return null
  return /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/.test(text) ? text : null
}

function name(value: unknown): string | null {
  const text = cleanText(value)
  return text === null ? null : text.slice(0, MAX_NAME)
}

function clock(value: unknown): string | null {
  const text = cleanText(value)
  const match = text === null ? null : /^(\d{1,2}):(\d{2})/.exec(text)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

/** The model's JSON → a `ProofOutcome`. Never throws on odd values: missing or odd fields become null. */
export function normalizeProof(raw: unknown): ProofOutcome {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (record.is_payment !== true) return { kind: 'not_a_payment' }
  const amount = parseNumber(record.amount)
  const currency = normalizeCurrency(cleanText(record.currency))
  return {
    kind: 'payment',
    proof: {
      app: typeof record.app === 'string' && APPS.has(record.app) ? (record.app as PaymentApp) : 'unknown',
      status: normalizeStatus(record.status),
      amount: amount !== null && amount > 0 && Number.isFinite(amount) ? roundMoney(amount) : null,
      currency,
      payerName: name(record.payer_name),
      payeeName: name(record.payee_name),
      payeeUpi: normalizeUpi(record.payee_upi),
      utr: normalizeUtr(record.utr),
      date: normalizeDate(cleanText(record.date)),
      time: clock(record.time),
    },
  }
}

/**
 * Reads one screenshot with the configured vision models, in order, within the time budget.
 * @throws UpstreamError (from nvidia.ts) when no model produced an answer.
 */
export async function readProof(
  config: ServerConfig,
  dataUrl: string,
  options: CompletionOptions = {},
): Promise<{ outcome: ProofOutcome; model: string }> {
  const task: CompletionTask = {
    noun: 'payment',
    models: config.models,
    timeoutMs: config.timeoutMs,
    budgetMs: PROOF_BUDGET_MS,
    minAttemptMs: PROOF_MIN_ATTEMPT_MS,
    body: (model, structured) => buildProofBody(model, dataUrl, structured),
    parse: (content) => extractJson(content, looksLikeProof),
  }
  const { raw, model } = await completeJson(config, task, options)
  return { outcome: normalizeProof(raw), model }
}
