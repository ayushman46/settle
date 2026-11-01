/**
 * Turns what the phone noticed (detect.ts) into stuck payments: new ones are saved, a failure is
 * confirmed when the debit is seen too, and an open one is ticked back when its money returns.
 *
 * STUB — the detect agent replaces the body; the types and exports are the contract.
 */
import type { StuckPayment, StuckSource } from '../../data/stores'
import type { StuckSignal } from './detect'

export interface TrackResult {
  /** Stuck payments saved just now. */
  added: StuckPayment[]
  /** Open ones whose money just came back (as they are now). */
  back: StuckPayment[]
  /** Puts everything back as it was. */
  undo: () => void
}

/** Applies what the messages said. `now` is epoch ms. */
export function trackStuckSignals(signals: readonly StuckSignal[], source: StuckSource, now: number = Date.now()): TrackResult {
  void signals
  void source
  void now
  return { added: [], back: [], undo: () => undefined }
}
