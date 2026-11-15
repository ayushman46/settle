import { useMemo } from 'react'
import { useFriendsById, useSummary } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { paydayDue, type PaydayDue } from './engine'
import { useMyPayday, usePaydayDismissed } from './store'

/**
 * What Home's payday card is about right now, or null when it has nothing to show (not your
 * payday or the two days after, you owe nobody, no payday set, or put away for this month).
 * Home can use it to keep "Clear everything" from showing twice.
 */
export function usePaydayDue(): PaydayDue | null {
  const mine = useMyPayday()
  const dismissed = usePaydayDismissed()
  const summary = useSummary()
  const friendsById = useFriendsById()
  const today = todayIso()
  return useMemo(() => paydayDue(mine, dismissed, summary.byFriend, friendsById, today), [mine, dismissed, summary.byFriend, friendsById, today])
}
