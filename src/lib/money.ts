/**
 * Money helpers. In app state every amount is an integer count of the currency's minor unit
 * (`Minor`). Floats only appear at the edges: scan results in, formatted text out.
 */
import type { Minor } from '../types'

/** Largest amount (in minor units) an input can produce. */
export const MAX_MINOR = 1e12

const digitsCache = new Map<string, number>()

/** Minor-unit digits of an ISO 4217 currency (INR 2, JPY 0, KWD 3). Unknown or invalid codes → 2. */
export function currencyDigits(code: string): number {
  const cached = digitsCache.get(code)
  if (cached !== undefined) return cached
  let digits = 2
  try {
    const resolved = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
    const max = resolved.maximumFractionDigits
    if (typeof max === 'number' && Number.isInteger(max) && max >= 0 && max <= 4) digits = max
  } catch {
    // Not a well-formed currency code — keep the default.
  }
  digitsCache.set(code, digits)
  return digits
}

/** Normalises `-0` and non-integers so every Minor we hand out is a clean integer. */
function cleanInt(value: number): number {
  if (!Number.isFinite(value)) return 0
  const r = Math.round(value)
  return r === 0 ? 0 : r
}

/** Major units → minor units, immune to float noise: `toMinor(0.1 + 0.2, 'USD') === 30`. */
export function toMinor(major: number, code: string): Minor {
  if (!Number.isFinite(major)) return 0
  const scaled = Number((major * 10 ** currencyDigits(code)).toFixed(6))
  const rounded = Math.round(Math.abs(scaled))
  return scaled < 0 && rounded !== 0 ? -rounded : rounded
}

/** Minor units → major units (`fromMinor(1999, 'USD') === 19.99`). */
export function fromMinor(minor: Minor, code: string): number {
  const value = cleanInt(minor) / 10 ** currencyDigits(code)
  return value === 0 ? 0 : value
}

/** Re-expresses an amount when the currency changes, keeping its major value (USD 1234 → JPY 12). */
export function rescaleMinor(minor: Minor, fromCode: string, toCode: string): Minor {
  const delta = currencyDigits(toCode) - currencyDigits(fromCode)
  const value = cleanInt(minor)
  if (delta === 0) return value
  if (delta > 0) return value * 10 ** delta
  const scaled = Math.round(Math.abs(value) / 10 ** -delta)
  return value < 0 && scaled !== 0 ? -scaled : scaled
}

export type MoneySign = 'auto' | 'always' | 'never' | 'negative'

export interface FormatMoneyOptions {
  /**
   * `auto`/`negative`: minus for negatives only (default). `always`: explicit + or − (zero unsigned).
   * `never`: absolute value.
   */
  sign?: MoneySign
  /** Drop the fraction for whole amounts (`₹1,200` instead of `₹1,200.00`). */
  trimZeros?: boolean
}

const SIGN_DISPLAY: Record<MoneySign, 'auto' | 'exceptZero' | 'never'> = {
  auto: 'auto',
  negative: 'auto', // identical for exact minor amounts once -0 is normalised away
  always: 'exceptZero',
  never: 'never',
}

const formatterCache = new Map<string, Intl.NumberFormat | null>()

function moneyFormatter(code: string, sign: MoneySign, whole: boolean): Intl.NumberFormat | null {
  const key = `${code}|${sign}|${whole ? 1 : 0}`
  if (formatterCache.has(key)) return formatterCache.get(key) ?? null
  let formatter: Intl.NumberFormat | null
  try {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      signDisplay: SIGN_DISPLAY[sign],
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    })
  } catch {
    formatter = null
  }
  formatterCache.set(key, formatter)
  return formatter
}

/** Formats minor units for display in the user's locale: `formatMoney(123450, 'INR')` → `₹1,234.50`. */
export function formatMoney(minor: number, code: string, opts: FormatMoneyOptions = {}): string {
  const sign = opts.sign ?? 'auto'
  const value = cleanInt(minor)
  const digits = currencyDigits(code)
  const whole = opts.trimZeros === true && value % 10 ** digits === 0
  const major = fromMinor(value, code)
  const formatter = moneyFormatter(code, sign, whole)
  if (formatter) return formatter.format(major)

  const prefix =
    sign === 'never' ? '' : value < 0 ? '-' : sign === 'always' && value > 0 ? '+' : ''
  return `${prefix}${code} ${Math.abs(major).toFixed(whole ? 0 : digits)}`
}

