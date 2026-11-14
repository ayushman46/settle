import { Store } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Card } from '../../components'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { canPayAtCounter, counterPath, counterPeople } from './shop'
import { hasPaidAtCounter, useCounter } from './store'
import styles from './Counter.module.css'

/**
 * On a bill you saved: "Pay at the counter" — everyone pays the shop their own share, so nobody
 * fronts the bill. Once a counter is open for it, the card says how far it has got.
 */
export function CounterCard({ expense }: { expense: Expense }) {
  const t = useT()
  const entry = useCounter(expense.id)
  if (!canPayAtCounter(expense)) return null
  const people = counterPeople(expense)
  if (people.length < 2) return null
  // Already collected the usual way: nothing left to pay at a counter.
  if (!entry && people.every((id) => id === expense.payerId || expense.paidBack[id] !== undefined)) return null
  const paid = entry ? people.filter((id) => hasPaidAtCounter(expense, entry, id)).length : 0
  return (
    <Card className={styles.entry}>
      <div className={styles.entryText}>
        <p className={styles.entryTitle}>
          <Store aria-hidden="true" className={styles.inlineIcon} /> {t('counter.entry.title')}
        </p>
        <p className={styles.fine}>{entry ? t('counter.live.count', { paid, count: people.length }) : t('counter.entry.body')}</p>
      </div>
      <Button size="md" variant={entry ? 'secondary' : 'primary'} block onClick={() => navigate(counterPath(expense.id))}>
        {entry ? t('counter.entry.open') : t('counter.entry.cta')}
      </Button>
    </Card>
  )
}
