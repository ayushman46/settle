/**
 * The little Pay it forward keeps on this phone: suggestions you put away (by pair and amount,
 * so the same pair with a new amount is suggested again). Everything else comes from balances.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'

export interface SwapState {
  /** `swapKey`s put away, oldest first. */
  dismissed: string[]
}

const MAX_DISMISSED = 100

export const swapSchema = z.object({
  dismissed: z.catch(z.array(z.string().check(z.maxLength(300))), []),
})

export const swapStore = createStore<SwapState>({
  key: STORAGE_KEYS.swap,
  schema: swapSchema,
  initial: () => ({ dismissed: [] }),
  version: 1,
})

export function useDismissedSwaps(): readonly string[] {
  return useStore(swapStore, (state) => state.dismissed)
}

/** Puts a suggestion away. */
export function dismissSwap(key: string): void {
  const state = swapStore.get()
  if (state.dismissed.includes(key)) return
  swapStore.set({ ...state, dismissed: [...state.dismissed, key].slice(-MAX_DISMISSED) })
}

/** Brings a suggestion back (Undo). */
export function restoreSwap(key: string): void {
  const state = swapStore.get()
  if (!state.dismissed.includes(key)) return
  swapStore.set({ ...state, dismissed: state.dismissed.filter((k) => k !== key) })
}
