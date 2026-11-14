/**
 * The little the Board keeps on this phone (everything else is worked out from the group itself):
 * a budget you set for a group, and pairs of bills you said are not the same bill twice.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { MAX_MINOR } from '../../lib/money'

export interface PlayState {
  /** Group → budget (paise). */
  budgets: Record<string, number>
  /** Group → pairs said to be different bills (`Duplicate.key`). */
  different: Record<string, string[]>
}

const MAX_PAIRS = 60

export const playSchema = z.object({
  budgets: z.record(z.string(), z.number()),
  different: z.record(z.string(), z.array(z.string())),
})

export const playStore = createStore<PlayState>({
  key: STORAGE_KEYS.play,
  schema: playSchema,
  initial: () => ({ budgets: {}, different: {} }),
  version: 1,
})

const NONE: readonly string[] = []

export function useBudget(groupId: string): number | null {
  return useStore(playStore, (state) => state.budgets[groupId] ?? null)
}

export function useDifferent(groupId: string): readonly string[] {
  return useStore(playStore, (state) => state.different[groupId] ?? NONE)
}

/** Sets the group's budget (paise); null or 0 takes it away. */
export function setBudget(groupId: string, budget: number | null): void {
  const state = playStore.get()
  const budgets = { ...state.budgets }
  if (budget !== null && Number.isSafeInteger(budget) && budget > 0 && budget <= MAX_MINOR) budgets[groupId] = budget
  else delete budgets[groupId]
  playStore.set({ ...state, budgets })
}

/** Remembers that this pair is two different bills. */
export function markDifferent(groupId: string, key: string): void {
  const state = playStore.get()
  const had = state.different[groupId] ?? []
  if (had.includes(key)) return
  playStore.set({ ...state, different: { ...state.different, [groupId]: [...had, key].slice(-MAX_PAIRS) } })
}
