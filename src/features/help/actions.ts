/**
 * Where House help’s salary meets the app’s real money: paying a month, and turning a shared
 * salary or advance into a real expense between flatmates. Every change hands back an Undo
 * that puts things back exactly.
 */
import { deleteExpense, expensesStore, friendsStore, groupsStore, restoreExpense, saveExpense } from '../../data'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { periodOf } from '../../engine/dates'
import { t } from '../../i18n'
import { monthSheet, paymentFrom, splitShares, turnOf, type HelpEntry, type HelpPayment, type HelpSharer, type Helper } from './engine'
import { addEntry, helperById, putEntry, putPayment, removeEntry, removePayment, setEntryExpense, setPaymentExpense, type EntryInput } from './store'
import { monthName } from './text'

export interface HelpChange {
  undo: () => void
}

export interface SharePlan {
  /** Who bears the cost today: the chosen people who are still in the app (you alone when nobody else is left). */
  sharers: HelpSharer[]
  /** The group a shared expense goes into: the chosen one, while it is open and holds every sharer. */
  group: Group | null
}

/** Who shares the cost and where a shared expense would go, from the app’s people and groups as they are now. */
export function sharePlanOf(helper: Pick<Helper, 'sharers' | 'groupId'>, friendIds: ReadonlySet<string>, groups: readonly Group[]): SharePlan {
  const live = helper.sharers.filter((s) => s.friendId === ME_ID || friendIds.has(s.friendId))
  const sharers = live.length > 0 ? live : [{ friendId: ME_ID, parts: 1 }]
  const chosen = helper.groupId ? (groups.find((g) => g.id === helper.groupId && !g.archived) ?? null) : null
  const group = chosen && sharers.length > 1 && sharers.every((s) => chosen.memberIds.includes(s.friendId)) ? chosen : null
  return { sharers, group }
}

export function sharePlan(helper: Pick<Helper, 'sharers' | 'groupId'>): SharePlan {
  return sharePlanOf(helper, new Set(friendsStore.get().map((f) => f.id)), groupsStore.get())
}

function personExists(id: string): boolean {
  return friendsStore.get().some((f) => f.id === id)
}

export function expenseExists(id: string | null | undefined): boolean {
  return !!id && expensesStore.get().some((e) => e.id === id)
}

/** A real expense for `amount`, split by the sharers’ parts. Null when it is not shared or cannot be saved. */
function shareOut(helper: Helper, what: { amount: number; title: string; date: string; payerId: string; turn: number }): Expense | null {
  const plan = sharePlan(helper)
  if (plan.sharers.length < 2 || what.amount <= 0) return null
  const shares = splitShares(what.amount, plan.sharers, what.turn)
  try {
    return saveExpense({
      kind: 'split',
      title: what.title,
      category: 'utilities',
      currency: helper.currency,
      total: what.amount,
      date: what.date,
      payerId: personExists(what.payerId) ? what.payerId : ME_ID,
      // Exact amounts, so the expense says to the paisa what this page showed.
      mode: 'exact',
      participants: shares.map((s) => ({ friendId: s.friendId, input: s.amount })),
      roundedToWhole: false,
      note: null,
      groupId: plan.group?.id ?? null,
      bill: null,
      recurringId: null,
      source: 'manual',
    })
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ pay day */

export interface PaidChange extends HelpChange {
  payment: HelpPayment
}

/** Marks a month paid, frozen with the numbers on its sheet today. Null when it is already paid or not a month kept. */
export function markPaid(helperId: string, period: string, how: { payerId: string; method: 'upi' | 'cash'; today: string }, now: number = Date.now()): PaidChange | null {
  const helper = helperById(helperId)
  const sheet = helper ? monthSheet(helper, period) : null
  if (!helper || !sheet || sheet.paid) return null
  const payment = paymentFrom(sheet, { paidOn: how.today, at: now, payerId: personExists(how.payerId) ? how.payerId : ME_ID, method: how.method })
  if (!putPayment(helperId, payment)) return null
  return {
    payment,
    undo: () => {
      const removed = removePayment(helperId, period)
      if (removed?.expenseId) deleteExpense(removed.expenseId)
    },
  }
}

/** Marks a paid month as not paid (its shared expense goes too). Undo brings both back. */
export function unmarkPaid(helperId: string, period: string): HelpChange | null {
  const payment = removePayment(helperId, period)
  if (!payment) return null
  const expense = payment.expenseId ? deleteExpense(payment.expenseId) : null
  return {
    undo: () => {
      if (!putPayment(helperId, payment)) return
      if (expense) restoreExpense(expense)
    },
  }
}

export interface SharedChange extends HelpChange {
  expense: Expense
}

/** One tap after a shared month is paid: a real expense, paid by whoever paid, split by the parts. */
export function sharePayment(helperId: string, period: string): SharedChange | null {
  const helper = helperById(helperId)
  const payment = helper?.payments.find((p) => p.period === period) ?? null
  if (!helper || !payment || expenseExists(payment.expenseId)) return null
  const title = t('help.expense.salary', { name: helper.name, month: monthName(period) })
  const expense = shareOut(helper, { amount: payment.amount, title, date: payment.paidOn, payerId: payment.payerId, turn: turnOf(period) })
  if (!expense) return null
  setPaymentExpense(helperId, period, expense.id)
  return {
    expense,
    undo: () => {
      deleteExpense(expense.id)
      setPaymentExpense(helperId, period, null)
    },
  }
}

/* ------------------------------------------------------------------ through the month */

export interface EntryChange extends HelpChange {
  entry: HelpEntry
  /** The expense a shared advance became, if it was added. */
  expense: Expense | null
}

/**
 * Writes an entry down. A shared advance (`share`) also becomes a real expense paid by whoever
 * handed it over: the money has moved today, so flatmates owe their part today.
 */
export function noteEntry(helperId: string, input: EntryInput, share = false): EntryChange | null {
  const entry = addEntry(helperId, input)
  const helper = helperById(helperId)
  if (!entry || !helper) return null
  let expense: Expense | null = null
  if (share && entry.kind === 'advance') {
    const title = t('help.expense.advance', { name: helper.name })
    expense = shareOut(helper, { amount: entry.amount, title, date: entry.date, payerId: entry.byId, turn: turnOf(periodOf(entry.date)) })
    if (expense) setEntryExpense(helperId, entry.id, expense.id)
  }
  const saved = expense ? { ...entry, expenseId: expense.id } : entry
  return {
    entry: saved,
    expense,
    undo: () => {
      removeEntry(helperId, entry.id)
      if (expense) deleteExpense(expense.id)
    },
  }
}

/** Takes an entry off (and the expense a shared advance became). Undo brings both back. */
export function dropEntry(helperId: string, entryId: string): HelpChange | null {
  const entry = removeEntry(helperId, entryId)
  if (!entry) return null
  const expense = entry.expenseId ? deleteExpense(entry.expenseId) : null
  return {
    undo: () => {
      putEntry(helperId, entry)
      if (expense) restoreExpense(expense)
    },
  }
}
