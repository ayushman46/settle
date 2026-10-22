/**
 * The Activity tab remembers where you were — filter, search and how far down the list you'd
 * loaded — for the rest of the visit, so opening an expense and coming Back (or switching tabs)
 * lands you exactly where you left off. In memory only: a reload starts fresh.
 */
import type { ActivityFilter } from './activityView'

export interface ActivityView {
  filter: ActivityFilter
  query: string
  /** Rows loaded so far (the list grows a page at a time). */
  limit: number
}

/** Rows per page: about three screenfuls on a phone. */
export const ACTIVITY_PAGE = 40

const START: ActivityView = Object.freeze({ filter: 'all', query: '', limit: ACTIVITY_PAGE })

let remembered: ActivityView = START

export function rememberedActivityView(): ActivityView {
  return remembered
}

export function rememberActivityView(view: ActivityView): void {
  remembered = { filter: view.filter, query: view.query, limit: Math.max(ACTIVITY_PAGE, view.limit) }
}

/** Back to "All", no search, first page (after clearing data, and between tests). */
export function forgetActivityView(): void {
  remembered = START
}
