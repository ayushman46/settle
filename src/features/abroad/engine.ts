/**
 * Friend abroad: what is owed between you in their currency at a given rate, the link that opens
 * their PayPal.Me, Wise or Revolut page, and what an "I've paid" settles. Pure: no storage, no
 * clock, no network (the rate is handed in).
 *
 * Links are only the forms each service documents: PayPal.Me takes an amount and a currency
 * (paypal.me/name/25USD); a Wisetag link (wise.com/pay/me/name) and a Revolut link
 * (revolut.me/name) are plain profile links, so the amount is copied instead.
 */
import type { Minor } from '../../domain/types'
import { convertMinor, parseRate } from '../../engine/fx'
import { currencyDigits, toInputString } from '../../lib/money'

/** The currencies offered as chips; any other ISO code can be typed. */
export const ABROAD_CURRENCIES = ['USD', 'AED', 'GBP', 'EUR', 'SGD', 'CAD', 'AUD'] as const

export const ABROAD_SERVICES = ['paypal', 'wise', 'revolut', 'other'] as const
export type AbroadService = (typeof ABROAD_SERVICES)[number]

/** How a friend abroad is set up on this phone. */
export interface AbroadSetup {
  /** ISO 4217, the money they use where they live. */
  currency: string
  via: AbroadService
  /** Their PayPal.Me name, Wisetag or Revolut name; for `other`, a note in the person's words. May be empty. */
  handle: string
}

export const MAX_HANDLE = 50
export const MAX_OTHER_NOTE = 80

const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The path piece after `marker` ("paypal.me", "paypalme", …), or null. */
function after(parts: readonly string[], markers: readonly string[]): string | null {
  const at = parts.findIndex((part) => markers.includes(part.toLowerCase()))
  return at === -1 ? null : (parts[at + 1] ?? null)
}

/**
 * What the person typed or pasted, as the bare name: "@riya", "paypal.me/riya/25USD",
 * "https://wise.com/pay/me/riyas12" and "revolut.me/riya" all become the name alone. Blank stays
 * blank (the handle is optional). Null when it can't be a name on that service (spaces, a link to
 * somewhere else). For `other` it is a free note, tidied to one line.
 */
