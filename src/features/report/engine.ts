/**
 * Expense report: the expenses Settle already has, laid out as a claim sheet for the office.
 * Pure: everything (today included) comes in as arguments.
 *
 * - Scope: one group, or a date range (every expense in it, any group or none).
 * - Basis: "what I paid" (expenses I paid for, the full amount) or "my share" (my part of each).
 * - Loans are never spending, so never claimed.
 */
import { ME_ID, type CategoryId, type Expense, type Group, type Minor } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { daysInMonth } from '../../engine/dates'
import { formatRate } from '../../engine/fx'
import { indianNumberWords } from '../../kit/amountWords'
import { allocate } from '../../lib/money'

export type ReportBasis = 'paid' | 'share'

export type ReportScope = { kind: 'group'; groupId: string } | { kind: 'dates'; from: string; to: string }

export interface ReportRow {
  id: string
  date: string
  title: string
  category: CategoryId
  /** English category name (the sheet is for the office). */
  categoryLabel: string
  payerId: string
  paidBy: string
  /** What is claimed, in the expense's currency. */
  amount: Minor
  currency: string
  /** Paid abroad: the bill in the currency actually paid, this row's part of it, and the rate used. */
  original: ReportOriginal | null
  /** An itemized bill or a scanned one: there is a bill to attach. */
  hasBill: boolean
}

export interface ReportOriginal {
  /** This row's part of the foreign bill (all of it when `whole`). */
  amount: Minor
  /** The whole foreign bill, as on the receipt. */
  bill: Minor
  /** The row claims the whole bill (false: only a share of it). */
  whole: boolean
  currency: string
  /** The stored rate, at full precision. */
  rate: string
  /** The rate as people read it: 4 decimals at most ("94.2431"), like the expense page. */
  rateShown: string
}

export interface CategoryTotal {
  category: CategoryId
  label: string
  currency: string
  amount: Minor
  count: number
}

export interface CurrencyTotal {
  currency: string
  amount: Minor
  count: number
}

export interface Report {
  rows: ReportRow[]
  /** Biggest first, per currency. */
  categories: CategoryTotal[]
  /** Rupees first, then by currency code. */
  totals: CurrencyTotal[]
  /** The rupee total in words, or null when there are no rupees. */
  words: string | null
}

export interface ReportInput {
  expenses: readonly Expense[]
  scope: ReportScope
  basis: ReportBasis
  /** Expense ids left out (unticked). */
  skipped?: ReadonlySet<string>
  /** Who "I" am. Default the device owner. */
  me?: string
  nameOf: (id: string) => string
}

