/** Expense ⋮ menu entries and edit routing that features add (see `extensions.tsx` for the cards). */
import { CLAIMS_ENABLED } from '../claim/enabled'
import { claimAction } from '../claim/expenseAction'
import { LEND_ENABLED } from '../lend/enabled'
import type { Expense } from '../../domain/types'
import type { ExpenseActionContext, ExpenseActionDef } from './ExpenseActionsSheet'

export type { ExpenseActionContext, ExpenseActionDef } from './ExpenseActionsSheet'

/** Feature entries for the expense ⋮ menu (listed above Delete). */
export function extraExpenseActions(expense: Expense, ctx: ExpenseActionContext): ExpenseActionDef[] {
  const actions: ExpenseActionDef[] = []
  if (CLAIMS_ENABLED) {
    const claim = claimAction(expense, ctx)
    if (claim) actions.push(claim)
  }
  return actions
}

/** One person who isn't the payer: a loan, or "Sam paid for my auto" — edited on the lend screen. */
export function isOneToOneEntry(expense: Pick<Expense, 'kind' | 'participants' | 'payerId'>): boolean {
  if (expense.kind === 'loan') return true
  const ids = new Set(expense.participants.map((p) => p.friendId))
  return ids.size === 1 && !ids.has(expense.payerId)
}

/** Where ⋮ → Edit goes for an expense, or null for the screen's usual place. */
export function extensionEditPath(expense: Expense): string | null {
  if (LEND_ENABLED && isOneToOneEntry(expense)) return `/app/lend/${encodeURIComponent(expense.id)}/edit`
  return null
}
