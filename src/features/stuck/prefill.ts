/**
 * One-shot hand-off into "Add stuck money" (`/app/stuck/new`) from wherever a stuck payment was
 * spotted: a message pasted on the list, a failed-payment SMS shared into Settle, a failed or
 * pending payment screenshot. What's known is filled in; the person checks it and saves. Kept in
 * memory and in sessionStorage (so it survives a reload between hand-off and pick-up), and gone
 * once taken. Also reads a paste of one or more messages into what each one is (readStuckPaste).
 *
 * A pasted message's day is the day it prints. One that prints none leaves the day unset, so Add
 * asks — never a quiet "today". A promise in days ("in 7 working days") stays a count, to run from
 * the day the person confirms.
 */
import * as z from 'zod/mini'
import { navigate } from '../../app/router'
import { STUCK_KINDS, STUCK_RAILS, STUCK_SOURCES, type StuckRail, type StuckSource } from '../../data/stores'
import type { StuckDraft } from '../../data/stuck'
import { addDays, isIsoDate } from '../../engine/dates'
import { MAX_MINOR, toMinor } from '../../lib/money'
import type { ProofResponse } from '../../../shared/api'
import { cleanSms, findVia, parseSms, type SmsParse } from '../sharein/sms/parseSms'
import { splitAlerts } from '../sharein/sms/splitAlerts'
import { readStuckFacts, readStuckMessage, signalToDraft, type StuckSignal } from './detect'
import { addWorkingDays } from './merchants'
import { STUCK_NEW_PATH } from './paths'

/** What Add can be opened with: any part of a new stuck payment. */
export type StuckPrefill = Partial<
  Pick<StuckDraft, 'kind' | 'rail' | 'party' | 'merchant' | 'amount' | 'date' | 'promisedBy' | 'ref' | 'orderId' | 'bank' | 'account' | 'app' | 'source' | 'confirmed'>
> & {
  /** "In 7 working days": a promise counted from the day it started, so it moves when that day is corrected. */
  promisedDays?: number | null
  /** …working days (false: calendar days, "within 7 days", "48 hours"). */
  promisedWorking?: boolean
  /** Brought back by Undo of "Start tracking": filled in, not saved. */
  undone?: boolean
}

export const STUCK_PREFILL_KEY = 'settle.v6.stuck-prefill'

/** A second take this soon after the first returns the same value (React StrictMode renders twice). */
const RETAKE_GRACE_MS = 1000

/** The longest promise in days read from a message (more is a typo, or not a promise). */
const MAX_PROMISED_DAYS = 90

const isoDay = z.string().check(z.refine(isIsoDate))
const text = (max: number) => z.nullable(z.string().check(z.maxLength(max)))

const prefillSchema = z.object({
  kind: z.optional(z.enum(STUCK_KINDS)),
  rail: z.optional(z.nullable(z.enum(STUCK_RAILS))),
  party: z.optional(text(120)),
  merchant: z.optional(text(40)),
  amount: z.optional(z.int().check(z.positive(), z.lte(MAX_MINOR))),
  date: z.optional(isoDay),
  promisedBy: z.optional(z.nullable(isoDay)),
  promisedDays: z.optional(z.nullable(z.int().check(z.positive(), z.lte(MAX_PROMISED_DAYS)))),
  promisedWorking: z.optional(z.boolean()),
  ref: z.optional(text(40)),
  orderId: z.optional(text(60)),
  bank: z.optional(text(40)),
  account: z.optional(text(20)),
  app: z.optional(text(40)),
  source: z.optional(z.enum(STUCK_SOURCES)),
  confirmed: z.optional(z.boolean()),
  undone: z.optional(z.boolean()),
})

let pending: StuckPrefill | null = null
let lastTaken: { value: StuckPrefill; at: number } | null = null

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Only known fields with the right types (a field that doesn't fit is dropped, not the rest). */
function clean(value: unknown): StuckPrefill | null {
  if (typeof value !== 'object' || value === null) return null
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(prefillSchema.def.shape)) {
    const raw = (value as Record<string, unknown>)[key]
    if (raw === undefined) continue
    const parsed = z.safeParse(field, raw)
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data
  }
  return out as StuckPrefill
}

