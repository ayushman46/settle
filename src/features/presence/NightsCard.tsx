import { useMemo } from 'react'
import { BedDouble } from 'lucide-react'
import { Button, Card, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroup } from '../../data'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { dayLabel, splitByNights } from './actions'
import { nightsPlan } from './engine'
import { useStays } from './store'
import styles from './Presence.module.css'

/**
 * On a stay (hotel, villa, homestay) in a group where someone came late or left early: split it by
 * the nights each person stayed, in one tap, with Undo. Shows nothing otherwise.
 */
export function NightsCard({ expense }: { expense: Expense }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const group = useGroup(expense.groupId)
  const expenses = useExpenses({ groupId: expense.groupId ?? '' })
  const stays = useStays(expense.groupId)
  const plan = useMemo(() => nightsPlan(expense, group, expenses, stays), [expense, group, expenses, stays])
  if (!plan) return null
  const money = (paise: number): string => formatMoney(paise, expense.currency, { trimZeros: true })

  const apply = (): void => {
    try {
      const change = splitByNights(expense, plan.participants)
      haptic('success')
      toast(t('presence.nights.done'), {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: change.undo },
      })
    } catch {
      haptic('error')
      toast(t('presence.nights.failed'))
    }
  }

  return (
    <Card className={styles.card}>
      <div className={styles.cardText}>
        <p className={styles.cardTitle}>
          <BedDouble aria-hidden="true" className={styles.inlineIcon} /> {t('presence.nights.title')}
        </p>
        <p className={styles.fine}>{t('presence.nights.body')}</p>
      </div>
      <ul className={styles.nights} aria-label={t('presence.nights.list')}>
        {plan.rows.map((row) => (
          <li key={row.friendId} className={styles.night}>
            {t('presence.nights.row', {
              name: friendLabel(row.friendId, friendsById[row.friendId]),
              nights: t('presence.nights.count', { count: row.nights }),
              amount: money(row.share),
            })}
          </li>
        ))}
      </ul>
      <p className={styles.fine}>
        {t('presence.nights.range', {
          from: dayLabel(plan.range.from),
          to: dayLabel(plan.range.to),
        })}
      </p>
      <Button size="md" block onClick={apply}>
        {t('presence.nights.cta')}
      </Button>
    </Card>
  )
}
