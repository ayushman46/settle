import { useEffect, useMemo, useState } from 'react'
import { useExpenses, useGroups } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { promiseViews, sweepPromises } from './actions'
import type { PromiseEntry, PromiseView } from './engine'

/**
 * The given promises as they stand today, following the app's records live. Also closes any
 * whose date has passed (after drawing, never while drawing).
 */
export function usePromiseViews(promises: readonly PromiseEntry[]): { views: PromiseView[]; today: string } {
  const expenses = useExpenses()
  const groups = useGroups()
  const [today] = useState(() => todayIso())
  const views = useMemo(() => promiseViews(promises, { expenses, groups }, today), [promises, expenses, groups, today])
  const passed = promises.some((p) => p.outcome === null && today > p.due)
  useEffect(() => {
    if (passed) sweepPromises()
  }, [passed])
  return { views, today }
}
