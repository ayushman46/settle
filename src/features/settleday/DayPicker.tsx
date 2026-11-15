import { useState } from 'react'
import { BottomSheet, Chip } from '../../components'
import { useT } from '../../i18n'
import { MAX_SETTLE_DAY, QUICK_DAYS, type SettleDay } from './engine'
import { chipLabel } from './labels'
import styles from './SettleDay.module.css'

const ALL_DAYS: readonly number[] = Array.from({ length: MAX_SETTLE_DAY }, (_, i) => i + 1)

export interface DayPickerProps {
  /** The day picked so far, or null. */
  value: SettleDay | null
  onPick: (day: SettleDay) => void
  /** Names the group of chips for assistive tech ("Settle day for Flat 4B"). */
  label: string
}

/**
 * The day of the month, in one tap: 1st, 5th, 10th or the last day; "Other" opens every day
 * from 1 to 28 (days every month has).
 */
export function DayPicker({ value, onPick, label }: DayPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const other = value !== null && !QUICK_DAYS.includes(value)

  const pick = (day: SettleDay): void => {
    setOpen(false)
    if (day !== value) onPick(day)
  }

  return (
    <>
      <div className={styles.chips} role="radiogroup" aria-label={label}>
        {QUICK_DAYS.map((day) => (
          <Chip key={day} size="lg" role="radio" selected={value === day} onClick={() => pick(day)}>
            {chipLabel(day)}
          </Chip>
        ))}
        <Chip size="lg" role="radio" selected={other} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          {other && value !== null ? chipLabel(value) : t('settleday.chip.other')}
        </Chip>
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('settleday.sheet.title')} description={t('settleday.sheet.body')}>
        <div className={styles.sheet} role="radiogroup" aria-label={t('settleday.sheet.days.aria')}>
          <div className={styles.days}>
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                role="radio"
                aria-checked={value === day}
                aria-label={chipLabel(day)}
                className={styles.dayButton}
                data-selected={value === day || undefined}
                onClick={() => pick(day)}
              >
                {day}
              </button>
            ))}
          </div>
          <Chip size="lg" role="radio" selected={value === 'last'} onClick={() => pick('last')} className={styles.lastChip}>
            {chipLabel('last')}
          </Chip>
        </div>
      </BottomSheet>
    </>
  )
}
