/**
 * Rent receipts for HRA (house rent allowance), pure and deterministic. Each flatmate claims HRA
 * only on the rent they pay, so each gets receipts for their own share, one per month or per
 * quarter of the Indian financial year (April–March).
 *
 * The rules applied (guidance for salaried employees; employers and tax advisers have the last word):
 * - Landlord's PAN: needed when the rent you pay in a financial year is more than ₹1,00,000
 *   (CBDT Circular 8/2013). Without a PAN, the landlord gives a signed declaration instead.
 * - Revenue stamp: a receipt for rent paid in cash above ₹5,000 carries a ₹1 revenue stamp (the
 *   usual state stamp rule). Rent paid by UPI, bank transfer or cheque needs none.
 * - HRA up to ₹3,000 a month: employers don't usually ask for receipts (CBDT Circular 20/2015).
 * - Receipts are the landlord's acknowledgement: they still need the landlord's signature.
 */
import type { Minor } from '../../domain/types'
import { indianNumberWords } from '../../kit/amountWords'

export type RentPaymentMode = 'upi' | 'bank' | 'cash' | 'cheque'
export const RENT_PAYMENT_MODES: readonly RentPaymentMode[] = ['upi', 'bank', 'cash', 'cheque']

/** Above this rent in a financial year, the employer needs the landlord's PAN. */
export const LANDLORD_PAN_THRESHOLD: Minor = 1_00_000_00
/** A cash receipt above this carries a revenue stamp. */
export const REVENUE_STAMP_THRESHOLD: Minor = 5_000_00
/** HRA up to this a month: receipts usually aren't asked for. */
export const NO_RECEIPTS_HRA_PER_MONTH: Minor = 3_000_00
/** Most months one set of receipts covers (two financial years). */
export const MAX_RECEIPT_MONTHS = 24

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** True for a `YYYY-MM` month. */
export function isMonth(value: string): boolean {
  return MONTH.test(value)
}

function parts(month: string): [number, number] {
  const match = MONTH.exec(month)
  if (!match) throw new RangeError(`Not a YYYY-MM month: ${month}`)
  return [Number(match[1]), Number(match[2])]
}

function format(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** The month after `month`. */
export function nextMonth(month: string): string {
  const [y, m] = parts(month)
  return m === 12 ? format(y + 1, 1) : format(y, m + 1)
}

/** "April 2026" (receipts are written in English, the language employers' HR teams process). */
export function monthName(month: string): string {
  const [y, m] = parts(month)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** "Apr 2026". */
export function shortMonthName(month: string): string {
  return monthName(month).replace(/^(\w{3})\w*/, '$1')
}

export interface FinancialYear {
  /** "2026-27". */
  label: string
  /** April of its first year, `YYYY-MM`. */
  from: string
  /** March of its second year, `YYYY-MM`. */
  to: string
}

/** The Indian financial year (April–March) a month falls in. */
export function financialYearOf(month: string): FinancialYear {
  const [y, m] = parts(month)
  const start = m >= 4 ? y : y - 1
  return { label: `${start}-${String((start + 1) % 100).padStart(2, '0')}`, from: format(start, 4), to: format(start + 1, 3) }
}

/** Every month from `from` to `to`, both included; empty when `to` is before `from`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to && out.length <= MAX_RECEIPT_MONTHS * 4; m = nextMonth(m)) out.push(m)
  return out
}

/** `YYYY-MM-DD` for `day` of `month`, clamped to the month's last day. */
export function dayOf(month: string, day: number): string {
  const [y, m] = parts(month)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(Math.min(Math.max(1, Math.round(day)), last)).padStart(2, '0')}`
}

/** True when a year of this monthly rent (12 months) is more than ₹1,00,000. */
export function needsLandlordPan(monthlyShare: Minor): boolean {
  return monthlyShare * 12 > LANDLORD_PAN_THRESHOLD
}

/** True for a cash receipt above ₹5,000. */
export function needsRevenueStamp(mode: RentPaymentMode, amount: Minor): boolean {
  return mode === 'cash' && amount > REVENUE_STAMP_THRESHOLD
}

/** A PAN: five letters, four digits, a letter (e.g. ABCDE1234F). */
export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/

/** Upper-cases and strips spaces from a typed PAN. */
export function normalizePan(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

function title(words: string): string {
  return words.replace(/(^|[\s-])([a-z])/g, (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`)
}

/** "Rupees Fourteen Thousand Five Hundred Only", or "… and Fifty Paise Only", on the Indian system. */
export function rupeesInWords(amount: Minor): string {
  const rupees = Math.floor(amount / 100)
  const paise = amount % 100
  const words = [`Rupees ${title(indianNumberWords(rupees))}`]
  if (paise > 0) words.push(`and ${title(indianNumberWords(paise))} Paise`)
  return `${words.join(' ')} Only`
}

export interface RentReceipt {
  /** "R-FL7Q-2-202604" — the rent, the flatmate and the first month. */
  number: string
  /** First and last month covered (`YYYY-MM`). */
  from: string
  to: string
  /** "April 2026" or "April 2026 – June 2026". */
  period: string
  months: number
  amount: Minor
  words: string
  /** Carries a ₹1 revenue stamp (cash above ₹5,000). */
  stamp: boolean
}

export interface ReceiptPlan {
  /** The rent's id (its first characters go into the receipt number). */
  rentId: string
  /** The flatmate's position in the rent (1-based in the number). */
  tenantIndex: number
  monthlyShare: Minor
  /** Months to cover, in order (`YYYY-MM`). */
  months: readonly string[]
  /** One receipt a month, or one a quarter of the financial year (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar). */
  per: 'month' | 'quarter'
  mode: RentPaymentMode
}

/** The quarter of the financial year a month is in: 0 = Apr–Jun … 3 = Jan–Mar, keyed by year. */
function quarterKey(month: string): string {
  const [, m] = parts(month)
  const fy = financialYearOf(month)
  return `${fy.label}-${Math.floor(((m + 8) % 12) / 3)}`
}

/** The receipts for a plan: consecutive months of the same quarter share a receipt when `per` is 'quarter'. */
export function buildReceipts(plan: ReceiptPlan): RentReceipt[] {
  const months = [...new Set(plan.months.filter(isMonth))].sort().slice(0, MAX_RECEIPT_MONTHS)
  const groups: string[][] = []
  for (const month of months) {
    const last = groups.at(-1)
    const previous = last?.at(-1)
    if (last && previous && plan.per === 'quarter' && quarterKey(previous) === quarterKey(month) && nextMonth(previous) === month) last.push(month)
    else groups.push([month])
  }
  const code = plan.rentId.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'RENT'
  return groups.map((group) => {
    const from = group[0] as string
    const to = group.at(-1) as string
    const amount = plan.monthlyShare * group.length
    return {
      number: `R-${code}-${plan.tenantIndex + 1}-${from.replace('-', '')}`,
      from,
      to,
      period: from === to ? monthName(from) : `${monthName(from)} – ${monthName(to)}`,
      months: group.length,
      amount,
      words: rupeesInWords(amount),
      stamp: needsRevenueStamp(plan.mode, amount),
    }
  })
}

/** Splits `total` into `count` shares that add up exactly (the first ones take the extra paise). */
export function equalShares(total: Minor, count: number): Minor[] {
  if (count <= 0) return []
  const base = Math.floor(total / count)
  const extra = total - base * count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}
