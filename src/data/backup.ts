/**
 * Backup & restore: everything Settle keeps, as one JSON file the owner controls. Restoring can
 * replace what's here or merge into it (people matched by name, newer edits win).
 */
import * as z from 'zod/mini'
import { ME_ID, type Expense, type Friend, type Group, type Profile, type RecurringTemplate } from '../domain/types'
import { nameKey } from '../lib/people'
import { clearSplitPrefill } from './handoff'
import { syncMeFriend } from './profile'
import {
  expensesSchema,
  friendsSchema,
  groupsSchema,
  MAX_FRIENDS,
  profileSchema,
  recurringListSchema,
  withMe,
} from './schemas'
import { flushAllStores, localStore } from './store'
import { expensesStore, friendsStore, groupsStore, profileStore, recurringStore, STORAGE_KEYS } from './stores'
import { LEGACY_KEYS } from './legacy'

export const BACKUP_VERSION = 3

export interface BackupFile {
  app: 'settle'
  version: 3
  /** ISO 8601 timestamp. */
  exportedAt: string
  profile: Profile
  friends: Friend[]
  expenses: Expense[]
  groups: Group[]
  recurring: RecurringTemplate[]
}

const backupSchema = z.object({
  app: z.literal('settle'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.catch(z.string(), ''),
  profile: profileSchema,
  friends: z.catch(friendsSchema, []),
  expenses: z.catch(expensesSchema, []),
  groups: z.catch(groupsSchema, []),
  recurring: z.catch(recurringListSchema, []),
})

export function exportBackup(): BackupFile {
  return {
    app: 'settle',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profileStore.get(),
    friends: friendsStore.get(),
    expenses: expensesStore.get(),
    groups: groupsStore.get(),
    recurring: recurringStore.get(),
  }
}

/** A validated backup from parsed JSON (or the raw file text), or null if it isn't one. Never throws. */
export function parseBackup(json: unknown): BackupFile | null {
  let value = json
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json)
    } catch {
      return null
    }
  }
  const parsed = z.safeParse(backupSchema, value)
  if (!parsed.success) return null
  const data = parsed.data
  return {
    app: 'settle',
    version: BACKUP_VERSION,
    exportedAt: data.exportedAt,
    profile: data.profile,
    friends: withMe(data.friends),
    expenses: data.expenses,
    groups: data.groups,
    recurring: data.recurring,
  }
}

/* ------------------------------------------------------------------ merge helpers */

type IdMap = ReadonlyMap<string, string>

function remapRecord<V>(record: Readonly<Record<string, V>>, map: IdMap): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [id, v] of Object.entries(record)) out[map.get(id) ?? id] = v
  return out
}

function remapExpense(e: Expense, map: IdMap): Expense {
  if (map.size === 0) return e
  const id = (x: string) => map.get(x) ?? x
  return {
    ...e,
    payerId: id(e.payerId),
    participants: e.participants.map((p) => ({ ...p, friendId: id(p.friendId) })),
    shares: remapRecord(e.shares, map),
    paidBack: remapRecord(e.paidBack, map),
    bill: e.bill && {
      ...e.bill,
      assignments: Object.fromEntries(Object.entries(e.bill.assignments).map(([item, shares]) => [item, remapRecord(shares, map)])),
    },
  }
}

function remapGroup(g: Group, map: IdMap): Group {
  if (map.size === 0) return g
  const id = (x: string) => map.get(x) ?? x
  return {
    ...g,
    memberIds: [...new Set(g.memberIds.map(id))],
    settlements: g.settlements.map((s) => ({ ...s, fromId: id(s.fromId), toId: id(s.toId) })),
  }
}

function remapRecurring(r: RecurringTemplate, map: IdMap): RecurringTemplate {
  if (map.size === 0) return r
  const id = (x: string) => map.get(x) ?? x
  return { ...r, payerId: id(r.payerId), participants: r.participants.map((p) => ({ ...p, friendId: id(p.friendId) })) }
}

/** Upserts by id; an incoming record replaces the local one only when `isNewer` says so. */
function mergeById<T extends { id: string }>(
  local: readonly T[],
  incoming: readonly T[],
  isNewer: (incoming: T, local: T) => T | null,
): { list: T[]; added: number; updated: number } {
  const byId = new Map(local.map((x) => [x.id, x]))
  const additions: T[] = []
  let updated = 0
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (!existing) {
      additions.push(item)
      byId.set(item.id, item)
      continue
    }
    const merged = isNewer(item, existing)
    if (merged) {
      byId.set(item.id, merged)
      updated += 1
    }
  }
  const list = [...additions, ...local.map((x) => byId.get(x.id) ?? x)]
  return { list, added: additions.length, updated }
}

