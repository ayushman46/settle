/**
 * Recording a refund and taking it off again. The expense is edited through `saveExpense` (so it
 * stays a real, editable expense), the 1:1 entries are real entries too, and every Undo puts the
 * expenses back exactly as they were: the same records, in the same places.
 */
import { ExpenseError, expensesStore, friendsStore, groupsStore, profileStore, saveExpense, type ExpenseDraft } from '../../data'
import { ME_ID, type Expense, type Friend } from '../../domain/types'
import { isSettledInGroup } from '../../engine/balances'
import { isIsoDate, today as todayIso } from '../../engine/dates'
import { t } from '../../i18n'
import { newId } from '../../lib/ids'
import { formatMoney } from '../../lib/money'
import { putShared, sharedFor } from '../groupsync/store'
import { canTakeOff, placeExact, planRefund, type RefundCompanion, type RefundIssue, type RefundPlan, type RefundRecord } from './engine'
import { addRefundRecord, hasRoomForFullRefund, refundStore, removeRefundRecord, restoreRefundRecord } from './store'

export type ApplyIssue = RefundIssue | 'gone' | 'full' | 'failed'

export type ApplyResult =
  | { ok: false; issue: ApplyIssue }
  | { ok: true; record: RefundRecord; plan: Extract<RefundPlan, { ok: true }>; /** The expense before the refund. */ before: Expense; undo: () => void }

/** "14 Nov 2026": the same on every phone, whatever its language (it is kept in a note). */
export function refundDateText(iso: string): string {
  const [y = 2000, m = 1, d = 1] = iso.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return iso
  }
}

/** A person's name as kept in a note others may read: never "You". */
function storedName(id: string): string {
  if (id === ME_ID) return profileStore.get().name.trim() || friendsStore.get().find((f) => f.id === ME_ID)?.name || t('common.people.someone')
  return friendsStore.get().find((f) => f.id === id)?.name ?? t('common.people.someone')
}

/** The line added to the expense's note: "₹300 refunded on 14 Nov 2026" (", to Riya" when it didn't go to the payer). */
export function refundNoteLine(e: Pick<Expense, 'currency' | 'payerId'>, amount: number, toId: string, date: string): string {
  const vars = { amount: formatMoney(amount, e.currency, { trimZeros: true }), date: refundDateText(date) }
  return toId === e.payerId ? t('refund.note.line', vars) : t('refund.note.line.to', { ...vars, name: storedName(toId) })
}

function draftOf(e: Expense): ExpenseDraft {
  const { id: _id, createdAt: _created, updatedAt: _updated, shares: _shares, paidBack: _paidBack, partPaid: _partPaid, ...rest } = e
  return rest
}

function companionDraft(e: Expense, c: RefundCompanion, date: string, inGroup: boolean): ExpenseDraft {
  const vars = { title: e.title, amount: formatMoney(c.amount, e.currency, { trimZeros: true }), date: refundDateText(date), lender: storedName(c.lenderId), borrower: storedName(c.borrowerId) }
  return {
    kind: 'loan',
    title: t('refund.companion.title', { title: e.title }),
    category: e.category,
    currency: e.currency,
    total: c.amount,
    date,
    payerId: c.lenderId,
    mode: 'equal',
    participants: [{ friendId: c.borrowerId, input: null }],
    roundedToWhole: false,
    note: c.kind === 'holder' ? t('refund.companion.note.holder', vars) : t('refund.companion.note.overpaid', vars),
    groupId: inGroup ? e.groupId : null,
    bill: null,
    recurringId: null,
    source: 'manual',
  }
}

