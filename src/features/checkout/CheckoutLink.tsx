import { memo, useMemo } from 'react'
import { ChevronRight, Luggage } from 'lucide-react'
import { navigate } from '../../app/router'
import { Chip } from '../../components'
import { useExpenses, useGroup } from '../../data'
import type { Group } from '../../domain/types'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { useT } from '../../i18n'
import { checkoutPath } from './paths'
import styles from './Checkout.module.css'

export interface CheckoutLinkProps {
  group: Group
  /** `row` (default): a line with what's left ("3 payments and everyone is square."). `chip`: a pill for a row of group tools. */
  variant?: 'row' | 'chip'
}

/**
 * The way into "Settle before you leave" from a group's page. Null when nothing is owed in the
 * group (there is nothing to do before leaving).
 */
export const CheckoutLink = memo(function CheckoutLink({ group: given, variant = 'row' }: CheckoutLinkProps) {
  const t = useT()
  const group = useGroup(given.id) ?? given
  const expenses = useExpenses({ groupId: group.id })
  const count = useMemo(() => simplifyDebts(groupBalances(group, expenses)).length, [group, expenses])
  if (count === 0) return null
  const open = (): void => navigate(checkoutPath(group.id))
  const title = t('checkout.link.title')

  if (variant === 'chip') {
    return (
      <Chip size="lg" leading={<Luggage />} onClick={open}>
        {title}
      </Chip>
    )
  }
  const line = t('checkout.link.body', { count })
  return (
    <button type="button" className={styles.link} onClick={open} aria-label={`${title}. ${line}`}>
      <Luggage aria-hidden="true" className={styles.linkIcon} />
      <span className={styles.linkText}>
        <span className={styles.linkTitle}>{title}</span>
        <span className={styles.fine}>{line}</span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.chevron} />
    </button>
  )
})
