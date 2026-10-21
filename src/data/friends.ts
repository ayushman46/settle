/** People you split with. The owner (ME) is always first and can't be removed. */
import { ME_ID, type Friend } from '../domain/types'
import { groupBalances, isSettledInGroup } from '../engine/balances'
import { newId } from '../lib/ids'
import { nameKey, nextColor, normalizeName } from '../lib/people'
import { AVATAR_COLORS } from '../types'
import { DataError } from './errors'
import { patchUpiId, updateProfile } from './profile'
import { cleanPhone, cleanUpiId, MAX_FRIENDS } from './schemas'
import { expensesStore, friendsStore, groupsStore, recurringStore } from './stores'

/** A friend (never ME) whose name matches ignoring case and accents, or null. */
export function findFriendByName(name: string, friends: readonly Friend[] = friendsStore.get()): Friend | null {
  const key = nameKey(name)
  if (!key) return null
  return friends.find((f) => f.id !== ME_ID && nameKey(f.name) === key) ?? null
}

/**
 * Adds someone, or returns the existing friend with the same name (filling in a UPI ID or phone
 * they didn't have yet). Throws DataError 'empty_name' or 'limit' (200 people).
 */
export function addFriend(input: { name: string; upiId?: string | null; phone?: string | null }): Friend {
  const name = normalizeName(input.name)
  if (!name) throw new DataError('empty_name')
  const friends = friendsStore.get()
  const upiId = cleanUpiId(input.upiId)
  const phone = cleanPhone(input.phone)

  const existing = findFriendByName(name, friends)
  if (existing) {
    const fill: Partial<Friend> = {}
    if (upiId && !existing.upiId) fill.upiId = upiId
    if (phone && !existing.phone) fill.phone = phone
    if (Object.keys(fill).length === 0) return existing
    const updated = { ...existing, ...fill }
    friendsStore.set(friends.map((f) => (f.id === existing.id ? updated : f)))
    return updated
  }

  if (friends.filter((f) => f.id !== ME_ID).length >= MAX_FRIENDS) throw new DataError('limit')
  const now = Date.now()
  const friend: Friend = {
    id: newId(),
    name,
    color: nextColor(friends.filter((f) => f.id !== ME_ID)),
    upiId,
    phone,
    createdAt: now,
    lastUsedAt: now,
  }
  friendsStore.set([...friends, friend])
  return friend
}

/**
 * Edits a friend. A blank name keeps the old one; a name another friend already has throws
 * DataError 'duplicate_name'. Editing ME updates the profile too.
 */
export function updateFriend(id: string, patch: Partial<Pick<Friend, 'name' | 'upiId' | 'phone' | 'color'>>): Friend {
  const friends = friendsStore.get()
  const prev = friends.find((f) => f.id === id)
  if (!prev) throw new DataError('not_found')

  let name = prev.name
  if (patch.name !== undefined) {
    const cleaned = normalizeName(patch.name)
    if (cleaned) {
      const clash = findFriendByName(cleaned, friends)
      if (id !== ME_ID && clash && clash.id !== id) throw new DataError('duplicate_name')
      name = cleaned
    }
  }
  const next: Friend = {
    ...prev,
    name,
    upiId: patchUpiId(prev.upiId, patch.upiId),
    phone: patch.phone === undefined ? prev.phone : cleanPhone(patch.phone),
    color:
      typeof patch.color === 'number' && Number.isInteger(patch.color) && patch.color >= 0 && patch.color < AVATAR_COLORS
        ? patch.color
        : prev.color,
  }
  if (id === ME_ID) {
    // The profile is the source of truth for the owner's name and UPI ID.
    updateProfile({ name: next.name, upiId: next.upiId })
    const synced = friendsStore.get().find((f) => f.id === ME_ID) ?? next
    const withRest = { ...synced, phone: next.phone, color: next.color }
    friendsStore.set(friendsStore.get().map((f) => (f.id === ME_ID ? withRest : f)))
    return withRest
  }
  friendsStore.set(friends.map((f) => (f.id === id ? next : f)))
  return next
}

/**
 * True while `id` has money outstanding anywhere: an unsettled balance in a group, an unpaid
 * share of a standalone expense (either way), or an active recurring split.
 */
export function isFriendInUse(id: string): boolean {
  const expenses = expensesStore.get()
  const groups = groupsStore.get()
  for (const group of groups) {
    if ((groupBalances(group, expenses)[id] ?? 0) !== 0) return true
  }
  for (const e of expenses) {
    if (isSettledInGroup(e, groups)) continue
    if (e.payerId === id) {
      const unpaid = Object.entries(e.shares).some(([who, share]) => who !== id && share > 0 && e.paidBack[who] === undefined)
      if (unpaid) return true
    } else if ((e.shares[id] ?? 0) > 0 && e.paidBack[id] === undefined) {
      return true
    }
  }
  return recurringStore
    .get()
    .some((r) => r.active && (r.payerId === id || r.participants.some((p) => p.friendId === id)))
}

/** Removes a friend unless it's you or they still have money outstanding. Also leaves their groups. */
export function removeFriend(id: string): { ok: boolean; reason?: 'is_me' | 'in_use' } {
  if (id === ME_ID) return { ok: false, reason: 'is_me' }
  if (!friendsStore.get().some((f) => f.id === id)) return { ok: true }
  if (isFriendInUse(id)) return { ok: false, reason: 'in_use' }
  friendsStore.update((friends) => friends.filter((f) => f.id !== id))
  groupsStore.update((groups) =>
    groups.some((g) => g.memberIds.includes(id))
      ? groups.map((g) => (g.memberIds.includes(id) ? { ...g, memberIds: g.memberIds.filter((m) => m !== id) } : g))
      : groups,
  )
  return { ok: true }
}

/** Marks people as just used, so they float to the top of "Frequent". */
export function touchFriends(ids: readonly string[], now = Date.now()): void {
  const wanted = new Set(ids)
  if (wanted.size === 0) return
  friendsStore.update((friends) => {
    let changed = false
    const next = friends.map((f) => {
      if (!wanted.has(f.id) || f.lastUsedAt >= now) return f
      changed = true
      return { ...f, lastUsedAt: now }
    })
    return changed ? next : friends
  })
}
