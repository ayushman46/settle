/**
 * "Settle finds out": in the Android app, with payment alerts on, the phone's own alerts say when
 * money left your account ("You paid ₹400 to Riya", the bank's "Rs.400 debited"). A pay sheet that
 * just sent you to your UPI app says what it's waiting for here; the alerts reader
 * (src/features/autosettle) says what it saw; a match records the payment with no tap.
 * Nothing here talks to a UPI app or a bank: it only pairs an amount with an alert, on the phone.
 */
import { hasPlugin } from './nativeApp'

/** Money that left your account, as an alert told it. */
export interface PaidOut {
  /** Paise. */
  amount: number
  /** When the alert was posted (epoch ms). */
  at: number
}

interface Waiting {
  amount: number
  since: number
  onSeen: () => void
}

/** A payment is waited for this long after you set off to pay. */
export const PAY_WATCH_MS = 30 * 60 * 1000
/** Clocks differ a little between the page and the alert. */
const SLACK_MS = 5_000

const waiting = new Set<Waiting>()

/** This phone can tell Settle when a payment went out (the Android app's payment alerts). */
export function canWatchPayments(): boolean {
  return hasPlugin('PaymentAlerts')
}

/** Waits for an alert that `amount` (paise) left the account from now on. Returns the way to stop waiting. */
export function expectPayment(amount: number, onSeen: () => void, since: number = Date.now()): () => void {
  const entry: Waiting = { amount, since, onSeen }
  waiting.add(entry)
  return () => {
    waiting.delete(entry)
  }
}

/** What the phone's alerts said went out: each waiting payment it matches is told, once. Returns the ones a pay sheet was waiting for. */
export function paymentsSeen(out: readonly PaidOut[]): PaidOut[] {
  const used = new Set<PaidOut>()
  for (const entry of [...waiting]) {
    const hit = out.find((o) => !used.has(o) && o.amount === entry.amount && o.at >= entry.since - SLACK_MS && o.at <= entry.since + PAY_WATCH_MS)
    if (!hit) continue
    used.add(hit)
    waiting.delete(entry)
    try {
      entry.onSeen()
    } catch {
      // The sheet is gone: nothing to tell.
    }
  }
  return [...used]
}

/** Tests only. */
export function resetPayWatchForTests(): void {
  waiting.clear()
}
