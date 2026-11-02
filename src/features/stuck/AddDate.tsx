import { useId } from 'react'
import { Chip } from '../../components'
import { addDays } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import { stuckDate } from './view'
import styles from './Stuck.module.css'

/** Days back offered as one tap: today, yesterday, and 2 to 5 days ago. */
const QUICK_DAYS = [0, 1, 2, 3, 4, 5] as const

/**
 * "When did the money leave?" as a few taps — Today, Yesterday, 2 to 5 days ago — or any other
 * day from the phone's picker. Nothing is picked until the person picks: the day sets the
 * deadline, so a guessed "Today" would set the wrong one. The day picked is also said in words
 * under the question, so it's seen even when its chip wraps out of view.
 */
export function AddDate({ label, value, today, onChange }: { label: string; value: string | null; today: string; onChange: (date: string) => void }) {
  const t = useT()
  const labelId = useId()
  const pickedId = useId()
  const quick = QUICK_DAYS.map((back) => addDays(today, -back))
  const other = value !== null && !quick.includes(value) ? value : ''
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={value !== null ? pickedId : undefined} className={styles.formSection}>
      <p id={labelId} className={styles.dateLabel}>
        {label}
      </p>
      {value !== null && (
        <p id={pickedId} className={styles.datePickedLine}>
          {t('stuck.add.date.picked', { date: stuckDate(value, today) })}
        </p>
      )}
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
