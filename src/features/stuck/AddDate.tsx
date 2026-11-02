import { useId } from 'react'
import { Chip } from '../../components'
import { addDays } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import styles from './Stuck.module.css'

/** Days back offered as one tap: today, yesterday, 2 and 3 days ago. */
const QUICK_DAYS = [0, 1, 2, 3] as const

/**
 * "When did the money leave?" as a few taps — Today, Yesterday, 2 days ago, 3 days ago — or any
 * other day from the phone's picker. Nothing is picked until the person picks: the day sets the
 * deadline, so a guessed "Today" would set the wrong one.
 */
export function AddDate({ label, value, today, onChange }: { label: string; value: string | null; today: string; onChange: (date: string) => void }) {
  const t = useT()
  const labelId = useId()
  const quick = QUICK_DAYS.map((back) => addDays(today, -back))
  const other = value !== null && !quick.includes(value) ? value : ''
  return (
    <div role="group" aria-labelledby={labelId} className={styles.formSection}>
      <p id={labelId} className={styles.dateLabel}>
        {label}
      </p>
      <div className={styles.chips}>
        {quick.map((day, back) => (
          <Chip key={day} selected={value === day} onClick={() => onChange(day)}>
            {back === 0 ? t('common.date.today') : back === 1 ? t('common.date.yesterday') : t('stuck.add.date.daysAgo', { count: back })}
          </Chip>
        ))}
        <DateField label={t('stuck.add.date.other')} value={other} onChange={onChange} className={other ? styles.datePicked : undefined} />
      </div>
    </div>
  )
}
