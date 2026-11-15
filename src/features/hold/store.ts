/**
 * Expenses on hold, kept whole on this phone (and in backups): each one exactly as it was taken
 * out of the app's expenses, with why and when. Putting one back hands the same record back.
 */
import * as z from 'zod/mini'
import { cleanText, expensesStore } from '../../data'
import { expenseSchema, isCanonicalExpense } from '../../data/schemas'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import type { Expense } from '../../domain/types'
import { isHoldReason, MAX_HELD, MAX_HOLD_NOTE, putBack, takeOut, type HeldExpense, type HoldReason } from './engine'

export interface HoldState {
  /** Newest hold first. */
  held: HeldExpense[]
}

const entryShape = z.object({
  expense: z.unknown(),
  reason: z.catch(z.string(), 'other'),
  note: z.catch(z.nullable(z.string()), null),
  heldAt: z.catch(z.number(), 0),
  afterId: z.catch(z.nullable(z.string()), null),
})

/** An expense as the app saved it comes back untouched; anything else is repaired like any stored expense, or dropped. */
function readExpense(raw: unknown): Expense | null {
  if (isCanonicalExpense(raw)) return raw
  const parsed = z.safeParse(expenseSchema, raw)
  return parsed.success ? parsed.data : null
}

/** Reads each hold on its own: one unreadable entry is dropped, never the rest. Twice the cap is read, so nothing saved is lost. */
const heldSchema: ZodType<HeldExpense[]> = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const out: HeldExpense[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      if (out.length >= MAX_HELD * 2) break
      const parsed = z.safeParse(entryShape, value)
      if (!parsed.success) continue
      const expense = readExpense(parsed.data.expense)
      if (!expense || seen.has(expense.id)) continue
      seen.add(expense.id)
      const note = parsed.data.note === null ? null : cleanText(parsed.data.note, MAX_HOLD_NOTE) || null
      out.push({
        expense,
        reason: isHoldReason(parsed.data.reason) ? parsed.data.reason : 'other',
        note,
        // A hold whose moment can't be read counts from the expense's last change (never from 1970).
        heldAt: Number.isFinite(parsed.data.heldAt) && parsed.data.heldAt > 0 ? parsed.data.heldAt : expense.updatedAt,
        afterId: parsed.data.afterId,
      })
    }
    return out
  }),
)

export const holdSchema = z.object({ held: z.catch(heldSchema, []) })

export const holdStore = createStore<HoldState>({
  key: STORAGE_KEYS.hold,
  schema: holdSchema,
  initial: () => ({ held: [] }),
  version: 1,
})

export function useHeld(): readonly HeldExpense[] {
  return useStore(holdStore, (state) => state.held)
}

export function heldById(expenseId: string): HeldExpense | null {
  return holdStore.get().held.find((h) => h.expense.id === expenseId) ?? null
}

/**
 * Takes expense `id` out of the app's expenses and keeps it whole here. Null when there is no
 * such expense, or too many are on hold already (nothing changes then).
 */
export function holdExpense(id: string, reason: HoldReason, note: string | null, now: number = Date.now()): HeldExpense | null {
  const state = holdStore.get()
  if (state.held.length >= MAX_HELD) return null
  const taken = takeOut(expensesStore.get(), id)
  if (!taken) return null
  const entry: HeldExpense = {
    expense: taken.expense,
    reason,
    note: reason === 'other' && note ? cleanText(note, MAX_HOLD_NOTE) || null : null,
    heldAt: now,
    afterId: taken.afterId,
  }
  // Kept here first: if anything stops halfway the expense is in both places, never in neither.
  holdStore.set({ ...state, held: [entry, ...state.held.filter((h) => h.expense.id !== id)] })
  expensesStore.set(taken.list)
  return entry
}

/** Puts a held expense back exactly as it was (same record, same place). Returns it, or null when it isn't on hold. */
export function releaseHold(expenseId: string): HeldExpense | null {
  const state = holdStore.get()
  const entry = state.held.find((h) => h.expense.id === expenseId)
  if (!entry) return null
  expensesStore.update((list) => putBack(list, entry.expense, entry.afterId))
  holdStore.set({ ...state, held: state.held.filter((h) => h !== entry) })
  return entry
}

/** Undoes `releaseHold`: the expense comes out again and its hold goes back where it was in the list. */
export function holdAgain(entry: HeldExpense, index: number): void {
  expensesStore.update((list) => list.filter((e) => e.id !== entry.expense.id))
  restoreHeld(entry, index)
}

/** Where a hold sits in the list (for putting it back there on Undo), or -1. */
export function heldIndex(expenseId: string): number {
  return holdStore.get().held.findIndex((h) => h.expense.id === expenseId)
}

/** Deletes a held expense for good. Returns it (for Undo with `restoreHeld`), or null. */
export function deleteHeld(expenseId: string): HeldExpense | null {
  const state = holdStore.get()
  const entry = state.held.find((h) => h.expense.id === expenseId)
  if (!entry) return null
  holdStore.set({ ...state, held: state.held.filter((h) => h !== entry) })
  return entry
}

/** Puts a hold back in the list at `index` (replacing one for the same expense). */
export function restoreHeld(entry: HeldExpense, index: number): void {
  holdStore.update((state) => {
    const rest = state.held.filter((h) => h.expense.id !== entry.expense.id)
    const at = Math.min(Math.max(0, index), rest.length)
    return { ...state, held: [...rest.slice(0, at), entry, ...rest.slice(at)] }
  })
}
