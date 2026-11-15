/** A settle day in words ("the 5th", "the last day of every month") and a date with its weekday ("Sat, 5 Dec"). */
import { isIsoDate } from '../../engine/dates'
import { getLanguage, intlLocale, t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { ordinalSuffix, type OpenSummary, type SettleDay } from './engine'

/** "the 5th" · "the last day of the month". */
export function dayLabel(day: SettleDay): string {
  return day === 'last' ? t('settleday.day.last') : t('settleday.day.nth', { n: day, suffix: ordinalSuffix(day) })
}

/** "the 5th of every month" · "the last day of every month". */
export function everyLabel(day: SettleDay): string {
  return day === 'last' ? t('settleday.every.last') : t('settleday.every.nth', { n: day, suffix: ordinalSuffix(day) })
}

/** What a chip says: "5th" · "Last day". */
export function chipLabel(day: SettleDay): string {
  return day === 'last' ? t('settleday.chip.last') : t('settleday.chip.nth', { n: day, suffix: ordinalSuffix(day) })
}

const FORMATS = new Map<string, Intl.DateTimeFormat | null>()

/** "Sat, 5 Dec": a date people plan around, so it says which day of the week it is. */
export function weekdayDate(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const lang = getLanguage()
  let format = FORMATS.get(lang)
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : intlLocale(lang), { weekday: 'short', day: 'numeric', month: 'short', numberingSystem: 'latn', timeZone: 'UTC' })
    } catch {
      format = null
    }
    FORMATS.set(lang, format)
  }
  const [y, m, d] = iso.split('-').map(Number)
  return format ? format.format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12))) : iso
}

/** "You pay ₹500. 3 payments clear Flat 4B.": what is open, from the owner's side. Every number is the one its sentence is about. */
export function openLine(open: OpenSummary, group: { name: string; currency: string }): string {
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  if (open.youPay > 0) return t('settleday.open.pay', { amount: money(open.youPay), count: open.count, name: group.name })
  if (open.youGet > 0) return t('settleday.open.get', { amount: money(open.youGet), count: open.count, name: group.name })
  return t('settleday.open.others', { count: open.count, name: group.name })
}
