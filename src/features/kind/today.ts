import type { TodayItem } from '../today/types'

/** A payment in kind is recorded once and is done: there is never anything due for Today. */
export function kindToday(now: Date): TodayItem[] {
  void now
  return []
}
