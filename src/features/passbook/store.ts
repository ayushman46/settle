/**
 * The little the Statement keeps on this phone: which dates you last looked at (this month, three
 * months, everything). The statement itself is always worked out from the app's own expenses and
 * payments, so it can never disagree with them.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { PASSBOOK_RANGES, type PassbookRange } from './engine'

export interface PassbookState {
  /** The dates last picked, or null when none has been (the screen then chooses by how long the history is). */
  range: PassbookRange | null
}

export const passbookSchema = z.object({
  range: z.catch(z.nullable(z.enum(PASSBOOK_RANGES)), null),
})

export const passbookStore = createStore<PassbookState>({
  key: STORAGE_KEYS.passbook,
  schema: passbookSchema,
  initial: () => ({ range: null }),
  version: 1,
})

export function usePassbookRange(): PassbookRange | null {
  return useStore(passbookStore, (state) => state.range)
}

/** Remembers the dates picked. Anything that isn't one of the three is ignored. */
export function setPassbookRange(range: PassbookRange): void {
  if (!(PASSBOOK_RANGES as readonly string[]).includes(range)) return
  const state = passbookStore.get()
  if (state.range === range) return
  passbookStore.set({ ...state, range })
}
