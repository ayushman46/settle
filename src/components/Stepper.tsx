import type { KeyboardEvent, ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import styles from './Stepper.module.css'

export interface StepperProps {
  value: number
  /** Default 1. */
  min?: number
  /** Default 99. */
  max?: number
  /** Default 1. */
  step?: number
  /** Receives the clamped next value (never called at a bound). Plays a tap haptic. */
  onChange: (value: number) => void
  /** What is being counted, e.g. "Quantity" or "Shares for Aisha" — names the group and its buttons. */
  label: string
  /** `sm` 32px buttons with 44px touch targets (default) · `md` 44px buttons. */
  size?: 'sm' | 'md'
  /** Custom display of the value (e.g. `n => `${n}×``). */
  formatValue?: (value: number) => ReactNode
  disabled?: boolean
  className?: string
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1)
}

/** Compact – value + control. Buttons stay focusable at the bounds (`aria-disabled`) so keyboard focus never jumps. */
export function Stepper({
  value,
  min = 1,
  max = 99,
  step = 1,
  onChange,
  label,
  size = 'sm',
  formatValue,
  disabled = false,
  className,
}: StepperProps) {
  const current = Number.isFinite(value) ? value : min
  const canDecrease = !disabled && current - step >= min - 1e-9
  const canIncrease = !disabled && current + step <= max + 1e-9
  const name = lowerFirst(label)

  const change = (delta: number): void => {
    const next = Math.min(max, Math.max(min, current + delta))
    if (next === current) return
    haptic('tap')
    onChange(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (canIncrease) change(step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (canDecrease) change(-step)
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(styles.stepper, styles[size], disabled && styles.disabled, className)}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={`Decrease ${name}`}
        aria-disabled={!canDecrease || undefined}
        disabled={disabled}
        onClick={() => {
          if (canDecrease) change(-step)
        }}
      >
        <Minus aria-hidden="true" strokeWidth={2.5} />
      </button>
      <output className={styles.value} aria-live="polite" aria-atomic="true">
        {formatValue ? formatValue(current) : current}
      </output>
      <button
        type="button"
        className={styles.button}
        aria-label={`Increase ${name}`}
        aria-disabled={!canIncrease || undefined}
        disabled={disabled}
        onClick={() => {
          if (canIncrease) change(step)
        }}
      >
        <Plus aria-hidden="true" strokeWidth={2.5} />
      </button>
    </div>
  )
}
