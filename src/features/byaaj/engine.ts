/**
 * Interest on a loan (byaaj): simple interest between friends and family. Pure: every date comes in.
 *
 * THE RULES (stated on the screen, tested here):
 * 1. Simple interest only. Interest is charged on the amount still lent, never on unpaid interest.
 * 2. Time is counted by the day, from the loan's date:
 *    - a rate "a month": every whole month since the loan's date counts as one month, and the days
 *      left over count as days out of 30 (so 1 Jan to 15 Feb is 1 month and 14 days = 1 + 14/30 months);
 *    - a rate "a year": the actual number of days, out of 365 (so a leap year's extra day earns one
 *      more day of interest: 366 days at 12% a year is 12% × 366/365).
 *    Time is always measured from the loan's date, so interest between two days never depends on
 *    when payments happened in between.
 * 3. A part payment pays the interest due first, then the amount lent.
 * 4. Interest is kept exact inside (as a fraction) and shown rounded to the nearest whole unit of the
 *    currency (the rupee); the rounding is done on the running total, so it never drifts.
 */
import type { Minor } from '../../domain/types'
import { addMonths, dateInPeriod, daysBetween, isIsoDate, periodOf } from '../../engine/dates'
import { indianNumberWords } from '../../kit/amountWords'
import { MAX_MINOR } from '../../lib/money'

export const RATE_PERS = ['month', 'year'] as const
export type RatePer = (typeof RATE_PERS)[number]

export interface Rate {
  /** Hundredths of a percent for one month or one year: 100 = 1%, 150 = 1.5%, 1200 = 12%. */
  bp: number
  per: RatePer
}

/** The quick picks: 1% a month, 2% a month, 12% a year. */
export const RATE_CHOICES: readonly Rate[] = [
  { bp: 100, per: 'month' },
  { bp: 200, per: 'month' },
  { bp: 1200, per: 'year' },
]

/** The highest rate that can be set: 100% a month or a year. */
export const MAX_RATE_BP = 10_000

export function isRate(rate: { bp: unknown; per: unknown } | null | undefined): rate is Rate {
  return !!rate && (rate.per === 'month' || rate.per === 'year') && typeof rate.bp === 'number' && Number.isInteger(rate.bp) && rate.bp >= 1 && rate.bp <= MAX_RATE_BP
}

export function sameRate(a: Rate, b: Rate): boolean {
  return a.bp === b.bp && a.per === b.per
}

/** "1.5" typed as a percent → 150; null when it isn't a rate that can be set (0, negative, over 100, more than two decimals' worth is rounded). */
export function parsePercent(text: string): number | null {
  const clean = text.trim().replace(/%$/, '').trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{0,4})?$/.test(clean) && !/^\.\d{1,4}$/.test(clean)) return null
  const bp = Math.round(Number(clean) * 100)
  return Number.isInteger(bp) && bp >= 1 && bp <= MAX_RATE_BP ? bp : null
}

