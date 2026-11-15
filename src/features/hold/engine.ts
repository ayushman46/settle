/**
 * On hold: a disputed expense is taken out of the app's expenses (so every balance is right with
 * no special cases) and kept whole until it is sorted out. Pure: lists in, lists out; the clock is passed in.
 */
import type { Expense } from '../../domain/types'

export const HOLD_REASONS = ['amount', 'absent', 'twice', 'checking', 'other'] as const
export type HoldReason = (typeof HOLD_REASONS)[number]

/** The reason picked when the person doesn't choose: the one that claims nothing. */
export const DEFAULT_HOLD_REASON: HoldReason = 'checking'

export interface HeldExpense {
  /** The expense exactly as it was taken out. */
  expense: Expense
  reason: HoldReason
  /** What the person typed for "Something else", or null. */
  note: string | null
  /** When it was put on hold (epoch ms): the hold counts from this moment. */
  heldAt: number
  /** The expense that sat just before it in the list (null: it was first), so it goes back in its place. */
  afterId: string | null
}

/** A hold this old is brought up on Today. */
export const HOLD_NUDGE_DAYS = 7
/** At most this many expenses can be on hold at once (a held expense is never dropped to make room). */
export const MAX_HELD = 200
export const MAX_HOLD_NOTE = 80
const DAY_MS = 86_400_000

export function isHoldReason(value: unknown): value is HoldReason {
  return (HOLD_REASONS as readonly unknown[]).includes(value)
}

/** The list without expense `id`, the expense itself, and what sat before it. Null when it isn't there. */
export function takeOut(list: readonly Expense[], id: string): { list: Expense[]; expense: Expense; afterId: string | null } | null {
  const index = list.findIndex((e) => e.id === id)
  const expense = list[index]
  if (!expense) return null
  return { list: list.filter((_, i) => i !== index), expense, afterId: list[index - 1]?.id ?? null }
}

/**
 * The list with `expense` back: the very same record, right after `afterId` (at the front when
 * that one is gone or it was first). An expense with the same id already there is replaced in place.
 */
export function putBack(list: readonly Expense[], expense: Expense, afterId: string | null): Expense[] {
  if (list.some((e) => e.id === expense.id)) return list.map((e) => (e.id === expense.id ? expense : e))
  const at = afterId === null ? -1 : list.findIndex((e) => e.id === afterId)
  if (at === -1) return [expense, ...list]
  return [...list.slice(0, at + 1), expense, ...list.slice(at + 1)]
}

/** Held expenses of one group, newest hold first (ties by title, so every reload lists them the same). */
export function heldInGroup(held: readonly HeldExpense[], groupId: string): HeldExpense[] {
  return held.filter((h) => h.expense.groupId === groupId).sort(newestHoldFirst)
}

/** Held expenses outside any group, or whose group no longer exists. */
export function looseHeld(held: readonly HeldExpense[], groupIds: ReadonlySet<string>): HeldExpense[] {
  return held.filter((h) => h.expense.groupId === null || !groupIds.has(h.expense.groupId)).sort(newestHoldFirst)
}

function newestHoldFirst(a: HeldExpense, b: HeldExpense): number {
  return b.heldAt - a.heldAt || a.expense.title.localeCompare(b.expense.title) || (a.expense.id < b.expense.id ? -1 : 1)
}

/** Whole days since it was put on hold (0 for the first 24 hours, and for a clock set back). */
export function daysHeld(heldAt: number, now: number): number {
  return Math.max(0, Math.floor((now - heldAt) / DAY_MS))
}

/** Holds at least `days` old (counted from the moment, not the day), oldest first. */
export function overdueHolds(held: readonly HeldExpense[], now: number, days: number = HOLD_NUDGE_DAYS): HeldExpense[] {
  return held.filter((h) => daysHeld(h.heldAt, now) >= days).sort((a, b) => a.heldAt - b.heldAt || a.expense.title.localeCompare(b.expense.title))
}
