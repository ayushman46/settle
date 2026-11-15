/**
 * The little Paid in kind keeps on this phone: for each payment settled with something that isn't
 * money, what it was, and which payment (or which share of a split) it belongs to. The payment
 * itself lives with every other payment; delete it there and its note simply stops showing.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { KIND_WHATS, MAX_KIND_TEXT, type KindEntry } from './engine'

export interface KindState {
  /** Newest first. */
  entries: KindEntry[]
}

/** At most this many are kept (the newest win). */
export const MAX_KIND_ENTRIES = 300
const MAX_REFS = 60

const id = z.string().check(z.minLength(1), z.maxLength(80))

const refSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('payment'), groupId: id, id }),
  z.object({ type: z.literal('share'), expenseId: id, debtorId: id, paidAt: z.nullable(z.number().check(z.gte(0))) }),
])

const entrySchema = z.object({
  id,
  friendId: id,
  direction: z.enum(['in', 'out']),
  what: z.enum(KIND_WHATS),
  text: z.catch(z.nullable(z.string().check(z.maxLength(MAX_KIND_TEXT))), null),
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  date: z.string().check(z.refine(isIsoDate)),
  createdAt: z.number().check(z.gte(0)),
  refs: z.array(refSchema).check(z.minLength(1), z.maxLength(MAX_REFS)),
})

/** Reads each entry on its own: one unreadable entry is dropped, never the rest. */
const entriesSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: KindEntry[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(entrySchema, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      seen.add(parsed.data.id)
      read.push(parsed.data)
    }
    read.sort((a, b) => b.createdAt - a.createdAt)
    return read.slice(0, MAX_KIND_ENTRIES)
  }),
)

export const kindSchema = z.object({ entries: z.catch(entriesSchema, []) })

export const kindStore = createStore<KindState>({
  key: STORAGE_KEYS.kind,
  schema: kindSchema,
  initial: () => ({ entries: [] }),
  version: 1,
})

export function useKindEntries(): readonly KindEntry[] {
  return useStore(kindStore, (state) => state.entries)
}

/** Keeps a payment in kind's note. Something unreadable is ignored. */
export function addKindEntry(entry: KindEntry): void {
  const parsed = z.safeParse(entrySchema, entry)
  if (!parsed.success) return
  const state = kindStore.get()
  const rest = state.entries.filter((e) => e.id !== parsed.data.id)
  kindStore.set({ ...state, entries: [parsed.data, ...rest].slice(0, MAX_KIND_ENTRIES) })
}

/** Forgets a note (Undo). */
export function removeKindEntry(entryId: string): void {
  const state = kindStore.get()
  if (!state.entries.some((e) => e.id === entryId)) return
  kindStore.set({ ...state, entries: state.entries.filter((e) => e.id !== entryId) })
}
