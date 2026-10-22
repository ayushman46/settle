/**
 * What the Insights screen shows for a range — the engine's numbers plus the few plain-English
 * extras around them (the biggest category, a monthly average, expenses in other currencies).
 */
import type { CategoryId, Expense, Minor } from '../../domain/types'
import { wholePercents } from '../../components/chartMath'
import { insights, insightsRange, type Insights, type InsightsRange } from '../../engine/insights'
import { currencyDigits } from '../../lib/money'

export interface RangeOption {
  value: InsightsRange
  /** Chip text. */
  label: string
  /** Fuller words for sentences ("in the last 3 months"). */
  phrase: string
}

export const RANGE_OPTIONS: readonly RangeOption[] = [
  { value: 'this_month', label: 'This month', phrase: 'this month' },
  { value: 'last_3_months', label: '3 months', phrase: 'in the last 3 months' },
  { value: 'this_year', label: 'This year', phrase: 'this year' },
  { value: 'all', label: 'All time', phrase: 'since you started' },
]

/** Most months drawn in the month chart (the latest ones). */
export const MAX_MONTH_BARS = 12

/** Most people listed under "Who you split with". */
export const TOP_PEOPLE = 5

export interface InsightsView extends Insights {
  range: InsightsRange
  /** The biggest category and its whole-percent share of what I spent; null when nothing was spent. */
  top: { category: CategoryId; percent: number } | null
  /** About how much a month (whole units, rounded down) — only for ranges longer than a month. */
  perMonth: Minor | null
  /** The latest months (at most `MAX_MONTH_BARS`), oldest first. */
  months: Insights['byMonth']
  /** People, biggest first (at most `TOP_PEOPLE`). */
  people: Insights['topFriends']
  /** Expenses I was part of in this range that are in another currency (not counted above). */
  otherCurrencyCount: number
}

function involves(e: Expense, meId: string): boolean {
  return e.payerId === meId || (e.shares[meId] ?? 0) > 0
}

/** Insights for `range` as of `today`, in `currency` (amounts are never converted). */
export function insightsView(
  expenses: readonly Expense[],
  opts: { meId: string; currency: string; range: InsightsRange; today: string },
): InsightsView {
  const { meId, currency, range, today } = opts
  const bounds = insightsRange(range, today)
  const data = insights(expenses, { meId, currency, ...bounds })

  // The same whole percents the category chart's legend shows (they add up to exactly 100).
  const biggest = data.byCategory[0]
  const percent = wholePercents(data.byCategory.map((c) => c.amount))[0] ?? 0
  const top = biggest && data.spent > 0 ? { category: biggest.category, percent } : null

  const unit = 10 ** currencyDigits(currency)
  const monthCount = data.byMonth.length
  const perMonth =
    range !== 'this_month' && monthCount > 1 && data.spent > 0 ? Math.floor(data.spent / monthCount / unit) * unit : null

  let otherCurrencyCount = 0
  for (const e of expenses) {
    if (e.currency === currency || !involves(e, meId)) continue
    if ((bounds.from && e.date < bounds.from) || (bounds.to && e.date > bounds.to)) continue
    otherCurrencyCount += 1
  }

  return {
    ...data,
    range,
    top,
    perMonth,
    months: data.byMonth.slice(-MAX_MONTH_BARS),
    people: data.topFriends.slice(0, TOP_PEOPLE),
    otherCurrencyCount,
  }
}

/**
 * The range to open on: the shortest one with something in it (this month if anything was spent
 * this month, else the last 3 months, …), so the screen never opens empty when there's data.
 */
export function initialRange(expenses: readonly Expense[], opts: { meId: string; currency: string; today: string }): InsightsRange {
  for (const option of RANGE_OPTIONS) {
    const bounds = insightsRange(option.value, opts.today)
    if (insights(expenses, { meId: opts.meId, currency: opts.currency, ...bounds }).spent > 0) return option.value
  }
  return 'this_month'
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, options)
  } catch {
    return null
  }
}

const SHORT_MONTH = formatter({ month: 'short' })
const LONG_MONTH = formatter({ month: 'long', year: 'numeric' })

function monthDate(period: string): Date {
  const [y, m] = period.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, 15, 12)
}

/** "Oct" for `2026-10`. */
export function shortMonth(period: string): string {
  return SHORT_MONTH ? SHORT_MONTH.format(monthDate(period)) : period.slice(5)
}

/** "October 2026" for `2026-10`. */
export function longMonth(period: string): string {
  return LONG_MONTH ? LONG_MONTH.format(monthDate(period)) : period
}
