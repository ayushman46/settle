/**
 * "Just say it": one sentence ("Cab 840 with Riya and Sam, Sam pays double") → a draft split,
 * read by the AI at `POST /api/describe`. Every failure is a `DescribeError` whose `message` is
 * friendly and safe to show as-is; `code` lets the UI pick the next step.
 */
import {
  DESCRIBE_BUDGET_MS,
  DESCRIBE_LIMITS,
  isCategoryId,
  LICENSE_HEADER,
  type DescribedPerson,
  type DescribeRequest,
  type DescribeResponse,
} from '../../shared/api'
import type { DescribedSplit } from '../domain/types'
import { callApi, isOffline, isRecord, PRO_ALLOWANCE_MIN_WAIT_SECONDS, waitPhrase, type CallResult } from '../api/http'
import { isIsoDate } from '../engine/dates'
import { isKnownCurrency } from '../lib/currencies'
import { graphemes, nameKey, normalizeName } from '../lib/people'
import { licenseHeaders } from '../pro/store'

export { describedToPrefill, missingPeople, resolveDescribedPeople, type DescribeContext, type ResolvedPerson } from './prefill'

export type DescribeErrorCode =
  | 'bad_request'
  | 'not_a_split'
  | 'unreadable'
  | 'not_configured'
  | 'upstream_auth'
  | 'rate_limited'
  | 'timeout'
  | 'upstream_error'
  | 'network'
  | 'aborted'

/** The example we coach with, everywhere. */
export const DESCRIBE_EXAMPLE = 'Dinner 2400 with Riya and Sam'

/** Our own words for every failure — never the server's. */
export const DESCRIBE_ERROR_MESSAGES: Readonly<Record<DescribeErrorCode, string>> = {
  bad_request: `Say what it was for and how much — like “${DESCRIBE_EXAMPLE}”.`,
  not_a_split: `That doesn't read like an expense — try “${DESCRIBE_EXAMPLE}”.`,
  unreadable: "We couldn't turn that into a split. Try “Cab 840 with Riya and Sam”.",
  not_configured: "The AI helper isn't available right now — you can still split it by hand.",
  upstream_auth: "The AI helper isn't working right now — you can still split it by hand.",
  rate_limited: 'Lots of splits are being read right now — try again in a moment.',
  timeout: 'That took too long. Try again — or split it by hand.',
  upstream_error: "Couldn't reach the AI service. Please try again.",
  network: 'You seem to be offline. Check your connection and try again.',
  aborted: 'Cancelled.',
}

/** Shown instead of trying at all when the browser knows it's offline. */
export const DESCRIBE_OFFLINE_MESSAGE = "You're offline — you can still split it by hand."

export const DESCRIBE_TOO_LONG_MESSAGE = `That's a lot to read — keep it under ${DESCRIBE_LIMITS.maxTextChars} characters.`

/**
 * The client waits a little longer than the server's own budget, so the server's answer —
 * a draft or a friendly `timeout` — always arrives before the browser gives up.
 */
export const DESCRIBE_TIMEOUT_MS = DESCRIBE_BUDGET_MS + 10_000

export class DescribeError extends Error {
  readonly code: DescribeErrorCode

  constructor(code: DescribeErrorCode, message: string = DESCRIBE_ERROR_MESSAGES[code]) {
    super(message)
    this.name = 'DescribeError'
    this.code = code
  }
}

/**
 * `rate_limited` copy for a `Retry-After`: a short wait is "busy", a long one names the wait — or,
 * for a request sent with Pro (`pro`), says the day's fair-use allowance is used up.
 */
export function describeRateLimitedMessage(seconds: number | null, pro = false): string {
  if (seconds === null || seconds < 60) return DESCRIBE_ERROR_MESSAGES.rate_limited
  if (pro && seconds > PRO_ALLOWANCE_MIN_WAIT_SECONDS) {
    return `You've reached today's fair-use AI limit. It resets in ${waitPhrase(seconds)} — you can still split it by hand.`
  }
  return `Too many AI splits for now. Try again in ${waitPhrase(seconds)} — or split it by hand.`
}

const DESCRIBE_API_CODES: ReadonlySet<string> = new Set<DescribeErrorCode>([
  'bad_request',
  'not_a_split',
  'unreadable',
  'not_configured',
  'upstream_auth',
  'rate_limited',
  'timeout',
  'upstream_error',
])

function fallbackCode(status: number): DescribeErrorCode {
  if (status === 400 || status === 413) return 'bad_request'
  if (status === 422) return 'not_a_split'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'not_configured'
  if (status === 504 || status === 408) return 'timeout'
  return 'upstream_error'
}

