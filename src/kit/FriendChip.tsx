import type { ReactNode, Ref } from 'react'
import { X } from 'lucide-react'
import { useFriend } from '../data'
import type { Friend } from '../domain/types'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel } from './friendName'
import styles from './FriendChip.module.css'

export interface FriendChipProps {
  /** Looks the person up in your people. Ignored when `friend` is passed. */
  friendId?: string | null
  /** The record itself (skips the lookup). `null` = someone who was removed. */
  friend?: Friend | null
  /** Adds an ✕ that removes the person, announced as "Remove Riya". */
  onRemove?: () => void
  /** Makes the chip itself a button (e.g. to open the person). */
  onClick?: () => void
  /** Accessible name for the chip button when `onClick` is set. Default: the name plus `trailing` text. */
  'aria-label'?: string
  /** Small extra after the name, e.g. an amount or a badge. */
  trailing?: ReactNode
  /** Ref to the ✕ button — for moving focus after a neighbour was removed. */
  removeRef?: Ref<HTMLButtonElement>
  /** id of the ✕ button. */
  removeId?: string
  className?: string
}

/** A person as a compact pill: avatar, name ("You" for the owner) and an optional ✕. */
export function FriendChip({
  friendId,
  friend,
  onRemove,
  onClick,
  'aria-label': ariaLabel,
  trailing,
  removeRef,
  removeId,
  className,
}: FriendChipProps) {
  const t = useT()
  const stored = useFriend(friend === undefined ? friendId : null)
  const record = friend === undefined ? stored : friend
  const id = record?.id ?? friendId ?? null
  const label = friendLabel(id, record)

  const body = (
    <>
      <FriendAvatar friend={record} size="xs" />
      <span className={styles.name}>{label}</span>
      {trailing != null && <span className={styles.trailing}>{trailing}</span>}
    </>
  )

  return (
    <span className={cx(styles.chip, onRemove && styles.removable, className)}>
      {onClick ? (
        <button
          type="button"
          className={styles.main}
          aria-label={ariaLabel}
          onClick={() => {
            haptic('tap')
            onClick()
          }}
        >
          {body}
        </button>
      ) : (
        <span className={styles.main}>{body}</span>
      )}
      {onRemove && (
        <button
          ref={removeRef}
          id={removeId}
          type="button"
          className={styles.remove}
          aria-label={t('kit.chip.remove.aria', { name: label })}
          onClick={() => {
            haptic('tap')
            onRemove()
          }}
        >
          <X aria-hidden="true" strokeWidth={2.75} />
        </button>
      )}
    </span>
  )
}
