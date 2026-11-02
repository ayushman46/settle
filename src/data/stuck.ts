/**
 * Money stuck with a bank or a business (src/features/stuck): a payment that failed but took the
 * money, or a refund still to come. Saved here, ticked off when the money is back, with every
 * complaint raised along the way. Every change returns its Undo. Kept on this phone and backed up.
 */
import { newId } from '../lib/ids'
import { stuckStore, type StuckBack, type StuckPayment, type StuckStep } from './stores'

/** Enough for anyone; the oldest settled ones fall off first. */
export const MAX_STUCK = 300

export type StuckDraft = Omit<StuckPayment, 'id' | 'steps' | 'back' | 'note' | 'dismissedAt' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<StuckPayment, 'steps' | 'back' | 'note'>>

/** Keeps the list within MAX_STUCK, dropping the oldest closed ones (open ones are never dropped). */
function capped(list: StuckPayment[]): StuckPayment[] {
  if (list.length <= MAX_STUCK) return list
  const closed = list
    .filter((s) => s.back !== null || s.dismissedAt !== null)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, list.length - MAX_STUCK)
  const drop = new Set(closed.map((s) => s.id))
  return list.filter((s) => !drop.has(s.id))
}

function patch(id: string, change: (s: StuckPayment) => StuckPayment): { before: StuckPayment; after: StuckPayment } | null {
  const list = stuckStore.get()
  const at = list.findIndex((s) => s.id === id)
  const before = list[at]
  if (!before) return null
  const after = { ...change(before), updatedAt: Date.now() }
  stuckStore.set(list.map((s, i) => (i === at ? after : s)))
  return { before, after }
}

/** Puts a stuck payment back as it was (the Undo of any change). */
export function restoreStuck(payment: StuckPayment): void {
  const list = stuckStore.get()
  const exists = list.some((s) => s.id === payment.id)
  stuckStore.set(exists ? list.map((s) => (s.id === payment.id ? payment : s)) : capped([...list, payment]))
}

/** Saves a new stuck payment. */
export function addStuck(draft: StuckDraft, now: number = Date.now()): StuckPayment {
  const payment: StuckPayment = {
    ...draft,
    id: newId(),
    steps: draft.steps ?? [],
    back: draft.back ?? null,
    note: draft.note ?? null,
    dismissedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  stuckStore.set(capped([...stuckStore.get(), payment]))
  return payment
}

/** Changes what's known about one (the amount, the reference, how it was paid…). */
export function updateStuck(id: string, change: Partial<Omit<StuckPayment, 'id' | 'createdAt' | 'updatedAt'>>): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, ...change }))
  return done ? () => restoreStuck(done.before) : null
}

/** The money is back (and any compensation with it). */
export function markStuckBack(id: string, back: StuckBack): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, back, confirmed: true, dismissedAt: null }))
  return done ? () => restoreStuck(done.before) : null
}

/** Notes a complaint raised (a second one of the same kind replaces the first). */
export function addStuckStep(id: string, step: StuckStep): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, steps: [...s.steps.filter((x) => x.kind !== step.kind), step].sort((a, b) => a.date.localeCompare(b.date)) }))
  return done ? () => restoreStuck(done.before) : null
}

/** It did leave the account (an app said it failed; you checked). */
export function confirmStuck(id: string): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, confirmed: true }))
  return done ? () => restoreStuck(done.before) : null
}

/** Not stuck after all, or not worth chasing: kept aside, not deleted. */
export function dismissStuck(id: string, now: number = Date.now()): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, dismissedAt: now }))
  return done ? () => restoreStuck(done.before) : null
}

/** Removes it for good; returns it for Undo. */
export function deleteStuck(id: string): StuckPayment | null {
  const list = stuckStore.get()
  const found = list.find((s) => s.id === id) ?? null
  if (found) stuckStore.set(list.filter((s) => s.id !== id))
  return found
}

/** Still owed: not all of it back, not set aside. */
export function isStuckOpen(s: StuckPayment): boolean {
  return (s.back === null || s.back.amount < s.amount) && s.dismissedAt === null
}
