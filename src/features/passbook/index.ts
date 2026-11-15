/**
 * Statement (passbook): a bank-style passbook between you and one person. Everything is worked out
 * from the app's own expenses and payments; the only thing kept is which dates you last looked at.
 */
import type { TodayItem } from '../today/types'

export { passbook, rangeStart, PASSBOOK_RANGES, type Passbook, type PassbookEntry, type PassbookKind, type PassbookLedger, type PassbookRange } from './engine'
export { PassbookLink, type PassbookLinkProps } from './PassbookLink'
export { PassbookScreen } from './PassbookScreen'
export { passbookCsv, passbookText } from './passbookText'
export { PASSBOOK_FRIENDS_PATTERN, PASSBOOK_PATTERN, passbookPath } from './paths'
export { passbookStore, setPassbookRange, usePassbookRange, type PassbookState } from './store'

/** A statement is never due: it has nothing for Today. */
export function passbookToday(now: Date): TodayItem[] {
  void now
  return []
}
