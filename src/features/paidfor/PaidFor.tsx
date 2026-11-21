import { useMemo } from 'react'
import { CircleCheck, CircleDashed, CircleDot } from 'lucide-react'
import { Avatar, Money } from '../../components'
import { useExpenses, useFriendsById, useGroup } from '../../data'
import { ME_ID, type Expense, type Group, type Settlement } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { groupCover, type BillPart } from './engine'
import styles from './PaidFor.module.css'

/**
 * On a group bill's page: who has paid their part of this bill — "Riya · Paid", "Sam · ₹200 of
 * ₹420", "Neha · Still owes ₹420" — worked out from the group's payments, oldest bill first.
 */
export function BillPaidCard({ expense }: { expense: Expense }) {
  const t = useT()
  const group = useGroup(expense.groupId)
  const expenses = useExpenses()
  const friends = useFriendsById()
  const cover = useMemo(
    () => (group && group.currency === expense.currency ? (groupCover(group, expenses).bills[expense.id] ?? null) : null),
    [group, expenses, expense.id, expense.currency],
  )
  if (!group || !cover || cover.parts.length === 0) return null
  const paid = cover.parts.filter((p) => p.status === 'paid').length
  const name = (id: string) => (id === ME_ID ? t('paidfor.you') : (friends[id]?.name ?? t('paidfor.someone')))
  return (
    <section className={styles.card} aria-labelledby={`paidfor-${expense.id}`}>
      <header className={styles.head}>
        <h2 id={`paidfor-${expense.id}`} className={styles.title}>
          {t('paidfor.bill.title')}
        </h2>
        <p className={cx(styles.count, cover.settled && styles.countDone)}>
          {cover.settled ? t('paidfor.bill.allPaid') : t('paidfor.bill.count', { paid, count: cover.parts.length })}
        </p>
      </header>
      <ul role="list" className={styles.list}>
        {cover.parts.map((part) => (
          <PartRow key={part.personId} part={part} name={name(part.personId)} avatarName={friends[part.personId]?.name ?? name(part.personId)} color={friends[part.personId]?.color ?? 0} currency={expense.currency} />
        ))}
      </ul>
      <p className={styles.note}>{t('paidfor.bill.note', { name: name(cover.payerId) })}</p>
    </section>
  )
}

function PartRow({ part, name, avatarName, color, currency }: { part: BillPart; name: string; avatarName: string; color: number; currency: string }) {
  const t = useT()
  const Icon = part.status === 'paid' ? CircleCheck : part.status === 'part' ? CircleDot : CircleDashed
  return (
    <li className={cx(styles.row, styles[part.status])}>
      <Avatar name={avatarName} color={color} size="sm" />
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>
        <Icon aria-hidden="true" />
        {part.status === 'paid' ? (
          t('paidfor.part.paid')
        ) : part.status === 'part' ? (
          <span>
            <Money value={part.covered} currency={currency} trimZeros /> {t('paidfor.part.of')} <Money value={part.share} currency={currency} trimZeros />
          </span>
        ) : (
          <span>
            {t('paidfor.part.owes')} <Money value={part.share} currency={currency} trimZeros strong />
          </span>
        )}
      </span>
    </li>
  )
}

/** In a group payment's sheet: "This paid for: Villa ₹4,800 · Cab ₹640", and any amount paid ahead. */
export function PaymentPaidFor({ group, settlement }: { group: Group; settlement: Settlement }) {
  const t = useT()
  const expenses = useExpenses()
  const cover = useMemo(() => groupCover(group, expenses).payments[settlement.id] ?? null, [group, expenses, settlement.id])
  const titles = useMemo(() => new Map(expenses.map((e) => [e.id, e.title || t('paidfor.untitled')])), [expenses, t])
  if (!cover || (cover.bills.length === 0 && cover.extra === 0)) return null
  return (
    <section className={styles.payment} aria-label={t('paidfor.payment.title')}>
      <h3 className={styles.paymentTitle}>{t('paidfor.payment.title')}</h3>
      <ul role="list" className={styles.billList}>
        {cover.bills.map((b) => (
          <li key={b.expenseId} className={styles.billRow}>
            <span className={styles.billName}>{titles.get(b.expenseId) ?? t('paidfor.untitled')}</span>
            <Money value={b.amount} currency={group.currency} trimZeros />
          </li>
        ))}
        {cover.extra > 0 && (
          <li className={cx(styles.billRow, styles.extra)}>
            <span className={styles.billName}>{t('paidfor.payment.extra')}</span>
            <Money value={cover.extra} currency={group.currency} trimZeros />
          </li>
        )}
      </ul>
    </section>
  )
}
