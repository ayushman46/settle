import { Globe } from 'lucide-react'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { fxNoteText } from './fxView'
import styles from './FxNote.module.css'

export interface FxNoteProps {
  /** The expense on screen. */
  expense: Expense
}

/**
 * Under the expense hero when it was paid abroad: what was actually paid and the frozen rate —
 * "Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)", or "… (your bank: ₹3,104.20)".
 */
export function FxNote({ expense }: FxNoteProps) {
  useT()
  const text = fxNoteText(expense)
  if (!text) return null
  return (
    <p className={styles.note}>
      <Globe aria-hidden="true" className={styles.icon} strokeWidth={2.25} />
      <span>{text}</span>
    </p>
  )
}
