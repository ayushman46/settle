/**
 * What this phone remembers about food and drink: who doesn't drink and who is vegetarian (by
 * friend, so the next bill needs no taps), and for the last few bills, who the app already took
 * off which item (so a person put back by hand stays put, and the banner survives going back a step).
 */
import * as z from 'zod/mini'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import type { DietKind } from './classify'
import { pairKey, type DietPrefs, type Taken } from './engine'

/** One bill's record (by bill draft id). */
export interface DietBill {
  /** When it was last touched (epoch ms): the oldest bills are forgotten first. */
  at: number
  /** Person-on-item pairs (`pairKey`) already handled. */
  handled: string[]
  /** Who was taken off what, with their weight. */
  taken: Taken[]
}

export interface DietState {
  /** Friend → what they don't have. */
  people: Record<string, DietPrefs>
  bills: Record<string, DietBill>
}

const MAX_PEOPLE = 500
const MAX_BILLS = 5
const MAX_PAIRS = 2000

/** A record of `value`s that keeps every entry `value` accepts and drops the rest, up to `max` entries. */
function lenientRecord<T>(value: ZodType<T>, max: number): ZodType<Record<string, T>> {
  return z.pipe(
    z.record(z.string(), z.unknown()),
    z.transform((raw: Record<string, unknown>) => {
      const out: Record<string, T> = {}
      let n = 0
      for (const [key, entry] of Object.entries(raw)) {
        if (n >= max) break
        const parsed = z.safeParse(value, entry)
        if (!parsed.success) continue
        out[key] = parsed.data
        n++
      }
      return out
    }),
  )
}

const prefsSchema: ZodType<DietPrefs> = z.pipe(
  z.object({ noAlcohol: z.optional(z.unknown()), veg: z.optional(z.unknown()) }),
  z.transform((raw): DietPrefs => ({ ...(raw.noAlcohol === true ? { noAlcohol: true } : {}), ...(raw.veg === true ? { veg: true } : {}) })),
)

const billSchema: ZodType<DietBill> = z.object({
  at: z.number(),
  handled: z.array(z.string()).check(z.maxLength(MAX_PAIRS)),
  taken: z.array(z.object({ item: z.string(), person: z.string(), w: z.number() })).check(z.maxLength(MAX_PAIRS)),
})

export const dietSchema = z.object({
  people: z.catch(lenientRecord(prefsSchema, MAX_PEOPLE), {}),
  bills: z.catch(lenientRecord(billSchema, MAX_BILLS), {}),
})

export const dietStore = createStore<DietState>({
  key: STORAGE_KEYS.diet,
  schema: dietSchema,
  initial: () => ({ people: {}, bills: {} }),
  version: 1,
})

const NO_PREFS: Readonly<Record<string, DietPrefs>> = {}

/** Everyone's food and drink, by friend. */
export function useDietPrefs(): Readonly<Record<string, DietPrefs>> {
  return useStore(dietStore, (state) => state.people ?? NO_PREFS)
}

/** One friend's. */
export function useFriendDiet(friendId: string): DietPrefs | null {
  return useStore(dietStore, (state) => state.people[friendId] ?? null)
}

/** This bill's record, or null. */
export function useDietBill(billId: string): DietBill | null {
  return useStore(dietStore, (state) => state.bills[billId] ?? null)
}

/** Remembers (or forgets) that `friendId` doesn't drink / is vegetarian. */
export function setDiet(friendId: string, kind: DietKind, on: boolean): void {
  if (!friendId) return
  const state = dietStore.get()
  const had = state.people[friendId] ?? {}
  const next: DietPrefs = { ...had }
  if (kind === 'alcohol') {
    if (on) next.noAlcohol = true
    else delete next.noAlcohol
  } else if (on) next.veg = true
  else delete next.veg
  const people = { ...state.people }
  if (next.noAlcohol || next.veg) people[friendId] = next
  else delete people[friendId]
  // Full: the person set longest ago makes room (objects keep insertion order).
  const ids = Object.keys(people)
  if (ids.length > MAX_PEOPLE) for (const id of ids.slice(0, ids.length - MAX_PEOPLE)) delete people[id]
  dietStore.set({ ...state, people })
}

/** Changes this bill's record (made if it isn't there), keeping only the newest few bills. */
export function updateDietBill(billId: string, change: (bill: DietBill) => DietBill, now: number = Date.now()): void {
  const state = dietStore.get()
  const before = state.bills[billId] ?? { at: now, handled: [], taken: [] }
  const after = change(before)
  const bill: DietBill = {
    at: now,
    handled: [...new Set(after.handled)].slice(-MAX_PAIRS),
    taken: after.taken.slice(-MAX_PAIRS),
  }
  const bills = { ...state.bills, [billId]: bill }
  const ids = Object.keys(bills).sort((a, b) => (bills[b]?.at ?? 0) - (bills[a]?.at ?? 0))
  for (const id of ids.slice(MAX_BILLS)) delete bills[id]
  dietStore.set({ ...state, bills })
}

/** The bill's pairs for this person on these items, as keys. */
export function pairsFor(personId: string, itemIds: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const itemId of itemIds) out.add(pairKey(itemId, personId))
  return out
}
