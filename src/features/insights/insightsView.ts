/**
 * What the Insights screen shows for a range — the engine's numbers plus the few plain-language
 * extras around them (the biggest category, a monthly average, expenses in other currencies).
 */
import type { CategoryId, Expense, Minor } from '../../domain/types'
import { wholePercents } from '../../components/chartMath'
import { insights, insightsRange, type Insights, type InsightsRange } from '../../engine/insights'
import { getLanguage, intlLocale, t, type MessageKey } from '../../i18n'
import { currencyDigits } from '../../lib/money'

export interface RangeOption {
  value: InsightsRange
  /** Chip text, in the current language (read when used). Sentences about the range select on `value`. */
  readonly label: string
}

function rangeOption(value: InsightsRange, label: MessageKey): RangeOption {
  return {
    value,
    get label() {
      return t(label)
    },
  }
}

export const RANGE_OPTIONS: readonly RangeOption[] = [
  rangeOption('this_month', 'insights.range.thisMonth'),
  rangeOption('last_3_months', 'insights.range.last3Months'),
  rangeOption('this_year', 'insights.range.thisYear'),
  rangeOption('all', 'insights.range.all'),
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

const formatters = new Map<string, Intl.DateTimeFormat | null>()

/** A month formatter in the UI language (Latin digits), made once per language and style. */
function formatter(style: 'short' | 'long'): Intl.DateTimeFormat | null {
  const locale = intlLocale(getLanguage())
  const key = `${locale}|${style}`
  if (!formatters.has(key)) {
    const options: Intl.DateTimeFormatOptions = style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' }
    let made: Intl.DateTimeFormat | null
    try {
      made = new Intl.DateTimeFormat(locale, { ...options, numberingSystem: 'latn' })
    } catch {
      made = null
    }
    formatters.set(key, made)
  }
  return formatters.get(key) ?? null
}

function monthDate(period: string): Date {
  const [y, m] = period.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, 15, 12)
}

/** "Oct" for `2026-10`. */
export function shortMonth(period: string): string {
  const format = formatter('short')
  return format ? format.format(monthDate(period)) : period.slice(5)
}

/** "October 2026" for `2026-10`. */
export function longMonth(period: string): string {
  const format = formatter('long')
  return format ? format.format(monthDate(period)) : period
}