function describeErrorFrom(result: Exclude<CallResult, { ok: true }>, pro: boolean): DescribeError {
  switch (result.kind) {
    case 'timeout':
      return new DescribeError('timeout')
    case 'aborted':
      return new DescribeError('aborted')
    case 'network':
      return new DescribeError('network', isOffline() ? DESCRIBE_OFFLINE_MESSAGE : DESCRIBE_ERROR_MESSAGES.network)
    case 'bad_body':
      return new DescribeError('upstream_error')
    case 'http': {
      const code =
        result.code !== null && DESCRIBE_API_CODES.has(result.code)
          ? (result.code as DescribeErrorCode)
          : fallbackCode(result.status)
      if (code === 'rate_limited') return new DescribeError(code, describeRateLimitedMessage(result.retryAfter, pro))
      return new DescribeError(code)
    }
  }
}

/* ------------------------------------------------------------------ response */

const MODES: ReadonlySet<string> = new Set(['equal', 'exact', 'percent', 'shares'])

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** Checks the 200 body really is a draft; tolerant of missing optional bits. Null when it isn't one. */
export function parseDescribeResponse(body: unknown): DescribeResponse | null {
  if (!isRecord(body) || !Array.isArray(body.people)) return null
  const people: DescribedPerson[] = []
  for (const raw of body.people) {
    if (!isRecord(raw)) continue
    const name = cleanText(raw.name)
    if (!name) continue
    people.push({ name, value: finite(raw.value) ? raw.value : null })
  }
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
  const payer = cleanText(body.payer)
  const headcount = body.headcount
  return {
    title: cleanText(body.title),
    category: isCategoryId(body.category) ? body.category : 'other',
    amount: finite(body.amount) && body.amount > 0 ? body.amount : null,
    currency: isKnownCurrency(currency) ? currency : null,
    mode: typeof body.mode === 'string' && MODES.has(body.mode) ? (body.mode as DescribedSplit['mode']) : 'equal',
    payer: payer || null,
    people,
    headcount: typeof headcount === 'number' && Number.isInteger(headcount) && headcount > 0 ? headcount : null,
    date: isIsoDate(body.date) ? body.date : null,
    model: typeof body.model === 'string' && body.model ? body.model : 'unknown',
  }
}

/* ------------------------------------------------------------------ request */

export interface DescribeHints {
  /** The user's default currency — a hint only; the AI never assumes it. */
  currency: string
  /** Names the user splits with, so matches come back spelled the same way. */
  people: string[]
  /** The user's local date (YYYY-MM-DD), for "yesterday" and weekdays. */
  today: string
}

/** Known names for the server: tidied, de-duplicated, within its limits. */
function hintNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    if (out.length >= DESCRIBE_LIMITS.maxPeople) break
    if (typeof raw !== 'string') continue
    const name = graphemes(normalizeName(raw)).slice(0, DESCRIBE_LIMITS.maxNameChars).join('').trim()
    const key = nameKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** The request body for `text` and the user's context (exported for tests). */
export function describeRequest(text: string, ctx: DescribeHints): DescribeRequest {
  const body: DescribeRequest = { text: text.replace(/\s+/g, ' ').trim() }
  if (isKnownCurrency(ctx.currency)) body.currency = ctx.currency
  const people = hintNames(ctx.people)
  if (people.length > 0) body.people = people
  if (isIsoDate(ctx.today)) body.today = ctx.today
  return body
}

/**
 * Asks the AI to read `text` as a split. With Pro, the license goes along for the Pro allowance.
 * Cancel with `signal` (→ `aborted`); gives up after `DESCRIBE_TIMEOUT_MS` (→ `timeout`).
 * @throws DescribeError
 */
export async function describeSplit(text: string, ctx: DescribeHints, signal?: AbortSignal): Promise<DescribeResponse> {
  if (signal?.aborted) throw new DescribeError('aborted')
  const body = describeRequest(typeof text === 'string' ? text : '', ctx)
  if (!/[\p{L}\p{N}]/u.test(body.text)) throw new DescribeError('bad_request')
  if (Array.from(body.text).length > DESCRIBE_LIMITS.maxTextChars) throw new DescribeError('bad_request', DESCRIBE_TOO_LONG_MESSAGE)

  const headers = licenseHeaders()
  const result = await callApi('/api/describe', {
    method: 'POST',
    body,
    headers,
    timeoutMs: DESCRIBE_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) throw describeErrorFrom(result, LICENSE_HEADER in headers)
  const parsed = parseDescribeResponse(result.body)
  if (!parsed) throw new DescribeError('upstream_error')
  return parsed
}
