/** Words for a tally: months, counts ("28.5 litres"), rates ("₹60 a litre") and the bill as a message. */
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { formatQty, Q, type MonthBill, type Tally, type TallyUnit } from './engine'

export const PRESETS = [
  { id: 'doodh', unit: 'litre', rate: 6000, usual: Q, split: 'equal' },
  { id: 'tiffin', unit: 'meal', rate: 8000, usual: Q, split: 'equal' },
  { id: 'paper', unit: 'day', rate: 600, usual: Q, split: 'equal' },
  { id: 'dhobi', unit: 'piece', rate: 1000, usual: 0, split: 'own' },
  { id: 'water', unit: 'can', rate: 4000, usual: 0, split: 'equal' },
  { id: 'chai', unit: 'cup', rate: 1200, usual: Q, split: 'own' },
] as const
export type PresetId = (typeof PRESETS)[number]['id']

let monthFormat: Intl.DateTimeFormat | null | undefined

/** "November", or "November 2025" when it is not this year's. */
export function monthName(period: string, today: string): string {
  if (monthFormat === undefined) {
    try {
      monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' })
    } catch {
      monthFormat = null
    }
  }
  const name = monthFormat ? monthFormat.format(new Date(`${period}-01T00:00:00Z`)) : period
  return period.slice(0, 4) === today.slice(0, 4) || !monthFormat ? name : `${name} ${period.slice(0, 4)}`
}

let dayFormat: Intl.DateTimeFormat | null | undefined

/** "15 Nov". */
export function dayName(iso: string): string {
  if (dayFormat === undefined) {
    try {
      dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    } catch {
      dayFormat = null
    }
  }
  return dayFormat ? dayFormat.format(new Date(`${iso}T00:00:00Z`)) : iso
}

/** "S", "M", "T"…: the weekday's first letter. */
export function weekdayLetter(iso: string): string {
  return 'SMTWTFS'.charAt(new Date(`${iso}T00:00:00Z`).getUTCDay())
}

export function money(amount: number, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/** "28.5 litres", "1 cup". */
export function qtyLabel(unit: TallyUnit, quarters: number): string {
  return `${formatQty(quarters)} ${t(`tally.unit.${unit}`, { count: quarters / Q })}`
}

/** "₹60 a litre". */
export function rateLabel(tally: Pick<Tally, 'unit' | 'currency'>, rate: number): string {
  return t('tally.rate', { amount: money(rate, tally.currency), per: t(`tally.per.${tally.unit}`) })
}

/** One line of the bill: "28.5 litres × ₹60 = ₹1,710". */
export function billLines(tally: Tally, bill: MonthBill): string[] {
  return bill.lines.map((l) => t('tally.bill.line', { qty: qtyLabel(tally.unit, l.qty), rate: money(l.rate, tally.currency), amount: money(l.amount, tally.currency) }))
}

/**
 * The message for the vendor or the flat: "Doodh for November: 28.5 litres, ₹1,710", the lines
 * when the rate changed, each person's part when it is shared, and the vendor's UPI ID if saved.
 */
export function billText(tally: Tally, bill: MonthBill, today: string, nameOf: (id: string) => string): string {
  const out = [
    t('tally.share.head', { name: tally.name, month: monthName(bill.period, today), qty: qtyLabel(tally.unit, bill.qty), amount: money(bill.total, tally.currency) }),
  ]
  if (bill.lines.length > 1) out.push(...billLines(tally, bill))
  if (bill.parts.length > 1) {
    for (const part of bill.parts) {
      const vars = { name: nameOf(part.id), amount: money(part.amount, tally.currency), qty: qtyLabel(tally.unit, part.qty ?? 0) }
      out.push(t(part.qty === null ? 'tally.share.part' : 'tally.share.part.own', vars))
    }
  }
  if (tally.vendor?.upiId) out.push(t('tally.share.upi', { vendor: tally.vendor.name, upi: tally.vendor.upiId }))
  return out.join('\n')
}
