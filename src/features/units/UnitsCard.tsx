import { memo } from 'react'
import { ChevronRight, UsersRound } from 'lucide-react'
import { navigate } from '../../app/router'
import { useGroup } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { householdsPath } from './paths'
import { paySentence, unitLabel } from './unitText'
import { useHouseholds } from './useUnits'
import styles from './Units.module.css'

/**
 * A group's households at a glance, on the group page: who is together ("The Sharmas (4) · The
 * Khans (2)") and the next payment between households, or that they are all square. Tapping opens
 * the households page. Null when the group has no household.
 */
export const UnitsCard = memo(function UnitsCard({ group: given }: { group: Group }) {
  const t = useT()
  const group = useGroup(given.id) ?? given
  const { rows, transfers, people, any } = useHouseholds(group)
  if (!any) return null

  const names = rows
    .filter((row) => row.unit.household)
    .map((row) => t('units.card.unit', { name: unitLabel(row.unit, people), count: row.unit.memberIds.length }))
    .join(' · ')
  const first = transfers[0]
  let line = t('units.card.square')
  if (first) {
    const sentence = paySentence(first.from, first.to, people)
    const amount = formatMoney(first.amount, group.currency, { trimZeros: true })
    line = transfers.length > 1 ? t('units.card.more', { sentence, amount, count: transfers.length - 1 }) : t('units.card.next', { sentence, amount })
  }

  return (
    <button type="button" className={styles.card} onClick={() => navigate(householdsPath(group.id))} aria-label={`${t('units.card.title')}: ${names}. ${line}. ${t('units.card.open')}`}>
      <UsersRound aria-hidden="true" className={styles.cardIcon} />
      <span className={styles.cardText}>
        <span className={styles.cardTitle}>{names}</span>
        <span className={styles.cardLine}>{line}</span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.chevron} />
    </button>
  )
})
