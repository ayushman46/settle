/**
 * Money between you and one friend, as the app's own records have it: what is owed in one
 * direction, which payments were recorded since a moment, and exactly what one recorded payment
 * changed. Pure. Pay in parts and Promise to pay both read the books through this, so neither
 * keeps a balance of its own and no payment is ever counted twice.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { isSettledInGroup, stillOwed } from '../../engine/balances'
import { toIsoDate } from '../../engine/dates'
import { friendBalance, netIn } from '../friends/friendBalance'

/** `pay`: you pay the friend. `receive`: the friend pays you. */
export type Direction = 'pay' | 'receive'

/** One change a recorded payment made in the app's records. A minus amount went the other way. */
export type MoneyRecord =
  | { kind: 'group'; groupId: string; settlementId: string; amount: Minor }
  | { kind: 'split'; expenseId: string; amount: Minor }

export interface Books {
  expenses: readonly Expense[]
  groups: readonly Group[]
}

/** A payment the app has on record between the two of you. */
export interface SeenPayment {
  amount: Minor
  /** The day it was paid, when the record has one (a part payment on a split has none). */
  on: string | null
  /** The group's name or the split's title. */
  where: string
  kind: 'group' | 'split'
}

/** Who pays and who receives. */
export function sides(friendId: string, direction: Direction, meId: string = ME_ID): { debtorId: string; creditorId: string } {
  return direction === 'pay' ? { debtorId: meId, creditorId: friendId } : { debtorId: friendId, creditorId: meId }
}

/** What is owed in `direction` in `currency` right now (never below 0). */
export function owedBetween(friendId: string, direction: Direction, currency: string, books: Books, meId: string = ME_ID): Minor {
  const net = netIn(friendBalance(friendId, books.expenses, books.groups, currency, meId), currency)
  return Math.max(0, direction === 'receive' ? net : -net)
}

/** True for a split outside groups that `debtorId` pays `creditorId` back for, in `currency`. */
function isTheirSplit(e: Expense, books: Books, debtorId: string, creditorId: string, currency: string): boolean {
  return e.currency === currency && e.payerId === creditorId && (e.shares[debtorId] ?? 0) > 0 && !isSettledInGroup(e, books.groups)
}

/** What `debtorId` has paid of their share so far. */
function paidToward(e: Expense, debtorId: string): Minor {
  return Math.max(0, (e.shares[debtorId] ?? 0) - stillOwed(e, debtorId))
}

/**
 * Shares outside groups that were part paid already (split id → what was paid), to remember when
 * something starts: a part payment has no date of its own, so this is how "paid since" is known.
 */
export function partPaidSoFar(books: Books, debtorId: string, creditorId: string, currency: string): Record<string, Minor> {
  const out: Record<string, Minor> = {}
  for (const e of books.expenses) {
    if (!isTheirSplit(e, books, debtorId, creditorId, currency) || e.paidBack[debtorId] !== undefined) continue
    const paid = paidToward(e, debtorId)
    if (paid > 0) out[e.id] = paid
  }
  return out
}

/**
 * Exactly what a payment recorded between `before` and `after` changed: new payments in shared
 * groups and what was paid off shares outside groups. Money from `debtorId` to `creditorId` is
 * plus; anything settled the other way in the same go is minus.
 */
export function diffRecords(before: Books, after: Books, debtorId: string, creditorId: string, currency: string): MoneyRecord[] {
  const records: MoneyRecord[] = []
  const had = new Map(before.groups.map((g) => [g.id, new Set(g.settlements.map((s) => s.id))]))
  for (const group of after.groups) {
    if (group.currency !== currency) continue
    const known = had.get(group.id)
    for (const s of group.settlements) {
      if (known?.has(s.id)) continue
      if (s.fromId === debtorId && s.toId === creditorId) records.push({ kind: 'group', groupId: group.id, settlementId: s.id, amount: s.amount })
      else if (s.fromId === creditorId && s.toId === debtorId) records.push({ kind: 'group', groupId: group.id, settlementId: s.id, amount: -s.amount })
    }
  }
  const earlier = new Map(before.expenses.map((e) => [e.id, e]))
  for (const e of after.expenses) {
    const was = earlier.get(e.id)
    if (!was || was === e || e.currency !== currency || isSettledInGroup(e, after.groups)) continue
    if (e.payerId === creditorId) {
      const delta = paidToward(e, debtorId) - paidToward(was, debtorId)
      if (delta !== 0) records.push({ kind: 'split', expenseId: e.id, amount: delta })
    } else if (e.payerId === debtorId) {
      const delta = paidToward(e, creditorId) - paidToward(was, creditorId)
      if (delta !== 0) records.push({ kind: 'split', expenseId: e.id, amount: -delta })
    }
  }
  return records
}

/** What the records add up to (money that went the other way taken off). */
export function recordsTotal(records: readonly MoneyRecord[]): Minor {
  return records.reduce((sum, r) => sum + r.amount, 0)
}

export interface SinceOptions {
  /** Epoch ms: only payments recorded from this moment on. */
  since: number
  /** `partPaidSoFar` as it was at that moment. */
  paidBefore: Readonly<Record<string, Minor>>
  /** Payments already accounted for (a plan's own): left out. */
  exclude?: readonly MoneyRecord[]
}

/**
 * Payments from `debtorId` to `creditorId` on record since a moment, leaving out the ones in
 * `exclude`: payments in shared groups, and what was paid off shares outside groups.
 */
export function paymentsSince(books: Books, debtorId: string, creditorId: string, currency: string, opts: SinceOptions): SeenPayment[] {
  const skipSettlements = new Set<string>()
  const counted = new Map<string, Minor>()
  for (const r of opts.exclude ?? []) {
    if (r.kind === 'group') skipSettlements.add(r.settlementId)
    else if (r.amount > 0) counted.set(r.expenseId, (counted.get(r.expenseId) ?? 0) + r.amount)
  }
  const seen: SeenPayment[] = []
  for (const group of books.groups) {
    if (group.currency !== currency) continue
    for (const s of group.settlements) {
      if (s.fromId !== debtorId || s.toId !== creditorId || skipSettlements.has(s.id)) continue
      if (!(s.createdAt >= opts.since) || !(s.amount > 0)) continue
      seen.push({ amount: s.amount, on: s.date, where: group.name, kind: 'group' })
    }
  }
  for (const e of books.expenses) {
    if (!isTheirSplit(e, books, debtorId, creditorId, currency)) continue
    const paidAt = e.paidBack[debtorId]
    if (paidAt !== undefined && paidAt < opts.since) continue
    const amount = paidToward(e, debtorId) - (opts.paidBefore[e.id] ?? 0) - (counted.get(e.id) ?? 0)
    if (amount > 0) seen.push({ amount, on: paidAt !== undefined ? toIsoDate(new Date(paidAt)) : null, where: e.title, kind: 'split' })
  }
  return seen
}

export function paymentsTotal(payments: readonly SeenPayment[]): Minor {
  return payments.reduce((sum, p) => sum + p.amount, 0)
}
