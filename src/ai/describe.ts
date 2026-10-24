/**
 * "Just say it": one sentence ("Cab 840 with Riya and Sam, Sam pays double") → a draft split,
 * read by the AI at `POST /api/describe`. Every failure is a `DescribeError` whose `message` is
 * friendly and safe to show as-is; `code` lets the UI pick the next step.
 */
import {
  DESCRIBE_BUDGET_MS,
  DESCRIBE_LIMITS,
  DESCRIBE_SOURCES,
  isCategoryId,
  LICENSE_HEADER,
  VOICE_LANGS,
  type DescribedPerson,
  type DescribeRequest,
  type DescribeResponse,
  type DescribeSource,
  type VoiceLang,
} from '../../shared/api'
import type { DescribedSplit } from '../domain/types'
import { t, type MessageKey } from '../i18n'
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

/** What the "Just say it" field cycles through: one per way of splitting it understands. */
export const DESCRIBE_EXAMPLES: readonly string[] = [
  DESCRIBE_EXAMPLE,
  'Rent 32000 me 40% Aditya 30% Neha 30%',
  'Cab 840 with Riya and Sam, Sam pays double',
  'Netflix 649 for 4',
  'Groceries 1260, Neha paid, split with me',
]

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

/** The message keys for each failure (the English copy is in `DESCRIBE_ERROR_MESSAGES`). */
const DESCRIBE_ERROR_KEYS: Readonly<Record<DescribeErrorCode, MessageKey>> = {
  bad_request: 'home.describe.error.badRequest',
  not_a_split: 'home.describe.error.notSplit',
  unreadable: 'home.describe.error.unreadable',
  not_configured: 'home.describe.error.notConfigured',
  upstream_auth: 'home.describe.error.upstreamAuth',
  rate_limited: 'home.describe.error.rateLimited',
  timeout: 'home.describe.error.timeout',
  upstream_error: 'home.describe.error.upstream',
  network: 'home.describe.error.network',
  aborted: 'home.describe.error.aborted',
}

/** A failure's copy in the UI language. */
export function describeErrorMessage(code: DescribeErrorCode): string {
  if (code === 'bad_request' || code === 'not_a_split') return t(DESCRIBE_ERROR_KEYS[code], { example: DESCRIBE_EXAMPLE })
  return t(DESCRIBE_ERROR_KEYS[code])
}

/** The offline copy in the UI language. */
export function describeOfflineMessage(): string {
  return t('home.describe.offline')
}

/** The too-long copy in the UI language. */
export function describeTooLongMessage(): string {
  return t('home.describe.tooLong', { max: DESCRIBE_LIMITS.maxTextChars })
}

/**
 * The client waits a little longer than the server's own budget, so the server's answer —
 * a draft or a friendly `timeout` — always arrives before the browser gives up.
 */
export const DESCRIBE_TIMEOUT_MS = DESCRIBE_BUDGET_MS + 10_000

export class DescribeError extends Error {
  readonly code: DescribeErrorCode

  constructor(code: DescribeErrorCode, message: string = describeErrorMessage(code)) {
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
  if (seconds === null || seconds < 60) return describeErrorMessage('rate_limited')
  if (pro && seconds > PRO_ALLOWANCE_MIN_WAIT_SECONDS) {
    return t('home.describe.limit.proDay', { wait: waitPhrase(seconds) })
  }
  return t('home.describe.limit.wait', { wait: waitPhrase(seconds) })
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
      return new DescribeError('network', isOffline() ? describeOfflineMessage() : describeErrorMessage('network'))
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
  /** The language it was written or spoken in (the voice language, or the app's for typed text). */
  lang?: VoiceLang
  /** How it arrived (typed by default). */
  source?: DescribeSource
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
  if (ctx.lang !== undefined && (VOICE_LANGS as readonly string[]).includes(ctx.lang)) body.lang = ctx.lang
  if (ctx.source !== undefined && (DESCRIBE_SOURCES as readonly string[]).includes(ctx.source)) body.source = ctx.source
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
  if (Array.from(body.text).length > DESCRIBE_LIMITS.maxTextChars) throw new DescribeError('bad_request', describeTooLongMessage())

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