export function cleanHandle(via: AbroadService, raw: string): string | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') return ''
  if (via === 'other') return text.slice(0, MAX_OTHER_NOTE).trim()
  let name = text
  if (text.includes('/')) {
    const path = text.split(/[?#]/)[0] ?? ''
    const parts = path.split('/').filter((part) => part !== '' && !/^https?:$/i.test(part))
    const found =
      via === 'paypal'
        ? after(parts, ['paypal.me', 'www.paypal.me', 'paypalme'])
        : via === 'wise'
          ? after(parts, ['me'])
          : after(parts, ['revolut.me', 'www.revolut.me'])
    if (found === null) return null
    name = found
  }
  name = name.replace(/^@+/, '')
  if (name.length === 0 || name.length > MAX_HANDLE || !HANDLE_PATTERN.test(name)) return null
  return name
}

/**
 * Currencies a PayPal.Me link is given an amount in. PayPal holds more, but these are the ones
 * with ordinary decimals and no in-country limits; for anything else the plain link is used and
 * the amount is copied instead.
 */
const PAYPAL_LINK_CURRENCIES: ReadonlySet<string> = new Set([
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'SGD',
  'NZD',
  'CHF',
  'HKD',
  'JPY',
  'SEK',
  'DKK',
  'NOK',
  'PLN',
  'CZK',
  'ILS',
  'MXN',
  'PHP',
  'THB',
])

export interface PayLink {
  url: string
  /** True when the link itself carries the amount; false means "copy the amount, then paste it there". */
  withAmount: boolean
}

/**
 * The page to pay them on, or null when there is no name saved (or it is `other`). `amount` is in
 * their currency's minor units; null or 0 gives the plain profile link.
 */
export function payLink(setup: AbroadSetup, amount: Minor | null): PayLink | null {
  if (setup.via === 'other') return null
  const name = cleanHandle(setup.via, setup.handle)
  if (!name) return null
  const safe = encodeURIComponent(name)
  if (setup.via === 'wise') return { url: `https://wise.com/pay/me/${safe}`, withAmount: false }
  if (setup.via === 'revolut') return { url: `https://revolut.me/${safe}`, withAmount: false }
  const base = `https://paypal.me/${safe}`
  if (amount !== null && Number.isSafeInteger(amount) && amount > 0 && PAYPAL_LINK_CURRENCIES.has(setup.currency)) {
    return { url: `${base}/${toInputString(amount, setup.currency, { trimZeros: true })}${setup.currency}`, withAmount: true }
  }
  return { url: base, withAmount: false }
}

export type AbroadSide = 'youOwe' | 'theyOwe' | 'even'

export interface AbroadView {
  side: AbroadSide
  /** What is open, in `currency`'s minor units; 0 when even. */
  amount: Minor
  currency: string
  theirCurrency: string
  /** The same money in their currency, or null when there is no rate (or it is too small to show). */
  theirAmount: Minor | null
  /** True when the money is already in their currency: nothing to convert. */
  same: boolean
}

/**
 * What is owed between you (`net`: + they owe you, − you owe them, in `currency`) and what that is
 * in their currency at `rate` (units of theirs per 1 of `currency`, a decimal string; null = no rate).
 */
export function abroadView(net: Minor, currency: string, theirCurrency: string, rate: string | null): AbroadView {
  const amount = Number.isSafeInteger(net) ? Math.abs(net) : 0
  const side: AbroadSide = amount === 0 ? 'even' : net > 0 ? 'theyOwe' : 'youOwe'
  const same = currency === theirCurrency
  let theirAmount: Minor | null = null
  if (amount > 0) {
    if (same) theirAmount = amount
    else if (rate !== null && parseRate(rate) !== null) {
      const converted = convertMinor(amount, currency, theirCurrency, rate)
      theirAmount = converted > 0 ? converted : null
    }
  }
  return { side, amount, currency, theirCurrency, theirAmount, same }
}

/** One side of "this much = that much". */
export interface RateSide {
  amount: Minor
  currency: string
}

/**
 * The rate in the direction people read it: `left` = `right`. Usually one unit of their currency
 * and what it costs in ours ("$1 = ₹88.42"). When one of theirs is worth less than one of ours
 * (yen, rupiah), a hundred of ours and what it buys ("₹100 = ¥175").
 */
export interface RateLine {
  left: RateSide
  right: RateSide
}

/** `rate`: units of theirs per 1 of `currency`, a decimal string. Null when it can't be read. */
export function rateLine(rate: string, currency: string, theirCurrency: string): RateLine | null {
  const parsed = parseRate(rate)
  if (!parsed) return null
  const value = Number(parsed.num) / Number(parsed.den)
  if (!Number.isFinite(value) || value <= 0) return null
  const ours = 10 ** currencyDigits(currency)
  const theirs = 10 ** currencyDigits(theirCurrency)
  const line: RateLine =
    value <= 1
      ? { left: { amount: theirs, currency: theirCurrency }, right: { amount: Math.round((1 / value) * ours), currency } }
      : { left: { amount: 100 * ours, currency }, right: { amount: Math.round(value * 100 * theirs), currency: theirCurrency } }
  return Number.isSafeInteger(line.right.amount) && line.right.amount > 0 ? line : null
}

/** "I've paid": did it clear everything, or a part. */
export type PaidMode = 'all' | 'part'

/** What is missing from "I've paid"; null when it can be recorded. */
export function paidIssue(typed: Minor | null): 'amount' | null {
  return typed === null || !Number.isSafeInteger(typed) || typed <= 0 ? 'amount' : null
}

/**
 * What an "I've paid" settles and what it cost. `all`: everything owed is cleared whatever the
 * transfer cost (fees and the bank's rate are the sender's). `part`: the amount typed is what is
 * settled, never more than what is owed.
 */
export function paidOutcome(mode: PaidMode, typed: Minor, owed: Minor): { settled: Minor; cost: Minor } {
  if (mode === 'all') return { settled: owed, cost: typed }
  const settled = Math.min(typed, owed)
  return { settled, cost: typed }
}

/** Dialling codes → the currency people there are paid in, longest code first. A guess for the first default only. */
const DIAL_CODES: ReadonlyArray<readonly [string, string]> = [
  ['971', 'AED'],
  ['966', 'SAR'],
  ['974', 'QAR'],
  ['965', 'KWD'],
  ['968', 'OMR'],
  ['973', 'BHD'],
  ['852', 'HKD'],
  ['353', 'EUR'],
  ['351', 'EUR'],
  ['358', 'EUR'],
  ['61', 'AUD'],
  ['64', 'NZD'],
  ['65', 'SGD'],
  ['44', 'GBP'],
  ['49', 'EUR'],
  ['33', 'EUR'],
  ['31', 'EUR'],
  ['34', 'EUR'],
  ['39', 'EUR'],
  ['32', 'EUR'],
  ['43', 'EUR'],
  ['41', 'CHF'],
  ['81', 'JPY'],
  ['60', 'MYR'],
  ['1', 'USD'],
]

/**
 * A first guess at their currency from a saved phone number with a country code ("+1 415…" → USD,
 * "+971…" → AED). Null for an Indian number, a number without a country code, or a code not listed.
 */
export function currencyFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const compact = phone.replace(/[\s().-]/g, '')
  const digits = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : null
  if (digits === null || !/^\d{7,15}$/.test(digits) || digits.startsWith('91')) return null
  for (const [code, currency] of DIAL_CODES) {
    if (digits.startsWith(code)) return currency
  }
  return null
}
