/**
 * The message that asks someone who owes you to pay the person you owe instead: the amount,
 * that person's UPI ID when it's known, and a pay link that opens on the payment (rupees only).
 */
import { ME_ID, type Friend, type Profile } from '../../domain/types'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { encodePayLink, payLinkFor, type PayLinkPayload } from '../../share/payLink'
import { friendFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import type { Swap } from './engine'

type FriendsById = Readonly<Record<string, Friend>>

/** The payee's UPI ID, cleaned, or null when there's no valid one. */
export function swapUpiId(toId: string, friendsById: FriendsById, profile: Pick<Profile, 'upiId'>): string | null {
  const raw = toId === ME_ID ? profile.upiId : (friendsById[toId]?.upiId ?? null)
  return raw && isValidUpiId(raw) ? normalizeUpiId(raw) : null
}

/**
 * A pay link where the person you owe is collecting and the one who owes you is the only one
 * paying, opening straight on their payment. Null without a UPI ID or outside rupees (UPI only
 * moves rupees).
 */
export function swapPayLinkPayload(
  swap: Swap,
  friendsById: FriendsById,
  profile: Pick<Profile, 'name' | 'upiId'>,
  currency: string,
  date: string,
): PayLinkPayload | null {
  const upi = swapUpiId(swap.toId, friendsById, profile)
  if (!upi || currency !== 'INR') return null
  return payLinkFor({
    v: 1,
    // The title travels in the link and shows on the pay page as is: English, like UPI notes.
    t: 'Settle up',
    cat: 'other',
    c: currency,
    d: date,
    to: { n: outsideName(swap.toId, friendsById, profile, friendFallback()), u: upi },
    tot: swap.amount,
    p: [{ n: outsideName(swap.fromId, friendsById, profile, friendFallback()), a: swap.amount }],
    f: 0,
  })
}

/** The link itself (async: links are packed). Null when there can't be one. */
export async function swapPayLink(
  swap: Swap,
  friendsById: FriendsById,
  profile: Pick<Profile, 'name' | 'upiId'>,
  currency: string,
  date: string,
  origin?: string,
): Promise<string | null> {
  const payload = swapPayLinkPayload(swap, friendsById, profile, currency, date)
  return payload ? encodePayLink(payload, origin) : null
}

/** The message to the person who owes you. Names as others know them (never "You"). */
export function swapMessage(
  swap: Swap,
  friendsById: FriendsById,
  profile: Pick<Profile, 'name' | 'upiId'>,
  currency: string,
  link: string | null,
): string {
  const from = outsideName(swap.fromId, friendsById, profile, friendFallback())
  const to = outsideName(swap.toId, friendsById, profile, friendFallback())
  const amount = formatMoney(swap.amount, currency, { trimZeros: true })
  const upi = swapUpiId(swap.toId, friendsById, profile)
  const lines = [t('swap.message', { from, to, amount })]
  if (upi) lines.push(t('swap.message.upi', { to, upi }))
  if (link) lines.push(t('swap.message.link', { to, link }))
  return lines.join('\n')
}
