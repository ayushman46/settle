import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import styles from './Chip.module.css'

export interface ChipProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  children: ReactNode
  /**
   * Toggle state. When defined the chip is a toggle (`aria-pressed`) and shows a check while
   * selected; leave undefined for a plain quick-pick action.
   */
  selected?: boolean
  /** Leading visual (icon or `Avatar size="xs"`). Replaced by a check while selected. */
  leading?: ReactNode
  /** Trailing visual (icon, count...). */
  trailing?: ReactNode
  /** `md` 36px with a 44px touch target (default) · `lg` 44px. */
  size?: 'md' | 'lg'
}

/** Small pill for quick picks and toggles. Plays a selection haptic on tap. */
export function Chip({
  children,
  selected,
  leading,
  trailing,
  size = 'md',
  className,
  onClick,
  type = 'button',
  ...rest
}: ChipProps) {
  const isToggle = selected !== undefined
  // Inside a radio group (role="radio") the state is aria-checked; aria-pressed is not allowed there.
  const isRadio = rest.role === 'radio'
  const lead = selected ? <Check strokeWidth={2.75} /> : leading
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={isToggle && !isRadio ? selected : undefined}
      aria-checked={isToggle && isRadio ? selected : undefined}
      className={cx(styles.chip, styles[size], selected && styles.selected, className)}
      onClick={(event) => {
        haptic('select')
        onClick?.(event)
      }}
    >
      {lead != null && (
        <span className={styles.icon} aria-hidden="true">
          {lead}
        </span>
      )}
      <span className={styles.label}>{children}</span>
      {trailing != null && (
        <span className={styles.icon} aria-hidden="true">
          {trailing}
        </span>
      )}
    </button>
  )
}
