/** Saving, editing and ticking off expenses. Shares always come from the engine, never from the UI. */
import type { Expense, SplitMode } from '../domain/types'
import { categoryFromText, isCategoryId } from '../engine/categories'
import { isIsoDate, today } from '../engine/dates'
import { expenseShares, isValidTotal, splitAmount, uniqueParticipants, type SplitIssue } from '../engine/split'
import { newId } from '../lib/ids'
import { ExpenseError, type ExpenseErrorCode } from './errors'
import { touchFriends } from './friends'
import {
  cleanCurrency,
  cleanMultiline,
  cleanText,
  EXPENSE_SOURCES,
  fallbackTitle,
  MAX_NOTE_LENGTH,
  MAX_PARTICIPANTS,
  MAX_TITLE_LENGTH,
} from './schemas'
import { expensesStore, friendsStore, groupsStore, profileStore } from './stores'

export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'shares' | 'paidBack'> & {
  id?: string
  paidBack?: Record<string, number>
}

const ISSUE_TO_CODE: Readonly<Record<SplitIssue, ExpenseErrorCode>> = {
  no_people: 'no_people',
  bad_total: 'bad_total',
  exact_mismatch: 'exact_mismatch',
  percent_mismatch: 'percent_mismatch',
  zero_weights: 'zero_weights',
}

type NormalizedDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'paidBack'>

/** Validates and tidies a draft, computing its shares. Throws ExpenseError. */
function normalizeDraft(draft: ExpenseDraft): NormalizedDraft {
  const profile = profileStore.get()
  const participants = uniqueParticipants(draft.participants ?? [])
    .slice(0, MAX_PARTICIPANTS)
    .map((p) => ({ friendId: p.friendId, input: typeof p.input === 'number' && Number.isFinite(p.input) ? p.input : null }))
  if (participants.length === 0) throw new ExpenseError('no_people')
  if (!isValidTotal(draft.total)) throw new ExpenseError('bad_total')
  if (!draft.payerId || !friendsStore.get().some((f) => f.id === draft.payerId)) throw new ExpenseError('payer_missing')

  const currency = cleanCurrency(draft.currency, profile.currency)
  const bill = draft.bill ?? null
  const mode: SplitMode = draft.mode === 'items' && !bill ? 'equal' : draft.mode
  const roundedToWhole = draft.roundedToWhole === true

  let shares: Record<string, number>
  if (mode === 'items') {
    shares = expenseShares({ total: draft.total, currency, mode, participants, payerId: draft.payerId, roundedToWhole, bill })
  } else {
    const result = splitAmount({ total: draft.total, currency, mode, participants, payerId: draft.payerId, roundToWhole: roundedToWhole })
    const issue = result.issues[0]
    if (issue) throw new ExpenseError(ISSUE_TO_CODE[issue])
    shares = result.shares
  }

  const title = cleanText(draft.title ?? '', MAX_TITLE_LENGTH)
  const category = isCategoryId(draft.category) ? draft.category : (categoryFromText(title) ?? 'other')
  const note = typeof draft.note === 'string' ? cleanMultiline(draft.note, MAX_NOTE_LENGTH) || null : null
  const groupId = draft.groupId && groupsStore.get().some((g) => g.id === draft.groupId) ? draft.groupId : null

  return {
    kind: bill && draft.kind === 'bill' ? 'bill' : 'split',
    title: title || fallbackTitle(category),
    category,
    currency,
    total: draft.total,
    date: isIsoDate(draft.date) ? draft.date : today(),
    payerId: draft.payerId,
    mode,
    participants,
    shares,
    roundedToWhole,
    note,
    groupId,
    bill,
    recurringId: draft.recurringId ?? null,
    source: EXPENSE_SOURCES.includes(draft.source) ? draft.source : 'manual',
  }
}

/** Keeps "paid back" marks only for people (not the payer) who still owe something. */
function cleanPaidBack(paidBack: Readonly<Record<string, number>>, e: Pick<Expense, 'payerId' | 'shares'>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, at] of Object.entries(paidBack)) {
    if (id !== e.payerId && (e.shares[id] ?? 0) > 0 && Number.isFinite(at)) out[id] = at
  }
  return out
}

/**
 * Ticks carried over an edit: someone who'd paid back stays paid unless their share went up
 * (then they owe the new amount again — an edit never quietly forgives money).
 */
function carriedPaidBack(existing: Expense, next: Pick<Expense, 'payerId' | 'shares'>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, at] of Object.entries(existing.paidBack)) {
    if ((next.shares[id] ?? 0) <= (existing.shares[id] ?? 0)) out[id] = at
  }
  return cleanPaidBack(out, next)
}

