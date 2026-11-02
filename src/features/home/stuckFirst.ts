import { useCallback } from 'react'
import { useStore } from '../../data'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { today } from '../../engine/dates'
import { summarize } from '../stuck/rules'
import { homeLines } from '../stuck/view'

/** Where Home shows Stuck money's card: near the top, lower down, or not at all. */
export type StuckPlace = 'top' | 'below' | null

/** `useStuckPlace`'s answer for a list on a day. */
export function stuckPlace(list: readonly StuckPayment[], day: string, hasSplits: boolean): StuckPlace {
  const summary = summarize(list, day)
  // The card's own test: nothing still owed (the money, or compensation for the wait), no card.
  if (homeLines(summary, list, day) === null) return null
  return !hasSplits || summary.act > 0 ? 'top' : 'below'
}

/**
 * Where Stuck money's card goes on Home: near the top when something there needs the person now
 * (a deadline passed, a reply is due), or nothing has been split yet, so it shouldn't sit under
 * the first-split invitation; lower down while it waits; nowhere when nothing is owed (Home's
 * grid has the tile then, so it's found before it's needed).
 */
export function useStuckPlace(hasSplits: boolean): StuckPlace {
  const day = today()
  const place = useCallback((list: readonly StuckPayment[]) => stuckPlace(list, day, hasSplits), [hasSplits, day])
  return useStore(stuckStore, place)
}