const symbolCache = new Map<string, string>()

/** The narrow symbol for a currency (`₹`, `$`, `€`), or the code itself when there is none. */
export function currencySymbol(code: string): string {
  const cached = symbolCache.get(code)
  if (cached !== undefined) return cached
  let symbol: string
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1)
    symbol = parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {
    symbol = code
  }
  symbolCache.set(code, symbol)
  return symbol
}

/** Zero code points of decimal digit blocks people may type (Arabic-Indic, Devanagari, Bengali, Thai, full-width...). */
const DIGIT_ZEROS = [
  0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0e50,
  0xff10,
]

function asciiDigits(text: string): string {
  return text
    .replace(/\p{Nd}/gu, (ch) => {
      const cp = ch.codePointAt(0) ?? 0
      const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9)
      return zero === undefined ? ch : String(cp - zero)
    })
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ',') // Arabic thousands separator
}

/** Whether `lead<sep>tail` (a single separator) reads as a decimal point rather than grouping. */
function isDecimalSeparator(lead: string, tail: string, digits: number): boolean {
  if (tail.length <= Math.max(digits, 2)) return true
  // "1,234" / "12.345": exactly three digits after a valid leading group → thousands.
  if (tail.length === 3 && /^[1-9]\d{0,2}$/.test(lead)) return false
  // "0.125", "1234.567": cannot be grouping → decimal with extra digits rounded.
  return true
}

/**
 * The digits-and-separators part of what was typed. A currency prefix such as "Rs." is skipped so
 * its dot isn't read as a decimal point, and trailing separators ("12.", "12,50 Rs.") are dropped.
 */
function numericPart(text: string): string {
  let start = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (ch >= '0' && ch <= '9') {
      start = i
      break
    }
    const nextIsDigit = /\d/.test(text.charAt(i + 1))
    if ((ch === '.' || ch === ',') && nextIsDigit && !/[\p{L}.]/u.test(text.charAt(i - 1))) {
      start = i
      break
    }
  }
  if (start === -1) return ''
  return text
    .slice(start)
    .replace(/[^\d.,]/g, '')
    .replace(/[.,]+$/, '')
}

/**
 * Parses what someone typed into a money field: "1,234.50", "₹1,234.5", "Rs.99", "12.", ".5",
 * "1,23,456.78", "1.234,50", "1234,5". Returns null for empty, invalid or negative input.
 * Extra fraction digits round half-up; results clamp to MAX_MINOR.
 */
export function parseMoneyInput(text: string, code: string): Minor | null {
  if (/[-−]/.test(text)) return null
  const s = numericPart(asciiDigits(text))
  if (!/\d/.test(s)) return null

  const digits = currencyDigits(code)
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let intPart: string
  let fracPart = ''

  if (lastDot !== -1 && lastComma !== -1) {
    // Both kinds present: the last one is the decimal separator, the other groups thousands.
    const decimal = lastDot > lastComma ? '.' : ','
    const grouping = decimal === '.' ? ',' : '.'
    const pieces = s.split(decimal)
    if (pieces.length !== 2) return null
    intPart = (pieces[0] ?? '').split(grouping).join('')
    fracPart = pieces[1] ?? ''
  } else if (lastDot === -1 && lastComma === -1) {
    intPart = s
  } else {
    const sep = lastDot !== -1 ? '.' : ','
    const pieces = s.split(sep)
    const lead = pieces[0] ?? ''
    const tail = pieces[1] ?? ''
    if (pieces.length === 2 && isDecimalSeparator(lead, tail, digits)) {
      intPart = lead
      fracPart = tail
    } else {
      intPart = pieces.join('')
    }
  }

  const padded = fracPart.padEnd(digits + 1, '0')
  let minor = Number((intPart || '0') + padded.slice(0, digits))
  if (!Number.isFinite(minor)) return null
  if (padded.charAt(digits) >= '5') minor += 1
  return Math.min(minor, MAX_MINOR)
}

export interface InputStringOptions {
  /** "1200" instead of "1200.00" for whole amounts. */
  trimZeros?: boolean
}