/** The first problem `saveExpense` would throw for, or null when the draft can be saved. */
export function expenseDraftIssue(draft: ExpenseDraft): ExpenseErrorCode | null {
  try {
    normalizeDraft(draft)
    return null
  } catch (error) {
    if (error instanceof ExpenseError) return error.code
    throw error
  }
}

/**
 * Creates or updates an expense (by `draft.id`). Shares are computed by the engine and always add
 * up to the total. Editing keeps who has already paid back (unless their share went up, or the
 * draft says otherwise).
 * Throws ExpenseError: 'no_people' | 'bad_total' | 'exact_mismatch' | 'percent_mismatch' |
 * 'zero_weights' | 'payer_missing'.
 */
export function saveExpense(draft: ExpenseDraft): Expense {
  const expense = normalizeDraft(draft)
  const now = Date.now()
  const list = expensesStore.get()
  const existing = draft.id ? list.find((e) => e.id === draft.id) : undefined
  const saved: Expense = {
    id: existing?.id ?? draft.id ?? newId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...expense,
    paidBack: draft.paidBack
      ? cleanPaidBack(draft.paidBack, expense)
      : existing
        ? carriedPaidBack(existing, expense)
        : {},
  }
  expensesStore.set(existing ? list.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...list])
  touchFriends([saved.payerId, ...saved.participants.map((p) => p.friendId)], now)
  if (saved.groupId) touchGroup(saved.groupId, now)
  return saved
}

function touchGroup(groupId: string, now: number): void {
  groupsStore.update((groups) =>
    groups.some((g) => g.id === groupId) ? groups.map((g) => (g.id === groupId ? { ...g, updatedAt: now } : g)) : groups,
  )
}

/** Deletes an expense and returns it (for "Undo"), or null if it didn't exist. */
export function deleteExpense(id: string): Expense | null {
  const list = expensesStore.get()
  const found = list.find((e) => e.id === id) ?? null
  if (found) expensesStore.set(list.filter((e) => e.id !== id))
  return found
}

/** Puts back an expense returned by `deleteExpense` (replacing any with the same id). */
export function restoreExpense(e: Expense): void {
  expensesStore.update((list) => [e, ...list.filter((x) => x.id !== e.id)])
}

function requireExpense(id: string): Expense {
  const found = expensesStore.get().find((e) => e.id === id)
  if (!found) throw new ExpenseError('not_found')
  return found
}

function replaceExpense(next: Expense): Expense {
  expensesStore.update((list) => list.map((e) => (e.id === next.id ? next : e)))
  return next
}

/** Ticks someone off as having paid the payer back (or un-ticks). The payer can't be ticked. */
export function setPaidBack(expenseId: string, friendId: string, paid: boolean): Expense {
  const e = requireExpense(expenseId)
  if (friendId === e.payerId || !((e.shares[friendId] ?? 0) > 0)) return e
  const has = e.paidBack[friendId] !== undefined
  if (has === paid) return e
  const paidBack = { ...e.paidBack }
  if (paid) paidBack[friendId] = Date.now()
  else delete paidBack[friendId]
  return replaceExpense({ ...e, paidBack, updatedAt: Date.now() })
}

/** Ticks everyone who owes something on an expense as paid back (or clears every tick). */
export function setAllPaidBack(expenseId: string, paid: boolean): Expense {
  const e = requireExpense(expenseId)
  const now = Date.now()
  const paidBack: Record<string, number> = {}
  if (paid) {
    for (const [id, share] of Object.entries(e.shares)) {
      if (id !== e.payerId && share > 0) paidBack[id] = e.paidBack[id] ?? now
    }
  }
  const same =
    Object.keys(paidBack).length === Object.keys(e.paidBack).length &&
    Object.keys(paidBack).every((id) => e.paidBack[id] !== undefined)
  return same ? e : replaceExpense({ ...e, paidBack, updatedAt: now })
}

/** A new draft with the same details, dated today, nobody ticked off. */
export function duplicateExpenseDraft(id: string): ExpenseDraft {
  const e = requireExpense(id)
  return {
    kind: e.kind,
    title: e.title,
    category: e.category,
    currency: e.currency,
    total: e.total,
    date: today(),
    payerId: e.payerId,
    mode: e.mode,
    participants: e.participants.map((p) => ({ ...p })),
    roundedToWhole: e.roundedToWhole,
    note: e.note,
    groupId: e.groupId,
    bill: e.bill,
    recurringId: null,
    source: 'manual',
  }
}
