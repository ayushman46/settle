/**
 * The payment references this phone has already marked from screenshots, so the same screenshot
 * (or a second copy of the same UPI payment) can't be recorded twice. Kept on this phone only and
 * included in backups (the store lives in the data layer, `src/data/stores.ts`).
 */
import { proofRefsStore, type ProofRef } from '../../data/stores'

/** Enough history for any realistic use; the oldest references fall off after this. */
export const MAX_LEDGER_ENTRIES = 500

export const proofLedgerStore = proofRefsStore

/** Remembers a reference as marked. Keeps the newest `MAX_LEDGER_ENTRIES`. */
export function rememberReference(entry: ProofRef): void {
  const next = [...proofLedgerStore.get().filter((e) => e.utr !== entry.utr), entry]
  proofLedgerStore.set(next.slice(-MAX_LEDGER_ENTRIES))
}

/** Forgets a reference (the Undo of a mark). */
export function forgetReference(utr: string): void {
  proofLedgerStore.set(proofLedgerStore.get().filter((e) => e.utr !== utr))
}
