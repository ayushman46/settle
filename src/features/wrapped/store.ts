/**
 * The little the story keeps on this phone: the "looks done" cards put away, with the group's
 * last expense date at the time, so a new burst of spending can bring the card back.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import type { PutAway } from './engine'

export interface WrappedState {
  /** Group → when its card was put away (`at`) and its last expense date then (`last`). */
  putAway: Record<string, { at: string; last: string }>
}

const MAX_PUT_AWAY = 100

export const wrappedSchema = z.object({
  putAway: z.record(z.string(), z.object({ at: z.string(), last: z.string() })),
})

export const wrappedStore = createStore<WrappedState>({
  key: STORAGE_KEYS.wrapped,
  schema: wrappedSchema,
  initial: () => ({ putAway: {} }),
  version: 1,
})

/** The group's card as put away, or null. */
export function usePutAway(groupId: string): PutAway | null {
  return useStore(wrappedStore, (state) => state.putAway[groupId] ?? null)
}

export function usePutAwayAll(): WrappedState['putAway'] {
  return useStore(wrappedStore, (state) => state.putAway)
}

/** Puts the group's card away (on `today`, with its last expense date `last`). Returns what was there before, for Undo. */
export function putAwayCard(groupId: string, today: string, last: string): { at: string; last: string } | null {
  const state = wrappedStore.get()
  const before = state.putAway[groupId] ?? null
  if (!isIsoDate(today) || !isIsoDate(last)) return before
  const entries = Object.entries({ ...state.putAway, [groupId]: { at: today, last } })
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, MAX_PUT_AWAY)
  wrappedStore.set({ ...state, putAway: Object.fromEntries(entries) })
  return before
}

/** Undo: puts back what was there (null: brings the card back). */
export function restorePutAway(groupId: string, before: { at: string; last: string } | null): void {
  const state = wrappedStore.get()
  const putAway = { ...state.putAway }
  if (before) putAway[groupId] = before
  else delete putAway[groupId]
  wrappedStore.set({ ...state, putAway })
}
