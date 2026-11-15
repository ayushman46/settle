/**
 * The bridge into the app's own rent set-up (src/features/rent): when a flat's rent is already
 * set up there with the same people, Fair rent can put its amounts in as each person's share, so
 * the pay link and the receipts use them. Nothing is kept twice: the shares live in the rent store.
 */
import type { Minor } from '../../domain/types'
import { RENT_ENABLED } from '../rent/enabled'
import { rentStore, saveRent, type Rent, type RentInput } from '../rent/store'

/** The rent set-up whose flatmates are exactly these people (the one changed most recently), or null. */
export function matchingRent(rents: readonly Rent[], people: readonly string[]): Rent | null {
  if (!RENT_ENABLED || people.length === 0) return null
  const want = new Set(people)
  const same = rents.filter((r) => r.tenants.length === want.size && r.tenants.every((t) => want.has(t.friendId)))
  return [...same].sort((a, b) => b.updatedAt - a.updatedAt || (a.name < b.name ? -1 : 1))[0] ?? null
}

function inputOf(rent: Rent): RentInput {
  return {
    name: rent.name,
    address: rent.address,
    landlordName: rent.landlordName,
    landlordUpi: rent.landlordUpi,
    landlordPan: rent.landlordPan,
    monthly: rent.monthly,
    dueDay: rent.dueDay,
    mode: rent.mode,
    tenants: rent.tenants.map((t) => ({ ...t })),
  }
}

/** True when the set-up already has exactly these shares. */
export function rentHasShares(rent: Rent, amounts: Readonly<Record<string, Minor>>, total: Minor): boolean {
  return rent.monthly === total && rent.tenants.every((t) => amounts[t.friendId] === t.share)
}

/**
 * Puts the amounts into the rent set-up as its shares (and the total as its monthly rent).
 * Returns the Undo, or null when it could not be done (someone missing, amounts that do not add up).
 */
export function applyToRent(rentId: string, amounts: Readonly<Record<string, Minor>>, total: Minor): (() => void) | null {
  const rent = rentStore.get().find((r) => r.id === rentId)
  if (!rent || rent.tenants.some((t) => amounts[t.friendId] === undefined)) return null
  const before = inputOf(rent)
  const tenants = rent.tenants.map((t) => ({ ...t, share: amounts[t.friendId] ?? 0 }))
  if (tenants.reduce((sum, t) => sum + t.share, 0) !== total) return null
  try {
    saveRent({ ...before, monthly: total, tenants }, rent.id)
  } catch {
    return null
  }
  return () => {
    if (!rentStore.get().some((r) => r.id === rent.id)) return
    try {
      saveRent(before, rent.id, rent.updatedAt)
    } catch {
      // The set-up changed underneath in a way that no longer fits: leave it as it is.
    }
  }
}
