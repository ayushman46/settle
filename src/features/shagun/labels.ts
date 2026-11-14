/** The shagun book's words: the reason behind "What should I give?", kinds, default names. */
import { t } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import type { ShagunAdvice } from './engine'
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

/** "Gave you ₹1,100 + silver coin", "You gave a saree". */
export function entryWhat(entry: ShagunEntry): string {
  const money = entry.amount > 0 ? rupees(entry.amount) : ''
  const thing = money && entry.gift ? `${money} + ${entry.gift}` : money || entry.gift || ''
  if (entry.amount > 0) return t(entry.direction === 'received' ? 'shagun.family.received' : 'shagun.family.given', { amount: thing })
  return t(entry.direction === 'received' ? 'shagun.family.receivedGift' : 'shagun.family.givenGift', { gift: thing })
}

/** "12 Feb 2024 · Our wedding, Feb 2024". */
export function entryWhen(entry: ShagunEntry, fn: ShagunFunction | null, today: string): string {
  const date = relativeDateLabel(entry.date, today)
  return fn ? `${date} · ${fn.name}` : date
}
