import type { Expense } from '../../domain/types'

export interface ClaimStatusCardProps {
  /** The bill on screen. */
  expense: Expense
}

/** Claims on this bill ("2 of 4 replied · 1 item needs you") — placeholder until slice S1 builds it: renders nothing. */
export function ClaimStatusCard(_props: ClaimStatusCardProps) {
  return null
}
