/** Who still has to pay the payer back on an expense, and how that reads. Pure, for cards, lists and their tests. */
import type { Expense } from '../domain/types'
import { describePeople } from '../components/helpers'
import { splitPeopleIds } from './expenseLabels'

/** Everyone who owes the payer something on `e` (share > 0, not paid back yet), in split order. */
export function pendingIds(e: Pick<Expense, 'participants' | 'shares' | 'payerId' | 'paidBack'>): string[] {
  return splitPeopleIds(e).filter((id) => id !== e.payerId && (e.shares[id] ?? 0) > 0 && e.paidBack[id] === undefined)
}

/** "1 of 3 paid", "All 3 paid", "Nobody's paid yet". */
export function paidCountLabel(paidCount: number, peopleCount: number): string {
  if (peopleCount > 0 && paidCount >= peopleCount) return peopleCount === 1 ? 'Paid' : `All ${peopleCount} paid`
  if (paidCount === 0) return peopleCount === 1 ? 'Not paid yet' : "Nobody's paid yet"
  return `${paidCount} of ${peopleCount} paid`
}

/** "Waiting on Sam", "Waiting on you and Sam", "Waiting on Sam, Neha and 2 others" (first names), or null. */
export function waitingOnLabel(names: readonly string[]): string | null {
  if (names.length === 0) return null
  const first = names.map((n) => n.trim().split(/\s+/)[0] || n)
  return `Waiting on ${describePeople(first, 2)}`
}
