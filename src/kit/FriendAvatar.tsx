import { Avatar, type AvatarSize } from '../components'
import { useFriend } from '../data'
import type { Friend } from '../domain/types'
import { cx } from '../lib/cx'
import { friendLabel } from './friendName'
import styles from './FriendAvatar.module.css'

export interface FriendAvatarProps {
  /** Looks the person up in your people. Ignored when `friend` is passed. */
  friendId?: string | null
  /** The record itself (skips the lookup). `null` = someone who was removed. */
  friend?: Friend | null
  /** `xs` 22px · `sm` 28px · `md` 40px (default) · `lg` 56px. */
  size?: AvatarSize
  /** Accent ring + check badge. */
  selected?: boolean
  /** Prints the name under the avatar ("You" for the owner) — the people-row look. */
  showName?: boolean
  /**
   * Without a visible name the avatar is decorative by default (a name is almost always printed
   * next to it). Set false to expose it as an image named after the person.
   */
  decorative?: boolean
  className?: string
}

/**
 * A person's pastel initials disc, resolved from your people. The owner reads "You"; an id that
 * no longer matches anyone (a removed friend on an old expense) shows a neutral "?" as "Someone".
 */
export function FriendAvatar({
  friendId,
  friend,
  size = 'md',
  selected = false,
  showName = false,
  decorative = true,
  className,
}: FriendAvatarProps) {
  const stored = useFriend(friend === undefined ? friendId : null)
  const record = friend === undefined ? stored : friend
  const id = record?.id ?? friendId ?? null
  const label = friendLabel(id, record)
  const known = record !== null

  const disc = (
    <Avatar
      // The owner's disc keeps their own initials; the visible/spoken label says "You".
      name={known ? record.name : ''}
      color={known ? record.color : 0}
      size={size}
      selected={selected}
      className={cx(!known && styles.unknown)}
    />
  )

  if (showName) {
    return (
      <span className={cx(styles.person, styles[size], selected && styles.selected, className)}>
        {disc}
        <span className={styles.name}>{label}</span>
      </span>
    )
  }

  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }
  return (
    <span {...a11y} className={cx(styles.solo, className)}>
      {disc}
    </span>
  )
}
