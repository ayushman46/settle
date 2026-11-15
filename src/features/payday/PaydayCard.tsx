import { Wallet, X } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Card, IconButton, useToast } from '../../components'
import { useFriendsById, useSummary } from '../../data'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { QUEUE_PATH } from '../queue/paths'
import { dismissPaydayCard } from './store'
import { usePaydayDue } from './usePaydayDue'
import styles from './Payday.module.css'

/**
 * Home, on your payday and the two days after, when you owe anything: "Payday. You owe ₹2,300 to
 * 3 people" and "Clear everything" (the same people and total that screen goes through).
 * "Not this month" puts it away until the next payday, with Undo. Nothing otherwise.
 */
export function PaydayCard() {
  const t = useT()
  const toast = useToast()
  const summary = useSummary()
  const friendsById = useFriendsById()
  const due = usePaydayDue()
  if (!due) return null

  const when = due.daysSince === 0 ? 'today' : due.daysSince === 1 ? 'yesterday' : 'earlier'
  const name = due.only ? firstName(friendLabel(due.only.friendId, friendsById[due.only.friendId] ?? due.only)) : ''
  const amount = formatMoney(due.amount, summary.currency, { trimZeros: true })

  const dismiss = (): void => {
    const undo = dismissPaydayCard(due.paidOn)
    toast(t('payday.card.dismissed'), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <Card className={styles.card} aria-label={t('payday.card.aria')} role="region">
      <div className={styles.cardHead}>
        <span className={styles.icon} aria-hidden="true">
          <Wallet />
        </span>
        <div className={styles.cardText}>
          <h2 className={styles.heading}>{t('payday.card.title', { when, amount, count: due.people, name })}</h2>
          <p className={styles.fine}>{t('payday.card.body', { count: due.people })}</p>
        </div>
        <IconButton label={t('payday.card.dismiss.aria')} size="sm" className={styles.dismiss} onClick={dismiss}>
          <X />
        </IconButton>
      </div>
      <Button block variant="tonal" onClick={() => navigate(QUEUE_PATH)}>
        {t('payday.card.cta')}
      </Button>
    </Card>
  )
}
