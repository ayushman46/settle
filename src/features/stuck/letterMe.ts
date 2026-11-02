/**
 * Your details for complaint letters — mobile number, city and state, address — and the email
 * address each bank's, wallet's or business's letters go to. Typed once in the Raise sheet, kept on
 * this phone only (not sent anywhere, not in backups), and written into every letter so no
 * "[your mobile number]" is left to fill in.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS, type StuckPayment, type StuckStepKind } from '../../data/stores'

export interface LetterMe {
  mobile: string
  /** City and state: "Pune, Maharashtra". */
  place: string
  address: string
  /** Where letters go, by who they're to ("bank:hdfc", "wallet:paytm", "merchant:amazon"). */
  emails: Readonly<Record<string, string>>
  /** NACH debits you'd revoked the mandate for, by stuck payment id: the day you revoked it, or '' when not given. */
  revoked: Readonly<Record<string, string>>
}

export const LETTER_ME_LIMITS = { mobile: 20, place: 80, address: 200, email: 120 } as const
/** Emails (and revoked mandates) remembered at most (the oldest go first). */
const MAX_EMAILS = 40
const MAX_KEY = 80

const letterMeSchema = z.object({
  mobile: z.catch(z.string().check(z.maxLength(LETTER_ME_LIMITS.mobile)), ''),
  place: z.catch(z.string().check(z.maxLength(LETTER_ME_LIMITS.place)), ''),
  address: z.catch(z.string().check(z.maxLength(LETTER_ME_LIMITS.address)), ''),
  emails: z.catch(z.record(z.string().check(z.maxLength(MAX_KEY)), z.string().check(z.maxLength(LETTER_ME_LIMITS.email))), {}),
  revoked: z.catch(z.record(z.string().check(z.maxLength(MAX_KEY)), z.string().check(z.maxLength(10))), {}),
})

export const letterMeStore = createStore<LetterMe>({
  key: STORAGE_KEYS.letterMe,
  schema: letterMeSchema,
  initial: () => ({ mobile: '', place: '', address: '', emails: {}, revoked: {} }),
  version: 1,
})

const whole = (me: LetterMe): LetterMe => me

export function useLetterMe(): LetterMe {
  return useStore(letterMeStore, whole)
}

export function setLetterMe(patch: Partial<Pick<LetterMe, 'mobile' | 'place' | 'address'>>): void {
  letterMeStore.update((prev) => ({ ...prev, ...patch }))
}

/**
 * Who a rung's email goes to, as Settle remembers it — the bank, the wallet (`wallet`: its id from
 * help.ts walletOf, when known) or the business — or null when it can't tell.
 */
export function emailKey(step: StuckStepKind, s: StuckPayment, wallet: string | null = null): string | null {
  if (step === 'bank') {
    if (s.rail === 'wallet') {
      const id = wallet ?? s.app?.trim().toLowerCase()
      return id ? `wallet:${id}`.slice(0, MAX_KEY) : null
    }
    const bank = s.bank?.trim().toLowerCase()
    return bank ? `bank:${bank}`.slice(0, MAX_KEY) : null
  }
  if (step === 'merchant') {
    const business = s.merchant ?? s.party?.trim().toLowerCase()
    return business ? `merchant:${business}`.slice(0, MAX_KEY) : null
  }
  return null
}

/** Remembers (or, emptied, forgets) where this one's letters go. */
export function setLetterEmail(key: string, email: string): void {
  const value = email.trim().slice(0, LETTER_ME_LIMITS.email)
  letterMeStore.update((prev) => {
    const others = Object.entries(prev.emails).filter(([k]) => k !== key)
    const kept = value ? [...others, [key, value] as const] : others
    return { ...prev, emails: Object.fromEntries(kept.slice(-MAX_EMAILS)) }
  })
}

/** Notes that this NACH debit came after you revoked the mandate (`on`: the day, or '' when not given), or that it didn't (null). */
export function setMandateRevoked(id: string, on: string | null): void {
  letterMeStore.update((prev) => {
    const others = Object.entries(prev.revoked).filter(([k]) => k !== id)
    const kept = on === null ? others : [...others, [id.slice(0, MAX_KEY), on] as const]
    return { ...prev, revoked: Object.fromEntries(kept.slice(-MAX_EMAILS)) }
  })
}