/**
 * Restores a backup. 'replace' swaps everything here for the file's contents. 'merge' keeps
 * what's here and adds what's new: people are matched by name, records by id (the newer edit
 * wins), payments are combined. Your profile is only filled in where it's blank.
 */
export function importBackup(file: BackupFile, mode: 'merge' | 'replace'): { added: number; updated: number } {
  if (mode === 'replace') {
    profileStore.set({ ...file.profile })
    friendsStore.set(withMe(file.friends))
    syncMeFriend(file.profile)
    expensesStore.set([...file.expenses])
    groupsStore.set([...file.groups])
    recurringStore.set([...file.recurring])
    clearSplitPrefill()
    flushAllStores()
    const added = file.friends.filter((f) => f.id !== ME_ID).length + file.expenses.length + file.groups.length + file.recurring.length
    return { added, updated: 0 }
  }

  let added = 0
  let updated = 0

  // People: same id, or same name → the same person here.
  const friends = [...friendsStore.get()]
  const idMap = new Map<string, string>()
  for (const incoming of file.friends) {
    if (incoming.id === ME_ID) continue
    const index = friends.findIndex((f) => f.id === incoming.id || (f.id !== ME_ID && nameKey(f.name) === nameKey(incoming.name)))
    const existing = friends[index]
    if (existing) {
      if (existing.id !== incoming.id) idMap.set(incoming.id, existing.id)
      const fill: Partial<Friend> = {}
      if (!existing.upiId && incoming.upiId) fill.upiId = incoming.upiId
      if (!existing.phone && incoming.phone) fill.phone = incoming.phone
      if (incoming.lastUsedAt > existing.lastUsedAt) fill.lastUsedAt = incoming.lastUsedAt
      if (Object.keys(fill).length > 0) {
        friends[index] = { ...existing, ...fill }
        if (fill.upiId || fill.phone) updated += 1
      }
    } else if (friends.length - 1 < MAX_FRIENDS) {
      friends.push(incoming)
      added += 1
    }
  }
  friendsStore.set(withMe(friends))

  const profile = profileStore.get()
  const nextProfile: Profile = {
    ...profile,
    name: profile.name || file.profile.name,
    upiId: profile.upiId ?? file.profile.upiId,
    onboarded: profile.onboarded || file.profile.onboarded,
  }
  if (nextProfile.name !== profile.name || nextProfile.upiId !== profile.upiId || nextProfile.onboarded !== profile.onboarded) {
    profileStore.set(nextProfile)
    syncMeFriend(nextProfile)
  }

  const expenses = mergeById(expensesStore.get(), file.expenses.map((e) => remapExpense(e, idMap)), (inc, loc) =>
    inc.updatedAt > loc.updatedAt ? inc : null,
  )
  expensesStore.set(expenses.list)

  const groups = mergeById(groupsStore.get(), file.groups.map((g) => remapGroup(g, idMap)), (inc, loc) => {
    const known = new Set(loc.settlements.map((s) => s.id))
    const extra = inc.settlements.filter((s) => !known.has(s.id))
    if (inc.updatedAt <= loc.updatedAt && extra.length === 0) return null
    const base = inc.updatedAt > loc.updatedAt ? inc : loc
    const settlements = [...loc.settlements, ...extra]
    return { ...base, memberIds: [...new Set([...base.memberIds, ...loc.memberIds, ...inc.memberIds])], settlements }
  })
  groupsStore.set(groups.list)

  const recurring = mergeById(recurringStore.get(), file.recurring.map((r) => remapRecurring(r, idMap)), (inc, loc) =>
    inc.lastCreatedPeriod !== null && (loc.lastCreatedPeriod === null || inc.lastCreatedPeriod > loc.lastCreatedPeriod)
      ? { ...loc, lastCreatedPeriod: inc.lastCreatedPeriod }
      : null,
  )
  recurringStore.set(recurring.list)

  flushAllStores()
  return {
    added: added + expenses.added + groups.added + recurring.added,
    updated: updated + expenses.updated + groups.updated + recurring.updated,
  }
}

/**
 * Wipes everything Settle keeps on this device: profile, people, expenses, groups, recurring
 * splits, and the leftovers of the old BillSplit app. The Pro license (src/pro) and the bill
 * draft (src/features/bill) belong to their own modules and are not touched here.
 */
export function clearAllData(): void {
  const storage = localStore()
  for (const key of [...Object.values(STORAGE_KEYS), ...LEGACY_KEYS]) {
    try {
      storage?.removeItem(key)
    } catch {
      // Blocked storage — the in-memory reset below still applies.
    }
  }
  for (const store of [profileStore, friendsStore, expensesStore, groupsStore, recurringStore]) store.reload()
  clearSplitPrefill()
}
