import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import styles from './SegmentedControl.module.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Small glyph before the label. */
  icon?: ReactNode
  disabled?: boolean
  /** Accessible name when the label is an icon or abbreviation (e.g. "%" → "Percentages"). */
  'aria-label'?: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Names the group, e.g. "Split mode". */
  ariaLabel: string
  /** `md` 44px (default) · `sm` 36px with 44px touch targets. */
  size?: 'md' | 'sm'
  className?: string
  id?: string
}

/**
 * One-of-n picker with a sliding ink thumb (radiogroup semantics). Arrow keys move the selection
 * (wrapping, skipping disabled options), Home/End jump to the ends; only the selected option is
 * in the tab order.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
  id,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = options.findIndex((o) => o.value === value)
  const focusable = index >= 0 && !options[index]?.disabled ? index : options.findIndex((o) => !o.disabled)
  const style = {
    '--seg-count': String(Math.max(1, options.length)),
    '--seg-index': String(Math.max(0, index)),
  } as CSSProperties

  const select = (i: number, focus: boolean): void => {
    const option = options[i]
    if (!option || option.disabled) return
    if (focus) refs.current[i]?.focus()
    if (option.value === value) return
    haptic('select')
    onChange(option.value)
  }

  /** The next enabled option from `from` in `step` direction (wrapping), or -1. */
  const nextEnabled = (from: number, step: 1 | -1): number => {
    const n = options.length
    for (let k = 1; k <= n; k++) {
      const i = (((from + step * k) % n) + n) % n
      if (!options[i]?.disabled) return i
    }
    return -1
  }

  /** Where a navigation key moves the selection; undefined for keys the group doesn't handle. */
  const targetFor = (key: string): number | undefined => {
    const from = index >= 0 ? index : focusable
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return nextEnabled(from, 1)
      case 'ArrowLeft':
      case 'ArrowUp':
        return nextEnabled(from, -1)
      case 'Home':
        return nextEnabled(-1, 1)
      case 'End':
        return nextEnabled(options.length, -1)
      default:
        return undefined
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = targetFor(event.key)
    if (target === undefined) return
    event.preventDefault()
    if (target >= 0) select(target, true)
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.track, styles[size], index < 0 && styles.none, className)}
      style={style}
      onKeyDown={onKeyDown}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option, i) => {
        const checked = i === index
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option['aria-label']}
            tabIndex={i === focusable ? 0 : -1}
            disabled={option.disabled}
            className={cx(styles.option, checked && styles.checked)}
            onClick={() => select(i, false)}
          >
            {option.icon != null && (
              <span className={styles.icon} aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span className={styles.label}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