/** 150 → "1.5", 1200 → "12", 75 → "0.75". */
export function percentText(bp: number): string {
  const whole = Math.trunc(bp / 100)
  const frac = Math.abs(bp % 100)
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`
}

/** Time as the interest counts it. For a yearly rate `months` is always 0 and `days` is the actual number of days. */
export interface Span {
  months: number
  days: number
}

/** Whole months from `from` to `to` (the 31st counts as the last day of a shorter month), and the days left over. */
function monthsAndDays(from: string, to: string): Span {
  const day = Number(from.slice(8, 10))
  let months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
  let anchor = dateInPeriod(addMonths(periodOf(from), months), day)
  if (anchor > to) {
    months -= 1
    anchor = dateInPeriod(addMonths(periodOf(from), months), day)
  }
  return { months, days: daysBetween(anchor, to) }
}

/** The time from `from` to `to` as the interest counts it; nothing when `to` is not after `from` (or a date is not a date). */
export function spanBetween(from: string, to: string, per: RatePer): Span {
  if (!isIsoDate(from) || !isIsoDate(to) || to <= from) return { months: 0, days: 0 }
  return per === 'year' ? { months: 0, days: daysBetween(from, to) } : monthsAndDays(from, to)
}

/** A span in the units interest is charged by: thirtieths of a month, or days of a 365-day year. */
function units(span: Span): number {
  return span.months * 30 + span.days
}

const DENOMINATOR: Readonly<Record<RatePer, bigint>> = { month: 30n * 10_000n, year: 365n * 10_000n }

/** numerator / denominator rounded half up to a multiple of `unit` (minor units). */
function roundTo(numerator: bigint, denominator: bigint, unit: number): Minor {
  const step = denominator * BigInt(unit)
  const rounded = ((numerator * 2n + step) / (step * 2n)) * BigInt(unit)
  return Number(rounded > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : rounded)
}

/**
 * Simple interest on `principal` from `from` to `to` with nothing paid in between, rounded to the
 * nearest `unit` (100 = whole rupees). The plain formula, for checking a number by hand.
 */
export function simpleInterest(principal: Minor, rate: Rate, from: string, to: string, unit = 100): Minor {
  if (!(principal > 0) || !isRate(rate)) return 0
  const u = units(spanBetween(from, to, rate.per))
  return roundTo(BigInt(Math.round(principal)) * BigInt(rate.bp) * BigInt(u), DENOMINATOR[rate.per], unit)
}

/** One payment, already divided: how much of it went to interest and how much came off the amount lent. */
export interface LoanPayment {
  id: string
  /** YYYY-MM-DD. */
  date: string
  interest: Minor
  principal: Minor
  /** Marked paid back elsewhere in the app, not on the loan's interest page (always all principal). */
  outside?: boolean
}

export interface StatementLine {
  kind: 'start' | 'payment' | 'asOf'
  id: string
  date: string
  /** Time since the line before, as the interest counts it. */
  span: Span
  /** Interest added since the line before. */
  interestAdded: Minor
  /** What was paid on this line (0 for the first and last line). */
  paid: Minor
  toInterest: Minor
  toPrincipal: Minor
  /** The amount still lent after this line. */
  principal: Minor
  /** Interest not yet paid after this line. */
  interestDue: Minor
  outside: boolean
}

export interface LoanStatement {
  rate: Rate
  from: string
  asOf: string
  /** The amount lent at the start. */
  principalStart: Minor
  /** The amount still lent. */
  principal: Minor
  principalPaid: Minor
  /** All the interest there has been, paid or not. */
  interestTotal: Minor
  interestPaid: Minor
  interestDue: Minor
  /** The amount still lent plus the interest due. */
  due: Minor
  /** From the loan's date to `asOf`. */
  span: Span
  /** The start, each payment in date order, then `asOf`. */
  lines: StatementLine[]
  /** Nothing is due any more (and something was lent). */
  cleared: boolean
}

export interface LoanStatementInput {
  /** The amount lent at the start (minor units). */
  principal: Minor
  rate: Rate
  /** The loan's date. */
  from: string
  /** The day to work it out for ("today"). Earlier than the loan's date counts as the loan's date. */
  asOf: string
  /** Payments already divided into interest and principal. Ones dated after `asOf` haven't happened yet and are left out. */
  payments?: readonly LoanPayment[]
  /** Interest is rounded to the nearest this many minor units: 100 = whole rupees (the default), 1 = to the paisa. */
  unit?: number
}

function clampMoney(value: number, max: number): Minor {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.round(value), max)
}

/**
 * The loan line by line: the start, every payment, and where it stands on `asOf`. Interest runs on
 * the amount still lent between lines; each payment's interest part comes off the interest due and
 * its principal part off the amount lent (never more than is there).
 */
export function loanStatement(input: LoanStatementInput): LoanStatement {
  const { rate, from } = input
  const unit = input.unit && input.unit >= 1 ? Math.round(input.unit) : 100
  const principalStart = clampMoney(input.principal, MAX_MINOR)
  const asOf = isIsoDate(input.asOf) && input.asOf > from ? input.asOf : from
  const per: RatePer = rate.per === 'year' ? 'year' : 'month'
  const bp = isRate(rate) ? BigInt(rate.bp) : 0n
  const denominator = DENOMINATOR[per]

  const payments = (input.payments ?? [])
    .map((p, index) => ({ p, index, date: isIsoDate(p.date) && p.date > from ? p.date : from }))
    .filter((x) => x.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index))

  let principal = principalStart
  let accrued = 0n
  let roundedSoFar = 0
  let interestPaid = 0
  let principalPaid = 0
  let lastUnits = 0
  let lastDate = from

  const advance = (date: string): { span: Span; added: Minor } => {
    const now = units(spanBetween(from, date, per))
    accrued += BigInt(principal) * bp * BigInt(Math.max(0, now - lastUnits))
    const rounded = roundTo(accrued, denominator, unit)
    const added = rounded - roundedSoFar
    const span = spanBetween(lastDate, date, per)
    roundedSoFar = rounded
    lastUnits = Math.max(lastUnits, now)
    lastDate = date
    return { span, added }
  }

  const lines: StatementLine[] = [
    { kind: 'start', id: 'start', date: from, span: { months: 0, days: 0 }, interestAdded: 0, paid: 0, toInterest: 0, toPrincipal: 0, principal, interestDue: 0, outside: false },
  ]
  for (const { p, date } of payments) {
    const { span, added } = advance(date)
    const toInterest = clampMoney(p.interest, Math.max(0, roundedSoFar - interestPaid))
    const toPrincipal = clampMoney(p.principal, principal)
    interestPaid += toInterest
    principalPaid += toPrincipal
    principal -= toPrincipal
    lines.push({
      kind: 'payment',
      id: p.id,
      date,
      span,
      interestAdded: added,
      paid: toInterest + toPrincipal,
      toInterest,
      toPrincipal,
      principal,
      interestDue: roundedSoFar - interestPaid,
      outside: p.outside === true,
    })
  }
  const last = advance(asOf)
  const interestDue = roundedSoFar - interestPaid
  lines.push({ kind: 'asOf', id: 'asOf', date: asOf, span: last.span, interestAdded: last.added, paid: 0, toInterest: 0, toPrincipal: 0, principal, interestDue, outside: false })

  return {
    rate: { bp: Number(bp), per },
    from,
    asOf,
    principalStart,
    principal,
    principalPaid,
    interestTotal: roundedSoFar,
    interestPaid,
    interestDue,
    due: principal + interestDue,
    span: spanBetween(from, asOf, per),
    lines,
    cleared: principalStart > 0 && principal + interestDue === 0,
  }
}

export interface PaymentParts {
  interest: Minor
  principal: Minor
  /** What is left of the payment once everything due is paid (0 unless they paid too much). */
  extra: Minor
}

/** The one rule for a payment: the interest due first, then the amount lent. */
export function payInterestFirst(amount: Minor, interestDue: Minor, principal: Minor): PaymentParts {
  const pay = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0
  const interest = Math.min(pay, Math.max(0, interestDue))
  const off = Math.min(pay - interest, Math.max(0, principal))
  return { interest, principal: off, extra: pay - interest - off }
}

/**
 * An amount in words for the loan note, on the Indian system: ₹1,50,000 → "Rupees one lakh fifty
 * thousand only"; ₹2,50,00,000.50 → "Rupees two crore fifty lakh and fifty paise only". Rupees only:
 * null for other currencies, zero and anything that isn't a whole number of paise.
 */
export function amountWords(minor: Minor, currency: string): string | null {
  if (currency !== 'INR' || !Number.isSafeInteger(minor) || minor <= 0) return null
  const rupees = Math.floor(minor / 100)
  const paise = minor % 100
  const paiseWords = `${indianNumberWords(paise)} ${paise === 1 ? 'paisa' : 'paise'}`
  if (rupees === 0) return `${paiseWords.charAt(0).toUpperCase()}${paiseWords.slice(1)} only`
  return paise > 0 ? `Rupees ${indianNumberWords(rupees)} and ${paiseWords} only` : `Rupees ${indianNumberWords(rupees)} only`
}
