import { useContext, useEffect } from 'react'
import { ListChecks } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button } from '../../components'
import { ToastContext } from '../../components/toastContext'
import { useClaimRoundForExpense } from '../../data'
import { roundBoard } from '../../data/claims'
import type { Expense } from '../../domain/types'
import { resolveRow } from '../../engine/claims'
import { useT } from '../../i18n'
import { claimBoardPath, onClaimStartError } from './startClaimRound'
import styles from './ClaimStatusCard.module.css'

export interface ClaimStatusCardProps {
  /** The bill on screen. */
  expense: Expense
}

/**
 * Under the expense hero once a claim link went out: "Claims · 2 of 4 replied · 1 item needs you"
 * with Review → the board. Also says why a claim link couldn't start from the ⋮ menu.
 */
export function ClaimStatusCard({ expense }: ClaimStatusCardProps) {
  const t = useT()
  // Optional: the card also renders where there's no toast host (previews, tests).
  const toast = useContext(ToastContext)
  const round = useClaimRoundForExpense(expense.id)

  useEffect(() => (toast ? onClaimStartError((message) => toast(message, { tone: 'error' })) : undefined), [toast])

  if (!round || !expense.bill) return null
  const billIds = new Set(expense.bill.items.map((item) => item.id))
  const everyone = expense.participants.map((p) => p.friendId)
  const replied = round.replies.filter((r) => r.state === 'active').length
  const people = Math.max(replied, round.peopleIds.length - 1)
  let needs = 0
  for (const row of roundBoard(round)) {
    const itemId = round.itemIds[row.index] ?? ''
    if (!billIds.has(itemId) || row.status === 'fixed' || row.status === 'complete') continue
    if (resolveRow(row, round.decisions[itemId], everyone) === null) needs++
  }
  const parts = [t('claim.status.title'), t('claim.status.replied', { replied, people })]
  if (needs > 0) parts.push(t('claim.status.needs', { n: needs }))

  return (
    <section className={styles.card} aria-label={t('claim.status.title')}>
      <span className={styles.icon} aria-hidden="true">
        <ListChecks strokeWidth={2.25} />
      </span>
      <p className={styles.text}>{parts.join(' · ')}</p>
      <Button size="sm" variant="secondary" aria-label={t('claim.status.reviewLabel')} onClick={() => navigate(claimBoardPath(round.id))}>
        {t('claim.status.review')}
      </Button>
    </section>
  )
}
