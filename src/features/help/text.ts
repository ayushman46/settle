/** Words for House help’s salary: months and days as people say them, the month as one sum, the payslip. */
import { isIsoDate, isPeriod } from '../../engine/dates'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { HelpEntry, HelpWork, Helper, MonthSheet } from './engine'

const FORMATS = new Map<string, Intl.DateTimeFormat | null>()

function format(name: 'month' | 'day'): Intl.DateTimeFormat | null {
  let found = FORMATS.get(name)
  if (found === undefined) {
    try {
      found = new Intl.DateTimeFormat('en', name === 'month' ? { month: 'long', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })
    } catch {
      found = null
    }
    FORMATS.set(name, found)
  }
  return found
}

/** "November", with the year ("November 2026") when it is not `today`’s year or no `today` is given. */
export function monthName(period: string, today?: string): string {
  const fmt = format('month')
  if (!isPeriod(period) || !fmt) return period
  const [y, m] = period.split('-').map(Number)
  const name = fmt.format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1)))
  return today && today.slice(0, 4) === period.slice(0, 4) ? name : `${name} ${period.slice(0, 4)}`
}

/** "1 Dec", with the year when it is not `today`’s year or no `today` is given. */
export function dayLabel(iso: string, today?: string): string {
  const fmt = format('day')
  if (!isIsoDate(iso) || !fmt) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const parts = fmt.formatToParts(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)))
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? ''
  const text = `${get('day')} ${get('month')}`
  return today && today.slice(0, 4) === iso.slice(0, 4) ? text : `${text} ${iso.slice(0, 4)}`
}

/** "1st", "2nd", "23rd", "31st". */
export function ordinal(day: number): string {
  const n = Math.trunc(day)
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

/** "the 1st", or "the last day" for a pay day no month is shorter than. */
export function payDayLabel(payDay: number): string {
  return payDay >= 31 ? t('help.payday.last') : t('help.payday.nth', { day: ordinal(payDay) })
}

export function workLabel(work: HelpWork): string {
  return t(`help.work.${work}`)
}

export function entryLabel(entry: Pick<HelpEntry, 'kind' | 'note'>): string {
  const kind = t(`help.entry.${entry.kind}`)
  return entry.note ? `${kind}: ${entry.note}` : kind
}

function money(amount: number, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/**
 * The month as one sum: "₹6,000 salary − ₹2,000 advance + ₹500 extra work = ₹4,500 to pay".
 * Only the parts that are not zero are said.
 */
export function equation(sheet: MonthSheet, currency: string): string {
  const parts = [t('help.eq.salary', { amount: money(sheet.salary, currency) })]
  if (sheet.leaveCut > 0) parts.push(t('help.eq.leave', { amount: money(sheet.leaveCut, currency), days: sheet.extraDaysOff }))
  if (sheet.advanceCut > 0) parts.push(t('help.eq.advance', { amount: money(sheet.advanceCut, currency) }))
  if (sheet.extra > 0) parts.push(t('help.eq.extra', { amount: money(sheet.extra, currency) }))
  if (sheet.bonus > 0) parts.push(t('help.eq.bonus', { amount: money(sheet.bonus, currency) }))
  parts.push(t(sheet.paid ? 'help.eq.paid' : 'help.eq.toPay', { amount: money(sheet.toPay, currency) }))
  return parts.join(' ')
}

/** What the days off mean for the pay, in one honest line; '' when there were none. */
export function daysOffLine(sheet: MonthSheet, currency: string): string {
  if (sheet.daysOff === 0) return ''
  const vars = { days: sheet.daysOff, paid: Math.min(sheet.daysOff, sheet.paidLeave), extra: sheet.extraDaysOff, amount: money(sheet.leaveCut, currency) }
  if (sheet.extraDaysOff === 0) return t('help.daysOff.within', vars)
  return sheet.leaveCut > 0 ? t('help.daysOff.cut', vars) : t('help.daysOff.noCut', vars)
}

export interface PayslipRow {
  label: string
  value: string
}

export interface Payslip {
  title: string
  subtitle: string
  rows: PayslipRow[]
  /** The line that says it was paid: how much, when, how and by whom. Empty while it is not paid. */
  paidLine: string
  thanks: string
}

/** A month’s payslip, the same words for the message and the printed sheet. */
export function payslip(helper: Helper, sheet: MonthSheet, payerName: string): Payslip {
  const cur = helper.currency
  const rows: PayslipRow[] = [{ label: t('help.slip.salary'), value: money(sheet.salary, cur) }]
  if (sheet.extra > 0) rows.push({ label: t('help.slip.extra'), value: `+ ${money(sheet.extra, cur)}` })
  if (sheet.bonus > 0) rows.push({ label: t('help.slip.bonus'), value: `+ ${money(sheet.bonus, cur)}` })
  rows.push({ label: t('help.slip.daysOff'), value: t('help.slip.daysOff.value', { days: sheet.daysOff, paid: Math.min(sheet.daysOff, sheet.paidLeave) }) })
  if (sheet.leaveCut > 0) rows.push({ label: t('help.slip.leaveCut', { days: sheet.extraDaysOff }), value: `− ${money(sheet.leaveCut, cur)}` })
  if (sheet.advanceCut > 0) rows.push({ label: t('help.slip.advance'), value: `− ${money(sheet.advanceCut, cur)}` })
  rows.push({ label: t(sheet.paid ? 'help.slip.paid' : 'help.slip.toPay'), value: money(sheet.toPay, cur) })
  if (sheet.advanceAfter > 0) rows.push({ label: t('help.slip.advanceLeft'), value: money(sheet.advanceAfter, cur) })
  const paid = sheet.paid
  return {
    title: t('help.slip.title', { name: helper.name }),
    subtitle: t('help.slip.subtitle', { month: monthName(sheet.period), work: workLabel(helper.work) }),
    rows,
    paidLine: paid ? t('help.slip.paidLine', { date: dayLabel(paid.paidOn), method: paid.method, name: payerName }) : '',
    thanks: t('help.slip.thanks', { name: helper.name }),
  }
}

export function payslipText(slip: Payslip): string {
  const lines = [slip.title, slip.subtitle, '', ...slip.rows.map((r) => `${r.label}: ${r.value}`)]
  if (slip.paidLine) lines.push(slip.paidLine)
  lines.push('', slip.thanks)
  return lines.join('\n')
}
