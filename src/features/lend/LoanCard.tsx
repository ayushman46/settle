import { useId, useMemo, useState } from 'react'
import { BellRing, CheckCheck, Coins } from 'lucide-react'
import { Button, useToast } from '../../components'
import { DataError, setPaidBack, useFriendsById, useGroups } from '../../data'
import { repayLoanPart } from '../../data/loans'
import { ME_ID, type Expense, type Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { NudgeSheet, usePayLink } from '../../kit/index-b'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { loanCardView } from './lendView'
import { RepaySheet } from './RepaySheet'
import styles from './LoanCard.module.css'

export interface LoanCardProps {
  /** The expense on screen. */
  expense: Expense
}

/**
 * Udhaar on an expense page — a loan, or a 1:1 entry between you and one person: what it was,
 * what's still to come (or when it was settled), and "Got it all back" / "Got some back" (or,
 * for what you borrowed, "I've paid it back" / "Paid some back"), each with undo. Part
 * repayments keep their history as a second, paid-back entry. Renders nothing for anything else.
 */
export function LoanCard({ expense }: LoanCardProps) {
  const t = useT()
  const toast = useToast()
  const titleId = useId()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const [repayOpen, setRepayOpen] = useState(false)
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const nameOf = useMemo(() => (id: string) => friendLabel(id, friendsById[id] ?? null), [friendsById])
  const view = useMemo(() => loanCardView(expense, nameOf, groups), [expense, nameOf, groups])
  const { link } = usePayLink(expense, { enabled: nudgeOpen && view?.mine === true })
  if (!view) return null

  const name = nameOf(view.otherId)
  const debtor = view.mine ? view.otherId : ME_ID
  const owed = expense.shares[debtor] ?? 0
  const money = (minor: Minor) => formatMoney(minor, expense.currency, { trimZeros: true })

  const allBack = (): void => {
    try {
      setPaidBack(expense.id, debtor, true)
    } catch {
      toast(t('lend.card.failed.toast'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(view.mine ? t('lend.card.allBack.toast', { name, amount: money(owed) }) : t('lend.card.paidBack.toast', { name, amount: money(owed) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => setPaidBack(expense.id, debtor, false) },
    })
  }

  const someBack = (amount: Minor): void => {
    let result: ReturnType<typeof repayLoanPart>
    try {
      result = repayLoanPart(expense.id, amount)
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(t('lend.card.failed.toast'), { tone: 'error' })
      return
    }
    setRepayOpen(false)
    haptic('success')
    const vars = { back: money(amount), left: money(result.remaining.shares[debtor] ?? 0) }
    toast(view.mine ? t('lend.card.someBack.toast', vars) : t('lend.card.paidSome.toast', vars), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: result.undo },
    })
  }

  return (
    <section className={cx(styles.card, view.state !== 'open' && styles.done)} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.emoji} aria-hidden="true">
          {view.emoji}
        </span>
        <h2 id={titleId} className={styles.line}>
          <span className={styles.label}>{view.label}</span>
          {` · ${view.line}`}
        </h2>
      </div>
      <p className={cx(styles.status, view.state === 'open' && (view.mine ? styles.coming : styles.toPay))}>{view.status}</p>

      {view.state === 'open' && (
        <div className={styles.actions}>
          <Button size="md" variant="primary" iconStart={<CheckCheck />} onClick={allBack} aria-label={view.mine ? t('lend.card.allBack.aria', { name }) : t('lend.card.paidBack.aria', { name })}>
            {view.mine ? t('lend.card.allBack.cta') : t('lend.card.paidBack.cta')}
          </Button>
          {view.canRepayPart && (
            <Button
              size="md"
              variant="secondary"
              iconStart={<Coins />}
              onClick={() => setRepayOpen(true)}
              aria-haspopup="dialog"
              aria-label={view.mine ? t('lend.card.someBack.aria', { name }) : t('lend.card.paidSome.aria', { name })}
            >
              {view.mine ? t('lend.card.someBack.cta') : t('lend.card.paidSome.cta')}
            </Button>
          )}
          {view.mine && expense.kind === 'loan' && (
            <Button size="md" variant="ghost" iconStart={<BellRing />} onClick={() => setNudgeOpen(true)} aria-haspopup="dialog">
              {t('lend.card.remind.cta', { name })}
            </Button>
          )}
        </div>
      )}

      <RepaySheet open={repayOpen} onClose={() => setRepayOpen(false)} mine={view.mine} name={name} total={owed} currency={expense.currency} onSave={someBack} />
      {view.mine && (
        <NudgeSheet
          open={nudgeOpen}
          onClose={() => setNudgeOpen(false)}
          friend={friendsById[view.otherId] ?? null}
          amount={owed}
          currency={expense.currency}
          title={expense.title}
          link={link}
          kind="loan"
          date={expense.date}
        />
      )}
    </section>
  )
}
