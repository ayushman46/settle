import { useId } from 'react'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import styles from './RangeChips.module.css'

export interface RangeChipsProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  /** Names the group ("Time range"). */
  label: string
  className?: string
}

/**
 * One-of-n chips in a row that scrolls sideways on narrow phones. Native radio buttons
 * underneath: arrow keys move the choice, and screen readers hear "3 of 4".
 */
export function RangeChips<T extends string>({ options, value, onChange, label, className }: RangeChipsProps<T>) {
  const name = useId()
  return (
    <fieldset className={cx(styles.group, className)}>
      <legend className="visually-hidden">{label}</legend>
      <div className={styles.row}>
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label key={option.value} className={cx(styles.chip, checked && styles.checked)}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                className={styles.input}
                onChange={() => {
                  haptic('select')
                  onChange(option.value)
                }}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
