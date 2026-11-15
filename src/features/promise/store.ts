/**
 * The promises noted on this phone: who promised whom how much by when, what was owed at that
 * moment, and how each one ended. Whether a promise is kept is always worked out from the app's
 * own payments.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import type { PromiseEntry } from './engine'

export interface PromiseBook {
  promises: PromiseEntry[]
}

/** At most this many promises are kept: the ones still open first, then the newest. */
export const MAX_PROMISES = 300

const id = z.string().check(z.minLength(1), z.maxLength(80))

const paidBeforeSchema = z.pipe(
  z.catch(z.record(z.string(), z.unknown()), {}),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_MINOR) out[key] = value
    }
    return out
  }),
)

const entrySchema = z.object({
  id,
  friendId: id,
  direction: z.enum(['pay', 'receive']),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  owedThen: z.catch(z.int().check(z.gte(0), z.lte(MAX_MINOR)), 0),
  due: z.string().check(z.refine(isIsoDate)),
  createdAt: z.int().check(z.gte(0)),
  paidBefore: paidBeforeSchema,
  outcome: z.catch(z.nullable(z.enum(['kept', 'broken'])), null),
  closedAt: z.catch(z.nullable(z.int().check(z.gte(0))), null),
})

function capped(list: readonly PromiseEntry[]): PromiseEntry[] {
  if (list.length <= MAX_PROMISES) return [...list]
  const order = [...list].sort((a, b) => Number(a.outcome !== null) - Number(b.outcome !== null) || b.createdAt - a.createdAt)
  const keep = new Set(order.slice(0, MAX_PROMISES).map((p) => p.id))
  return list.filter((p) => keep.has(p.id))
}

/** Reads each promise on its own: one unreadable entry is dropped, never the rest. Two with one id: the first stays. */
const listSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: PromiseEntry[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(entrySchema, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      seen.add(parsed.data.id)
      read.push(parsed.data)
    }
    return capped(read)
  }),
)

export const promiseSchema = z.object({ promises: z.catch(listSchema, []) })

export const promiseStore = createStore<PromiseBook>({
  key: STORAGE_KEYS.promise,
  schema: promiseSchema,
  initial: () => ({ promises: [] }),
  version: 1,
})

export function usePromises(): PromiseEntry[] {
  return useStore(promiseStore, (state) => state.promises)
}

export function promisesNow(): PromiseEntry[] {
  return promiseStore.get().promises
}

/** Adds a promise, or puts back one that was removed (in its place in time order). */
export function putPromise(entry: PromiseEntry): void {
  const parsed = z.safeParse(entrySchema, entry)
  if (!parsed.success) return
  const state = promiseStore.get()
  const rest = state.promises.filter((p) => p.id !== entry.id)
  promiseStore.set({ ...state, promises: capped([...rest, parsed.data].sort((a, b) => a.createdAt - b.createdAt)) })
}

/** Removes a promise and returns it (for Undo). */
export function takePromise(promiseId: string): PromiseEntry | null {
  const state = promiseStore.get()
  const entry = state.promises.find((p) => p.id === promiseId) ?? null
  if (!entry) return null
  promiseStore.set({ ...state, promises: state.promises.filter((p) => p.id !== promiseId) })
  return entry
}

/** Swaps the whole list (closing the ones whose date has passed). */
export function setPromises(promises: readonly PromiseEntry[]): void {
  const state = promiseStore.get()
  if (state.promises === promises) return
  promiseStore.set({ ...state, promises: capped(promises) })
}
