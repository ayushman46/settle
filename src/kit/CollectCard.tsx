import { useId } from 'react'
import { Check, Users } from 'lucide-react'
import { Money, ProgressRing } from '../components'
import { useFriendsById, useGroup } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { collectProgress, isSettledInGroup } from '../engine/balances'
import { cx } from '../lib/cx'
import { paidCountLabel, pendingIds, waitingOnLabel } from './collectLabels'
import { friendLabel, friendObjectLabel } from './friendName'
import styles from './CollectCard.module.css'

export interface CollectCardProps {
  expense: Expense
  className?: string
}

/**
 * How much of an expense has come back to whoever paid: a progress ring and
 * "₹1,383 of ₹2,074.50 collected · 1 of 3 paid · Waiting on Sam and Neha". Expenses settled
 * through their group's balances say so instead; a split with nobody to pay back says that.
 */
export function CollectCard({ expense, className }: CollectCardProps) {
  const titleId = useId()
  const friendsById = useFriendsById()
  const group = useGroup(expense.groupId)
  const payerIsMe = expense.payerId === ME_ID
  const payerName = friendLabel(expense.payerId, friendsById[expense.payerId] ?? null)
  const money = (value: number, strong = false) => (
    <Money value={value} currency={expense.currency} size="inherit" trimZeros strong={strong} className={styles.money} />
  )

  if (group && isSettledInGroup(expense, [group])) {
    return (
      <section aria-labelledby={titleId} className={cx(styles.card, className)} data-state="group">
        <span className={styles.icon} aria-hidden="true">
          <Users strokeWidth={2.25} />
        </span>
        <div className={styles.text}>
          <h2 id={titleId} className={styles.title}>
            Settles in {group.name}
          </h2>
          <p className={styles.detail}>It counts towards the group’s balances, so settle up from the group.</p>
        </div>
      </section>
    )
  }

  const progress = collectProgress(expense)
  if (progress.peopleCount === 0) {
    return (
      <section aria-labelledby={titleId} className={cx(styles.card, className)} data-state="none">
        <span className={styles.icon} aria-hidden="true">
          <Check strokeWidth={2.75} />
        </span>
        <div className={styles.text}>
          <h2 id={titleId} className={styles.title}>
            {payerIsMe ? 'Nothing to collect' : 'Nothing to pay back'}
          </h2>
          <p className={styles.detail}>{payerIsMe ? 'It’s just you on this one.' : `${payerName} covered only themselves.`}</p>
        </div>
      </section>
    )
  }

  const done = progress.outstanding === 0
  const fraction = progress.total > 0 ? progress.collected / progress.total : 0
  const waiting = waitingOnLabel(pendingIds(expense).map((id) => friendObjectLabel(id, friendsById[id] ?? null)))
  const detail = [paidCountLabel(progress.paidCount, progress.peopleCount), waiting].filter(Boolean).join(' · ')

  const title = !done ? (
    <>
      {money(progress.collected, true)} of {money(progress.total)} {payerIsMe ? 'collected' : `paid back to ${payerName}`}
    </>
  ) : payerIsMe ? (
    <>All {money(progress.total, true)} collected</>
  ) : (
    <>
      {payerName} got back all {money(progress.total, true)}
    </>
  )

  return (
    <section aria-labelledby={titleId} className={cx(styles.card, className)} data-state={done ? 'done' : 'collecting'}>
      <ProgressRing value={fraction} size={64} stroke={7} label={payerIsMe ? 'Collected' : 'Paid back'} className={styles.ring}>
        {done ? (
          <Check strokeWidth={3} className={styles.doneCheck} />
        ) : (
          <span className={styles.count}>
            {progress.paidCount}/{progress.peopleCount}
          </span>
        )}
      </ProgressRing>
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={cx(styles.detail, done && styles.doneDetail)}>{detail}</p>
      </div>
    </section>
  )
}
