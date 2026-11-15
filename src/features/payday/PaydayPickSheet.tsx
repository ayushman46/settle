import { useRef, type KeyboardEvent } from 'react'
import { BottomSheet, Button, Chip } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { ordinal } from '../recurring/recurringLabels'
import type { Payday } from './engine'
import styles from './Payday.module.css'

export interface PaydayPickSheetProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** What is saved now (shown as picked), or null. */
  value: Payday | null
  /** A payday picked, or null for "Don't know". The sheet closes itself after. */
  onPick: (payday: Payday | null) => void
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const COLUMNS = 7

/**
 * Picks a payday: any day of the month (a calendar-like grid: arrow keys move, Enter picks), the
 * last day, the last working day, or "Don't know". One tap saves and closes.
 */
export function PaydayPickSheet({ open, onClose, title, description, value, onPick }: PaydayPickSheetProps) {
  const t = useT()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const picked = typeof value === 'number' ? value : null

  const pick = (payday: Payday | null): void => {
    haptic('select')
    onPick(payday)
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const from = refs.current.findIndex((el) => el === document.activeElement)
    if (from < 0) return
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
        to = DAYS.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    refs.current[Math.min(DAYS.length - 1, Math.max(0, to))]?.focus()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      initialFocus={picked !== null ? selectedRef : undefined}
      footer={
        <Button block variant="ghost" onClick={() => pick(null)}>
          {t('payday.sheet.clear')}
        </Button>
      }
    >
      <div className={styles.sheet}>
        <div role="group" aria-label={t('payday.sheet.grid.aria')} className={styles.grid} onKeyDown={onKeyDown}>
          {DAYS.map((day, i) => {
            const checked = day === picked
            return (
              <button
                key={day}
                ref={(el) => {
                  refs.current[i] = el
                  if (checked) selectedRef.current = el
                }}
                type="button"
                aria-pressed={checked}
                aria-label={t('payday.sheet.day.aria', { day: ordinal(day) })}
                // One stop in the tab order: the picked day, or the 1st.
                tabIndex={checked || (picked === null && day === 1) ? 0 : -1}
                className={cx(styles.day, checked && styles.checked)}
                onClick={() => pick(day)}
              >
                {day}
              </button>
            )
          })}
        </div>
        <p className={styles.fine}>{t('payday.sheet.short')}</p>
        <div className={styles.chips}>
          <Chip size="lg" selected={value === 'last'} onClick={() => pick('last')}>
            {t('payday.sheet.last')}
          </Chip>
          <Chip size="lg" selected={value === 'lastWorking'} onClick={() => pick('lastWorking')}>
            {t('payday.sheet.lastWorking')}
          </Chip>
        </div>
        <p className={styles.fine}>{t('payday.sheet.lastWorking.note')}</p>
      </div>
    </BottomSheet>
  )
}
