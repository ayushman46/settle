/**
 * The one thing "Why this payment?" keeps on this phone: the groups where Settle up shows only
 * what each two people directly owe each other. Everything else is worked out from the group.
 */
import * as z from 'zod/mini'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'

export interface WhyState {
  /** Groups with "Pay only people I actually owe" on. */
  direct: Record<string, true>
}

const MAX_GROUPS = 300

/** Keeps the groups marked exactly `true` (the newest when there are too many), drops anything else. */
const directSchema: ZodType<Record<string, true>> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const ids = Object.keys(raw).filter((id) => id !== '' && raw[id] === true)
    const out: Record<string, true> = {}
    for (const id of ids.slice(-MAX_GROUPS)) out[id] = true
    return out
  }),
)

export const whySchema = z.object({ direct: z.catch(directSchema, {}) })

export const whyStore = createStore<WhyState>({
  key: STORAGE_KEYS.why,
  schema: whySchema,
  initial: () => ({ direct: {} }),
  version: 1,
})

/** Whether the group settles only between people who directly owe each other. */
export function useDirectMode(groupId: string | null | undefined): boolean {
  return useStore(whyStore, (state) => (groupId ? state.direct[groupId] === true : false))
}

/** Same, outside React. */
export function isDirectMode(groupId: string | null | undefined): boolean {
  return groupId ? whyStore.get().direct[groupId] === true : false
}

/** Turns "Pay only people I actually owe" on or off for a group. */
export function setDirectMode(groupId: string, on: boolean): void {
  if (!groupId) return
  const state = whyStore.get()
  if ((state.direct[groupId] === true) === on) return
  const direct = { ...state.direct }
  if (on) {
    // Re-added last, so the newest choices are the ones kept.
    delete direct[groupId]
    direct[groupId] = true
    const ids = Object.keys(direct)
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_GROUPS))) delete direct[id]
  } else {
    delete direct[groupId]
  }
  whyStore.set({ ...state, direct })
}
