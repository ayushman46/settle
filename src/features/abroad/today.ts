import type { TodayItem } from '../today/types'

/** A friend abroad has no date attached: there is never anything due for Today. */
export function abroadToday(now: Date): TodayItem[] {
  void now
  return []
}