/** Plain editable text for an amount: "1234.50" (no grouping), JPY "1234"; `''` for null. */
export function toInputString(minor: Minor | null, code: string, opts: InputStringOptions = {}): string {
  if (minor === null || !Number.isFinite(minor)) return ''
  const value = cleanInt(minor)
  const digits = currencyDigits(code)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (digits === 0) return `${sign}${abs}`
  const unit = 10 ** digits
  const whole = Math.floor(abs / unit)
  const frac = abs % unit
  if (opts.trimZeros && frac === 0) return `${sign}${whole}`
  return `${sign}${whole}.${String(frac).padStart(digits, '0')}`
}

/** Most whole-unit digits an amount field accepts (₹9,99,99,99,999). */
export const MAX_INTEGER_DIGITS = 10

/**
 * Tidies an amount field as the user types, like a payments app: digits and ONE decimal
 * separator (`.` or `,`, as typed) only, no more decimals than the currency has, no leading
 * zeros, at most `MAX_INTEGER_DIGITS` whole digits. Pasted formatted amounts ("₹1,234.50")
 * become plain ("1234.50"). Parse the result with `parseMoneyInput`.
 */
export function cleanAmountText(text: string, code: string): string {
  let ascii = asciiDigits(text)
  // A pasted formatted amount ("1,234.50", "1.234,50", "1,23,456"): read it as a whole first.
  const core = ascii.replace(/[^\d.,]/g, '')
  const formatted = (core.includes('.') && core.includes(',')) || /^\d{1,3}([.,])\d{2,3}(?:\1\d{2,3})+$/.test(core)
  if (formatted) {
    const parsed = parseMoneyInput(text, code)
    if (parsed !== null) ascii = toInputString(parsed, code, { trimZeros: true })
  }
  const digits = currencyDigits(code)
  let whole = ''
  let fraction = ''
  let separator: string | null = null
  for (const ch of ascii) {
    if (ch >= '0' && ch <= '9') {
      if (separator === null) {
        if (whole.length < MAX_INTEGER_DIGITS) whole += ch
      } else if (fraction.length < digits) {
        fraction += ch
      }
    } else if ((ch === '.' || ch === ',') && separator === null && digits > 0) {
      separator = ch
    }
  }
  whole = whole.replace(/^0+(?=\d)/, '')
  if (separator === null) return whole
  return `${whole || '0'}${separator}${fraction}`
}

/** Exact integer representation of a finite non-negative double: `x = n / 2^k`. */
function dyadic(x: number): { n: bigint; k: number } {
  let value = x
  let k = 0
  // Doubling a non-integer double is exact (it is < 2^53, so it cannot overflow).
  while (!Number.isInteger(value)) {
    value *= 2
    k++
  }
  return { n: BigInt(value), k }
}

/**
 * Splits `total` into integer parts proportional to `weights` using the largest-remainder
 * (Hamilton) method. Exact: the parts always sum to `total`. Negative/NaN weights count as 0;
 * all-zero weights split equally; ties go to the lowest index; negative totals mirror positive ones.
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  const n = weights.length
  if (n === 0) return []
  const t = cleanInt(total)
  if (t < 0) return allocate(-t, weights).map((v) => (v === 0 ? 0 : -v))
  if (t === 0) return new Array<number>(n).fill(0)

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  if (!clean.some((w) => w > 0)) clean.fill(1)

  // Bring every weight onto a common power-of-two denominator so the arithmetic is exact.
  const parts = clean.map(dyadic)
  const maxK = parts.reduce((m, p) => Math.max(m, p.k), 0)
  const ints = parts.map((p) => p.n << BigInt(maxK - p.k))
  const sum = ints.reduce((a, b) => a + b, 0n)

  const T = BigInt(t)
  const shares: bigint[] = []
  const remainders: bigint[] = []
  let assigned = 0n
  for (const w of ints) {
    const product = T * w
    const share = product / sum
    shares.push(share)
    remainders.push(product % sum)
    assigned += share
  }

  const leftover = Number(T - assigned) // 0 <= leftover < n
  const order = shares.map((_, i) => i)
  order.sort((a, b) => {
    const ra = remainders[a] ?? 0n
    const rb = remainders[b] ?? 0n
    return ra === rb ? a - b : rb > ra ? 1 : -1
  })
  for (let k = 0; k < leftover; k++) {
    const idx = order[k]
    if (idx !== undefined) shares[idx] = (shares[idx] ?? 0n) + 1n
  }
  return shares.map(Number)
}
