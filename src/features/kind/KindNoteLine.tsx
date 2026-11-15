import { Handshake } from 'lucide-react'
import { useFriendsById } from '../../data'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { firstName } from '../../share/text'
import { kindNoteText } from './kindText'
import { useKindNote } from './useKindNote'
import styles from './Kind.module.css'

export interface KindNoteLineProps {
  /** A group payment's id, or an expense's id. */
  id: string
  /** Whose share, for an expense with several people on it. */
  debtorId?: string
  className?: string
}

/**
 * "Settled without money: Riya bought your ticket", for beside a payment in a group's list or a
 * share on an expense page. Nothing when that record wasn't settled in kind.
 */
export function KindNoteLine({ id, debtorId, className }: KindNoteLineProps) {
  useT()
  const entry = useKindNote(id, debtorId)
  const friendsById = useFriendsById()
  if (!entry) return null
  const name = firstName(friendLabel(entry.friendId, friendsById[entry.friendId]))
  return (
    <p className={cx(styles.note, className)}>
      <Handshake aria-hidden="true" />
      <span>{kindNoteText(entry, name)}</span>
    </p>
  )
}
