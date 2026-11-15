import { memo, useMemo } from 'react'
import { Undo2 } from 'lucide-react'
import { Button, Card, useToast } from '../../components'
import { useFriendsById, useGroups } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { clearFullRefund, refundDateText, takeOffRefund } from './actions'
import { fullyRefunded, type RefundRecord } from './engine'
import { useRefunds } from './store'
import styles from './Refund.module.css'

/**
 * On the group page: the group's expenses whose money all came back ("Movie tickets ₹2,400, came
 * back on 14 Nov 2026"). They are out of the balances; "Put it back" returns one exactly as it
 * was. Null when there are none.
 */
export const RefundedCard = memo(function RefundedCard({ group }: { group: Group }) {
  const records = useRefunds()
  const groups = useGroups()
  const mine = useMemo(() => fullyRefunded(records, group.id, new Set(groups.map((g) => g.id))), [records, group.id, groups])
  return <RefundedList records={mine} />
})

/** The same for expenses outside any group (or whose group is gone). Null when there are none. */
export const RefundedHome = memo(function RefundedHome() {
  const records = useRefunds()
  const groups = useGroups()
  const loose = useMemo(() => fullyRefunded(records, null, new Set(groups.map((g) => g.id))), [records, groups])
  return <RefundedList records={loose} />
})

function RefundedList({ records }: { records: readonly RefundRecord[] }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  if (records.length === 0) return null

  const putBack = (record: RefundRecord): void => {
    const undo = takeOffRefund(record.id)
    if (!undo) {
      haptic('error')
      toast(t('refund.full.back.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('refund.full.back.done', { title: record.before.title }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  const clear = (record: RefundRecord): void => {
    const undo = clearFullRefund(record.id)
    if (!undo) return
    haptic('tap')
    toast(t('refund.full.clear.done', { title: record.before.title }), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  const heading = t('refund.full.title', { count: records.length })
  return (
    <section className={styles.card} aria-label={heading}>
      <h3 className={styles.heading}>
        <Undo2 aria-hidden="true" />
        {heading}
      </h3>
      <p className={styles.fine}>{records.length === 1 ? t('refund.full.body.one') : t('refund.full.body')}</p>
      <Card padding="none">
        <ul className={styles.rows}>
          {records.map((record) => {
            const { before } = record
            const amount = formatMoney(before.total, before.currency, { trimZeros: true })
            const vars = { date: refundDateText(record.date), name: friendLabel(record.toId, friendsById[record.toId] ?? null) }
            return (
              <li key={record.id} className={styles.row} aria-label={t('refund.full.row.aria', { title: before.title, amount })}>
                <div className={styles.top}>
                  <span className={styles.name}>{before.title}</span>
                  <span className={styles.amount}>{amount}</span>
                </div>
                <p className={styles.fine}>{record.toId === before.payerId ? t('refund.full.row.line', vars) : t('refund.full.row.line.to', vars)}</p>
                <div className={styles.actions}>
                  <Button size="md" variant="secondary" onClick={() => putBack(record)} aria-label={t('refund.full.back.aria', { title: before.title })}>
                    {t('refund.full.back')}
                  </Button>
                  <Button size="md" variant="ghost" onClick={() => clear(record)} aria-label={t('refund.full.clear.aria', { title: before.title })}>
                    {t('refund.full.clear')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}