/** Leaves `prefill` for Add to pick up. */
export function setStuckPrefill(prefill: StuckPrefill): void {
  pending = clean(prefill)
  lastTaken = null
  try {
    if (pending) session()?.setItem(STUCK_PREFILL_KEY, JSON.stringify(pending))
    else session()?.removeItem(STUCK_PREFILL_KEY)
  } catch {
    // sessionStorage unavailable: the in-memory copy still works within this page.
  }
}

/** What's waiting, without taking it. */
export function peekStuckPrefill(): StuckPrefill | null {
  if (pending) return pending
  try {
    const raw = session()?.getItem(STUCK_PREFILL_KEY)
    return raw ? clean(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Takes the waiting prefill (once) — null when there's none. */
export function takeStuckPrefill(): StuckPrefill | null {
  const value = peekStuckPrefill()
  drop()
  if (value) {
    lastTaken = { value, at: Date.now() }
    return value
  }
  if (lastTaken && Date.now() - lastTaken.at < RETAKE_GRACE_MS) return lastTaken.value
  return null
}

function drop(): void {
  pending = null
  try {
    session()?.removeItem(STUCK_PREFILL_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Discards any waiting prefill. */
export function clearStuckPrefill(): void {
  drop()
  lastTaken = null
}

/** Opens Add with `prefill` filled in. */
export function openStuckAdd(prefill: StuckPrefill): void {
  setStuckPrefill(prefill)
  navigate(STUCK_NEW_PATH)
}

/**
 * A message that says a payment failed → Add, filled in with whatever the message gave (or just
 * "a failed payment, not yet known to have taken the money" when it gave nothing more).
 */
export function trackFailedMessage(text: string, today: string, source: StuckSource): void {
  const signal = readStuckMessage(text, { today })
  openStuckAdd((signal ? prefillFromSignal(signal, source, text) : null) ?? { kind: 'failed', source, confirmed: false })
}

/* ---------------------------------------------------------------- what a pasted message itself says */

/**
 * The day a pasted message is about came from the message itself. The detector puts "today" on a
 * message that prints no day (`dated: false`), or prints one still to come (`dateDoubt`): that's
 * not the day the money left.
 */
function printsItsDay(signal: StuckSignal): boolean {
  return signal.dated !== false && signal.dateDoubt === undefined
}

/** "in 7 working days", "within 5-7 business days", "in 48 hours": the longest it allows. */
const PROMISE_WITHIN =
  /\b(?:in|within|takes?|take up to|up to|upto)\s+(?:the next\s+|another\s+)?(\d{1,2})(?:\s?(?:-|–|to)\s?(\d{1,2}))?\s*(business|working|bank(?:ing)?(?: working)?)?\s*(days?|hours?|hrs?)\b/i
/** Hinglish and Hindi: "5-7 din mein", "7 kaam ke din mein", "5-7 कार्य दिवस में". */
const PROMISE_DIN =
  /\b(\d{1,2})(?:\s?(?:-|–|to|se)\s?(\d{1,2}))?\s*(working|business|kaam(?:-?kaaj)?(?: ke)?|कार्य|कामकाजी)?\s*(din|days?|दिन|दिवस|दिवसों)\s*(?:(?:mein|me|main|men|ke andar)\b|में|के अंदर|के भीतर)/i
/** "Refund in 5-7 business days" said any other way. */
const PROMISE_WORKING = /\b(\d{1,2})(?:\s?(?:-|–|to)\s?(\d{1,2}))?\s*(business|working|bank(?:ing)?(?: working)?)\s*(days?)\b/i

interface PromiseIn {
  days: number
  /** Working days (else calendar days). */
  working: boolean
}

/** A promise a message counts in days, as it counts them — or null. (The detector keeps working days; calendar days are read here.) */
function promiseIn(text: string): PromiseIn | null {
  const m = PROMISE_WITHIN.exec(text) ?? PROMISE_DIN.exec(text) ?? PROMISE_WORKING.exec(text)
  if (!m) return null
  const n = Number(m[2] ?? m[1])
  if (/^h/i.test(m[4] ?? '')) return { days: Math.max(1, Math.ceil(n / 24)), working: false }
  return n > 0 && n <= MAX_PROMISED_DAYS ? { days: n, working: m[3] !== undefined } : null
}

/** The day a promise in days ends, counted from `date`. */
export function promiseEnds(date: string, days: number, working: boolean): string {
  return working ? addWorkingDays(date, days) : addDays(date, days)
}

/**
 * A prefill as a pasted message gives it: its own day, or none (Add asks); a promise in days kept
 * as a count from that day, so it moves when the day is corrected. (A flight's refund to a card
 * comes from the detector with its card: the DGCA's 7 days apply.)
 */
function asPasted(prefill: StuckPrefill, signal: StuckSignal, text: string): StuckPrefill {
  const { date, ...undated } = prefill
  const out: StuckPrefill = printsItsDay(signal) ? { ...undated, date } : undated
  if (signal.type !== 'refund_initiated') return out
  const promise = signal.promisedDays ? { days: signal.promisedDays, working: true } : promiseIn(text)
  // Only a promise that is that count from the message's day ("by 12 Nov" is a day of its own).
  if (promise && (signal.promisedBy === null || signal.promisedBy === promiseEnds(signal.date, promise.days, promise.working))) {
    out.promisedBy = null
    out.promisedDays = promise.days
    out.promisedWorking = promise.working
  }
  return out
}

/**
 * A payment screenshot that says failed or pending, as a prefill: the amount, who it was to, the
 * reference, the day and the app — not yet known to have taken the money (Add asks).
 */
export function prefillFromProof(proof: Omit<ProofResponse, 'model'>): StuckPrefill {
  const rupees = proof.currency === null || proof.currency === 'INR'
  return {
    kind: 'failed',
    amount: proof.amount !== null && proof.amount > 0 && rupees ? toMinor(proof.amount, 'INR') : undefined,
    party: proof.payeeName ?? proof.payeeUpi ?? null,
    ref: proof.utr,
    date: proof.date ?? undefined,
    app: proof.app === 'gpay' || proof.app === 'phonepe' || proof.app === 'paytm' || proof.app === 'bhim' ? proof.app : null,
    rail: null,
    source: 'screenshot',
    confirmed: false,
  }
}

/**
 * What a message said, as a prefill: the detector's draft when it makes one (a failed or pending
 * payment, a refund started), otherwise what the message itself gave. Money coming back is not a
 * new stuck payment: null. Given the text of a message pasted or shared in, its day is only the
 * day it prints — see asPasted().
 */
export function prefillFromSignal(signal: StuckSignal, source: StuckSource, pasted?: string): StuckPrefill | null {
  if (signal.type !== 'failed' && signal.type !== 'pending' && signal.type !== 'refund_initiated') return null
  const prefill = signalToDraft(signal, source) ?? fromSignal(signal, source)
  return pasted !== undefined ? asPasted(prefill, signal, pasted) : prefill
}

function fromSignal(signal: Extract<StuckSignal, { type: 'failed' | 'pending' | 'refund_initiated' }>, source: StuckSource): StuckPrefill {
  const common: StuckPrefill = {
    amount: signal.amount,
    date: signal.date,
    party: signal.party,
    merchant: signal.merchant,
    ref: signal.ref,
    bank: signal.bank,
    account: signal.account,
    app: signal.app,
    source,
  }
  if (signal.type === 'refund_initiated') return { ...common, kind: 'refund', orderId: signal.orderId, promisedBy: signal.promisedBy, confirmed: true }
  return { ...common, kind: 'failed', rail: signal.rail, confirmed: signal.type === 'failed' && signal.debited }
}

/** What a message said, for a form filled in by hand: the amount, who, the day (when it's the message's own), the reference, the bank and account. */
function foundIn(signal: StuckSignal, dated: boolean): StuckPrefill {
  return {
    amount: signal.amount,
    ...(dated ? { date: signal.date } : {}),
    party: signal.party,
    merchant: signal.merchant,
    ref: signal.ref,
    bank: signal.bank,
    account: signal.account,
    app: signal.app,
    source: 'sms',
  }
}

/**
 * A message about money Settle couldn't read in full, as what it could read (the amount, the day
 * it prints, the reference, the account and bank, a business named) for "Add it yourself" — a
 * failed payment when it says one failed, not yet known to have taken the money. Null without an amount.
 */
function unreadIn(text: string, today: string): StuckPrefill | null {
  const facts = readStuckFacts(text, today)
  if (!facts) return null
  return {
    ...(facts.failed ? { kind: 'failed' as const, confirmed: false } : {}),
    amount: facts.amount,
    ...(facts.date !== null ? { date: facts.date } : {}),
    party: facts.party,
    merchant: facts.merchant,
    ref: facts.ref,
    account: facts.account,
    bank: facts.bank,
    source: 'sms',
  }
}

/** How a plain debit was paid, when its message makes it clear (null leaves the choice to the person). */
function railOfDebit(text: string, merchant: string | null): StuckRail | null {
  if (/\bnach\b|\becs\b/i.test(text)) return 'nach'
  const via = findVia(text)
  if (via === 'atm' || via === 'imps' || via === 'wallet') return via
  if (via === 'card') return /\bpos\b/i.test(text) ? 'card_pos' : merchant ? 'card_online' : null
  if (via === 'upi') return merchant || /\bp2m\b/i.test(text) ? 'upi_merchant' : /\bp2p\b/i.test(text) ? 'upi_person' : null
  return null
}

/**
 * A plain debit ("Sent Rs.649 to SWIGGY", "A/c X3367 debited by 1845.00 … trf to IRCTC") that the
 * person says failed but took the money: a failed payment known to have left the account. A debit
 * pasted without its day leaves the day for Add to ask.
 */
export function prefillFromDebit(signal: StuckSignal, text: string): StuckPrefill {
  const rail = ('rail' in signal ? signal.rail : null) ?? railOfDebit(text, signal.merchant)
  return { ...foundIn(signal, printsItsDay(signal)), kind: 'failed', rail, confirmed: true }
}

/**
 * Why a pasted message isn't stuck money: an OTP, an offer, money in, a payment out, a bill or an
 * EMI, an AutoPay, one Settle couldn't read in full, the same message pasted twice, or something else.
 */
export type PasteSkip = 'otp' | 'offer' | 'in' | 'out' | 'bill' | 'autopay' | 'unread' | 'repeat' | 'other'

function skipOf(parsed: SmsParse, unread: StuckPrefill | null): PasteSkip {
  if (parsed.kind === 'txn') return parsed.dir === 'credit' ? 'in' : 'out'
  // About money, but not understood ("रु 5000.00 … नामे किए गए"): what it gave goes into Add.
  if (parsed.kind === 'unknown') return unread !== null ? 'unread' : 'other'
  switch (parsed.reason) {
    case 'otp':
      return 'otp'
    case 'promo':
      return 'offer'
    case 'statement':
      return 'bill'
    case 'mandate':
      return 'autopay'
    case 'failed':
      return unread !== null ? 'unread' : 'other'
    default:
      return 'other'
  }
}

/** The most messages read from one paste (the sheet's subtitle says 50). Any past it are counted and said (paste them next), never dropped quietly. */
export const MAX_PASTE_MESSAGES = 50

/** One paste, read message by message (blank lines or a new bank alert start the next). */
export interface StuckPaste {
  /** New stuck payments — a failure, a pending payment, a refund a business started — and what to fill in. */
  items: Array<{ signal: StuckSignal; prefill: StuckPrefill }>
  /** Money back: a reversal, a refund credited. */
  back: StuckSignal[]
  /** Plain debits not paired with a failure here: maybe a failure the bank only told as a debit (and what Add would get). */
  debits: Array<{ signal: StuckSignal; prefill: StuckPrefill }>
  /** Debits that showed a failure here took the money (saved along with it, they say so again). */
  paired: StuckSignal[]
  /** Messages about money that came in from someone (a friend paying you back?). */
  credits: number
  /** Why each of the other messages isn't stuck money. */
  skipped: PasteSkip[]
  /** Whatever the messages gave (amount, who, day, reference) — for adding it by hand when nothing was stuck money. */
  found: StuckPrefill | null
  /** Messages read. */
  read: number
  /** Messages past MAX_PASTE_MESSAGES, not read. */
  left: number
}

/** The same message pasted twice: the same kind of message, amount and reference (or order number, or words). */
function pasteKey(signal: StuckSignal, text: string): string {
  const id = signal.ref ?? (signal.type === 'refund_initiated' ? signal.orderId : null) ?? cleanSms(text).toLowerCase()
  return `${signal.type}|${signal.amount}|${id}`
}

/** A failure with the debit that shows it took the money: confirmed, and the debit's day (and bank) when the failure didn't say. */
function withDebit(failure: StuckPrefill, debit: StuckPrefill): StuckPrefill {
  return {
    ...failure,
    confirmed: true,
    ...(failure.date === undefined && debit.date !== undefined ? { date: debit.date } : {}),
    ref: failure.ref ?? debit.ref ?? null,
    bank: failure.bank ?? debit.bank ?? null,
    account: failure.account ?? debit.account ?? null,
  }
}

/**
 * Reads a paste one message at a time, so an OTP or an offer pasted with a failed payment doesn't
 * hide it, and two stuck payments in one paste are both found. A failure pasted with its own debit
 * (the same amount, no other reference) is known to have taken the money — on the debit's day,
 * when the failure didn't say one. The same message pasted twice counts once.
 */
export function readStuckPaste(text: string, today: string): StuckPaste {
  // The whole paste (no cut at 2,000 characters), every message in it.
  const messages = splitAlerts(cleanSms(typeof text === 'string' ? text : '', Number.MAX_SAFE_INTEGER))
  const read = messages.slice(0, MAX_PASTE_MESSAGES)
  const out: StuckPaste = { items: [], back: [], debits: [], paired: [], credits: 0, skipped: [], found: null, read: read.length, left: messages.length - read.length }
  const keys = new Set<string>()
  for (const message of read) {
    const signal = readStuckMessage(message, { today })
    const prefill = signal ? prefillFromSignal(signal, 'sms', message) : null
    if (signal && prefill) {
      const key = pasteKey(signal, message)
      if (keys.has(key)) out.skipped.push('repeat')
      else out.items.push({ signal, prefill })
      keys.add(key)
    } else if (signal && (signal.type === 'reversal' || signal.type === 'refund_credited')) out.back.push(signal)
    else if (signal?.type === 'debit') out.debits.push({ signal, prefill: prefillFromDebit(signal, message) })
    else {
      const parsed = parseSms(message, { today })
      if (parsed.kind === 'txn' && parsed.dir === 'credit' && !parsed.refund) out.credits += 1
      // About money but not understood, or a failure the detector couldn't read: what it could read.
      const unread = !signal && (parsed.kind === 'unknown' || (parsed.kind === 'ignored' && parsed.reason === 'failed')) ? unreadIn(message, today) : null
      out.skipped.push(signal ? 'out' : skipOf(parsed, unread))
      if (signal) out.found ??= foundIn(signal, printsItsDay(signal))
      else if (unread) out.found ??= unread
    }
  }
  for (const item of out.items) {
    if (item.signal.type !== 'failed' || item.prefill.confirmed !== false) continue
    const ref = item.signal.ref
    const at = out.debits.findIndex(({ signal }) => signal.amount === item.signal.amount && (!ref || !signal.ref || signal.ref === ref))
    const debit = at < 0 ? undefined : out.debits.splice(at, 1)[0]
    if (!debit) continue
    item.prefill = withDebit(item.prefill, debit.prefill)
    out.paired.push(debit.signal)
  }
  const debit = out.debits[0]
  if (debit) out.found = foundIn(debit.signal, debit.prefill.date !== undefined)
  return out
}
