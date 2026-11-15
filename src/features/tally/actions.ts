/**
 * Where a tally meets the app's real money: closing a month makes one ordinary, editable expense
 * (each person's part exactly as the bill shows it), and reopening takes it away again.
 */
import { deleteExpense, expensesStore, friendsStore, groupsStore, restoreExpense, saveExpense } from '../../data'
import type { Expense } from '../../domain/types'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { isClosed, monthBill, type MonthBill, type Tally } from './engine'
import { billText, monthName } from './labels'
import { putTally, setMonth, tallyById } from './store'

/** A person's name as this phone knows it ("You" for the owner). */
export function nameNow(id: string): string {
  return friendLabel(id, friendsStore.get().find((f) => f.id === id) ?? null)
}

/** Names used only for ordering, so every phone deals the odd paise the same way. */
export function sortNameNow(id: string): string {
  return friendsStore.get().find((f) => f.id === id)?.name ?? ''
}

export function billNow(tally: Tally, period: string, today: string): MonthBill {
  return monthBill(tally, period, today, sortNameNow)
}

/** The group a tally's expense can go into: it must exist, be open, and hold the payer and everyone with a part. */
export function expenseGroupId(tally: Tally, people: readonly string[]): string | null {
  const group = tally.groupId ? groupsStore.get().find((g) => g.id === tally.groupId) : null
  if (!group || group.archived) return null
  return people.every((id) => group.memberIds.includes(id)) ? group.id : null
}

export interface Closing {
  /** The expense made, or null when the month was closed without one. */
  expense: Expense | null
  /** Puts everything back as it was. */
  undo: () => void
}

/**
 * Closes a month. With `payerId`, the bill becomes an expense that person paid, split exactly as
 * the bill shows. Null when the month is closed already, has not ended, came to nothing (for an
 * expense), or the expense could not be saved.
 */
export function closeMonth(tallyId: string, period: string, payerId: string | null, today: string, now: number = Date.now()): Closing | null {
  const before = tallyById(tallyId)
  if (!before || isClosed(before, period)) return null
  const bill = billNow(before, period, today)
  if (!bill.ended) return null
  let expense: Expense | null = null
  if (payerId !== null) {
    const parts = bill.parts.filter((p) => p.amount > 0)
    if (bill.total <= 0 || parts.length === 0) return null
    try {
      expense = saveExpense({
        kind: 'split',
        title: t('tally.expense.title', { name: before.name, month: monthName(period, today) }),
        category: 'groceries',
        currency: before.currency,
        total: bill.total,
        date: bill.to,
        payerId,
        mode: 'exact',
        participants: parts.map((p) => ({ friendId: p.id, input: p.amount })),
        roundedToWhole: false,
        note: billText({ ...before, vendor: null }, bill, today, nameNow),
        groupId: expenseGroupId(before, [payerId, ...parts.map((p) => p.id)]),
        bill: null,
        recurringId: null,
        source: 'manual',
      })
    } catch {
      return null
    }
  }
  setMonth(tallyId, period, { closedAt: now, expenseId: expense?.id ?? null })
  const made = expense
  return {
    expense,
    undo: () => {
      if (made) deleteExpense(made.id)
      putTally(before)
    },
  }
}

/** Opens a closed month again and removes the expense closing made (if it is still there). */
export function reopenMonth(tallyId: string, period: string): { hadExpense: boolean; undo: () => void } | null {
  const before = tallyById(tallyId)
  if (!before || !isClosed(before, period)) return null
  const expenseId = before.months[period]?.expenseId ?? null
  const expense = expenseId ? (expensesStore.get().find((e) => e.id === expenseId) ?? null) : null
  if (expense) deleteExpense(expense.id)
  setMonth(tallyId, period, { closedAt: null, expenseId: null })
  return {
    hadExpense: expense !== null,
    undo: () => {
      if (expense) restoreExpense(expense)
      putTally(before)
    },
  }
}