function sameShares(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/**
 * In a shared group the newest version of an expense wins. Putting an older record back exactly
 * would lose to the copy other phones already have, so the group's own "brought back" stamp is
 * moved on: the record stays as it was, and its restored state is the one everyone ends up with.
 */
function stampShared(e: Pick<Expense, 'id' | 'groupId'>, now: number): void {
  if (!e.groupId) return
  const shared = sharedFor(e.groupId)
  if (shared) putShared({ ...shared, revived: { ...shared.revived, [e.id]: now } })
}

/** "Last used" marks moved by saving go back to what they were (only where nothing else moved them since). */
function restoreLastUsed(before: readonly Friend[], after: readonly Friend[]): void {
  const was = new Map(before.map((f) => [f.id, f.lastUsedAt]))
  const became = new Map(after.map((f) => [f.id, f.lastUsedAt]))
  friendsStore.update((friends) => {
    let changed = false
    const next = friends.map((f) => {
      const old = was.get(f.id)
      if (old === undefined || old === f.lastUsedAt || became.get(f.id) !== f.lastUsedAt) return f
      changed = true
      return { ...f, lastUsedAt: old }
    })
    return changed ? next : friends
  })
}

/**
 * Records a refund of `amount` on expense `expenseId`, received by `toId` on `date`. Returns the
 * record and an Undo that restores everything exactly, or why nothing was changed.
 */
export function applyRefund(expenseId: string, input: { amount: number; toId: string; date: string }, now: number = Date.now()): ApplyResult {
  const list = expensesStore.get()
  const index = list.findIndex((e) => e.id === expenseId)
  const before = list[index]
  if (!before) return { ok: false, issue: 'gone' }
  const date = isIsoDate(input.date) ? input.date : todayIso(new Date(now))
  const inGroup = isSettledInGroup(before, groupsStore.get())
  const plan = planRefund(before, { amount: input.amount, toId: input.toId, noteLine: refundNoteLine(before, input.amount, input.toId, date), inGroup })
  if (!plan.ok) return { ok: false, issue: plan.issue }
  if (plan.kind === 'remove' && !hasRoomForFullRefund()) return { ok: false, issue: 'full' }

  const afterId = list[index - 1]?.id ?? null
  const friendsBefore = friendsStore.get()
  const companionIds: string[] = []
  /** Everything back as it was: the companions gone, the very same expense record in its place. */
  const putBack = (): void => {
    expensesStore.update((current) => placeExact(current.filter((e) => !companionIds.includes(e.id)), before, afterId))
  }

  let savedAt = 0
  try {
    if (plan.changes) {
      const saved = saveExpense({ ...draftOf(before), ...plan.changes, id: before.id })
      // The promise this feature makes: the saved shares are the planned ones, to the paisa.
      if (saved.total !== plan.newTotal || !sameShares(saved.shares, plan.shares)) throw new ExpenseError('bad_total')
      savedAt = saved.updatedAt
    } else {
      expensesStore.set(list.filter((e) => e.id !== before.id))
    }
    for (const companion of plan.companions) companionIds.push(saveExpense(companionDraft(before, companion, date, inGroup)).id)
  } catch (error) {
    putBack()
    restoreLastUsed(friendsBefore, friendsStore.get())
    if (!(error instanceof ExpenseError)) throw error
    return { ok: false, issue: 'failed' }
  }
  const friendsAfter = friendsStore.get()

  const record: RefundRecord = {
    id: newId(),
    expenseId: before.id,
    kind: plan.kind,
    amount: plan.amount,
    currency: before.currency,
    toId: input.toId,
    date,
    createdAt: now,
    before,
    afterId,
    companionIds,
    savedAt,
  }
  addRefundRecord(record)

  const undo = (): void => {
    putBack()
    restoreLastUsed(friendsBefore, friendsAfter)
    removeRefundRecord(record.id)
    stampShared(before, Date.now())
  }
  return { ok: true, record, plan, before, undo }
}

/**
 * Takes a refund off: the expense goes back exactly as it was before it (for a full refund: back
 * into the expenses), and the 1:1 entries made with it are removed. Only the latest refund on an
 * expense, and only while the expense is unchanged since (see `canTakeOff`). Returns an Undo that
 * puts the refund back as it stood, or null when it can't be taken off.
 */
export function takeOffRefund(recordId: string): (() => void) | null {
  const records = refundStore.get().refunds
  const record = records.find((r) => r.id === recordId)
  const list = expensesStore.get()
  if (!record || !canTakeOff(record, records, list)) return null

  const at = list.findIndex((e) => e.id === record.expenseId)
  const current = list[at] ?? null
  // The entries made with it, each with what sits before it, so Undo puts them back in place.
  const companions = record.companionIds
    .map((id) => list.findIndex((e) => e.id === id))
    .filter((i) => i !== -1)
    .map((i) => ({ expense: list[i] as Expense, afterId: list[i - 1]?.id ?? null }))

  expensesStore.set(placeExact(list.filter((e) => !record.companionIds.includes(e.id)), record.before, record.afterId))
  const index = removeRefundRecord(record.id)
  stampShared(record.before, Date.now())

  return () => {
    expensesStore.update((now) => {
      let next = current ? placeExact(now, current, null) : now.filter((e) => e.id !== record.expenseId)
      for (const companion of companions) next = placeExact(next, companion.expense, companion.afterId)
      return next
    })
    restoreRefundRecord(record, index)
    stampShared(record.before, Date.now())
  }
}

/** Forgets an expense refunded in full (its 1:1 entries stay). Returns an Undo, or null when there is no such record. */
export function clearFullRefund(recordId: string): (() => void) | null {
  const record = refundStore.get().refunds.find((r) => r.id === recordId && r.kind === 'remove')
  if (!record) return null
  const index = removeRefundRecord(record.id)
  return () => restoreRefundRecord(record, index)
}
