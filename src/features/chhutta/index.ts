/** Small change rule: a group ignores dues under ₹X; "Call it even" on tiny balances, logged. */
import type { TodayItem } from '../today/types'

export { CallEvenButton } from './CallEvenButton'
export { ChhuttaCard } from './ChhuttaCard'
export { ChhuttaLog, ChhuttaRow } from './ChhuttaRow'
export { callFriendEven, callGroupEven } from './actions'
export {
  CHHUTTA_OPTIONS,
  FRIEND_UNITS,
  GENTLE_UNITS,
  smallBalance,
  smallDues,
  unitsToMinor,
  yearTotals,
  type ChhuttaEntry,
  type ChhuttaTotals,
  type SmallDue,
} from './engine'
export { chhuttaRuleFor, chhuttaStore, setChhuttaRule, useChhuttaLog, useChhuttaRule, type ChhuttaState } from './store'

/** Small change never has anything due: its offers sit on the group and the friend, not on Today. */
export function chhuttaToday(_now: Date): TodayItem[] {
  return []
}
