import { Chip } from '../../components'
import { useT } from '../../i18n'
import { QUICK_PAYDAYS, type Payday } from './engine'
import { paydayChipLabel } from './labels'
import styles from './Payday.module.css'

export interface PaydayChipsProps {
  /** What is saved now, or null. */
  value: Payday | null
  /** A quick pick, or null for "Don't know". */
  onPick: (payday: Payday | null) => void
  /** "Other": open the full picker. */
  onOther: () => void
  /** Names the group ("Riya's payday"). */
  label: string
}

/**
 * The quick picks: 1st, 5th, 7th, 10th, Last day, Other, Don't know. A payday that isn't a quick
 * pick shows on the "Other" chip ("15th"), picked. "Don't know" is picked until something is set.
 */
export function PaydayChips({ value, onPick, onOther, label }: PaydayChipsProps) {
  const t = useT()
  const isOther = value !== null && !QUICK_PAYDAYS.includes(value)
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {QUICK_PAYDAYS.map((payday) => (
        <Chip key={payday} size="lg" selected={value === payday} onClick={() => onPick(payday)}>
          {paydayChipLabel(payday)}
        </Chip>
      ))}
      <Chip size="lg" selected={isOther} aria-haspopup="dialog" onClick={onOther}>
        {isOther ? paydayChipLabel(value) : t('payday.chip.other')}
      </Chip>
      <Chip size="lg" selected={value === null} onClick={() => onPick(null)}>
        {t('payday.chip.unknown')}
      </Chip>
    </div>
  )
}
