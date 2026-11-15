import type { TodayItem } from '../today/types'

/**
 * What households need from the person today: nothing. A household has no date of its own; what
 * it owes is on the group's page and on Settle up whenever they look.
 */
export function unitsToday(now: Date): TodayItem[] {
  void now
  return []
}
