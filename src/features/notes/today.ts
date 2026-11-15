import type { TodayItem } from '../today/types'

/** Cash notes never have anything due: there is nothing for Today. */
export function notesToday(now: Date): TodayItem[] {
  void now
  return []
}
