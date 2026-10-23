import { ArrowRightLeft } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button } from '../../components'
import { useGroup } from '../../data'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { currencySymbol } from '../../lib/money'
import { convertPath } from './fxView'
import styles from './ConvertCard.module.css'

export interface ConvertCardProps {
  /** The expense on screen. */
  expense: Expense
}

/**
 * A group expense in another currency than the group's, with no rate (older ones, an itemized bill
 * saved in THB): it isn't in the group's balances — "Convert to ₹" opens it with the switch on.
 */
export function ConvertCard({ expense }: ConvertCardProps) {
  const t = useT()
  const group = useGroup(expense.groupId)
  if (!group || expense.fx || expense.currency === group.currency) return null
  const symbol = currencySymbol(group.currency)
  return (
    <div className={styles.card}>
      <p className={styles.text}>{t('trip.convert.text', { code: expense.currency, group: group.name, symbol })}</p>
      <Button size="sm" variant="tonal" iconStart={<ArrowRightLeft />} className={styles.button} onClick={() => navigate(convertPath(expense.id))}>
        {t('trip.convert.action', { symbol })}
      </Button>
    </div>
  )
}
