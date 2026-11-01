/**
 * Reads one bank SMS or app notification for money that's stuck or coming back: a payment that
 * failed (or is pending), a debit (only to confirm a failure took the money), money reversed,
 * a refund a business has started, or a refund credited. Everything else is null.
 *
 * STUB — the detect agent replaces the body; the types and exports are the contract.
 */
import type { StuckRail } from '../../data/stores'
import type { StuckDraft } from '../../data/stuck'

interface SignalBase {
  /** Paise. */
  amount: number
  /** YYYY-MM-DD. */
  date: string
  /** When it was seen (epoch ms). */
  at: number
  /** UPI reference (RRN/UTR), ARN or transaction id. */
  ref: string | null
  /** Who it was paid to / who's refunding: "Swiggy", "Riya Sharma". */
  party: string | null
  /** A business Settle knows (merchants.ts), or null. */
  merchant: string | null
  bank: string | null
  account: string | null
  app: string | null
}

export type StuckSignal =
  | (SignalBase & { type: 'failed' | 'pending'; vpa: string | null; rail: StuckRail | null; debited: boolean })
  | (SignalBase & { type: 'debit' })
  | (SignalBase & { type: 'reversal' })
  | (SignalBase & { type: 'refund_initiated'; orderId: string | null; promisedBy: string | null })
  | (SignalBase & { type: 'refund_credited' })

export interface ReadOptions {
  /** YYYY-MM-DD on this phone. */
  today: string
  /** The Android package that posted it, when it's a notification. */
  app?: string | null
  /** When it was posted (epoch ms); defaults to now. */
  at?: number
}

/** What one message says about stuck money, or null when it says nothing about it. */
export function readStuckMessage(text: string, opts: ReadOptions): StuckSignal | null {
  void text
  void opts
  return null
}

/** A new stuck payment from what a message said (failed, pending or a refund started), or null. */
export function signalToDraft(signal: StuckSignal, source: StuckDraft['source']): StuckDraft | null {
  void signal
  void source
  return null
}
