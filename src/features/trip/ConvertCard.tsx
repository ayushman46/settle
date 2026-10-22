import type { Expense } from '../../domain/types'

export interface ConvertCardProps {
  /** The expense on screen. */
  expense: Expense
}

/** An expense in another currency than its group's: "Convert to ₹" — placeholder until slice S6 builds it: renders nothing. */
export function ConvertCard(_props: ConvertCardProps) {
  return null
}
