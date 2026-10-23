import { createElement } from 'react'
import { ListChecks, Send } from 'lucide-react'
import { navigate } from '../../app/router'
import { claimsStore, latestClaimRound } from '../../data'
import type { Expense } from '../../domain/types'
import { t } from '../../i18n'
import type { ExpenseActionContext, ExpenseActionDef } from '../expense/ExpenseActionsSheet'
import { claimBoardPath, startClaimRound } from './startClaimRound'

/**
 * The expense ⋮ menu entry for claims: "Let friends claim items" on an itemized bill, or "Review
 * claims" once a round exists for it. Nothing for other expenses (or bills paid abroad).
 */
export function claimAction(expense: Expense, ctx: ExpenseActionContext): ExpenseActionDef | null {
  if (expense.kind !== 'bill' || !expense.bill || expense.bill.items.length === 0 || expense.fx) return null
  const round = latestClaimRound(claimsStore.get(), expense.id)
  if (round) {
    const replied = round.replies.filter((r) => r.state === 'active').length
    return {
      key: 'claims',
      icon: createElement(ListChecks),
      label: t('claim.entry.review'),
      detail: t('claim.entry.reviewDetail', { replied, people: Math.max(replied, round.peopleIds.length - 1) }),
      onSelect: () => {
        ctx.close()
        navigate(claimBoardPath(round.id))
      },
    }
  }
  return {
    key: 'claims',
    icon: createElement(Send),
    label: t('claim.entry.action'),
    detail: t('claim.entry.actionDetail'),
    onSelect: () => {
      ctx.close()
      startClaimRound(expense.id)
    },
  }
}
