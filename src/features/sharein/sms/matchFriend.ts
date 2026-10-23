/**
 * Closing the loop from a bank SMS to "mark as paid": who the money went to (or came from) among
 * your people, and whether it pays off exactly what's open between you — the whole INR balance, or
 * one open split. Amounts must match to the paisa; anything else gets no offer (never guess).
 */
import type { Expense, Friend, Group, Minor } from '../../../domain/types'
import { friendBalance, netIn, type FriendSource, type PaidBackMark } from '../../friends/friendBalance'
import { nameKey } from '../../../lib/people'
import { normalizeUpiId } from '../../../lib/upi'
import type { SmsTxn } from './parseSms'

export interface FriendMatch {
  friendId: string
  by: 'vpa' | 'name'
}

export type SettleOffer =
  /** The whole INR balance with them. */
  | { kind: 'all'; friendId: string; amount: Minor; sources: FriendSource[] }
  /** One open split. */
  | { kind: 'one'; friendId: string; amount: Minor; mark: PaidBackMark; title: string }

/** Every SMS here is in rupees. */
const CURRENCY = 'INR'

/** Case-, accent- and punctuation-insensitive words ("RIYA SHARMA." → ["riya", "sharma"]). */
function words(name: string): string[] {
  return nameKey(name)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** True when two surnames can be the same person's: equal, or one cut short by the bank ("SHA" for "Sharma"). */
function sameRest(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return true
  const x = a.join(' ')
  const y = b.join(' ')
  return x.startsWith(y) || y.startsWith(x)
}

/**
 * VPA equal to a friend's UPI ID (normalized) wins; else a unique friend whose name equals the SMS
 * name, or whose first name equals the SMS name's first word ("RIYA SHARMA" → the one Riya). Two
 * people who could be meant → no match.
 */
export function matchFriend(t: SmsTxn, friends: readonly Friend[], meId: string): FriendMatch | null {
  const others = friends.filter((f) => f.id !== meId)
  if (t.vpa) {
    const vpa = normalizeUpiId(t.vpa)
    const byVpa = others.filter((f) => f.upiId !== null && normalizeUpiId(f.upiId) === vpa)
    if (byVpa.length === 1 && byVpa[0]) return { friendId: byVpa[0].id, by: 'vpa' }
    if (byVpa.length > 1) return null
  }
  if (!t.name) return null
  const sms = words(t.name)
  const first = sms[0]
  if (!first) return null
  const key = sms.join(' ')
  const exact = others.filter((f) => words(f.name).join(' ') === key)
  if (exact.length === 1 && exact[0]) return { friendId: exact[0].id, by: 'name' }
  if (exact.length > 1) return null
  // Only when they're your one person with that first name, and their surname (if any) fits.
  const byFirst = others.filter((f) => words(f.name)[0] === first)
  const only = byFirst.length === 1 ? byFirst[0] : undefined
  if (only && sameRest(words(only.name).slice(1), sms.slice(1))) return { friendId: only.id, by: 'name' }
  return null
}

/**
 * A debit to a friend you owe exactly `amount` (all of it, or one split they paid), or a credit
 * from a friend who owes you exactly that — else null. Refunds never settle anything.
 */
export function settleOffer(
  t: SmsTxn,
  match: FriendMatch,
  expenses: readonly Expense[],
  groups: readonly Group[],
  meId: string,
): SettleOffer | null {
  if (t.refund || !Number.isSafeInteger(t.amount) || t.amount <= 0) return null
  const { friendId } = match
  if (friendId === meId) return null
  const balance = friendBalance(friendId, expenses, groups, CURRENCY, meId)
  // + they owe me. A payment I made settles what I owe; one they made, what they owe.
  const sign = t.dir === 'debit' ? -1 : 1
  if (netIn(balance, CURRENCY) === sign * t.amount) {
    return { kind: 'all', friendId, amount: t.amount, sources: balance.sources.filter((s) => s.currency === CURRENCY) }
  }
  const debtorId = t.dir === 'debit' ? meId : friendId
  const byId = new Map(expenses.map((e) => [e.id, e]))
  for (const source of balance.sources) {
    if (source.kind !== 'splits' || source.currency !== CURRENCY) continue
    // Newest first, as friendBalance lists them.
    for (const mark of source.marks) {
      if (mark.debtorId !== debtorId) continue
      const expense = byId.get(mark.expenseId)
      if (expense && expense.shares[debtorId] === t.amount) {
        return { kind: 'one', friendId, amount: t.amount, mark, title: expense.title }
      }
    }
  }
  return null
}
