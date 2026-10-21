/** Recurring splits (Pro): rent, Wi-Fi, Netflix — a template that becomes an expense each month. */
import type { Expense, RecurringTemplate } from '../domain/types'
import { isCategoryId } from '../engine/categories'
import { dateInPeriod, isPeriod, periodOf, today } from '../engine/dates'
import { isValidTotal, splitAmount, uniqueParticipants } from '../engine/split'
import { newId } from '../lib/ids'
import { ExpenseError } from './errors'
import { saveExpense } from './expenses'
import { cleanCurrency, cleanDayOfMonth, cleanText, fallbackTitle, MAX_PARTICIPANTS, MAX_TITLE_LENGTH } from './schemas'
import { expensesStore, friendsStore, groupsStore, profileStore, recurringStore } from './stores'

export type RecurringDraft = Omit<RecurringTemplate, 'id' | 'createdAt' | 'lastCreatedPeriod'> & { id?: string }

/** Creates or updates a template. Validated like an expense: throws ExpenseError. */
export function saveRecurring(draft: RecurringDraft): RecurringTemplate {
  const participants = uniqueParticipants(draft.participants ?? [])
    .slice(0, MAX_PARTICIPANTS)
    .map((p) => ({ friendId: p.friendId, input: typeof p.input === 'number' && Number.isFinite(p.input) ? p.input : null }))
  const currency = cleanCurrency(draft.currency, profileStore.get().currency)
  if (participants.length === 0) throw new ExpenseError('no_people')
  if (!isValidTotal(draft.total)) throw new ExpenseError('bad_total')
  if (!draft.payerId || !friendsStore.get().some((f) => f.id === draft.payerId)) throw new ExpenseError('payer_missing')
  const mode = draft.mode === 'exact' || draft.mode === 'percent' || draft.mode === 'shares' ? draft.mode : 'equal'
  const check = splitAmount({ total: draft.total, currency, mode, participants, payerId: draft.payerId })
  const issue = check.issues[0]
  if (issue) throw new ExpenseError(issue)

  const list = recurringStore.get()
  const existing = draft.id ? list.find((r) => r.id === draft.id) : undefined
  const category = isCategoryId(draft.category) ? draft.category : 'other'
  const template: RecurringTemplate = {
    id: existing?.id ?? draft.id ?? newId(),
    title: cleanText(draft.title ?? '', MAX_TITLE_LENGTH) || fallbackTitle(category),
    category,
    currency,
    total: draft.total,
    payerId: draft.payerId,
    mode,
    participants,
    dayOfMonth: cleanDayOfMonth(draft.dayOfMonth),
    groupId: draft.groupId && groupsStore.get().some((g) => g.id === draft.groupId) ? draft.groupId : null,
    lastCreatedPeriod: existing?.lastCreatedPeriod ?? null,
    active: draft.active !== false,
    createdAt: existing?.createdAt ?? Date.now(),
  }
  recurringStore.set(existing ? list.map((r) => (r.id === template.id ? template : r)) : [...list, template])
  return template
}

/** Deletes a template (expenses already created from it stay). Returns it for "Undo". */
export function deleteRecurring(id: string): RecurringTemplate | null {
  const list = recurringStore.get()
  const found = list.find((r) => r.id === id) ?? null
  if (found) recurringStore.set(list.filter((r) => r.id !== id))
  return found
}

/** Puts back a template returned by `deleteRecurring`. */
export function restoreRecurring(template: RecurringTemplate): void {
  recurringStore.update((list) => [...list.filter((r) => r.id !== template.id), template])
}

/**
 * Splits a template for one month (`YYYY-MM`), dated on its due day. Idempotent: if that month
 * was already split, the existing expense is returned. Throws ExpenseError ('not_found', or
 * any validation code if people it names were removed).
 */
export function createExpenseFromRecurring(id: string, period: string): Expense {
  const template = recurringStore.get().find((r) => r.id === id)
  if (!template) throw new ExpenseError('not_found')
  const month = isPeriod(period) ? period : periodOf(today())

  const already = expensesStore.get().find((e) => e.recurringId === id && periodOf(e.date) === month)
  const expense =
    already ??
    saveExpense({
      kind: 'split',
      title: template.title,
      category: template.category,
      currency: template.currency,
      total: template.total,
      date: dateInPeriod(month, template.dayOfMonth),
      payerId: template.payerId,
      mode: template.mode,
      participants: template.participants.map((p) => ({ ...p })),
      roundedToWhole: false,
      note: null,
      groupId: template.groupId,
      bill: null,
      recurringId: id,
      source: 'recurring',
    })

  recurringStore.update((list) =>
    list.map((r) =>
      r.id === id && (r.lastCreatedPeriod === null || r.lastCreatedPeriod < month) ? { ...r, lastCreatedPeriod: month } : r,
    ),
  )
  return expense
}
