/**
 * Lend / borrow (udhaar): 1:1 entries between you and one person. Cash handed over is a loan
 * (`kind 'loan'` — not spending); anything else ("Sam paid for my auto") is a 1:1 split with the
 * chip's category. Both net into the same balances, nudges and UPI settle-up as every other
 * expense, and part-repayments keep their history as two records.
 */
import { ME_ID, type CategoryId, type Expense, type Minor } from '../domain/types'
import { isIsoDate, today } from '../engine/dates'
import { isValidTotal } from '../engine/split'
import { intlLocale } from '../i18n/languages'
import { getLanguage, t } from '../i18n/runtime'
import { DataError } from './errors'
import { deleteExpense, restoreExpense, saveExpense, type ExpenseDraft } from './expenses'
import { cleanText } from './schemas'
import { expensesStore, friendsStore, profileStore } from './stores'

export type LendDirection = 'lent' | 'borrowed'
export type LendWhat = 'cash' | 'auto' | 'chai' | 'food' | 'recharge' | 'tickets' | 'petrol' | 'other'

export const LEND_WHATS: readonly LendWhat[] = ['cash', 'auto', 'chai', 'food', 'recharge', 'tickets', 'petrol', 'other']

/** What each "What for?" chip saves: its title, category, and whether it's a cash loan. */
export const LEND_WHAT: Readonly<Record<LendWhat, { label: string; emoji: string; category: CategoryId; loan: boolean }>> = {
  cash: { label: 'Cash', emoji: '💵', category: 'other', loan: true },
  auto: { label: 'Auto', emoji: '🛺', category: 'transport', loan: false },
  chai: { label: 'Chai', emoji: '☕', category: 'food', loan: false },
  food: { label: 'Food', emoji: '🍱', category: 'food', loan: false },
  recharge: { label: 'Recharge', emoji: '📱', category: 'utilities', loan: false },
  tickets: { label: 'Tickets', emoji: '🎟️', category: 'entertainment', loan: false },
  petrol: { label: 'Petrol', emoji: '⛽', category: 'transport', loan: false },
  other: { label: 'Other', emoji: '✨', category: 'other', loan: false },
}

/** Longest title for "Other" ("What was it?"). */
export const MAX_LEND_TITLE_LENGTH = 80

export interface LendDraft {
  id?: string
  direction: LendDirection
  /** Never ME. */
  friendId: string
  amount: Minor
  currency: string
  what: LendWhat
  /** Title for 'other' (else the chip label). */
  title?: string
  date: string
  note?: string | null
  groupId?: string | null
}

/** "21 Oct" in the app's language (Latin digits). */
export function shortDateLabel(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(intlLocale(getLanguage()), { day: 'numeric', month: 'short', timeZone: 'UTC', numberingSystem: 'latn' }).format(
      new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)),
    )
  } catch {
    return iso
  }
}

/** The one person in a 1:1 entry who isn't the payer, or null when the expense isn't one. */
export function oneToOnePerson(e: Pick<Expense, 'participants' | 'payerId'>): string | null {
  const ids = [...new Set(e.participants.map((p) => p.friendId))]
  const only = ids.length === 1 ? ids[0] : undefined
  return only !== undefined && only !== e.payerId ? only : null
}

/** A loan, or a 1:1 entry that is me and one other person ("Sam paid for my auto"). */
export function isLendEntry(e: Pick<Expense, 'participants' | 'payerId'>): boolean {
  const other = oneToOnePerson(e)
  return other !== null && (e.payerId === ME_ID || other === ME_ID)
}

function titleFor(d: Pick<LendDraft, 'what' | 'title'>): string {
  if (d.what !== 'other') return LEND_WHAT[d.what].label
  return cleanText(d.title ?? '', MAX_LEND_TITLE_LENGTH) || LEND_WHAT.other.label
}

