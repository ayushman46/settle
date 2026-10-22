import type { Expense } from '../../domain/types'

export interface LoanCardProps {
  /** The expense on screen. */
  expense: Expense
}

/** A loan or 1:1 entry: what's still to come, "Got it all back" — placeholder until slice S4 builds it: renders nothing. */
export function LoanCard(_props: LoanCardProps) {
  return null
}
