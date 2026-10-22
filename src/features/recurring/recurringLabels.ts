/** Plain-English labels for recurring splits: "Every month on the 1st", "Due in 3 days", "You'll be owed ₹21,333". */
import { ME_ID, type Minor, type RecurringTemplate } from '../../domain/types'
import { splitAmount } from '../../engine/split'
import { addMonths, dateInPeriod, isIsoDate, periodOf } from '../../engine/dates'
import { nextRecurringPeriod, type RecurringDue } from '../../engine/recurring'
import { formatMoney } from '../../lib/money'

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(day: number): string {
  const n = Math.trunc(day)
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** "Every month on the 1st". */
export function repeatsLabel(dayOfMonth: number): string {
  return `Every month on the ${ordinal(dayOfMonth)}`
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, options)
  } catch {
    return null
  }
}

const DAY_MONTH = formatter({ day: 'numeric', month: 'short' })
const MONTH = formatter({ month: 'long' })
const MONTH_YEAR = formatter({ month: 'long', year: 'numeric' })

function noon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12)
}

/** "1 Nov" (locale order) for a `YYYY-MM-DD`. */
export function shortDate(iso: string): string {
  if (!isIsoDate(iso)) return iso
  return DAY_MONTH ? DAY_MONTH.format(noon(iso)) : iso
}

/** "November" for `2026-11` — with the year when it isn't `today`'s year ("January 2027"). */
export function monthName(period: string, today: string): string {
  const date = noon(`${period}-15`)
  const sameYear = period.slice(0, 4) === today.slice(0, 4)
  const fmt = sameYear ? MONTH : MONTH_YEAR
  return fmt ? fmt.format(date) : period
}

/** "Overdue since 1 Oct", "Due today", "Due tomorrow", "Due in 3 days". */
export function dueLabel(due: Pick<RecurringDue, 'dueDate' | 'daysUntil' | 'overdue'>): string {
  if (due.overdue) return `Overdue since ${shortDate(due.dueDate)}`
  if (due.daysUntil === 0) return 'Due today'
  if (due.daysUntil === 1) return 'Due tomorrow'
  return `Due in ${due.daysUntil} days`
}

/** "Next: 1 Nov" — for templates that aren't due yet. */
export function nextLabel(template: RecurringTemplate, today: string): string {
  return `Next: ${shortDate(nextRecurringPeriod(template, today).dueDate)}`
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
  if (standing.kind === 'owed') return tense === 'future' ? `You'll be owed ${amount}` : `You're owed ${amount}`
  return tense === 'future' ? `You'll owe ${payerName} ${amount}` : `You owe ${payerName} ${amount}`
}
