/**
 * Udhaar limit: a ceiling on what a friend can owe you (and an optional one for everyone), a note
 * before a split crosses it, a badge in To collect. It warns; it never blocks.
 */
import type { TodayItem } from '../today/types'

export { isLimitAmount, limitChoices, limitFor, limitStanding, limitWarnings, overBy, type AppliedLimit, type LimitState, type LimitWarning } from './engine'
export { LimitBadge, type LimitBadgeProps } from './LimitBadge'
export { LimitNote, type LimitNoteProps } from './LimitNote'
export { LimitEveryoneRow, LimitRow, type LimitRowProps } from './LimitRow'
export { LimitScreen } from './LimitScreen'
export { LIMIT_PATH } from './paths'
export { limitStore, setEveryoneLimit, setFriendLimit, useLimitState } from './store'

/** A limit is never due on a day: it has nothing for Today (it speaks up on the split itself, and in To collect). */
export function limitToday(now: Date): TodayItem[] {
  void now
  return []
}
