/**
 * A group's expense list grows a page at a time; this remembers how far it had grown, per group,
 * for the rest of the visit — so opening an expense far down the list and coming Back (or
 * switching between the Expenses and Balances tabs) lands you where you were, with the rows
 * you'd loaded still there. In memory only: a reload starts fresh.
 */

/** Entries per page: about three screenfuls on a phone. */
export const TIMELINE_PAGE = 40

/** Groups remembered at most (the most recently viewed). */
const MAX_GROUPS = 20

const limits = new Map<string, number>()

/** How many entries to show for `groupId`: the first page, or as far as it had grown. */
export function rememberedTimelineLimit(groupId: string): number {
  return limits.get(groupId) ?? TIMELINE_PAGE
}

export function rememberTimelineLimit(groupId: string, limit: number): void {
  limits.delete(groupId)
  if (!(limit > TIMELINE_PAGE)) return
  limits.set(groupId, Math.floor(limit))
  if (limits.size > MAX_GROUPS) {
    const oldest = limits.keys().next().value
    if (oldest !== undefined) limits.delete(oldest)
  }
}

/** Back to the first page everywhere (between tests). */
export function forgetTimelineLimits(): void {
  limits.clear()
}
