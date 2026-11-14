/**
 * The little the kitty keeps on this phone: per group, who holds it, what each person puts in and
 * the day it started. Everything else (who has put in, what's left) is worked out from the group's
 * own payments and bills, so it never goes stale.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import type { KittyConfig } from './engine'

export interface KittyState {
  /** Group id → its kitty. */
  byGroup: Record<string, KittyConfig>
}

/** At most this many kitties are kept (the newest starts win). */
export const MAX_KITTIES = 100

const configSchema = z.object({
  holderId: z.string().check(z.minLength(1), z.maxLength(80)),
  perHead: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  startedOn: z.string().check(z.refine(isIsoDate)),
})

/** Reads each group's kitty on its own: one unreadable entry is dropped, never the rest. */
const byGroupSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, KittyConfig]> = []
    for (const [groupId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(configSchema, value)
      if (parsed.success) read.push([groupId, parsed.data])
    }
    read.sort((a, b) => (a[1].startedOn < b[1].startedOn ? 1 : a[1].startedOn > b[1].startedOn ? -1 : 0))
    return Object.fromEntries(read.slice(0, MAX_KITTIES)) as Record<string, KittyConfig>
  }),
)

export const kittySchema = z.object({ byGroup: z.catch(byGroupSchema, {}) })

export const kittyStore = createStore<KittyState>({
  key: STORAGE_KEYS.kitty,
  schema: kittySchema,
  initial: () => ({ byGroup: {} }),
  version: 1,
})

/** The group's kitty, or null when it hasn't one. */
export function useKittyConfig(groupId: string): KittyConfig | null {
  return useStore(kittyStore, (state) => state.byGroup[groupId] ?? null)
}

export function kittyConfigFor(groupId: string): KittyConfig | null {
  return kittyStore.get().byGroup[groupId] ?? null
}

/** Starts (or replaces) the group's kitty. Ignores an amount that isn't a positive whole number of paise. */
export function setKitty(groupId: string, config: KittyConfig): void {
  const parsed = z.safeParse(configSchema, config)
  if (!parsed.success) return
  const state = kittyStore.get()
  const byGroup = { ...state.byGroup }
  delete byGroup[groupId]
  const entries = [[groupId, parsed.data] as const, ...Object.entries(byGroup)].slice(0, MAX_KITTIES)
  kittyStore.set({ ...state, byGroup: Object.fromEntries(entries) })
}

/** Ends the group's kitty (only the setting: the payments and bills stay as they are). */
export function endKitty(groupId: string): void {
  const state = kittyStore.get()
  if (!state.byGroup[groupId]) return
  const byGroup = { ...state.byGroup }
  delete byGroup[groupId]
  kittyStore.set({ ...state, byGroup })
}
