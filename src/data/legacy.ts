/**
 * Bringing people over from BillSplit v2, and finishing onboarding.
 *
 * v2 had no "me": the owner typed their own name onto every bill like anyone else, and the UPI
 * IDs it remembered were usually the owner's (the payer). So names become friends once, and when
 * the owner later tells us their name in onboarding, the friend that turns out to be them is
 * folded back into their profile (with that UPI ID).
 */
import { ME_ID, type Profile } from '../domain/types'
import { RECENT_NAMES_KEY, getRecentNames } from '../lib/recent'
import { nameKey, normalizeName } from '../lib/people'
import { getSavedUpiId, LEGACY_UPI_ID_KEY, normalizeUpiId, UPI_ID_PATTERN, UPI_IDS_KEY } from '../lib/upi'
import { addFriend } from './friends'
import { updateProfile } from './profile'
import { localStore } from './store'
import { expensesStore, friendsStore, groupsStore, profileStore, recurringStore } from './stores'

/** Set once the v2 data has been brought over: `{ v: 1, at, friendIds }`. */
export const MIGRATION_KEY = 'settle.v3.migrated'

/** Keys of the old app that "Clear all data" also removes (the in-progress bill draft is not one). */
export const LEGACY_KEYS: readonly string[] = [RECENT_NAMES_KEY, UPI_IDS_KEY, LEGACY_UPI_ID_KEY, MIGRATION_KEY]

interface MigrationMarker {
  v: 1
  at: number
  friendIds: string[]
}

function readMarker(): MigrationMarker | null {
  try {
    const raw = localStore()?.getItem(MIGRATION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { v: 1, at: 0, friendIds: [] }
    const ids = (parsed as { friendIds?: unknown }).friendIds
    return {
      v: 1,
      at: Number((parsed as { at?: unknown }).at) || 0,
      friendIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [],
    }
  } catch {
    // Unreadable marker: assume migration already ran rather than importing twice.
    return { v: 1, at: 0, friendIds: [] }
  }
}

function writeMarker(marker: MigrationMarker): boolean {
  try {
    const storage = localStore()
    if (!storage) return false
    storage.setItem(MIGRATION_KEY, JSON.stringify(marker))
    return true
  } catch {
    return false
  }
}

/** v2's remembered UPI IDs: `[nameKey, vpa]`, valid ones only. */
function legacyUpiIds(): Array<[string, string]> {
  try {
    const raw = localStore()?.getItem(UPI_IDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: Array<[string, string]> = []
    for (const entry of parsed) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') continue
      const vpa = normalizeUpiId(entry[1])
      if (entry[0] && UPI_ID_PATTERN.test(vpa)) out.push([entry[0], vpa])
    }
    return out
  } catch {
    return []
  }
}

/** The UPI ID v2 remembered for `name`, if any — for prefilling onboarding. Never throws. */
export function legacyUpiIdFor(name: string): string | null {
  return getSavedUpiId(name)
}

/**
 * Brings v2 data over, once: recent names become friends (most recent first) and remembered UPI
 * IDs go onto the matching friend (or the profile, when the name is the owner's). Idempotent and
 * safe to call on every start; never touches the in-progress bill draft. Never throws.
 */
export function migrateLegacy(): void {
  if (!localStore() || readMarker() !== null) return
  const friendIds: string[] = []
  try {
    const profile = profileStore.get()
    const ownKey = profile.onboarded ? nameKey(profile.name) : ''
    const now = Date.now()
    getRecentNames().forEach((name, index) => {
      if (ownKey && nameKey(name) === ownKey) return
      const before = friendsStore.get()
      const friend = addFriend({ name })
      if (before.some((f) => f.id === friend.id)) return
      friendIds.push(friend.id)
      // Keep v2's recency order, just behind anyone used in Settle itself.
      const lastUsedAt = now - (index + 1) * 60_000
      friendsStore.update((list) => list.map((f) => (f.id === friend.id ? { ...f, lastUsedAt, createdAt: lastUsedAt } : f)))
    })

    for (const [key, vpa] of legacyUpiIds()) {
      if (ownKey && key === ownKey) {
        if (!profileStore.get().upiId) updateProfile({ upiId: vpa })
        continue
      }
      friendsStore.update((list) => {
        const index = list.findIndex((f) => f.id !== ME_ID && nameKey(f.name) === key && !f.upiId)
        if (index === -1) return list
        return list.map((f, i) => (i === index ? { ...f, upiId: vpa } : f))
      })
    }
  } catch {
    // A friend limit or blocked storage: keep whatever made it across.
  }
  writeMarker({ v: 1, at: Date.now(), friendIds })
}

function isReferenced(id: string): boolean {
  return (
    expensesStore.get().some((e) => e.payerId === id || e.participants.some((p) => p.friendId === id)) ||
    groupsStore.get().some((g) => g.memberIds.includes(id)) ||
    recurringStore.get().some((r) => r.payerId === id || r.participants.some((p) => p.friendId === id))
  )
}

/**
 * Finishes onboarding. `upiId`: a value sets it, null means none; left out, a UPI ID v2 kept
 * for this name is adopted. A friend migrated from v2 under the owner's own name (and not used
 * since) is folded into the profile.
 */
export function completeOnboarding(input: { name: string; upiId?: string | null; currency?: string }): Profile {
  const name = normalizeName(input.name ?? '')
  const key = nameKey(name)
  let adoptedUpi: string | null = null
  if (key) {
    const migrated = new Set(readMarker()?.friendIds ?? [])
    const self = friendsStore.get().find((f) => migrated.has(f.id) && nameKey(f.name) === key)
    if (self && !isReferenced(self.id)) {
      adoptedUpi = self.upiId
      friendsStore.update((list) => list.filter((f) => f.id !== self.id))
    }
    adoptedUpi = adoptedUpi ?? legacyUpiIdFor(name)
  }
  const patch: Partial<Profile> = { name, onboarded: true }
  if (input.upiId !== undefined) patch.upiId = input.upiId
  else if (adoptedUpi) patch.upiId = adoptedUpi
  if (input.currency !== undefined) patch.currency = input.currency
  return updateProfile(patch)
}
