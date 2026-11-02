import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import styles from './Stuck.module.css'

export interface DetailDateProps {
  /** The question, beside the date chip ("When did it come back?"). */
  label: string
  value: string
  onChange: (value: string) => void
  /** The first day it can be (the payment, the complaint…); today is the last. */
  min: string
  /** Why a day before `min` can't be ("It can't have come before 10 Oct…"). */
  early: string
}

/**
 * A day in one of a payment's sheets: its question beside the date chip and — when a day outside
 * the ones it can be is typed in (the picker's limits don't stop typing) — why, read out. The sheet
 * keeps its Save off until the day is right.
 */
export function DetailDate({ label, value, onChange, min, early }: DetailDateProps) {
  const t = useT()
  const issue = value < min ? early : value > todayIso() ? t('stuck.back.dateFuture') : null
  return (
    <div className={styles.dateField}>
      <div className={styles.dateRow}>
        <span className={styles.dateLabel} aria-hidden="true">
          {label}
        </span>
        <DateField label={label} value={value} min={min} onChange={onChange} />
      </div>
      <p className={styles.fieldIssue} aria-live="polite">
        {issue}
      </p>
    </div>
  )
}
