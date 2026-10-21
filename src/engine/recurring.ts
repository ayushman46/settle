/**
 * Recurring splits (rent, Wi-Fi, Netflix): which month is next for each template and when it's
 * due. A template only ever asks about one month at a time — months that were skipped are
 * not nagged about.
 */
import type { RecurringTemplate } from '../domain/types'
import { addMonths, dateInPeriod, daysBetween, isIsoDate, isPeriod, periodOf, toIsoDate } from './dates'

/** Upcoming templates are listed this many days before they're due. */
export const DUE_SOON_DAYS = 7

export interface RecurringDue {
  template: RecurringTemplate
  /** The month to create (`YYYY-MM`) — pass it to `createExpenseFromRecurring`. */
  period: string
  /** `YYYY-MM-DD`. */
  dueDate: string
  /** The due date has passed. */
  overdue: boolean
  /** Days until the due date (negative when overdue). */
  daysUntil: number
}

/**
 * The next month a template should be split for: this month if it hasn't been yet, else next
 * month. A template never asks for a month whose due date came before it was set up.
 */
export function nextRecurringPeriod(template: RecurringTemplate, today: string): { period: string; dueDate: string } {
  const current = periodOf(today)
  let period = current
  if (template.lastCreatedPeriod && isPeriod(template.lastCreatedPeriod) && template.lastCreatedPeriod >= current) {
    period = addMonths(template.lastCreatedPeriod, 1)
  }
  const created = Number.isFinite(template.createdAt) && template.createdAt > 0 ? toIsoDate(new Date(template.createdAt)) : null
  if (created) {
    const createdPeriod = periodOf(created)
    const firstPeriod = created <= dateInPeriod(createdPeriod, template.dayOfMonth) ? createdPeriod : addMonths(createdPeriod, 1)
    if (period < firstPeriod) period = firstPeriod
  }
  return { period, dueDate: dateInPeriod(period, template.dayOfMonth) }
}

/**
 * Active templates that need attention: overdue ones and those due within `withinDays`
 * (default 7), soonest first.
 */
export function dueRecurring(
  templates: readonly RecurringTemplate[],
  today: string,
  opts: { withinDays?: number } = {},
): RecurringDue[] {
  if (!isIsoDate(today)) return []
  const window = opts.withinDays ?? DUE_SOON_DAYS
  const out: RecurringDue[] = []
  for (const template of templates) {
    if (!template.active) continue
    const { period, dueDate } = nextRecurringPeriod(template, today)
    const daysUntil = daysBetween(today, dueDate)
    if (daysUntil > window) continue
    out.push({ template, period, dueDate, overdue: daysUntil < 0, daysUntil })
  }
  return out.sort(
    (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) || a.template.title.localeCompare(b.template.title),
  )
}