/** The expense draft a lend draft saves as (see spec 07 §4 mapping). Throws DataError 'invalid'. */
export function lendExpenseDraft(d: LendDraft): ExpenseDraft {
  if (!d || typeof d.friendId !== 'string' || d.friendId === '' || d.friendId === ME_ID) throw new DataError('invalid')
  if (!friendsStore.get().some((f) => f.id === d.friendId)) throw new DataError('invalid')
  if (d.direction !== 'lent' && d.direction !== 'borrowed') throw new DataError('invalid')
  const what: LendWhat = Object.hasOwn(LEND_WHAT, d.what) ? d.what : 'other'
  const meta = LEND_WHAT[what]
  const lent = d.direction === 'lent'
  return {
    ...(d.id ? { id: d.id } : {}),
    kind: meta.loan ? 'loan' : 'split',
    title: titleFor({ what, title: d.title }),
    category: meta.category,
    currency: d.currency || profileStore.get().currency,
    total: d.amount,
    date: isIsoDate(d.date) ? d.date : today(),
    payerId: lent ? ME_ID : d.friendId,
    mode: 'equal',
    participants: [{ friendId: lent ? d.friendId : ME_ID, input: null }],
    roundedToWhole: false,
    note: typeof d.note === 'string' ? d.note : null,
    groupId: d.groupId ?? null,
    bill: null,
    recurringId: null,
    source: 'manual',
  }
}

/**
 * Saves (or updates) a 1:1 entry: cash → kind 'loan'; anything else → kind 'split' with the chip's
 * category. Editing that changes direction clears who has paid back. Throws ExpenseError
 * ('bad_total', …) or DataError ('invalid').
 */
export function saveLoan(d: LendDraft): Expense {
  const draft = lendExpenseDraft(d)
  const existing = d.id ? expensesStore.get().find((e) => e.id === d.id) : undefined
  if (existing && existing.payerId !== draft.payerId) draft.paidBack = {}
  return saveExpense(draft)
}

/** The draft for editing a 1:1 entry between me and one person, or null when the expense isn't one. */
export function lendDraftFromExpense(e: Expense): LendDraft | null {
  const other = oneToOnePerson(e)
  if (other === null) return null
  if (e.payerId !== ME_ID && other !== ME_ID) return null
  const lent = e.payerId === ME_ID
  const friendId = lent ? other : e.payerId
  let what: LendWhat = 'other'
  if (e.kind === 'loan') what = 'cash'
  else {
    const chip = LEND_WHATS.find((w) => w !== 'other' && !LEND_WHAT[w].loan && LEND_WHAT[w].label === e.title && LEND_WHAT[w].category === e.category)
    if (chip) what = chip
  }
  return {
    id: e.id,
    direction: lent ? 'lent' : 'borrowed',
    friendId,
    amount: e.total,
    currency: e.currency,
    what,
    ...(what === 'other' ? { title: e.title } : {}),
    date: e.date,
    note: e.note,
    groupId: e.groupId,
  }
}

/** Still open: the borrower hasn't been ticked off as having paid back. */
export function isLoanOpen(e: Expense): boolean {
  const other = oneToOnePerson(e)
  return other !== null && (e.shares[other] ?? 0) > 0 && e.paidBack[other] === undefined
}

/**
 * Splits an open 1:1 entry: the original keeps `total − amount` (still open), and a copy of
 * `amount` is saved already paid back (note "Paid back on 23 Oct"). Returns both, plus an undo that
 * puts the original back as it was and removes the copy. Throws DataError: 'not_found', or
 * 'invalid' (not a 1:1 entry, already settled, an itemized bill, or an amount outside 1 … total − 1).
 */
export function repayLoanPart(expenseId: string, amount: Minor): { remaining: Expense; repaid: Expense; undo: () => void } {
  const original = expensesStore.get().find((e) => e.id === expenseId)
  if (!original) throw new DataError('not_found')
  const borrower = oneToOnePerson(original)
  if (borrower === null || !isLoanOpen(original) || original.bill !== null) throw new DataError('invalid')
  if (!isValidTotal(amount) || amount >= original.total) throw new DataError('invalid')

  const now = Date.now()
  const base: ExpenseDraft = {
    kind: original.kind,
    title: original.title,
    category: original.category,
    currency: original.currency,
    total: original.total,
    date: original.date,
    payerId: original.payerId,
    mode: 'equal',
    participants: [{ friendId: borrower, input: null }],
    roundedToWhole: false,
    note: original.note,
    groupId: original.groupId,
    bill: null,
    recurringId: original.recurringId,
    source: original.source,
  }
  const remaining = saveExpense({ ...base, id: original.id, total: original.total - amount, paidBack: {} })
  let repaid: Expense
  try {
    repaid = saveExpense({
      ...base,
      total: amount,
      recurringId: null,
      note: t('lend.repay.note', { date: shortDateLabel(today()) }),
      paidBack: { [borrower]: now },
    })
  } catch (error) {
    restoreExpense(original)
    throw error
  }
  return {
    remaining,
    repaid,
    undo: () => {
      deleteExpense(repaid.id)
      restoreExpense(original)
    },
  }
}
