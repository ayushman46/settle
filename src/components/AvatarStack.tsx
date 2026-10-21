import { cx } from '../lib/cx'
import { Avatar } from './Avatar'
import { describePeople } from './helpers'
import styles from './AvatarStack.module.css'

export interface AvatarStackPerson {
  id: string
  name: string
  color: number
}

export interface AvatarStackProps {
  people: readonly AvatarStackPerson[]
  /** Most circles shown (avatars + the "+N" counter). Default 4. */
  max?: number
  size?: 'xs' | 'sm' | 'md'
  /** Accessible label; defaults to a readable list of names ("Aisha, Ben and 2 others"). */
  label?: string
  className?: string
}

/** Overlapping avatars for "who's on this item", capped with a "+N" counter. */
export function AvatarStack({ people, max = 4, size = 'sm', label, className }: AvatarStackProps) {
  const limit = Math.max(1, Math.floor(max))
  const overflow = people.length > limit
  const visible = overflow ? people.slice(0, limit - 1) : people
  const extra = people.length - visible.length
  const text = label ?? describePeople(people.map((p) => p.name), 3)
  return (
    <span role="img" aria-label={text} className={cx(styles.stack, styles[size], className)}>
      {visible.map((person) => (
        <Avatar key={person.id} name={person.name} color={person.color} size={size} className={styles.item} />
      ))}
      {overflow && (
        <span className={cx(styles.item, styles.more)} aria-hidden="true">
          +{extra}
        </span>
      )}
    </span>
  )
}
