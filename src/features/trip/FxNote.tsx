import type { Expense } from '../../domain/types'

export interface FxNoteProps {
  /** The expense on screen. */
  expense: Expense
}

/** What was paid abroad and the frozen rate ("Paid ฿1,250 · 1 THB = ₹2.4108") — placeholder until slice S6 builds it: renders nothing. */
export function FxNote(_props: FxNoteProps) {
  return null
}
