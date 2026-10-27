/**
 * Reads a screenshot of a UPI app's payment history for `POST /api/history` ("Who's paid?"):
 * only the money received, row by row — payer as printed, amount with paise, date, status, and
 * what on the row said it came in. Rows of money sent are counted, never transcribed (they're the
 * collector's own spending). Same models, budget and fallbacks as payment screenshots; nothing is
 * kept or logged but the kind of answer it was.
 */
import { z } from 'zod'
import { HISTORY_CUES, PAYMENT_APPS, type HistoryCue, type HistoryRow, type PaymentApp } from '../shared/api'
import type { ServerConfig } from './config'
import { cleanText, extractJson, normalizeDate, parseNumber, roundMoney } from './parse'
import { completeJson, type CompletionOptions, type CompletionTask } from './nvidia'
import { normalizeStatus, normalizeUtr } from './proof'

const HISTORY_BUDGET_MS = 60_000
const HISTORY_MIN_ATTEMPT_MS = 5_000
const MAX_TOKENS = 4096
const MAX_ROWS = 40
const MAX_NAME = 80

/** What the 422 `not_a_history` answer says. */
export const NOT_A_HISTORY_MESSAGE = "That doesn't look like a list of payments. Try your UPI app's history, filtered to money received."

export const HISTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_history', 'app', 'skipped_outgoing', 'rows'],
  properties: {
    is_history: { type: 'boolean' },
    app: { type: 'string', enum: [...PAYMENT_APPS] },
    skipped_outgoing: { type: 'integer' },
    rows: {
      type: 'array',
      maxItems: MAX_ROWS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'handle', 'amount', 'date', 'status', 'cue', 'utr', 'cut_off'],
        properties: {
          name: { type: ['string', 'null'] },
          handle: { type: ['string', 'null'] },
          amount: { type: ['number', 'null'] },
          date: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['success', 'pending', 'failed', 'unknown'] },
          cue: { type: 'string', enum: [...HISTORY_CUES] },
          utr: { type: ['string', 'null'] },
          cut_off: { type: 'boolean' },
        },
      },
    },
  },
} as const

export const HISTORY_SYSTEM_PROMPT = `You read screenshots of payment history lists from Indian UPI and bank apps (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, CRED, and bank apps' mini statements) and return strict JSON. Only money RECEIVED is transcribed. Accuracy matters: each row you return may mark a real person as having paid. When a value is not clearly printed, return null. Never guess a name, an amount or a reference.`

export function historyUserPrompt(today: string): string {
  return `Today is ${today} (India). Read this screenshot and return one JSON object that follows this schema exactly, keys in this order:
{
  "is_history": boolean,   // true only for a LIST of several payments (an app's history or passbook, a bank mini statement). false for a single payment's screen, chats, bills, or anything else.
  "app": "gpay" | "phonepe" | "paytm" | "bhim" | "bank" | "other" | "unknown",
  "skipped_outgoing": integer,   // how many rows are money SENT, paid or debited. Do not transcribe them.
  "rows": [   // one entry per row of money RECEIVED, top to bottom
    {
      "name": string | null,     // the payer exactly as printed ("Received from RIYA SHARMA" → "RIYA SHARMA")
      "handle": string | null,   // their UPI ID or masked number exactly as printed, e.g. "******4821@ybl"; null if none
      "amount": number | null,   // rupees WITH paise exactly as printed: "₹499.37" → 499.37. Lakh grouping "1,25,000" is 125000.
      "date": "YYYY-MM-DD" | null,   // resolve "Today" and "Yesterday" from today's date. A date without a year takes the year from a section header ("October 2026"), else this year — or last year if that would be in the future.
      "status": "success" | "pending" | "failed" | "unknown",
      "cue": "received_word" | "credited_word" | "plus_sign" | "cr_marker" | "deposit_column" | "green_only",   // what on the row says the money came IN. Use green_only when only the colour does.
      "utr": string | null,      // only a 12-digit reference printed on the row itself; else null
      "cut_off": boolean         // true if the row is partly outside the screenshot
    }
  ]
}
A row counts as RECEIVED only when its words or signs say so: "Received from", "Credited", "+₹", "Cr", or a deposit column. "Paid to", "Sent", "Debited", "−" are money sent: count them in skipped_outgoing. Return only the JSON object.`
}

