import { CalendarClock } from 'lucide-react'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { bestAsk } from './engine'
import { askHint } from './labels'
import { useFriendPayday } from './store'
import styles from './Payday.module.css'

export interface PaydayHintProps {
  friendId: string
  className?: string
}

/**
 * One line for a To collect row: "Gets paid on the 1st: best to ask on the 2nd", or "Payday was
 * yesterday: a good day to ask". Goes by the payday you told Settle (it can't see anyone's bank).
 * Nothing when their payday isn't known, or the day to ask is more than 10 days away.
 * A `<span>`, so it can sit inside the row's button.
 */
export function PaydayHint({ friendId, className }: PaydayHintProps) {
  // Re-read when the language changes.
  useT()
  const payday = useFriendPayday(friendId)
  const today = todayIso()
  const text = askHint(payday, today)
  if (text === null) return null
  const now = bestAsk(payday, today)?.inDays === 0
  return (
    <span className={cx(styles.hint, now && styles.hintNow, className)}>
      <CalendarClock aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
