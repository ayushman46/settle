/**
 * The same stuck money tracked twice: before a new one is saved (typed in, or read from a pasted
 * message), the one already on the phone it would repeat — so a second paste of one SMS doesn't
 * double what you're owed.
 *
 * - The same reference, or the same order number from the same business: surely the same money
 *   (an open one first; one that came back or was set aside still counts, so it isn't re-added).
 * - Otherwise an open one of the same kind for the same amount, to the same party, a day apart at
 *   most: maybe the same — two ₹649 Swiggy failures in a day can happen, so it's only asked.
 * - Two different 12-digit UPI references, or two different order numbers, are never the same.
 */
import { daysBetween, isIsoDate } from '../../engine/dates'
import type { StuckKind, StuckPayment } from '../../data/stores'
import { isStuckOpen } from '../../data/stuck'

/** What's known of the new one (from the form, or from a message). */
export interface StuckCandidate {
  kind?: StuckKind | null
  amount?: number | null
  date?: string | null
  party?: string | null
  merchant?: string | null
  ref?: string | null
  orderId?: string | null
}

export interface StuckTwin {
  payment: StuckPayment
  /** The same reference or order number. Otherwise only the same amount, party and day. */
  sure: boolean
  /** What matched: the reference, the order number, or the amount, party and day. */
  by: 'ref' | 'order' | 'details'
}

const UPI_REF = /^\d{12}$/

/** A reference or order number as compared: "430 112 345 678", "#OD123…", "PNR x7k2lq" → "X7K2LQ". */
function key(value: string | null | undefined): string | null {
  const k = (value ?? '')
    .replace(/^\s*pnr\b\s*(?:no\.?|number)?\s*[:#.-]?/i, '')
    .replace(/[\s#]/g, '')
    .toUpperCase()
  return k.length >= 4 ? k : null
}

function nameWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 1),
  )
}

/** Could they be the same business or person? Known on both sides they must agree; unknown on either can't say no. */
function sameParty(s: Pick<StuckPayment, 'party' | 'merchant'>, c: StuckCandidate): boolean {
  if (s.merchant && c.merchant) return s.merchant === c.merchant
  const a = s.party?.trim()
  const b = c.party?.trim()
  if (!a || !b) return true
  const words = nameWords(a)
  return [...nameWords(b)].some((w) => words.has(w))
}

/** The stuck payment already on the phone that `c` would repeat, or null. */
export function findStuckTwin(list: readonly StuckPayment[], c: StuckCandidate): StuckTwin | null {
  const ref = key(c.ref)
  const order = key(c.orderId)
  let closed: StuckTwin | null = null
  let maybe: StuckPayment | null = null
  for (const s of list) {
    const sRef = key(s.ref)
    const sOrder = key(s.orderId)
    const by = ref !== null && sRef === ref ? 'ref' : order !== null && sOrder === order && sameParty(s, c) ? 'order' : null
    if (by !== null) {
      if (isStuckOpen(s)) return { payment: s, sure: true, by }
      closed ??= { payment: s, sure: true, by }
      continue
    }
    if (maybe !== null || !isStuckOpen(s)) continue
    if (ref !== null && sRef !== null && UPI_REF.test(ref) && UPI_REF.test(sRef)) continue
    if (order !== null && sOrder !== null) continue
    if (c.kind && c.kind !== s.kind) continue
    if (c.amount == null || c.amount !== s.amount) continue
    if (!isIsoDate(c.date) || Math.abs(daysBetween(s.date, c.date)) > 1) continue
    if (sameParty(s, c)) maybe = s
  }
  return closed ?? (maybe ? { payment: maybe, sure: false, by: 'details' } : null)
}