/** The chat-completions request body for one history screenshot. */
export function buildHistoryBody(model: string, dataUrl: string, today: string, structured: boolean): Record<string, unknown> {
  return {
    model,
    temperature: 0.05,
    top_p: 0.9,
    max_tokens: MAX_TOKENS,
    stream: false,
    messages: [
      { role: 'system', content: HISTORY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: historyUserPrompt(today) },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: 'history', strict: true, schema: HISTORY_SCHEMA } } } : {}),
    ...(/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  }
}

const looksLikeHistory = (value: Record<string, unknown>): boolean => 'is_history' in value
const HistoryReplySchema = z.object({ is_history: z.boolean() }).passthrough()

/** Only a JSON object that says whether it's a history counts as an answer; anything else tries the next model. */
export function isHistoryReply(raw: unknown): boolean {
  return HistoryReplySchema.safeParse(raw).success
}

export type HistoryOutcome = { kind: 'history'; app: PaymentApp; rows: HistoryRow[]; skippedOutgoing: number } | { kind: 'not_a_history' }

const APPS: ReadonlySet<string> = new Set(PAYMENT_APPS)
const CUES: ReadonlySet<string> = new Set(HISTORY_CUES)

/** A UPI ID or masked number as printed, lower case, or null. */
function handle(value: unknown): string | null {
  const text = cleanText(value)?.toLowerCase().replace(/\s+/g, '') ?? null
  return text !== null && /^[a-z0-9*][a-z0-9._*-]{0,63}@[a-z][a-z0-9.-]{1,63}$/.test(text) ? text : null
}

/** The model's JSON → a `HistoryOutcome`. Never throws: odd rows are dropped, odd fields become null. */
export function normalizeHistory(raw: unknown, today: string): HistoryOutcome {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (record.is_history !== true) return { kind: 'not_a_history' }
  const rows: HistoryRow[] = []
  for (const entry of Array.isArray(record.rows) ? record.rows.slice(0, MAX_ROWS) : []) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const amount = parseNumber(row.amount)
    if (amount === null || !(amount > 0)) continue
    const date = normalizeDate(cleanText(row.date))
    const utr = normalizeUtr(row.utr)
    rows.push({
      name: cleanText(row.name)?.slice(0, MAX_NAME) ?? null,
      handle: handle(row.handle),
      amount: roundMoney(amount),
      // Never a date after today.
      date: date !== null && date <= today ? date : null,
      status: normalizeStatus(row.status),
      cue: typeof row.cue === 'string' && CUES.has(row.cue) ? (row.cue as HistoryCue) : 'green_only',
      utr: utr !== null && utr.length === 12 ? utr : null,
      cutOff: row.cut_off === true,
    })
  }
  const skipped = typeof record.skipped_outgoing === 'number' && Number.isFinite(record.skipped_outgoing) ? Math.max(0, Math.round(record.skipped_outgoing)) : 0
  return {
    kind: 'history',
    app: typeof record.app === 'string' && APPS.has(record.app) ? (record.app as PaymentApp) : 'unknown',
    rows,
    skippedOutgoing: skipped,
  }
}

/**
 * Reads one history screenshot with the configured vision models, in order, within the budget.
 * @throws UpstreamError (from nvidia.ts) when no model produced an answer.
 */
export async function readHistory(config: ServerConfig, dataUrl: string, today: string, options: CompletionOptions = {}): Promise<{ outcome: HistoryOutcome; model: string }> {
  const task: CompletionTask = {
    noun: 'history',
    models: config.models,
    timeoutMs: config.timeoutMs,
    budgetMs: HISTORY_BUDGET_MS,
    minAttemptMs: HISTORY_MIN_ATTEMPT_MS,
    body: (model, structured) => buildHistoryBody(model, dataUrl, today, structured),
    parse: (content) => extractJson(content, looksLikeHistory),
  }
  const { raw, model } = await completeJson(config, task, options)
  return { outcome: normalizeHistory(raw, today), model }
}
