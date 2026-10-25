/**
 * This month's rent as a pay link where the landlord is the one collecting: each flatmate opens
 * it, taps their name and pays their own share straight to the landlord's UPI ID, with the amount
 * already filled in. Nobody fronts the whole rent and chases the others, and every flatmate has
 * their own payment to the landlord — the trail an HRA claim leans on.
 */
import type { Friend, Profile } from '../../domain/types'
import { encodePayLink, payLinkFor, type PayLinkPayload } from '../../share/payLink'
import { outsideName } from '../../share/names'
import { personFallback } from '../../share/fallbacks'
import { dayOf, shortMonthName } from './hra'
import type { Rent } from './store'

type FriendsById = Readonly<Record<string, Friend>>

/** A flatmate's name as others see it (never "You"). */
export function tenantName(friendId: string, index: number, friendsById: FriendsById, profile: Pick<Profile, 'name'>): string {
  return outsideName(friendId, friendsById, profile, personFallback(index + 1))
}

/** The pay-link payload for `month`'s rent (`YYYY-MM`). */
export function rentPayLinkPayload(rent: Rent, month: string, friendsById: FriendsById, profile: Pick<Profile, 'name'>): PayLinkPayload {
  return payLinkFor({
    v: 1,
    t: `Rent · ${shortMonthName(month)} · ${rent.name}`,
    cat: 'rent',
    c: 'INR',
    d: dayOf(month, rent.dueDay),
    to: { n: rent.landlordName, u: rent.landlordUpi },
    tot: rent.monthly,
    p: rent.tenants.map((t, i) => ({ n: tenantName(t.friendId, i, friendsById, profile), a: t.share })),
  })
}

/** The link itself, ready to send to the flat's group chat. */
export function rentPayLink(rent: Rent, month: string, friendsById: FriendsById, profile: Pick<Profile, 'name'>, origin?: string): Promise<string> {
  return encodePayLink(rentPayLinkPayload(rent, month, friendsById, profile), origin)
}
