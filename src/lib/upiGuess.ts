/**
 * A UPI ID with no typing, for the apps that make it from the phone number: PhonePe gives every
 * user `<mobile>@ybl`, BHIM `<mobile>@upi`, Amazon Pay `<mobile>@apl`. Google Pay's IDs are made
 * from the e-mail address, so they can't be worked out (its QR is read instead, see `upiQr.ts`).
 * Nothing is looked up anywhere: the ID is right only if that app is set up on that number, which
 * is why whoever pays is shown the name on the account before any money moves.
 */
import { isValidUpiId, normalizeUpiId } from './upi'

export type GuessApp = 'phonepe' | 'bhim' | 'amazonpay'

export const GUESS_APPS: ReadonlyArray<{ id: GuessApp; name: string; handle: string }> = [
  { id: 'phonepe', name: 'PhonePe', handle: 'ybl' },
  { id: 'bhim', name: 'BHIM', handle: 'upi' },
  { id: 'amazonpay', name: 'Amazon Pay', handle: 'apl' },
]

/** The ten digits of an Indian mobile number ("+91 98765-43210" → "9876543210"), or null. */
export function mobileOf(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null
  let digits = text.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

/** The ID `app` gives the number, or null when the number isn't an Indian mobile. */
export function guessUpiId(phone: string | null | undefined, app: GuessApp): string | null {
  const mobile = mobileOf(phone)
  const handle = GUESS_APPS.find((a) => a.id === app)?.handle
  return mobile && handle ? `${mobile}@${handle}` : null
}

/** The first UPI ID in some copied text ("My UPI ID is riya@okaxis. Pay me!" → "riya@okaxis"), or null. */
export function upiIdIn(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null
  for (const m of text.slice(0, 2000).matchAll(/[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z][A-Za-z0-9.-]{1,63}/g)) {
    const candidate = m[0].replace(/[.,;:!?)\]]+$/, '')
    // An e-mail address isn't one: UPI handles have no dot-something ending.
    if (/\.[A-Za-z]{2,}$/.test(candidate.split('@')[1] ?? '')) continue
    if (isValidUpiId(candidate)) return normalizeUpiId(candidate)
  }
  return null
}
