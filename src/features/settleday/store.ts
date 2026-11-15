/**
 * The little Settle Day keeps on this phone: per group, the day of the month and the moment it
 * was picked. What is open on the day is always worked out from the group itself.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { cleanSettleDay, MAX_SETTLE_DAY, MIN_SETTLE_DAY, type SettleDay } from './engine'

export interface SettleDayEntry {
  day: SettleDay
  /** When it was picked (ms). A day picked after it had passed is not shown as missed. */
  setAt: number
}

export interface SettleDayState {
  /** Group id → its settle day. */
  byGroup: Record<string, SettleDayEntry>
}

/** At most this many groups keep a settle day (the most recently picked win). */
export const MAX_SETTLE_DAYS = 200

const entrySchema = z.object({
  day: z.union([z.literal('last'), z.int().check(z.gte(MIN_SETTLE_DAY), z.lte(MAX_SETTLE_DAY))]),
  setAt: z.catch(z.int().check(z.gte(0)), 0),
})

/** Reads each group's entry on its own: one unreadable entry is dropped, never the rest. */
const byGroupSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, SettleDayEntry]> = []
    for (const [groupId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(entrySchema, value)
      if (parsed.success && groupId) read.push([groupId, parsed.data])
    }
    read.sort((a, b) => b[1].setAt - a[1].setAt)
    return Object.fromEntries(read.slice(0, MAX_SETTLE_DAYS)) as Record<string, SettleDayEntry>
  }),
)

export const settledaySchema = z.object({ byGroup: z.catch(byGroupSchema, {}) })

export const settledayStore = createStore<SettleDayState>({
  key: STORAGE_KEYS.settleday,
  schema: settledaySchema,
  initial: () => ({ byGroup: {} }),
  version: 1,
})

/** The group's settle day, or null when it hasn't one. */
export function useSettleDayEntry(groupId: string): SettleDayEntry | null {
  return useStore(settledayStore, (state) => state.byGroup[groupId] ?? null)
}

export function settleDayFor(groupId: string): SettleDayEntry | null {
  return settledayStore.get().byGroup[groupId] ?? null
}

/**
 * Sets (or changes) the group's settle day. Returns what was there before, for Undo. Anything
 * that isn't a day is ignored.
 */
export function setSettleDay(groupId: string, day: SettleDay, now: number = Date.now()): SettleDayEntry | null {
  const before = settleDayFor(groupId)
  const clean = cleanSettleDay(day)
  if (clean === null || !groupId) return before
  const state = settledayStore.get()
  const rest = { ...state.byGroup }
  delete rest[groupId]
  const entry: SettleDayEntry = { day: clean, setAt: Number.isSafeInteger(now) && now >= 0 ? now : 0 }
  const entries = [[groupId, entry] as const, ...Object.entries(rest)].slice(0, MAX_SETTLE_DAYS)
  settledayStore.set({ ...state, byGroup: Object.fromEntries(entries) })
  return before
}

/** Takes the group's settle day away. Returns what was there, for Undo. */
export function clearSettleDay(groupId: string): SettleDayEntry | null {
  const state = settledayStore.get()
  const before = state.byGroup[groupId] ?? null
  if (!before) return null
  const byGroup = { ...state.byGroup }
  delete byGroup[groupId]
  settledayStore.set({ ...state, byGroup })
  return before
}

/** Undo for the two above: puts back exactly what was there (nothing, or the earlier day and when it was picked). */
export function restoreSettleDay(groupId: string, before: SettleDayEntry | null): void {
  const state = settledayStore.get()
  const byGroup = { ...state.byGroup }
  if (before) byGroup[groupId] = before
  else delete byGroup[groupId]
  settledayStore.set({ ...state, byGroup })
}