/** `YYYY-MM-DD` → "05/04/2026" (Indian day-first order). */
export function indianDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** `YYYY-MM-DD` → the first and last day of that month. */
export function monthRange(today: string): { from: string; to: string } {
  const month = today.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const last = daysInMonth(y ?? 2000, m ?? 1)
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

function inScope(e: Expense, scope: ReportScope): boolean {
  if (scope.kind === 'group') return e.groupId === scope.groupId
  const [from, to] = scope.from <= scope.to ? [scope.from, scope.to] : [scope.to, scope.from]
  return e.date >= from && e.date <= to
}

/** What this expense puts on my claim under `basis` (0 = nothing). */
export function claimAmount(e: Expense, basis: ReportBasis, me: string = ME_ID): Minor {
  if (e.kind === 'loan') return 0
  const amount = basis === 'paid' ? (e.payerId === me ? e.total : 0) : (e.shares[me] ?? 0)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
}

export function hasBill(e: Expense): boolean {
  return e.kind === 'bill' || e.source === 'scan'
}

function compareRows(a: { date: string; title: string; id: string }, b: { date: string; title: string; id: string }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const byTitle = a.title.localeCompare(b.title)
  if (byTitle !== 0) return byTitle
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function toRow(e: Expense, amount: Minor, nameOf: (id: string) => string): ReportRow {
  let original: ReportRow['original'] = null
  if (e.fx && e.fx.currency !== e.currency && e.total > 0) {
    // My share abroad, in what was paid: the same part of the foreign amount.
    const whole = amount === e.total
    const foreign = whole ? e.fx.amount : (allocate(e.fx.amount, [amount, e.total - amount])[0] ?? 0)
    original = {
      amount: foreign,
      bill: e.fx.amount,
      whole,
      currency: e.fx.currency,
      rate: e.fx.rate,
      rateShown: formatRate(e.fx.rate, e.fx.currency, e.currency),
    }
  }
  return {
    id: e.id,
    date: e.date,
    title: e.title.trim(),
    category: e.category,
    categoryLabel: CATEGORY_META[e.category]?.label ?? CATEGORY_META.other.label,
    payerId: e.payerId,
    paidBy: nameOf(e.payerId),
    amount,
    currency: e.currency,
    original,
    hasBill: hasBill(e),
  }
}

/** Every expense that could go on the claim (ticked or not), oldest first. */
export function reportCandidates(input: Omit<ReportInput, 'skipped'>): ReportRow[] {
  const me = input.me ?? ME_ID
  const rows: ReportRow[] = []
  for (const e of input.expenses) {
    if (!inScope(e, input.scope)) continue
    const amount = claimAmount(e, input.basis, me)
    if (amount > 0) rows.push(toRow(e, amount, input.nameOf))
  }
  return rows.sort(compareRows)
}

/**
 * The dates the sheet covers: its first and last expense (`to` equals `from` for one day), or null
 * with nothing on it.
 */
export function reportPeriod(rows: readonly { date: string }[]): { from: string; to: string } | null {
  let from: string | null = null
  let to: string | null = null
  for (const r of rows) {
    if (from === null || r.date < from) from = r.date
    if (to === null || r.date > to) to = r.date
  }
  return from !== null && to !== null ? { from, to } : null
}

/** Rupees in words, the way claim forms want them: 240050 → "Two thousand four hundred rupees and fifty paise". */
export function rupeesInWords(minor: Minor): string | null {
  if (!Number.isSafeInteger(minor) || minor <= 0) return null
  const rupees = Math.floor(minor / 100)
  const paise = minor % 100
  const parts: string[] = []
  if (rupees > 0) parts.push(`${indianNumberWords(rupees)} ${rupees === 1 ? 'rupee' : 'rupees'}`)
  if (paise > 0) parts.push(`${indianNumberWords(paise)} ${paise === 1 ? 'paisa' : 'paise'}`)
  const text = parts.join(' and ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Rows from candidates (minus the skipped ones), category totals, totals per currency and the rupee total in words. */
export function summarize(candidates: readonly ReportRow[], skipped: ReadonlySet<string> = new Set()): Report {
  const rows = candidates.filter((r) => !skipped.has(r.id))
  const byCategory = new Map<string, CategoryTotal>()
  const byCurrency = new Map<string, CurrencyTotal>()
  for (const r of rows) {
    const key = `${r.currency}|${r.category}`
    const cat = byCategory.get(key) ?? { category: r.category, label: r.categoryLabel, currency: r.currency, amount: 0, count: 0 }
    cat.amount += r.amount
    cat.count += 1
    byCategory.set(key, cat)
    const cur = byCurrency.get(r.currency) ?? { currency: r.currency, amount: 0, count: 0 }
    cur.amount += r.amount
    cur.count += 1
    byCurrency.set(r.currency, cur)
  }
  const currencyOrder = (a: string, b: string) => (a === b ? 0 : a === 'INR' ? -1 : b === 'INR' ? 1 : a < b ? -1 : 1)
  const totals = [...byCurrency.values()].sort((a, b) => currencyOrder(a.currency, b.currency))
  const categories = [...byCategory.values()].sort(
    (a, b) => currencyOrder(a.currency, b.currency) || b.amount - a.amount || a.label.localeCompare(b.label),
  )
  const inr = byCurrency.get('INR')
  return { rows, categories, totals, words: inr ? rupeesInWords(inr.amount) : null }
}

/** The whole report in one call. */
export function buildReport(input: ReportInput): Report {
  return summarize(reportCandidates(input), input.skipped)
}

/**
 * Where a new report starts: the group with the most recent expense I could claim (either basis),
 * names breaking ties; else this month.
 */
export function defaultScope(groups: readonly Group[], expenses: readonly Expense[], today: string, me: string = ME_ID): ReportScope {
  const recent = claimableGroups(groups, expenses, me)[0]
  return recent ? { kind: 'group', groupId: recent.id } : { kind: 'dates', ...monthRange(today) }
}

/** Groups with anything I could claim, the most recently active first. */
export function claimableGroups(groups: readonly Group[], expenses: readonly Expense[], me: string = ME_ID): Group[] {
  const latest = new Map<string, string>()
  for (const e of expenses) {
    if (!e.groupId || (claimAmount(e, 'paid', me) === 0 && claimAmount(e, 'share', me) === 0)) continue
    const had = latest.get(e.groupId)
    if (had === undefined || e.date > had) latest.set(e.groupId, e.date)
  }
  return groups
    .filter((g) => latest.has(g.id))
    .sort((a, b) => {
      const da = latest.get(a.id) ?? ''
      const db = latest.get(b.id) ?? ''
      return da !== db ? (da > db ? -1 : 1) : a.name.localeCompare(b.name)
    })
}
