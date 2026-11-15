/**
 * Refund splitter: money that came back on an expense (a refund, cashback, a deposit returned)
 * goes back to everyone in the proportions they paid in. Pure: it plans the change; `actions.ts` makes it.
 *
 * The rule the plan keeps: after a refund the expense is still an ordinary, self-consistent
 * expense. Its stored shares are exactly what the app's own split engine works out from its mode,
 * inputs and (smaller) total, so a later edit, a reload or another phone never changes them.
 *
 * - Part of it came back: the expense's total comes down by that much. Equal, percent, shares and
 *   "what each had" keep their inputs (the engine re-deals the smaller total in the same
 *   proportions); exact amounts are re-dealt in proportion to what was typed; an itemised bill
 *   keeps its items and who had what (the engine shares what was paid by each person's items).
 * - All of it came back: an expense can't be ₹0, so it leaves the expenses (kept whole in the
 *   refund store, to put back).
 * - The money went to someone other than the payer: that person holds the payer's money, so one
 *   1:1 entry "payer lent them the refund" is added beside it.
 * - Outside a group, someone had already paid the payer back more than their new share: the payer
 *   owes them the difference, as a 1:1 entry.
 */
import type { Expense, FxSnapshot, Minor, Participant } from '../../domain/types'
import { rateFromTotals } from '../../engine/fx'
import { expenseShares } from '../../engine/split'
import { allocate } from '../../lib/money'

export type RefundIssue =
  /** A loan isn't spending: nothing to refund. */
  | 'loan'
  /** Not a whole, positive amount. */
  | 'bad_amount'
  /** More than was paid. */
  | 'too_much'
  /** The expense's own split doesn't add up for the smaller total (damaged data): edit it instead. */
  | 'stuck'

export interface RefundInput {
  /** What came back, in the expense's currency (minor units). */
  amount: Minor
  /** Who got the money. */
  toId: string
  /** The line to add to the expense's note ("₹300 refunded on 14 Nov 2026"), already written; '' adds none. */
  noteLine: string
  /** The expense is settled through its group's balances (so "paid back" ticks don't count). */
  inGroup: boolean
}

/** A 1:1 entry added beside the expense: `lenderId` is owed `amount` by `borrowerId`. */
export interface RefundCompanion {
  /** holder: they got the refund of the payer's money. overpaid: they had paid the payer more than their new share. */
  kind: 'holder' | 'overpaid'
  lenderId: string
  borrowerId: string
  amount: Minor
}

/** What changes on the expense itself when part of it came back. */
export interface RefundChanges {
  total: Minor
  participants: Participant[]
  note: string | null
  /** Present only for an expense paid in another currency. */
  fx?: FxSnapshot
}

export type RefundPlan =
  | { ok: false; issue: RefundIssue }
  | {
      ok: true
      /** lower: the expense stays, smaller. remove: all of it came back, so it leaves the expenses. */
      kind: 'lower' | 'remove'
      amount: Minor
      newTotal: Minor
      /** The fields to save on the expense (null when it is removed). */
      changes: RefundChanges | null
      /** What each person's share will be (empty when removed). Σ === newTotal. */
      shares: Record<string, Minor>
      companions: RefundCompanion[]
    }

/** The longest note an expense keeps (`MAX_NOTE_LENGTH` in the data layer). */
export const NOTE_LIMIT = 500

function wholeInput(value: number | null): number {
  return value === null || !Number.isFinite(value) || value <= 0 ? 0 : Math.round(value)
}

/** `allocate`, with the payer first in line for an odd paisa (the app's own rule: friends never pay a stray one). */
function allocatePayerFirst(total: Minor, weights: readonly number[], ids: readonly string[], payerId: string): Minor[] {
  const payerIndex = ids.indexOf(payerId)
  if (payerIndex <= 0) return allocate(total, weights)
  const order = [payerIndex, ...ids.map((_, i) => i).filter((i) => i !== payerIndex)]
  const parts = allocate(total, order.map((i) => weights[i] ?? 0))
  const out = new Array<number>(ids.length).fill(0)
  order.forEach((index, k) => {
    out[index] = parts[k] ?? 0
  })
  return out
}

/** The participants of the smaller expense: only exact amounts change (re-dealt in proportion, to the paisa). */
export function participantsAfter(e: Pick<Expense, 'mode' | 'participants' | 'payerId'>, newTotal: Minor): Participant[] {
  if (e.mode !== 'exact') return e.participants.map((p) => ({ ...p }))
  const ids = e.participants.map((p) => p.friendId)
  const parts = allocatePayerFirst(newTotal, e.participants.map((p) => wholeInput(p.input)), ids, e.payerId)
  return e.participants.map((p, i) => ({ friendId: p.friendId, input: parts[i] ?? 0 }))
}

/** The note with the refund line added on its own line; unchanged when the line is empty or wouldn't fit. */
export function noteAfter(note: string | null, line: string, limit: number = NOTE_LIMIT): string | null {
  const add = line.trim()
  if (add === '') return note
  const next = note && note.trim() !== '' ? `${note}\n${add}` : add
  return [...next].length <= limit ? next : note
}

/**
 * Trip currency after a refund: the foreign amount comes down in the same proportion, and the
 * snapshot becomes "what was actually paid" (so the smaller total stands to the paisa, whatever
 * the rate rounds to).
 */
