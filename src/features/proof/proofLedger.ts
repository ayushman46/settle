/**
 * The payment references this phone has already marked from screenshots, so the same screenshot
 * (or a second copy of the same UPI payment) can't be recorded twice. Kept on this phone only.
 */
import { z } from 'zod'
import { createStore } from '../../data/store'
import type { LedgerEntry } from './proofMatch'

/** Enough history for any realistic use; the oldest references fall off after this. */
export const MAX_LEDGER_ENTRIES = 500

const LedgerSchema = z.array(
  z.object({
    utr: z.string().regex(/^\d{10,22}$/),
    friendId: z.string().min(1),
    amount: z.number().int().positive(),
    at: z.number(),
  }),
)

export const proofLedgerStore = createStore<LedgerEntry[]>({
  key: 'settle-proof-refs',
  schema: LedgerSchema,
  initial: () => [],
  version: 1,
})

/** Remembers a reference as marked. Keeps the newest `MAX_LEDGER_ENTRIES`. */
export function rememberReference(entry: LedgerEntry): void {
  const next = [...proofLedgerStore.get().filter((e) => e.utr !== entry.utr), entry]
  proofLedgerStore.set(next.slice(-MAX_LEDGER_ENTRIES))
}

/** Forgets a reference (the Undo of a mark). */
export function forgetReference(utr: string): void {
  proofLedgerStore.set(proofLedgerStore.get().filter((e) => e.utr !== utr))
}
