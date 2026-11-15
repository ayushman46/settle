/** Refund splitter: a refund, cashback or deposit return on an expense goes back in the same proportions. */
import type { TodayItem } from '../today/types'

export { RefundButton, RefundSheet, type RefundButtonProps, type RefundSheetProps } from './RefundSheet'
export { RefundedCard, RefundedHome } from './RefundedCard'
export { applyRefund, clearFullRefund, refundDateText, refundNoteLine, takeOffRefund, type ApplyIssue, type ApplyResult } from './actions'
export {
  canTakeOff,
  fullyRefunded,
  planRefund,
  refundsOn,
  type RefundChanges,
  type RefundCompanion,
  type RefundInput,
  type RefundIssue,
  type RefundPlan,
  type RefundRecord,
} from './engine'
export { refundStore, useRefunds, type RefundState } from './store'

/** A refund is recorded when it arrives: nothing is ever due. */
export function refundToday(_now: Date): TodayItem[] {
  return []
}
