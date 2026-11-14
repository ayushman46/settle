/** Pay it forward's suggestions for this phone: from every friend's balance with you, in your currency. */
import { useMemo } from 'react'
import { useFriendsById, useSummary } from '../../data'
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { swapKey, swapPlan, type Swap, type SwapPerson } from './engine'
import { useDismissedSwaps } from './store'

/** Your people with money open in `byFriend` (the profile currency's nets), named as you know them. */
export function swapPeople(byFriend: Readonly<Record<string, Minor>>, friendsById: Readonly<Record<string, Friend>>): SwapPerson[] {
  const out: SwapPerson[] = []
  for (const [id, net] of Object.entries(byFriend)) {
    const friend = friendsById[id]
    // Someone no longer in your people can't be messaged.
    if (id === ME_ID || !friend || net === 0) continue
    out.push({ id, name: friend.name, net })
  }
  return out
}

export interface SwapView {
  /** Suggestions not put away, best first. */
  swaps: Swap[]
  /** Payments saved if every suggestion is followed; null once some are put away (it no longer adds up). */
  saved: number | null
  currency: string
}

export function useSwaps(): SwapView {
  const summary = useSummary()
  const friendsById = useFriendsById()
  const dismissed = useDismissedSwaps()
  return useMemo(() => {
    const plan = swapPlan(swapPeople(summary.byFriend, friendsById))
    const away = new Set(dismissed)
    const swaps = plan.swaps.filter((s) => !away.has(swapKey(s)))
    return { swaps, saved: swaps.length === plan.swaps.length ? plan.saved : null, currency: summary.currency }
  }, [summary, friendsById, dismissed])
}
