import { Check } from 'lucide-react'
import { cx } from '../lib/cx'
import { initials } from '../lib/people'
import { avatarColorIndex } from './helpers'
import styles from './Avatar.module.css'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

export interface AvatarProps {
  name: string
  /** Palette index (`Person.color`, 0..7). Out-of-range values wrap. */
  color: number
  /** `xs` 22px · `sm` 28px · `md` 40px (default) · `lg` 56px. */
  size?: AvatarSize
  /** Accent ring + check badge. */
  selected?: boolean
  /**
   * Decorative by default (the name is almost always printed next to it). Set false to expose
   * it as an image named after the person.
   */
  decorative?: boolean
  className?: string
}

/** Pastel initials disc for a person. */
export function Avatar({ name, color, size = 'md', selected = false, decorative = true, className }: AvatarProps) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name }
  return (
    <span
      {...a11y}
      className={cx(styles.avatar, styles[size], styles[`c${avatarColorIndex(color)}`], selected && styles.selected, className)}
    >
      <span className={styles.initials}>{initials(name)}</span>
      {selected && size !== 'xs' && (
        <span className={styles.badge}>
          <Check strokeWidth={3.5} />
        </span>
      )}
    </span>
  )
}
