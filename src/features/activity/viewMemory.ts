/**
 * The Activity tab remembers where you were — filter and search — for the rest of the visit, so
 * opening an expense and coming Back (or switching tabs) lands you exactly where you left off
 * (the page's scroll position is the router's; the list keeps its full height, so it fits). In
 * memory only: a reload starts fresh.
 */
import type { ActivityFilter } from './activityView'

export interface ActivityView {
  filter: ActivityFilter
  query: string
  /**
   * No longer used: the list used to grow a page at a time; it is windowed now (every row has its
   * place, only those near the screen are rendered). Accepted and ignored.
   */
  limit?: number
}

/** Rows the list renders before it knows where it is on screen: a phone's first screen and a bit. */
export const FIRST_SCREEN_ROWS = 20

/**
 * Rows per page of the old pager. Kept for callers that size things by it (about three
 * screenfuls on a phone).
 */
export const ACTIVITY_PAGE = 40

const START: ActivityView = Object.freeze({ filter: 'all', query: '' })

let remembered: ActivityView = START

export function rememberedActivityView(): ActivityView {
  return remembered
}

export function rememberActivityView(view: ActivityView): void {
  remembered = { filter: view.filter, query: view.query }
}

/** Back to "All", no search (after clearing data, and between tests). */
export function forgetActivityView(): void {
  remembered = START
}
