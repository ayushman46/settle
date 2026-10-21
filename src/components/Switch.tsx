import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import styles from './Switch.module.css'

export interface SwitchProps {
  checked: boolean
  /** Receives the new state. A selection haptic plays first. */
  onChange: (checked: boolean) => void
  /** Names the setting (the whole row toggles it). */
  label: ReactNode
  /** Second line explaining the setting (also its accessible description). */
  description?: ReactNode
  /** Visually hide the label — only the track shows (it's still the accessible name). */
  hideLabel?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * On/off setting (`role="switch"`): a full-width row — label and description on the left, the
 * track on the right — so the whole row is the touch target.
 */
export function Switch({ checked, onChange, label, description, hideLabel = false, disabled = false, id, className }: SwitchProps) {
  const autoId = useId()
  const labelId = `${autoId}-label`
  const descriptionId = `${autoId}-description`
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description != null ? descriptionId : undefined}
      disabled={disabled}
      className={cx(styles.row, hideLabel && styles.compact, checked && styles.on, className)}
      onClick={() => {
        haptic('select')
        onChange(!checked)
      }}
    >
      <span className={cx(styles.text, hideLabel && 'visually-hidden')}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description != null && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb}>
          <Check className={styles.check} strokeWidth={3.5} />
        </span>
      </span>
    </button>
  )
}
