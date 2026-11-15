import { useCallback } from 'react'
import { CalendarClock } from 'lucide-react'
import { shallowArrayEqual, useStore } from '../../data'
import { useT } from '../../i18n'
import { dayLabel } from '../kist/text'
import { shownPromise, type PromiseEntry } from './engine'
import { promiseStore, type PromiseBook } from './store'
import { usePromiseViews } from './usePromiseViews'
import styles from './Promise.module.css'

export interface PromiseChipProps {
  friendId: string
}

/**
 * A small line for a person's row or page: "Promised by Fri 5 Dec" while a promise is open,
 * "Promise was due 2 days ago" once its date has passed unpaid ("You promised…" when the promise
 * is yours). Null when there is no promise to speak of, so it can sit on any row.
 */
export function PromiseChip({ friendId }: PromiseChipProps) {
  const select = useCallback((state: PromiseBook) => state.promises.filter((p) => p.friendId === friendId), [friendId])
  const promises = useStore(promiseStore, select, shallowArrayEqual)
  // Most people have no promise: they cost one look at the list, nothing more.
  if (promises.length === 0) return null
  return <ChipLine promises={promises} />
}

function ChipLine({ promises }: { promises: readonly PromiseEntry[] }) {
  const t = useT()
  const { views, today } = usePromiseViews(promises)
  const shown = shownPromise(views)
  if (!shown) return null
  const mine = shown.promise.direction === 'pay'
  const late = shown.state === 'broken' || shown.overdue > 0
  const text = late
    ? t(mine ? 'promise.chip.mine.late' : 'promise.chip.theirs.late', { days: Math.max(1, shown.overdue) })
    : shown.promise.due === today
      ? t(mine ? 'promise.chip.mine.today' : 'promise.chip.theirs.today')
      : t(mine ? 'promise.chip.mine' : 'promise.chip.theirs', { date: dayLabel(shown.promise.due, today) })
  return (
    <span className={styles.chip} data-tone={late ? 'late' : shown.promise.due === today ? 'today' : 'open'}>
      <CalendarClock aria-hidden="true" />
      {text}
    </span>
  )
}
