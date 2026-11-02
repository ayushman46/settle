/**
 * Money stuck with a bank or a business (src/features/stuck): a payment that failed but took the
 * money, or a refund still to come. Saved here, ticked off when the money is back, with every
 * complaint raised along the way. Every change returns its Undo. Kept on this phone and backed up.
 */
import { newId } from '../lib/ids'
import { stuckStore, type StuckBack, type StuckBackPart, type StuckPayment, type StuckStep } from './stores'

/** Enough for anyone; the oldest settled ones fall off first. */
export const MAX_STUCK = 300

export type StuckDraft = Omit<StuckPayment, 'id' | 'steps' | 'repliedAt' | 'back' | 'note' | 'dismissedAt' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<StuckPayment, 'steps' | 'repliedAt' | 'back' | 'note'>>

/** Keeps the list within MAX_STUCK, dropping the oldest closed ones (open ones — part of it back too — are never dropped). */
function capped(list: StuckPayment[]): StuckPayment[] {
  if (list.length <= MAX_STUCK) return list
  const closed = list
    .filter((s) => !isStuckOpen(s))
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
    repliedAt: draft.repliedAt ?? null,
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

/** Most parts one payment keeps (the store's own limit); past it, a new part joins the last. */
const MAX_BACK_PARTS = 100

/** The parts noted so far: the list, or — saved before parts were kept, or set as totals — the totals as one. */
function partsOf(back: StuckBack | null): StuckBackPart[] {
  if (!back) return []
  if (back.parts && back.parts.length > 0) return back.parts
  return back.amount > 0 || back.compensation > 0 ? [{ date: back.date, amount: back.amount, compensation: back.compensation }] : []
}

/** The totals the parts add up to: the money (never more than was paid), the compensation, and the day the last of the money came. */
function backFrom(parts: StuckBackPart[], paid: number): StuckBack {
  const money = parts.filter((p) => p.amount > 0)
  const date = (money.at(-1) ?? parts.at(-1))?.date ?? ''
  const amount = Math.min(paid, money.reduce((sum, p) => sum + p.amount, 0))
  const compensation = parts.reduce((sum, p) => sum + p.compensation, 0)
  return { date, amount, compensation, parts }
}

/**
 * The money is back as these totals (an edit of what came back, or all of it at once; never more
 * than was paid). When they only add to what was noted — more money on the day of the last part or
 * later, or compensation — the parts so far stay and the difference is a new part; any other change
 * starts over from the totals. Given with its parts, the totals are worked out from them.
 */
export function markStuckBack(id: string, back: StuckBack): (() => void) | null {
  const done = patch(id, (s) => ({ ...s, back: totalsBack(s.back, back, s.amount), confirmed: true, dismissedAt: null }))
  return done ? () => restoreStuck(done.before) : null
}

function totalsBack(before: StuckBack | null, back: StuckBack, paid: number): StuckBack {
  if (back.parts && back.parts.length > 0) return backFrom(back.parts, paid)
  const totals = { date: back.date, amount: Math.min(paid, back.amount), compensation: back.compensation }
  if (!before) return totals
  const more = { date: back.date, amount: totals.amount - before.amount, compensation: totals.compensation - before.compensation }
  if (more.amount === 0 && more.compensation === 0 && back.date === before.date) return before
  // More of the money, on the day of the last part or later; or only compensation, the money's day kept.
  const adds = more.compensation >= 0 && (more.amount > 0 ? back.date >= before.date : more.amount === 0 && back.date === before.date)
  return adds ? { ...totals, parts: [...partsOf(before), more] } : totals
}

/**
 * Money that came in for it: a part of the payment and/or compensation, on `part.date`. Added to
 * what came before (each keeps its own day), and the totals follow: the money (never more than was
 * paid), the compensation, and the day the last of the money came. With Undo.
 */
export function addStuckBack(id: string, part: StuckBackPart): (() => void) | null {
  if (part.amount <= 0 && part.compensation <= 0) return null
  const add: StuckBackPart = { date: part.date, amount: Math.max(0, part.amount), compensation: Math.max(0, part.compensation) }
  const done = patch(id, (s) => {
    const parts = [...partsOf(s.back)]
    const last = parts.at(-1)
    if (last && parts.length >= MAX_BACK_PARTS) {
      parts[parts.length - 1] = { date: last.date > add.date ? last.date : add.date, amount: last.amount + add.amount, compensation: last.compensation + add.compensation }
    } else {
      // In date order; on the same day, after what came before it.
      const at = parts.findIndex((p) => p.date > add.date)
      parts.splice(at === -1 ? parts.length : at, 0, add)
    }
    return { ...s, back: backFrom(parts, s.amount), confirmed: true, dismissedAt: null }
  })
  return done ? () => restoreStuck(done.before) : null
}

/** Notes a complaint raised (a second one of the same kind replaces the first; a new one to the bank waits for a new reply). */
export function addStuckStep(id: string, step: StuckStep): (() => void) | null {
  const done = patch(id, (s) => ({
    ...s,
    steps: [...s.steps.filter((x) => x.kind !== step.kind), step].sort((a, b) => a.date.localeCompare(b.date)),
    repliedAt: step.kind === 'bank' && s.repliedAt !== null && step.date > s.repliedAt ? null : s.repliedAt,
  }))
  return done ? () => restoreStuck(done.before) : null
}

/** The bank replied to the complaint or turned it down, on `date` (null: it hasn't after all). The RBI Ombudsman opens from then. */
export function markBankReplied(id: string, date: string | null): () => void {
  const done = patch(id, (s) => ({ ...s, repliedAt: date }))
  return done ? () => restoreStuck(done.before) : () => undefined
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
