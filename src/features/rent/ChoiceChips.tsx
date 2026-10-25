import { useId, type ReactNode } from 'react'
import { Chip } from '../../components'
import styles from './Rent.module.css'

export interface ChoiceChipsProps<T extends string> {
  /** The question, shown above the chips and naming the group. */
  label: ReactNode
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}

/**
 * One choice from a few, as chips that wrap onto the next line (a segmented bar breaks words
 * mid-way once there are four options on a 320 px phone). A radio group to assistive tech.
 */
export function ChoiceChips<T extends string>({ label, value, options, onChange }: ChoiceChipsProps<T>) {
  const id = useId()
  return (
    <div className={styles.section}>
      <span id={id} className={styles.lead}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className={styles.chips}>
        {options.map((option) => (
          <Chip key={option.value} role="radio" aria-checked={value === option.value} selected={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