export function fxAfter(fx: FxSnapshot, currency: string, total: Minor, newTotal: Minor): FxSnapshot {
  const amount = Math.max(1, allocate(fx.amount, [newTotal, Math.max(0, total - newTotal)])[0] ?? fx.amount)
  return { amount, currency: fx.currency, rate: rateFromTotals(amount, fx.currency, newTotal, currency) ?? fx.rate, rateDate: null, source: 'manual_total' }
}

/** What `id` has already paid the payer on a standalone expense: all of it when ticked off, else their part payments. */
function alreadyPaid(e: Pick<Expense, 'shares' | 'paidBack' | 'partPaid'>, id: string): Minor {
  const share = e.shares[id] ?? 0
  if (e.paidBack[id] !== undefined) return share
  return Math.min(Math.max(0, e.partPaid?.[id] ?? 0), share)
}

/** Plans a refund of `input.amount` on `e`. Changes nothing. */
export function planRefund(e: Expense, input: RefundInput): RefundPlan {
  if (e.kind === 'loan') return { ok: false, issue: 'loan' }
  const amount = input.amount
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, issue: 'bad_amount' }
  if (amount > e.total) return { ok: false, issue: 'too_much' }

  const newTotal = e.total - amount
  const kind = newTotal === 0 ? 'remove' : 'lower'
  let changes: RefundChanges | null = null
  let shares: Record<string, Minor> = {}

  if (kind === 'lower') {
    const participants = participantsAfter(e, newTotal)
    shares = expenseShares({ total: newTotal, currency: e.currency, mode: e.mode, participants, payerId: e.payerId, roundedToWhole: e.roundedToWhole, bill: e.bill })
    let sum = 0
    for (const share of Object.values(shares)) {
      if (!Number.isSafeInteger(share) || share < 0) return { ok: false, issue: 'stuck' }
      sum += share
    }
    if (sum !== newTotal) return { ok: false, issue: 'stuck' }
    changes = { total: newTotal, participants, note: noteAfter(e.note, input.noteLine) }
    if (e.fx) changes.fx = fxAfter(e.fx, e.currency, e.total, newTotal)
  }

  const companions: RefundCompanion[] = []
  if (input.toId !== e.payerId) companions.push({ kind: 'holder', lenderId: e.payerId, borrowerId: input.toId, amount })
  if (!input.inGroup) {
    // In the order people are listed on the expense, so every phone makes the same entries.
    for (const { friendId } of e.participants) {
      if (friendId === e.payerId || !((e.shares[friendId] ?? 0) > 0)) continue
      const over = alreadyPaid(e, friendId) - (shares[friendId] ?? 0)
      if (over > 0) companions.push({ kind: 'overpaid', lenderId: friendId, borrowerId: e.payerId, amount: over })
    }
  }
  return { ok: true, kind, amount, newTotal, changes, shares, companions }
}

/** One refund kept on this phone: enough to show it, undo it exactly, and (when all of it came back) put the expense back. */
export interface RefundRecord {
  id: string
  expenseId: string
  kind: 'lower' | 'remove'
  amount: Minor
  currency: string
  toId: string
  /** YYYY-MM-DD the money came back. */
  date: string
  createdAt: number
  /** The expense exactly as it was before this refund. */
  before: Expense
  /** The expense that sat just before it in the list (null: it was first). */
  afterId: string | null
  /** The 1:1 entries added with it. */
  companionIds: string[]
  /** The smaller expense's `updatedAt` as saved (a different one now means it was changed since); 0 when removed. */
  savedAt: number
}

/** The refunds on one expense, newest first. */
export function refundsOn(records: readonly RefundRecord[], expenseId: string): RefundRecord[] {
  return records.filter((r) => r.expenseId === expenseId).sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Whether a refund can be taken off exactly: it must be the latest one on its expense, and (when
 * the expense is still there, smaller) the expense must not have been changed since.
 */
export function canTakeOff(record: RefundRecord, records: readonly RefundRecord[], expenses: readonly Expense[]): boolean {
  if (refundsOn(records, record.expenseId)[0]?.id !== record.id) return false
  const current = expenses.find((e) => e.id === record.expenseId)
  if (record.kind === 'remove') return current === undefined
  return current !== undefined && current.updatedAt === record.savedAt
}

/** Expenses that were refunded in full, for one group (`groupId`) or outside groups / in groups that are gone (`null`). */
export function fullyRefunded(records: readonly RefundRecord[], groupId: string | null, groupIds: ReadonlySet<string>): RefundRecord[] {
  return records
    .filter((r) => r.kind === 'remove')
    .filter((r) => (groupId === null ? r.before.groupId === null || !groupIds.has(r.before.groupId) : r.before.groupId === groupId))
    .sort((a, b) => b.createdAt - a.createdAt || a.before.title.localeCompare(b.before.title))
}

/** The list with `expense` back: replaced in place when it's there, else right after `afterId` (the front when that is gone). */
export function placeExact(list: readonly Expense[], expense: Expense, afterId: string | null): Expense[] {
  if (list.some((e) => e.id === expense.id)) return list.map((e) => (e.id === expense.id ? expense : e))
  const at = afterId === null ? -1 : list.findIndex((e) => e.id === afterId)
  if (at === -1) return [expense, ...list]
  return [...list.slice(0, at + 1), expense, ...list.slice(at + 1)]
}
