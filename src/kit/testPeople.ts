/** Test support (never imported by the app): the share-kit fixture people, saved as your people. */
import { friendsStore, groupsStore, updateProfile } from '../data'
import { ME_ID, type Friend, type Group } from '../domain/types'
import { FRIENDS, makeGroup } from '../share/testing'

/**
 * Saves Riya (UPI riya@okicici, phone 98765 43210), Sam and Neha Sharma with their fixture ids
 * — the people on `makeExpense()` — and names the owner Ayush (UPI ayush@okaxis) unless told otherwise.
 */
export function seedPeople(owner: { name?: string; upiId?: string | null } = {}): void {
  updateProfile({ name: owner.name ?? 'Ayush', upiId: owner.upiId === undefined ? 'ayush@okaxis' : owner.upiId })
  const me = friendsStore.get().filter((f) => f.id === ME_ID)
  const others = [FRIENDS.riya, FRIENDS.sam, FRIENDS.neha].filter((f): f is Friend => f !== undefined)
  friendsStore.set([...me, ...others])
}

/** Saves `makeGroup(extra)` (Goa 2026 with everyone) and returns it. */
export function seedGroup(extra: Partial<Group> = {}): Group {
  const group = makeGroup(extra)
  groupsStore.set([...groupsStore.get().filter((g) => g.id !== group.id), group])
  return group
}
