import type { Expense } from '../../domain/types'
import type { ExpenseActionContext, ExpenseActionDef } from '../expense/ExpenseActionsSheet'

/**
 * The expense ⋮ menu entry for claims ("Let friends claim items" / "Review claims") — placeholder
 * until slice S1 builds it: no entry.
 */
export function claimAction(_expense: Expense, _ctx: ExpenseActionContext): ExpenseActionDef | null {
  return null
}
