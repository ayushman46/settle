import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Card } from '../../components'
import { useFriendsById, useSummary } from '../../data'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { payQueue, queueTotal } from './engine'
import { QUEUE_PATH } from './paths'
import styles from './Queue.module.css'

/** Home's way into "Clear everything": shown when you owe two people or more, nothing otherwise. */
export function QueueCard() {
  const t = useT()
  const summary = useSummary()
  const friendsById = useFriendsById()
  const queue = useMemo(() => payQueue(summary.byFriend, friendsById), [summary.byFriend, friendsById])
  if (queue.length < 2) return null
  const amount = formatMoney(queueTotal(queue), summary.currency, { trimZeros: true })

  return (
    <Card className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.icon} aria-hidden="true">
          <ListChecks />
        </span>
        <div className={styles.cardText}>
          <h2 className={styles.cardTitle}>{t('queue.card.title', { count: queue.length, amount })}</h2>
          <p className={styles.fine}>{t('queue.card.body')}</p>
        </div>
      </div>
      <Button block variant="tonal" onClick={() => navigate(QUEUE_PATH)}>
        {t('queue.card.cta')}
      </Button>
    </Card>
  )
}
