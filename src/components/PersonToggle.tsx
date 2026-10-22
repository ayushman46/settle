import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { Avatar } from './Avatar'
import styles from './PersonToggle.module.css'

export interface PersonToggleProps {
  name: string
  /** Name the avatar's initials come from, when it differs from the label (the owner reads "You" but keeps their own initials). */
  avatarName?: string
  /** Palette index (`Person.color`). */
  color: number
  selected: boolean
  /** Flip selection. A light haptic tick plays first. */
  onToggle: () => void
  /** Small second line, e.g. this person's share of the item (fades in; the card height stays put for one-line names). */
  meta?: ReactNode
  /** Extra controls under the toggle (e.g. a share `Stepper`). Rendered outside the button. */
  trailing?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

/** Big tappable person card with a pressed state (avatar check + highlighter fill). */
export function PersonToggle({
  name,
  avatarName,
  color,
  selected,
  onToggle,
  meta,
  trailing,
  disabled = false,
  id,
  className,
}: PersonToggleProps) {
  return (
    <div className={cx(styles.card, selected && styles.selected, disabled && styles.disabled, className)}>
      <button
        id={id}
        type="button"
        className={styles.toggle}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => {
          haptic('select')
          onToggle()
        }}
      >
        <Avatar name={avatarName ?? name} color={color} size="md" selected={selected} />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          {meta != null && (
            <>
              {' '}
              <span className={styles.meta}>{meta}</span>
            </>
          )}
        </span>
      </button>
      {trailing != null && <div className={styles.trailing}>{trailing}</div>}
    </div>
  )
}
