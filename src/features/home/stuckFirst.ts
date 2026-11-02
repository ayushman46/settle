import { useCallback } from 'react'
import { useStore } from '../../data'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { today } from '../../engine/dates'
import { summarize } from '../stuck/rules'

/**
 * True when Stuck money's card belongs near the top of Home: something there needs the person (a
 * deadline passed, a reply is due), or nothing has been split yet, so it shouldn't sit under the
 * first-split invitation. (The card itself still decides whether there's anything to show.)
 */
export function useStuckFirst(hasSplits: boolean): boolean {
  const day = today()
  const first = useCallback((list: readonly StuckPayment[]) => list.length > 0 && (!hasSplits || summarize(list, day).act > 0), [hasSplits, day])
  return useStore(stuckStore, first)
}
