/** Small display formatters (user locale) that aren't money. */

const dateFormatter: Intl.DateTimeFormat | null = (() => {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
})()

/**
 * A bill date for display. ISO dates ("2026-10-18") become "18 Oct 2026" / "Oct 18, 2026" per
 * locale; anything else is shown as printed. Null/blank → null.
 */
export function formatBillDate(date: string | null | undefined): string | null {
  const text = date?.trim()
  if (!text) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (match && dateFormatter) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const local = new Date(2000, 0, 1)
    local.setFullYear(year, month, day)
    const valid = local.getFullYear() === year && local.getMonth() === month && local.getDate() === day
    if (valid) return dateFormatter.format(local)
  }
  return text.length > 40 ? `${text.slice(0, 39)}…` : text
}

const percentCache = new Map<string, Intl.NumberFormat>()

/**
 * A ratio as a percentage: `formatPercent(0.0823)` → "8.2%". `sign: 'always'` adds +/− (not for zero).
 */
export function formatPercent(
  rate: number,
  opts: { sign?: 'auto' | 'always' | 'never'; maxFractionDigits?: number } = {},
): string {
  const sign = opts.sign ?? 'auto'
  const digits = opts.maxFractionDigits ?? 1
  const key = `${sign}|${digits}`
  let formatter = percentCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'percent',
      maximumFractionDigits: digits,
      signDisplay: sign === 'always' ? 'exceptZero' : sign,
    })
    percentCache.set(key, formatter)
  }
  const value = Number.isFinite(rate) ? rate : 0
  return formatter.format(value === 0 ? 0 : value)
}

const quantityFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })

/** A line quantity for display ("2", "0.5", "1.25"). */
export function formatQuantity(quantity: number): string {
  return quantityFormatter.format(Number.isFinite(quantity) ? quantity : 1)
}
