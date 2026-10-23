import { useId } from 'react'
import { Check, Users } from 'lucide-react'
import { Money, ProgressRing } from '../components'
import { useFriendsById, useGroup } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { tx, useT, type MessageKey } from '../i18n'
import { collectProgress, isSettledInGroup } from '../engine/balances'
import { cx } from '../lib/cx'
import { formatMoney } from '../lib/money'
import { paidCountLabel, pendingIds, waitingOnLabel } from './collectLabels'
import { friendLabel, friendObjectLabel } from './friendName'
import styles from './CollectCard.module.css'

export interface CollectCardProps {
  expense: Expense
  className?: string
}

/**
 * How much of an expense has come back to whoever paid: a progress ring and "₹691.50 collected",
 * "of ₹2,074.50 · 1 of 3 paid", "Waiting on Sam and Neha". Expenses settled
 * through their group's balances say so instead; a split with nobody to pay back says that.
 */
export function CollectCard({ expense, className }: CollectCardProps) {
  const t = useT()
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
            {t('kit.collect.group.title', { group: group.name })}
          </h2>
          <p className={styles.detail}>{t('kit.collect.group.body')}</p>
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
            {payerIsMe ? t('kit.collect.none.mine.title') : t('kit.collect.none.theirs.title')}
          </h2>
          <p className={styles.detail}>{payerIsMe ? t('kit.collect.none.mine.body') : t('kit.collect.none.theirs.body', { name: payerName })}</p>
        </div>
      </section>
    )
  }

  const done = progress.outstanding === 0
  const started = progress.collected > 0
  const fraction = progress.total > 0 ? progress.collected / progress.total : 0
  const waiting = waitingOnLabel(pendingIds(expense).map((id) => friendObjectLabel(id, friendsById[id] ?? null)))
  const counted = paidCountLabel(progress.paidCount, progress.peopleCount)
  const totalText = formatMoney(progress.total, expense.currency, { trimZeros: true })

  // Short headline first ("₹691.50 collected"), the rest of the story underneath.
  const headline = (key: MessageKey, value: number) =>
    tx(key, { amount: formatMoney(value, expense.currency, { trimZeros: true }), name: payerName }, { m: () => money(value, true) })
  const title = done
    ? headline(payerIsMe ? 'kit.collect.done.mine' : 'kit.collect.done.theirs', progress.total)
    : started
      ? headline(payerIsMe ? 'kit.collect.started.mine' : 'kit.collect.started.theirs', progress.collected)
      : headline(payerIsMe ? 'kit.collect.open.mine' : 'kit.collect.open.theirs', progress.total)
  const detail = !done && started ? t('kit.collect.detail.ofTotal', { total: totalText, counted }) : counted

  return (
    <section aria-labelledby={titleId} className={cx(styles.card, className)} data-state={done ? 'done' : 'collecting'}>
      <ProgressRing value={fraction} size={64} stroke={7} label={payerIsMe ? t('kit.collect.ring.mine') : t('kit.collect.ring.theirs')} className={styles.ring}>
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
        {waiting && <p className={styles.detail}>{waiting}</p>}
      </div>
    </section>
  )
}
