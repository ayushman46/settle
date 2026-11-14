/** The shagun book's words: the reason behind "What should I give?", kinds, default names. */
import { t } from '../../i18n'
import { daysBetween, isIsoDate } from '../../engine/dates'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import type { GivenNote, ShagunAdvice } from './engine'
import type { ShagunEntry, ShagunFunction, ShagunKind } from './types'

export function rupees(paise: number): string {
  return formatMoney(paise, 'INR', { trimZeros: true })
}

export function kindLabel(kind: ShagunKind): string {
  return t(`shagun.kind.${kind}`)
}

/** "at your wedding", "at Sharma ji’s daughter’s wedding", or '' without a function. */
function atPhrase(fn: ShagunFunction | null): string {
  if (!fn) return ''
  return fn.mine ? t('shagun.at.mine', { kind: fn.kind }) : t('shagun.at.theirs', { name: fn.name })
}

/**
 * "They gave ₹1,100 at your wedding in 2024. With 2 years gone by, ₹1,301." Null when there's
 * nothing to go on (say "No history with them yet" instead).
 */
export function adviceText(advice: ShagunAdvice): string | null {
  if (advice.kind === 'none') return null
  const at = atPhrase(advice.fn)
  const year = advice.date.slice(0, 4)
  if (advice.kind === 'gift') {
    const gift = advice.gift || t('shagun.advice.gift.unnamed')
    return at ? t('shagun.advice.gift.at', { gift, at, year }) : t('shagun.advice.gift', { gift, year })
  }
  const gave = rupees(advice.gave)
  const first = at ? t('shagun.advice.gave.at', { gave, at, year }) : t('shagun.advice.gave', { gave, year })
  return `${first} ${t('shagun.advice.give', { years: advice.years, amount: rupees(advice.amount) })}`
}

/** "You gave them ₹1,101 at Neha’s wedding in 2026." Null when you haven't given them anything. */
export function givenText(given: GivenNote | null): string | null {
  if (!given) return null
  const what = given.amount > 0 ? rupees(given.amount) : given.gift || t('shagun.advice.gift.unnamed')
  const at = atPhrase(given.fn)
  const year = given.date.slice(0, 4)
  return at ? t('shagun.advice.yougave.at', { what, at, year }) : t('shagun.advice.yougave', { what, year })
}

let monthFormat: Intl.DateTimeFormat | null | undefined

/** "Feb 2024" for `2024-02-12`. */
export function monthLabel(iso: string): string {
  if (monthFormat === undefined) {
    try {
      monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    } catch {
      monthFormat = null
    }
  }
  return monthFormat ? monthFormat.format(new Date(`${iso}T00:00:00Z`)) : iso.slice(0, 7)
}

/** "Our wedding, Feb 2024" / "A wedding, Nov 2026": the name when none is typed. */
export function defaultFunctionName(kind: ShagunKind, mine: boolean, date: string): string {
  return t(mine ? 'shagun.default.mine' : 'shagun.default.theirs', { kind, month: monthLabel(date) })
}

/** "₹1,100 + silver coin", "₹501", "saree": what was in it, without who or which way. */
export function entryThing(entry: ShagunEntry): string {
  const money = entry.amount > 0 ? rupees(entry.amount) : ''
  return money && entry.gift ? `${money} + ${entry.gift}` : money || entry.gift || ''
}

/** "Gave you ₹1,100 + silver coin", "You gave a saree". */
export function entryWhat(entry: ShagunEntry): string {
  const thing = entryThing(entry)
  if (entry.amount > 0) return t(entry.direction === 'received' ? 'shagun.family.received' : 'shagun.family.given', { amount: thing })
  return t(entry.direction === 'received' ? 'shagun.family.receivedGift' : 'shagun.family.givenGift', { gift: thing })
}

let dayFormat: Intl.DateTimeFormat | null | undefined

/**
 * "12 Feb 2024", always with the year (a book spans years: "20 Jan" next to "18 Feb 2024" reads
 * as if one had no year). Today and yesterday still say so.
 */
export function dateWithYear(iso: string, today: string): string {
  if (!isIsoDate(iso) || (isIsoDate(today) && Math.abs(daysBetween(today, iso)) <= 1)) return relativeDateLabel(iso, today)
  if (dayFormat === undefined) {
    try {
      dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    } catch {
      dayFormat = null
    }
  }
  return dayFormat ? dayFormat.format(new Date(`${iso}T00:00:00Z`)) : iso
}

/** "12 Feb 2024 · Our wedding, Feb 2024". */
export function entryWhen(entry: ShagunEntry, fn: ShagunFunction | null, today: string): string {
  const date = dateWithYear(entry.date, today)
  return fn ? `${date} · ${fn.name}` : date
}
