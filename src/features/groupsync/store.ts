/**
 * What this phone remembers about each group it shares: the shared group's id and secret, which
 * member is you, which of your people each member is, and what the last copy said — so the next
 * one only carries what changed here. On the phone, like everything else.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'

export const GROUP_SYNC_KEY = 'settle.v8.group-sync'

/** A member as the last copy had them, and as this phone showed them then (to tell an edit made here). */
export interface MemberSeen {
  n: string
  u: string | null
  c: number
  v: number
  j: number
  /** The name and UPI ID this phone had for them when that copy was applied. */
  ln: string
  lu: string | null
}

export interface SharedGroup {
  /** This phone's group. */
  groupId: string
  /** The shared group's id (the same on every phone). */
  id: string
  /** The secret from the invite link: it encrypts every copy and names the group's place on the server. */
  key: string
  /** Which member is you. */
  me: string
  /** Member id → your person (ME for you). */
  members: Record<string, string>
  seen: Record<string, MemberSeen>
  /** The group's name, emoji and kind as last sent, with their version. */
  meta: { n: string; e: string; k: string; u: number }
  /** Deleted things (id → when). */
  gone: Record<string, number>
  /** Things brought back after a deletion here (id → when): their version from then on. */
  revived: Record<string, number>
  /** Ids of the expenses, payments and members in the last copy: one missing now was deleted here. */
  known: string[]
  /** Who added each expense (expense id → member id). */
  by: Record<string, string>
  createdAt: number
  /** The last copy sent out as a link, and when (null: never). */
  sent: { at: number; hash: string } | null
  /** The last copy the server and this phone agreed on, and when (null: never). */
  synced: { at: number; hash: string } | null
}

export type GroupSyncState = Record<string, SharedGroup>

const stamps = z.record(z.string(), z.number())
const seenSchema = z.object({ n: z.string(), u: z.nullable(z.string()), c: z.number(), v: z.number(), j: z.number(), ln: z.string(), lu: z.nullable(z.string()) })
const mark = z.catch(z.nullable(z.object({ at: z.number(), hash: z.string() })), null)
const sharedSchema = z.object({
  groupId: z.string().check(z.minLength(1)),
  id: z.string().check(z.minLength(4)),
  key: z.string().check(z.minLength(16)),
  me: z.string().check(z.minLength(4)),
  members: z.record(z.string(), z.string()),
  seen: z.catch(z.record(z.string(), seenSchema), {}),
  meta: z.object({ n: z.string(), e: z.string(), k: z.string(), u: z.number() }),
  gone: z.catch(stamps, {}),
  revived: z.catch(stamps, {}),
  known: z.catch(z.array(z.string()), []),
  by: z.catch(z.record(z.string(), z.string()), {}),
  createdAt: z.catch(z.number(), 0),
  sent: mark,
  synced: mark,
})

/** Each group's record on its own: one damaged record never takes the others with it. */
export const groupSyncSchema: z.core.$ZodType<GroupSyncState> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw) => {
    const out: GroupSyncState = {}
    for (const [groupId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(sharedSchema, value)
      if (parsed.success && parsed.data.groupId === groupId) out[groupId] = parsed.data
    }
    return out
  }),
) as unknown as z.core.$ZodType<GroupSyncState>

export const groupSyncStore = createStore<GroupSyncState>({
  key: GROUP_SYNC_KEY,
  schema: groupSyncSchema,
  initial: () => ({}),
  version: 1,
})

/** This phone's record for a shared group, or null when the group isn't shared. */
export function useShared(groupId: string | null | undefined): SharedGroup | null {
  return useStore(groupSyncStore, (state) => (groupId ? (state[groupId] ?? null) : null))
}

export function sharedFor(groupId: string): SharedGroup | null {
  return groupSyncStore.get()[groupId] ?? null
}

/** The local group that is shared group `id`, or null. */
export function sharedById(id: string): SharedGroup | null {
  return Object.values(groupSyncStore.get()).find((s) => s.id === id) ?? null
}

export function putShared(shared: SharedGroup): void {
  groupSyncStore.update((state) => ({ ...state, [shared.groupId]: shared }))
}

/** Stops sharing a group on this phone (the group and its expenses stay). */
export function dropShared(groupId: string): void {
  groupSyncStore.update((state) => {
    if (!(groupId in state)) return state
    const next = { ...state }
    delete next[groupId]
    return next
  })
}
