/**
 * The little Friend abroad keeps on this phone: per friend, the currency they use and how they
 * pay or get paid; and, for each "I've paid", what it cleared and what it cost you. What is owed
 * always comes from the app's own balances.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { ABROAD_SERVICES, MAX_OTHER_NOTE, type AbroadSetup } from './engine'

/** One "I've paid" to a friend abroad. */
export interface AbroadSent {
  id: string
  friendId: string
  /** What it cleared of what you owed, in `currency`'s minor units. */
  settled: number
  /** What it cost you (fee and the bank's rate included), in `currency`'s minor units. */
  cost: number
  currency: string
  /** What that was in their currency at the day's reference rate, or null when there was no rate. */
  theirAmount: number | null
  theirCurrency: string
  /** YYYY-MM-DD. */
  date: string
  createdAt: number
}

export interface AbroadState {
  /** Friend id → how they're set up. */
  friends: Record<string, AbroadSetup>
  /** Newest first. */
  sent: AbroadSent[]
}

export const MAX_ABROAD_FRIENDS = 200
export const MAX_ABROAD_SENT = 200

const code = z.string().check(z.regex(/^[A-Z]{3}$/))
const id = z.string().check(z.minLength(1), z.maxLength(80))
const money = z.int().check(z.gt(0), z.lte(MAX_MINOR))

const setupSchema = z.object({
  currency: code,
  via: z.catch(z.enum(ABROAD_SERVICES), 'other'),
  handle: z.catch(z.string().check(z.maxLength(MAX_OTHER_NOTE)), ''),
})

const sentSchema = z.object({
  id,
  friendId: id,
  settled: money,
  cost: money,
  currency: code,
  theirAmount: z.catch(z.nullable(money), null),
  theirCurrency: code,
  date: z.string().check(z.refine(isIsoDate)),
  createdAt: z.number().check(z.gte(0)),
})

/** Reads each friend on their own: one unreadable entry is dropped, never the rest. */
const friendsSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, AbroadSetup]> = []
    for (const [friendId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(setupSchema, value)
      if (parsed.success && friendId !== '') read.push([friendId, parsed.data])
    }
    return Object.fromEntries(read.slice(0, MAX_ABROAD_FRIENDS)) as Record<string, AbroadSetup>
  }),
)

const sentListSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: AbroadSent[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(sentSchema, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      seen.add(parsed.data.id)
      read.push(parsed.data)
    }
    read.sort((a, b) => b.createdAt - a.createdAt)
    return read.slice(0, MAX_ABROAD_SENT)
  }),
)

export const abroadSchema = z.object({
  friends: z.catch(friendsSchema, {}),
  sent: z.catch(sentListSchema, []),
})

export const abroadStore = createStore<AbroadState>({
  key: STORAGE_KEYS.abroad,
  schema: abroadSchema,
  initial: () => ({ friends: {}, sent: [] }),
  version: 1,
})

/** How this friend is set up, or null when they aren't marked as living abroad. */
export function useAbroad(friendId: string): AbroadSetup | null {
  return useStore(abroadStore, (state) => state.friends[friendId] ?? null)
}

export function abroadFor(friendId: string): AbroadSetup | null {
  return abroadStore.get().friends[friendId] ?? null
}

/** The last "I've paid" to this friend, or null. */
export function useLastSent(friendId: string): AbroadSent | null {
  return useStore(abroadStore, (state) => state.sent.find((s) => s.friendId === friendId) ?? null)
}

/** Saves (or replaces) how a friend abroad is set up. Something unreadable is ignored. */
export function setAbroad(friendId: string, setup: AbroadSetup): void {
  const parsed = z.safeParse(setupSchema, setup)
  if (!parsed.success || friendId === '') return
  const state = abroadStore.get()
  const friends = { ...state.friends }
  delete friends[friendId]
  const entries = [[friendId, parsed.data] as const, ...Object.entries(friends)].slice(0, MAX_ABROAD_FRIENDS)
  abroadStore.set({ ...state, friends: Object.fromEntries(entries) })
}

/** Forgets that a friend lives abroad. Returns what was saved, for Undo (null when nothing was). */
export function clearAbroad(friendId: string): AbroadSetup | null {
  const state = abroadStore.get()
  const had = state.friends[friendId] ?? null
  if (!had) return null
  const friends = { ...state.friends }
  delete friends[friendId]
  abroadStore.set({ ...state, friends })
  return had
}

/** Keeps what an "I've paid" cleared and cost. */
export function logSent(entry: AbroadSent): void {
  const parsed = z.safeParse(sentSchema, entry)
  if (!parsed.success) return
  const state = abroadStore.get()
  abroadStore.set({ ...state, sent: [parsed.data, ...state.sent.filter((s) => s.id !== parsed.data.id)].slice(0, MAX_ABROAD_SENT) })
}

/** Forgets one (Undo). */
export function removeSent(sentId: string): void {
  const state = abroadStore.get()
  if (!state.sent.some((s) => s.id === sentId)) return
  abroadStore.set({ ...state, sent: state.sent.filter((s) => s.id !== sentId) })
}
