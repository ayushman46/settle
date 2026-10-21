import type { KeyboardEvent, MouseEvent } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { isIsoDate, today } from '../engine/dates'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { fullDateLabel, relativeDateLabel } from './dateLabel'
import styles from './DateField.module.css'

export interface DateFieldProps {
  /** Local calendar date, `YYYY-MM-DD`. */
  value: string
  /** Receives a valid `YYYY-MM-DD` (a cleared picker keeps the current date). */
  onChange: (value: string) => void
  /** Names the field for assistive tech. Default "Date". */
  label?: string
  /** Latest date that can be picked. Default today — expenses have already happened. `null` = no limit. */
  max?: string | null
  /** Earliest date that can be picked. */
  min?: string
  disabled?: boolean
  id?: string
  className?: string
}

/** Opens the browser's own picker where it can be opened from script (desktop needs this; phones open on tap). */
function openPicker(input: HTMLInputElement): void {
  if (typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // Already open, or not allowed right now — the native control still works as is.
  }
}

/**
 * A date chip — "Today", "Yesterday", "18 Oct" — that opens the phone's native date picker. The
 * real `<input type="date">` covers the chip, so taps, keyboards and screen readers all reach it.
 */
export function DateField({ value, onChange, label = 'Date', max, min, disabled = false, id, className }: DateFieldProps) {
  const now = today()
  const limit = max === undefined ? now : max
  const text = relativeDateLabel(value, now)
  const full = fullDateLabel(value)
  const spoken = full && full !== text ? `${label}: ${text}, ${full}` : `${label}: ${text}`

  return (
    <span className={cx(styles.field, disabled && styles.disabled, className)}>
      <CalendarDays className={styles.icon} aria-hidden="true" strokeWidth={2.25} />
      <span className={styles.text} aria-hidden="true">
        {text}
      </span>
      <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={2.5} />
      <input
        id={id}
        type="date"
        className={styles.input}
        value={isIsoDate(value) ? value : ''}
        max={limit ?? undefined}
        min={min}
        required
        disabled={disabled}
        aria-label={spoken}
        onClick={(event: MouseEvent<HTMLInputElement>) => openPicker(event.currentTarget)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker(event.currentTarget)
          }
        }}
        onChange={(event) => {
          const next = event.currentTarget.value
          if (!isIsoDate(next) || next === value) return
          haptic('select')
          onChange(next)
        }}
      />
    </span>
  )
}
