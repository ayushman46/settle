/**
 * Settle before you leave, worked out: a checklist of payments that stays put while it is being
 * ticked (the app's fewest payments can reshuffle after each one, a checklist must not), kept
 * honest against the group's real balances, and the facts for the "All square" card. Pure.
 */
import type { Expense, Group, Minor } from '../../domain/types'
import { simplifyDebts, type Transfer } from '../../engine/balances'

/** One line of the checklist. Ticked when `settlementId` names the group payment that was recorded for it. */
export interface CheckoutRow {
  fromId: string
  toId: string
  amount: Minor
  settlementId: string | null
}

export interface CheckoutSession {
  rows: CheckoutRow[]
  /** When this checklist began (ms). */
  startedAt: number
  /** The open payments were worked out again after it began (an expense or a payment changed). */
  revised: boolean
}

/** A checklist never holds more lines than this (the oldest ticked ones go first). */
export const MAX_CHECKOUT_ROWS = 120

export interface Reconciled {
  rows: CheckoutRow[]
  /** The rows are not what was stored: save them. */
  changed: boolean
  /** The open payments had to be worked out again under an unfinished checklist. */
  revised: boolean
  /** A finished checklist was replaced by a new one (money came up after everyone was square). */
  fresh: boolean
}

function isPaid(row: CheckoutRow): boolean {
  return row.settlementId !== null
}

/**
 * The stored checklist against the group as it is now.
 *
 * - A tick whose payment no longer exists (removed on the group's page) is open again.
 * - If making every open payment squares everyone exactly, the checklist stands as it is.
 * - Otherwise something changed (a new expense, a payment recorded elsewhere, a part payment):
 *   the ticked lines are kept and the open ones are worked out again from the real balances.
 *   A checklist that was already finished starts over instead.
 *
 * `order` puts freshly worked-out payments in the order to show them.
 */
export function reconcile(
  stored: readonly CheckoutRow[],
  balances: Readonly<Record<string, Minor>>,
  settlementIds: ReadonlySet<string>,
  order: (transfers: Transfer[]) => Transfer[] = (list) => list,
): Reconciled {
  let changed = false
  const rows = stored.map((row) => {
    if (row.settlementId === null || settlementIds.has(row.settlementId)) return row
    changed = true
    return { ...row, settlementId: null }
  })

  const left: Record<string, number> = {}
  for (const [id, value] of Object.entries(balances)) left[id] = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  for (const row of rows) {
    if (isPaid(row)) continue
    left[row.fromId] = (left[row.fromId] ?? 0) + row.amount
    left[row.toId] = (left[row.toId] ?? 0) - row.amount
  }
  if (Object.values(left).every((v) => v === 0)) return { rows, changed, revised: false, fresh: false }

  const next = order(simplifyDebts(balances)).map((t): CheckoutRow => ({ fromId: t.fromId, toId: t.toId, amount: t.amount, settlementId: null }))
  if (rows.length === 0) return { rows: next.slice(0, MAX_CHECKOUT_ROWS), changed: next.length > 0, revised: false, fresh: false }
  if (rows.every(isPaid)) return { rows: next.slice(0, MAX_CHECKOUT_ROWS), changed: true, revised: false, fresh: true }
  const paid = rows.filter(isPaid)
  const keep = Math.max(0, MAX_CHECKOUT_ROWS - next.length)
  return { rows: [...(keep > 0 ? paid.slice(-keep) : []), ...next].slice(0, MAX_CHECKOUT_ROWS), changed: true, revised: true, fresh: false }
}

export interface CheckoutProgress {
  total: number
  paid: number
  open: number
}

export function checkoutProgress(rows: readonly CheckoutRow[]): CheckoutProgress {
  const paid = rows.filter(isPaid).length
  return { total: rows.length, paid, open: rows.length - paid }
}

export interface TripFacts {
  /** What the group spent in its own currency (money lent is not spending). */
  spent: Minor
  expenseCount: number
  /** Everyone in the group, plus anyone else who paid or had a share. */
  people: number
  /** The first and last day something was spent; null when nothing was. */
  from: string | null
  to: string | null
}

/** The group at a glance for the "All square" card. */
export function tripFacts(group: Group, expenses: readonly Expense[]): TripFacts {
  const people = new Set(group.memberIds)
  let spent = 0
  let expenseCount = 0
  let from: string | null = null
  let to: string | null = null
  for (const e of expenses) {
    if (e.groupId !== group.id || e.currency !== group.currency || e.kind === 'loan') continue
    spent += e.total
    expenseCount += 1
    people.add(e.payerId)
    for (const [id, share] of Object.entries(e.shares)) if (share > 0) people.add(id)
    if (from === null || e.date < from) from = e.date
    if (to === null || e.date > to) to = e.date
  }
  return { spent, expenseCount, people: people.size, from, to }
}
