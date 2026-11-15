/**
 * Under the split editor of a new expense in a group with households: the household split it
 * opened with ("Per family: 3 equal parts. The Sharmas: one part between 4 people."), with a way
 * back to an equal split; or, when the expense is split some other way, one tap to use it.
 * Nothing for a group without households, a plain per-head group, or an edit.
 */
import { UsersRound } from 'lucide-react'
import { Button, Card } from '../../components'
import type { Group, Minor, Participant } from '../../domain/types'
import type { AmountSplitMode } from '../../engine/split'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { hasHouseholds, matchesUnitsSplit, needsAmount, unitsSplitFor, unitsSummary } from './engine'
import { useGroupUnits } from './store'
import { splitLine } from './unitText'
import { useUnitPeople } from './useUnits'
import styles from './Units.module.css'

export interface UnitsSplitBarProps {
  form: { mode: AmountSplitMode; participants: readonly Participant[]; payerId: string }
  /** What is being shared, in the currency it is shared in (the editor's own total); null while nothing is typed. */
  total: Minor | null
  /** The currency of `total`. */
  currency: string
  group: Pick<Group, 'id' | 'name' | 'memberIds'> | null
  /** A new expense (an edit is never offered it). */
  isNew: boolean
  onChange: (patch: { mode: AmountSplitMode; participants: Participant[] }) => void
}

const USE_KEYS = { family: 'units.bar.use.family', half: 'units.bar.use.half', free: 'units.bar.use.free' } as const

export function UnitsSplitBar({ form, total, currency, group, isNew, onChange }: UnitsSplitBarProps) {
  const t = useT()
  const units = useGroupUnits(group?.id)
  const people = useUnitPeople()
  if (!isNew || !group || !units || form.participants.length < 2 || !hasHouseholds(group, units)) return null

  const ids = form.participants.map((p) => p.friendId)
  const split = unitsSplitFor(form, group, units, { total, payerId: form.payerId, currency })
  const waiting = split === null && needsAmount(form, group, units)
  if (split === null && !waiting) return null

  const line = splitLine(unitsSummary(ids, group, units), people)
  const useLabel = t(USE_KEYS[units.basis === 'family' ? 'family' : units.children === 'free' ? 'free' : 'half'])

  // The weights are too large for the editor's shares and there is no amount to work them out for yet.
  if (split === null) {
    return (
      <Card className={styles.bar}>
        <UsersRound aria-hidden="true" className={styles.barIcon} />
        <div className={styles.barText}>
          <p className={styles.barTitle}>{line}</p>
          <p className={styles.fine}>{t('units.bar.needAmount')}</p>
        </div>
      </Card>
    )
  }

  if (matchesUnitsSplit(form, split)) {
    return (
      <Card className={styles.bar}>
        <UsersRound aria-hidden="true" className={styles.barIcon} />
        <div className={styles.barText} role="status">
          <p className={styles.barTitle}>{line}</p>
          {split.mode === 'exact' && total !== null && <p className={styles.fine}>{t('units.bar.exact', { amount: formatMoney(total, currency, { trimZeros: true }) })}</p>}
        </div>
        <Button size="md" variant="secondary" onClick={() => onChange({ mode: 'equal', participants: form.participants.map((p) => ({ friendId: p.friendId, input: null })) })}>
          {t('units.bar.change')}
        </Button>
      </Card>
    )
  }

  return (
    <Card className={styles.bar}>
      <UsersRound aria-hidden="true" className={styles.barIcon} />
      <div className={styles.barText}>
        <p className={styles.fine}>{line}</p>
      </div>
      <Button size="md" variant="secondary" onClick={() => onChange({ mode: split.mode, participants: split.participants })}>
        {useLabel}
      </Button>
    </Card>
  )
}
