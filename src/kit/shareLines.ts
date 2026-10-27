/**
 * Each person's line in an expense's share list: their share, whether it's settled, and — on
 * itemized bills — what they had. Pure, so the list, the pay page and their tests agree to the paisa.
 */
import { ME_ID, type Expense, type Minor } from '../domain/types'
import { t } from '../i18n'
import { uniqueParticipants } from '../engine/split'
import { currencyDigits } from '../lib/money'
import { computeSplit, shareLabel } from '../lib/split'
import { splitPeopleIds } from './expenseLabels'

export interface ShareItemLine {
  itemId: string
  name: string
  /** This person's exact part of the item price. */
  amount: Minor
  /** "½", "⅓", "2 of 3 shares"; null when they had it alone. */
  portion: string | null
  /** Nobody was ticked for the item, so everyone shares it. */
  everyone: boolean
}

export type ShareState =
  /** Paid the bill (their share is their own). */
  | 'payer'
  /** Has paid the payer back. */
  | 'paid'
  /** Still owes the payer. */
  | 'owes'
  /** In the split with nothing to pay. */
  | 'zero'
  /** Settled through the group's balances, not person by person. */
  | 'group'

export interface ShareLine {
  friendId: string
  share: Minor
  state: ShareState
  /** Bills only: the person's items, in bill order. */
  items: ShareItemLine[]
  /** Bills only: their part of tax and charges (+) or discounts (−) — `share` minus their items. */
  extras: Minor
  /** Still owing: what they've paid of it so far (`Expense.partPaid`), else 0. */
  paidSoFar: Minor
}

/** Everyone in the split, payer first, with what they owe and where it stands. */
export function shareLines(e: Expense, opts: { settledInGroup?: boolean } = {}): ShareLine[] {
  const items = billItemLines(e)
  return splitPeopleIds(e).map((friendId) => {
    const share = e.shares[friendId] ?? 0
    const state: ShareState =
      friendId === e.payerId
        ? 'payer'
        : opts.settledInGroup
          ? 'group'
          : share <= 0
            ? 'zero'
            : e.paidBack[friendId] !== undefined
              ? 'paid'
              : 'owes'
    const lines = items?.get(friendId) ?? []
    const itemsTotal = lines.reduce((sum, line) => sum + line.amount, 0)
    const paidSoFar = state === 'owes' ? Math.min(e.partPaid?.[friendId] ?? 0, share) : 0
    return { friendId, share, state, items: lines, extras: items ? share - itemsTotal : 0, paidSoFar }
  })
}

/** Item lines per person on an itemized bill (null for anything else). */
function billItemLines(e: Expense): Map<string, ShareItemLine[]> | null {
  const bill = e.bill
  if (e.kind !== 'bill' || !bill || bill.items.length === 0) return null
  const people = uniqueParticipants(e.participants).map((p) => ({ id: p.friendId, name: p.friendId, color: 0 }))
  const split = computeSplit({ items: bill.items, people, assignments: bill.assignments, paid: e.total })
  const out = new Map<string, ShareItemLine[]>()
  for (const person of split.people) {
    out.set(
      person.person.id,
      person.lines.map((line) => ({
        itemId: line.itemId,
        name: line.name,
        amount: line.amount,
        portion: shareLabel(line),
        everyone: line.everyone,
      })),
    )
  }
  return out
}

/** "Tax & charges", "Discounts" or "Round-off" (up to one whole unit either way) for a bill's extras line. */
export function extrasLabel(extras: Minor, currency: string): string {
  if (Math.abs(extras) <= 10 ** currencyDigits(currency)) return t('kit.shares.extras.roundOff')
  return extras > 0 ? t('kit.shares.extras.charges') : t('kit.shares.extras.discounts')
}

/** Who can act on a line, from the owner's side. */
export interface ShareActions {
  /** Tick them off as paid back (or undo). */
  toggle: boolean
  /** A UPI QR: them paying me, or me paying the payer. INR only. */
  upi: boolean
  /** A reminder to pay me back. */
  nudge: boolean
}

export function shareActions(line: ShareLine, e: Pick<Expense, 'payerId' | 'currency'>): ShareActions {
  const open = line.state === 'owes'
  const iPaid = e.payerId === ME_ID
  const between = iPaid || line.friendId === ME_ID
  return {
    toggle: open || line.state === 'paid',
    upi: open && between && e.currency === 'INR',
    nudge: open && iPaid && line.friendId !== ME_ID,
  }
}
