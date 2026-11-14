/**
 * What this phone remembers about who was there when: per group, each person's first and last day
 * (both optional), and the fix-ups you said to leave alone (so the banner doesn't ask again).
 * Everything else is worked out from the group's expenses.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import type { Stay } from './engine'

export interface PresenceState {
  /** Group → friend → stay. */
  stays: Record<string, Record<string, Stay>>
  /** Group → `fixUpKey`s said to be left alone. */
  declined: Record<string, string[]>
}

const MAX_GROUPS = 100
const MAX_PEOPLE = 100
const MAX_DECLINED = 300
const MAX_ID = 80

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: string): boolean => v.length > 0 && v.length <= MAX_ID

function cleanStay(raw: unknown): Stay | null {
  if (!isObject(raw)) return null
  const from = isIsoDate(raw.from) ? raw.from : null
  const to = isIsoDate(raw.to) ? raw.to : null
  if (from === null && to === null) return null
  if (from !== null && to !== null && from > to) return null
  return { from, to }
}

/** Keeps whatever it can read, drops the rest, one record at a time. */
export function cleanPresence(raw: unknown): PresenceState {
  const out: PresenceState = { stays: {}, declined: {} }
  if (!isObject(raw)) return out
  if (isObject(raw.stays)) {
    for (const [groupId, people] of Object.entries(raw.stays).slice(0, MAX_GROUPS)) {
      if (!isId(groupId) || !isObject(people)) continue
      const kept: Record<string, Stay> = {}
      for (const [friendId, stay] of Object.entries(people).slice(0, MAX_PEOPLE)) {
        const s = isId(friendId) ? cleanStay(stay) : null
        if (s) kept[friendId] = s
      }
      if (Object.keys(kept).length > 0) out.stays[groupId] = kept
    }
  }
  if (isObject(raw.declined)) {
    for (const [groupId, keys] of Object.entries(raw.declined).slice(0, MAX_GROUPS)) {
      if (!isId(groupId) || !Array.isArray(keys)) continue
      const kept = keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 2 * MAX_ID + 1).slice(-MAX_DECLINED)
      if (kept.length > 0) out.declined[groupId] = kept
    }
  }
  return out
}

export const presenceSchema = z.pipe(z.unknown(), z.transform(cleanPresence))

export const presenceStore = createStore<PresenceState>({
  key: STORAGE_KEYS.presence,
  schema: presenceSchema,
  initial: () => ({ stays: {}, declined: {} }),
  version: 1,
})

const NO_STAYS: Readonly<Record<string, Stay>> = {}
const NONE: readonly string[] = []

/** One group's stays (friend → stay). */
export function useStays(groupId: string | null | undefined): Readonly<Record<string, Stay>> {
  return useStore(presenceStore, (state) => (groupId ? (state.stays[groupId] ?? NO_STAYS) : NO_STAYS))
}

/** One group's fix-ups said to be left alone. */
export function useDeclined(groupId: string): readonly string[] {
  return useStore(presenceStore, (state) => state.declined[groupId] ?? NONE)
}

/** Sets one person's stay in a group; both null (or an impossible range) clears it. */
export function setStay(groupId: string, friendId: string, stay: Stay): void {
  if (!isId(groupId) || !isId(friendId)) return
  const state = presenceStore.get()
  const people = { ...state.stays[groupId] }
  const clean = cleanStay(stay)
  if (clean) people[friendId] = clean
  else delete people[friendId]
  const stays = { ...state.stays }
  if (Object.keys(people).length > 0) stays[groupId] = people
  else delete stays[groupId]
  presenceStore.set({ ...state, stays })
}

/** Remembers fix-ups the user said to leave alone. */
export function decline(groupId: string, keys: readonly string[]): void {
  if (!isId(groupId) || keys.length === 0) return
  const state = presenceStore.get()
  const had = state.declined[groupId] ?? []
  const next = [...had, ...keys.filter((k) => !had.includes(k))].slice(-MAX_DECLINED)
  presenceStore.set({
    ...state,
    declined: { ...state.declined, [groupId]: next },
  })
}

/** Forgets fix-ups said to be left alone (Undo of "Leave them"). */
export function undecline(groupId: string, keys: readonly string[]): void {
  const state = presenceStore.get()
  const had = state.declined[groupId]
  if (!had) return
  const next = had.filter((k) => !keys.includes(k))
  const declined = { ...state.declined }
  if (next.length > 0) declined[groupId] = next
  else delete declined[groupId]
  presenceStore.set({ ...state, declined })
}
