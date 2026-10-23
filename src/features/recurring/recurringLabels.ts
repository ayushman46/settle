/** Plain-English labels for recurring splits: "Every month on the 1st", "Due in 3 days", "You'll be owed ₹21,333". */
import { ME_ID, type Minor, type RecurringTemplate } from '../../domain/types'
import { splitAmount } from '../../engine/split'
import { addMonths, dateInPeriod, isIsoDate, periodOf } from '../../engine/dates'
import { nextRecurringPeriod, type RecurringDue } from '../../engine/recurring'
import { getLanguage, intlLocale, t } from '../../i18n'
import { formatMoney } from '../../lib/money'

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(day: number): string {
  const n = Math.trunc(day)
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return t('recurring.ordinal.th', { n })
  switch (n % 10) {
    case 1:
      return t('recurring.ordinal.st', { n })
    case 2:
      return t('recurring.ordinal.nd', { n })
    case 3:
      return t('recurring.ordinal.rd', { n })
    default:
      return t('recurring.ordinal.th', { n })
  }
}

/** "Every month on the 1st". */
export function repeatsLabel(dayOfMonth: number): string {
  return t('recurring.repeats', { day: ordinal(dayOfMonth) })
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()

/**
 * A date formatter for the UI language: English keeps the phone's own order ("1 Nov" / "Nov 1");
 * other languages use their Indian locale with Latin digits ("1 नव॰").
 */
function formatter(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  const lang = getLanguage()
  const id = `${lang}|${name}`
  let fmt = formatters.get(id)
  if (fmt === undefined) {
    try {
      fmt = lang === 'en' ? new Intl.DateTimeFormat(undefined, options) : new Intl.DateTimeFormat(intlLocale(lang), { ...options, numberingSystem: 'latn' })
    } catch {
      fmt = null
    }
    formatters.set(id, fmt)
  }
  return fmt
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const MONTH: Intl.DateTimeFormatOptions = { month: 'long' }
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

function noon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12)
}

/** "1 Nov" (locale order) for a `YYYY-MM-DD`. */
export function shortDate(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const fmt = formatter('dayMonth', DAY_MONTH)
  return fmt ? fmt.format(noon(iso)) : iso
}

/** "November" for `2026-11` — with the year when it isn't `today`'s year ("January 2027"). */
export function monthName(period: string, today: string): string {
  const date = noon(`${period}-15`)
  const sameYear = period.slice(0, 4) === today.slice(0, 4)
  const fmt = sameYear ? formatter('month', MONTH) : formatter('monthYear', MONTH_YEAR)
  return fmt ? fmt.format(date) : period
}

/** "Overdue since 1 Oct", "Due today", "Due tomorrow", "Due in 3 days". */
export function dueLabel(due: Pick<RecurringDue, 'dueDate' | 'daysUntil' | 'overdue'>): string {
  if (due.overdue) return t('recurring.due.overdue', { date: shortDate(due.dueDate) })
  if (due.daysUntil === 0) return t('recurring.due.today')
  if (due.daysUntil === 1) return t('recurring.due.tomorrow')
  return t('recurring.due.inDays', { count: due.daysUntil })
}

/** The same, short enough for a list row's badge: "Overdue", "Due today", "Due in 3 days". */
export function dueBadgeLabel(due: Pick<RecurringDue, 'dueDate' | 'daysUntil' | 'overdue'>): string {
  return due.overdue ? t('recurring.due.badge.overdue') : dueLabel(due)
}

/** "Next: 1 Nov" — for templates that aren't due yet. */
export function nextLabel(template: RecurringTemplate, today: string): string {
  return t('recurring.next', { date: shortDate(nextRecurringPeriod(template, today).dueDate) })
}

/** The first due date a new template would get if set up today on `dayOfMonth`. */
export function firstDueDate(dayOfMonth: number, today: string): string {
  const period = periodOf(today)
  const thisMonth = dateInPeriod(period, dayOfMonth)
  return thisMonth >= today ? thisMonth : dateInPeriod(addMonths(period, 1), dayOfMonth)
}

export interface Standing {
  kind: 'owed' | 'owe' | 'none'
  amount: Minor
}

/** What a split means for me: owed (I paid) the others' shares, or owe the payer my share. */
export function standingFromShares(payerId: string, total: Minor, shares: Readonly<Record<string, Minor>>, meId: string = ME_ID): Standing {
  const mine = shares[meId] ?? 0
  if (payerId === meId) {
    const owed = total - mine
    return owed > 0 ? { kind: 'owed', amount: owed } : { kind: 'none', amount: 0 }
  }
  return mine > 0 ? { kind: 'owe', amount: mine } : { kind: 'none', amount: 0 }
}

/** What the template will mean for me each month (null when its split doesn't add up any more). */
export function templateStanding(template: RecurringTemplate, meId: string = ME_ID): Standing | null {
  const result = splitAmount({
    total: template.total,
    currency: template.currency,
    mode: template.mode,
    participants: template.participants,
    payerId: template.payerId,
  })
  return result.ok ? standingFromShares(template.payerId, template.total, result.shares, meId) : null
}

/** "You'll be owed ₹21,333", "You'll owe Riya ₹10,667", or null when it's all on one person. */
export function standingLine(standing: Standing | null, currency: string, payerName: string, tense: 'future' | 'now' = 'future'): string | null {
  if (!standing || standing.kind === 'none') return null
  const amount = formatMoney(standing.amount, currency, { trimZeros: true })
  if (standing.kind === 'owed') return t(tense === 'future' ? 'recurring.standing.owed.future' : 'recurring.standing.owed.now', { amount })
  return t(tense === 'future' ? 'recurring.standing.owe.future' : 'recurring.standing.owe.now', { name: payerName, amount })
}
