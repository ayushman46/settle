/**
 * One-shot hand-off into "Add stuck money" (`/app/stuck/new`) from wherever a stuck payment was
 * spotted: a message pasted on the list, a failed-payment SMS shared into Settle, a failed or
 * pending payment screenshot. What's known is filled in; the person checks it and saves. Kept in
 * memory and in sessionStorage (so it survives a reload between hand-off and pick-up), and gone
 * once taken. Also reads a paste of one or more messages into what each one is (readStuckPaste).
 */
import * as z from 'zod/mini'
import { navigate } from '../../app/router'
import { STUCK_KINDS, STUCK_RAILS, STUCK_SOURCES, type StuckRail, type StuckSource } from '../../data/stores'
import type { StuckDraft } from '../../data/stuck'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR, toMinor } from '../../lib/money'
import type { ProofResponse } from '../../../shared/api'
import { findVia, parseSms, type SmsParse } from '../sharein/sms/parseSms'
import { splitMessages } from '../sharein/sms/smsView'
import { readStuckMessage, signalToDraft, type StuckSignal } from './detect'
import { STUCK_NEW_PATH } from './paths'

/** What Add can be opened with: any part of a new stuck payment. */
export type StuckPrefill = Partial<
  Pick<StuckDraft, 'kind' | 'rail' | 'party' | 'merchant' | 'amount' | 'date' | 'promisedBy' | 'ref' | 'orderId' | 'bank' | 'account' | 'app' | 'source' | 'confirmed'>
>

export const STUCK_PREFILL_KEY = 'settle.v6.stuck-prefill'

/** A second take this soon after the first returns the same value (React StrictMode renders twice). */
const RETAKE_GRACE_MS = 1000

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
  ref: z.optional(text(40)),
  orderId: z.optional(text(60)),
  bank: z.optional(text(40)),
  account: z.optional(text(20)),
  app: z.optional(text(40)),
  source: z.optional(z.enum(STUCK_SOURCES)),
  confirmed: z.optional(z.boolean()),
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
  openStuckAdd((signal ? prefillFromSignal(signal, source) : null) ?? { kind: 'failed', source, confirmed: false })
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
 * new stuck payment: null.
 */
export function prefillFromSignal(signal: StuckSignal, source: StuckSource): StuckPrefill | null {
  if (signal.type !== 'failed' && signal.type !== 'pending' && signal.type !== 'refund_initiated') return null
  const draft = signalToDraft(signal, source)
  if (draft) return draft
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

/** What a message said, for a form filled in by hand: the amount, who, the day, the reference, the bank and account. */
function foundIn(signal: StuckSignal): StuckPrefill {
  return {
    amount: signal.amount,
    date: signal.date,
    party: signal.party,
    merchant: signal.merchant,
    ref: signal.ref,
    bank: signal.bank,
    account: signal.account,
    app: signal.app,
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
 * person says failed but took the money: a failed payment known to have left the account.
 */
export function prefillFromDebit(signal: StuckSignal, text: string): StuckPrefill {
  const rail = ('rail' in signal ? signal.rail : null) ?? railOfDebit(text, signal.merchant)
  return { ...foundIn(signal), kind: 'failed', rail, confirmed: true }
}

/** Why a pasted message isn't stuck money: an OTP, an offer, money in, a payment out, or something else. */
export type PasteSkip = 'otp' | 'offer' | 'in' | 'out' | 'other'

function skipOf(parsed: SmsParse): PasteSkip {
  if (parsed.kind === 'ignored') return parsed.reason === 'otp' ? 'otp' : parsed.reason === 'promo' ? 'offer' : 'other'
  if (parsed.kind === 'txn') return parsed.dir === 'credit' ? 'in' : 'out'
  return 'other'
}

/** One paste, read message by message (blank lines or a new bank alert start the next; five at most). */
export interface StuckPaste {
  /** New stuck payments — a failure, a pending payment, a refund a business started — and what to fill in. */
  items: Array<{ signal: StuckSignal; prefill: StuckPrefill }>
  /** Money back: a reversal, a refund credited. */
  back: StuckSignal[]
  /** Plain debits not paired with a failure here: maybe a failure the bank only told as a debit. */
  debits: Array<{ signal: StuckSignal; text: string }>
  /** Debits that showed a failure here took the money (saved along with it, they say so again). */
  paired: StuckSignal[]
  /** Messages about money that came in from someone (a friend paying you back?). */
  credits: number
  /** Why each of the other messages isn't stuck money. */
  skipped: PasteSkip[]
  /** Whatever the messages gave (amount, who, day, reference) — for adding it by hand when nothing was stuck money. */
  found: StuckPrefill | null
}

/**
 * Reads a paste one message at a time, so an OTP or an offer pasted with a failed payment doesn't
 * hide it, and two stuck payments in one paste are both found. A failure pasted with its own debit
 * (the same amount, no other reference) is known to have taken the money.
 */
export function readStuckPaste(text: string, today: string): StuckPaste {
  const out: StuckPaste = { items: [], back: [], debits: [], paired: [], credits: 0, skipped: [], found: null }
  for (const message of splitMessages(text)) {
    const signal = readStuckMessage(message, { today })
    const prefill = signal ? prefillFromSignal(signal, 'sms') : null
    if (signal && prefill) out.items.push({ signal, prefill })
    else if (signal && (signal.type === 'reversal' || signal.type === 'refund_credited')) out.back.push(signal)
    else if (signal?.type === 'debit') out.debits.push({ signal, text: message })
    else {
      const parsed = parseSms(message, { today })
      if (parsed.kind === 'txn' && parsed.dir === 'credit' && !parsed.refund) out.credits += 1
      out.skipped.push(signal ? 'out' : skipOf(parsed))
      if (signal) out.found ??= foundIn(signal)
    }
  }
  for (const item of out.items) {
    if (item.signal.type !== 'failed' || item.prefill.confirmed !== false) continue
    const ref = item.signal.ref
    const at = out.debits.findIndex(({ signal }) => signal.amount === item.signal.amount && (!ref || !signal.ref || signal.ref === ref))
    if (at < 0) continue
    item.prefill = { ...item.prefill, confirmed: true }
    out.paired.push(...out.debits.splice(at, 1).map((d) => d.signal))
  }
  const debit = out.debits[0]
  if (debit) out.found = foundIn(debit.signal)
  return out
}
