/**
 * Decides what a payment screenshot means for Settle, as plain rules (no DOM, no storage):
 * refuses what isn't a finished payment to me, and otherwise finds the one person who owes exactly
 * that money. Anything ambiguous goes back to the person to pick, never to a guess.
 */
import type { PaymentStatus, ProofResponse } from '../../../shared/api'
import type { Minor } from '../../domain/types'

/** Money the screenshot may differ by and still be the same payment: ₹1. */
export const AMOUNT_TOLERANCE: Minor = 100

/** Someone who owes me, in rupees (minor units), with what settling with them covers. */
export interface Owed {
  friendId: string
  name: string
  /** What they owe me, in paise, > 0. */
  amount: Minor
}

export interface Me {
  name: string
  upiId: string | null
}

/** A payment already recorded from a screenshot: its reference, and whom it settled. */
export interface LedgerEntry {
  utr: string
  friendId: string
  amount: Minor
  at: number
}

export type ProofVerdict =
  /** One person owes exactly this: offer "Mark X's ₹N as paid?". */
  | { kind: 'match'; friendId: string; name: string; amount: Minor; utr: string | null }
  /** Still processing: not marked. */
  | { kind: 'pending' }
  /** The payment failed: not marked. */
  | { kind: 'failed' }
  /** Couldn't tell whether it went through. */
  | { kind: 'unreadable' }
  /** The money went to someone else. */
  | { kind: 'wrong_payee'; payeeName: string | null; payeeUpi: string | null }
  /** No receiver is shown, so it can't be checked against me. */
  | { kind: 'payee_unknown' }
  /** This reference is already recorded. `friendId` is null when that person was removed since. */
  | { kind: 'duplicate'; utr: string; friendId: string | null }
  /** Nothing matches exactly: the person picks (`candidates` are those closest to the amount, or everyone who owes). */
  | { kind: 'no_match'; amount: Minor | null; payerName: string | null; candidates: Owed[] }

/** Loose name comparison: letters only, any script; "Riya" matches "Riya Sharma", "Sam D" matches "Sam Dsouza". */
export function namesMatch(a: string, b: string): boolean {
  const x = nameTokens(a)
  const y = nameTokens(b)
  if (x.length === 0 || y.length === 0) return false
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.every((token) => long.includes(token))) return true
  const first = x[0] ?? ''
  return first === (y[0] ?? '') && first.length >= 3
}

function nameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

/** Rupees to paise, as the rest of the app counts money. */
export function toPaise(rupees: number): Minor {
  return Math.round(rupees * 100)
}

function payeeIsMe(proof: Pick<ProofResponse, 'payeeName' | 'payeeUpi'>, me: Me): boolean {
  if (proof.payeeUpi !== null && me.upiId !== null && proof.payeeUpi.toLowerCase() === me.upiId.trim().toLowerCase()) return true
  return proof.payeeName !== null && namesMatch(proof.payeeName, me.name)
}

export interface MatchInput {
  owed: readonly Owed[]
  me: Me
  ledger: readonly LedgerEntry[]
}

/** The verdict for one reading. Order matters: a pending or failed payment is refused before anything else is checked. */
export function matchProof(proof: Omit<ProofResponse, 'model'>, input: MatchInput): ProofVerdict {
  const status: PaymentStatus = proof.status
  if (status === 'pending') return { kind: 'pending' }
  if (status === 'failed') return { kind: 'failed' }
  if (status !== 'success') return { kind: 'unreadable' }

  if (!payeeIsMe(proof, input.me)) {
    if (proof.payeeName === null && proof.payeeUpi === null) return { kind: 'payee_unknown' }
    return { kind: 'wrong_payee', payeeName: proof.payeeName, payeeUpi: proof.payeeUpi }
  }

  if (proof.utr !== null) {
    const seen = input.ledger.find((entry) => entry.utr === proof.utr)
    if (seen) return { kind: 'duplicate', utr: proof.utr, friendId: seen.friendId }
  }

  // Only rupee payments can be matched: anything else goes to the person.
  if (proof.amount === null || (proof.currency !== null && proof.currency !== 'INR')) {
    return { kind: 'no_match', amount: null, payerName: proof.payerName, candidates: [...input.owed] }
  }
  const amount = toPaise(proof.amount)
  const near = input.owed.filter((o) => Math.abs(o.amount - amount) <= AMOUNT_TOLERANCE)
  if (near.length === 0) return { kind: 'no_match', amount, payerName: proof.payerName, candidates: [...input.owed] }

  const named = proof.payerName === null ? near : near.filter((o) => namesMatch(proof.payerName ?? '', o.name))
  if (named.length === 1) {
    const only = named[0]
    if (only) return { kind: 'match', friendId: only.friendId, name: only.name, amount: only.amount, utr: proof.utr }
  }
  return { kind: 'no_match', amount, payerName: proof.payerName, candidates: named.length > 0 ? named : near }
}
