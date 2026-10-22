/**
 * Trip currency maths: exact conversion of a foreign amount into the settle currency at a frozen
 * rate. Rates are decimal strings (never floats) so a rate written today converts to the same
 * paise forever; the arithmetic is BigInt, rounding half up, aware of each currency's minor digits
 * (JPY has none, INR two). Pure — no storage, no network.
 */
import type { Minor } from '../domain/types'
import { currencyDigits, currencySymbol } from '../lib/money'

/** A stored rate: up to 7 integer digits and 12 decimals, no sign or exponent. */
export const RATE_PATTERN = /^\d{1,7}(\.\d{1,12})?$/

const MAX_DECIMALS = 12

/** Drops trailing zeros after the point ("2.500" → "2.5", "3.000" → "3"). */
function trimDecimal(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

/** A positive finite rate as a decimal string with 10 significant digits (no exponent), or null. */
export function rateString(rate: number): string | null {
  if (!Number.isFinite(rate) || !(rate > 0)) return null
  let text = rate.toPrecision(10)
  if (/e/i.test(text)) text = Number(text).toFixed(MAX_DECIMALS)
  text = trimDecimal(text)
  return RATE_PATTERN.test(text) && /[1-9]/.test(text) ? text : null
}

/** "2.410751226" → { num: 2410751226n, den: 1000000000n }; null when invalid or 0. */
export function parseRate(rate: string): { num: bigint; den: bigint } | null {
  if (typeof rate !== 'string' || !RATE_PATTERN.test(rate)) return null
  const [whole = '', fraction = ''] = rate.split('.')
  const num = BigInt(whole + fraction)
  if (num === 0n) return null
  return { num, den: 10n ** BigInt(fraction.length) }
}

/** True for a usable stored rate (matches `RATE_PATTERN` and is more than 0). */
export function isValidRate(rate: unknown): rate is string {
  return typeof rate === 'string' && parseRate(rate) !== null
}

/**
 * `amount` (minor units of `from`) × `rate` → minor units of `to`, rounded half up, exact.
 * Returns 0 when the rate is invalid (callers validate rates before converting).
 */
export function convertMinor(amount: Minor, from: string, to: string, rate: string): Minor {
  const parsed = parseRate(rate)
  if (!parsed || !Number.isSafeInteger(amount) || amount < 0) return 0
  const shift = currencyDigits(to) - currencyDigits(from)
  let num = BigInt(amount) * parsed.num
  let den = parsed.den
  if (shift >= 0) num *= 10n ** BigInt(shift)
  else den *= 10n ** BigInt(-shift)
  return Number((2n * num + den) / (2n * den))
}

/**
 * The rate that turns `foreign` (minor of `from`) into exactly `settle` (minor of `to`) — for
 * "what your bank charged" (manual_total) — as a decimal string with at most 12 decimals, or null.
 */
export function rateFromTotals(foreign: Minor, from: string, settle: Minor, to: string): string | null {
  if (!Number.isSafeInteger(foreign) || foreign <= 0 || !Number.isSafeInteger(settle) || settle <= 0) return null
  // rate = (settle / 10^dTo) / (foreign / 10^dFrom), to 12 decimals, half up.
  const scale = 10n ** BigInt(MAX_DECIMALS)
  let num = BigInt(settle) * scale
  let den = BigInt(foreign)
  const shift = currencyDigits(from) - currencyDigits(to)
  if (shift >= 0) num *= 10n ** BigInt(shift)
  else den *= 10n ** BigInt(-shift)
  const scaled = (2n * num + den) / (2n * den)
  if (scaled === 0n) return null
  const digits = scaled.toString().padStart(MAX_DECIMALS + 1, '0')
  const text = trimDecimal(`${digits.slice(0, -MAX_DECIMALS)}.${digits.slice(-MAX_DECIMALS)}`)
  return RATE_PATTERN.test(text) ? text : null
}

/** Units of `to` per 1 `from`, from a table of units per 1 EUR (EUR itself = 1); null when either is missing. */
export function crossRate(rates: Readonly<Record<string, number>>, from: string, to: string): number | null {
  const f = from === 'EUR' ? 1 : rates[from]
  const t = to === 'EUR' ? 1 : rates[to]
  if (typeof f !== 'number' || typeof t !== 'number' || !Number.isFinite(f) || !Number.isFinite(t) || f <= 0 || t <= 0) return null
  return t / f
}

/** Rounds to at most `decimals` places and drops trailing zeros. */
function shortDecimal(value: number, decimals: number): string {
  return trimDecimal(value.toFixed(decimals))
}

/**
 * For display. Rates of 0.01 and up: at most 4 decimals ("2.4108", "0.625", "83.6405"). Tinier
 * rates read better the other way round: "₹1 = 188.13 IDR".
 */
export function formatRate(rate: string, from: string, to: string): string {
  const parsed = parseRate(rate)
  if (!parsed) return rate
  const value = Number(parsed.num) / Number(parsed.den)
  if (value >= 0.01) return shortDecimal(value, 4)
  return `${currencySymbol(to)}1 = ${shortDecimal(1 / value, 2)} ${from}`
}
