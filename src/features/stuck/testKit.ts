/** Test support for Stuck money's screens: a stuck payment as the store keeps it, and a seeded list. */
import { stuckStore, type StuckPayment } from '../../data/stores'

/** A failed ₹500 UPI payment to Riya on 28 Oct 2026 that took the money (patch what the test needs). */
export function stuckPayment(over: Partial<StuckPayment> = {}): StuckPayment {
  return {
    id: 's1',
    kind: 'failed',
    rail: 'upi_person',
    party: 'Riya Sharma',
    merchant: null,
    amount: 50_000,
    date: '2026-10-28',
    promisedBy: null,
    ref: '430112345678',
    orderId: null,
    bank: 'hdfc',
    account: 'XX4821',
    app: 'gpay',
    source: 'manual',
    confirmed: true,
    steps: [],
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

/** Puts these stuck payments on the phone. */
export function seedStuck(...list: StuckPayment[]): void {
  stuckStore.set(list)
}

/** The stuck payment with this id, as stored now. */
export function storedStuck(id: string): StuckPayment | undefined {
  return stuckStore.get().find((s) => s.id === id)
}
