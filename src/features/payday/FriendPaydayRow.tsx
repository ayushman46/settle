import { useId, useState } from 'react'
import { useFriend } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import { shortDate } from '../recurring/recurringLabels'
import { nextPayday } from './engine'
import { paydayLabel } from './labels'
import { PaydayChips } from './PaydayChips'
import { PaydayPickSheet } from './PaydayPickSheet'
import { useFriendPayday } from './store'
import { useSetFriendPayday } from './usePaydayActions'
import styles from './Payday.module.css'

export interface FriendPaydayRowProps {
  friendId: string
}

/**
 * The friend page's payday row: "When does Riya get paid?" with one-tap chips (1st, 5th, 7th,
 * 10th, Last day, Other, Don't know). Saved on the tap, with Undo. Nothing for yourself or for
 * someone who isn't one of your people.
 */
export function FriendPaydayRow({ friendId }: FriendPaydayRowProps) {
  const t = useT()
  const friend = useFriend(friendId)
  const payday = useFriendPayday(friendId)
  const setPayday = useSetFriendPayday()
  const [picking, setPicking] = useState(false)
  const headingId = useId()
  if (!friend || friendId === ME_ID) return null
  const name = firstName(friendLabel(friendId, friend))
  const today = todayIso()

  return (
    <section className={styles.friendRow} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {t('payday.friend.question', { name })}
      </h2>
      <p className={styles.fine} role="status">
        {payday === null ? t('payday.friend.why') : t('payday.friend.set', { payday: paydayLabel(payday), date: shortDate(nextPayday(payday, today)) })}
      </p>
      <PaydayChips
        value={payday}
        label={t('payday.friend.chips.aria', { name })}
        onPick={(next) => setPayday(friendId, name, next)}
        onOther={() => setPicking(true)}
      />
      <PaydayPickSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t('payday.sheet.friend.title', { name })}
        description={t('payday.sheet.friend.description')}
        value={payday}
        onPick={(next) => setPayday(friendId, name, next)}
      />
    </section>
  )
}
