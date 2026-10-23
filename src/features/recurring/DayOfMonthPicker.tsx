import { useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { BottomSheet } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { ordinal, repeatsLabel } from './recurringLabels'
import styles from './DayOfMonthPicker.module.css'

export interface DayOfMonthPickerProps {
  /** 1–28. */
  value: number
  onChange: (day: number) => void
  className?: string
}

/** Days 29–31 aren't in every month, so the 28th is the latest due day. */
export const LAST_DAY = 28
const DAYS = Array.from({ length: LAST_DAY }, (_, i) => i + 1)
const COLUMNS = 7

/**
 * "Every month on the 1st ▾" — a chip that opens a calendar-like grid of days 1–28 (a radio
 * group: arrow keys move in the grid, Home/End jump to the ends).
 */
export function DayOfMonthPicker({ value, onChange, className }: DayOfMonthPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  const pick = (day: number): void => {
    haptic('select')
    onChange(day)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const from = value - 1
    let to: number
    switch (event.key) {
      case 'ArrowRight':
        to = from + 1
        break
      case 'ArrowLeft':
        to = from - 1
        break
      case 'ArrowDown':
        to = from + COLUMNS
        break
      case 'ArrowUp':
        to = from - COLUMNS
        break
      case 'Home':
        to = 0
        break
      case 'End':
        to = LAST_DAY - 1
        break
      default:
        return
    }
    event.preventDefault()
    const next = Math.min(LAST_DAY - 1, Math.max(0, to))
    refs.current[next]?.focus()
    if (next !== from) {
      haptic('select')
      onChange(next + 1)
    }
  }

  return (
    <>
      <button
        type="button"
        className={cx(styles.chip, className)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CalendarDays aria-hidden="true" className={styles.icon} />
        <span className={styles.label}>{repeatsLabel(value)}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('recurring.day.sheet.title')}
        description={t('recurring.day.sheet.description')}
        initialFocus={selectedRef}
      >
        <div role="radiogroup" aria-label={t('recurring.day.grid.aria')} className={styles.grid} onKeyDown={onKeyDown}>
          {DAYS.map((day, i) => {
            const checked = day === value
            return (
              <button
                key={day}
                ref={(el) => {
                  refs.current[i] = el
                  if (checked) selectedRef.current = el
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t('recurring.day.option.aria', { day: ordinal(day) })}
                tabIndex={checked ? 0 : -1}
                className={cx(styles.day, checked && styles.checked)}
                onClick={() => pick(day)}
              >
                {day}
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}
