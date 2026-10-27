import type { Minor } from '../../domain/types'
import { UpiRoutes } from '../../kit/UpiRoutes'
import { useTouchFirst } from './useTouchFirst'

export interface UpiPayBlockProps {
  /** Who the money goes to, as the UPI app should show it. */
  payeeName: string
  /** Their UPI ID (valid). */
  vpa: string
  /** What to pay, in minor units. */
  amount: Minor
  /** The UPI note ("Friday dinner"). */
  note: string
  /** The amount's currency; UPI is INR only. */
  currency: string
  /** The payee's avatar colour. */
  color: number
  /** The payer started paying (saved the QR, copied the UPI ID, opened an app). */
  onStarted?: () => void
  /** "Yes, I paid" when they come back from their UPI app. */
  onPaid?: () => void
}

/**
 * Paying one person by UPI on the pay, claim and pool pages: the ways UPI allows, led by what this
 * device is good at (see `UpiRoutes`) — the QR on a computer; on a phone a QR to save and upload
 * (up to ₹2,000) or the UPI ID to paste.
 */
export function UpiPayBlock({ payeeName, vpa, amount, note, color, onStarted, onPaid }: UpiPayBlockProps) {
  const phone = useTouchFirst()
  return <UpiRoutes payeeName={payeeName} vpa={vpa} amount={amount} note={note} color={color} phone={phone} onStarted={onStarted} onPaid={onPaid} />
}
