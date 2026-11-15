/** Words for the "All square" card: the trip's dates ("12 to 15 Nov") and the text that gets shared. */
import { BRAND, type Group } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { getLanguage, intlLocale, t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { TripFacts } from './engine'

function parts(iso: string, withYear: boolean): { day: string; rest: string } | null {
  if (!isIsoDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const lang = getLanguage()
  try {
    const format = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : intlLocale(lang), {
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      numberingSystem: 'latn',
      timeZone: 'UTC',
    })
    return { day: String(d ?? 1), rest: format.format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12))) }
  } catch {
    return null
  }
}

/**
 * "15 Nov" for one day, "12 to 15 Nov" within a month, "28 Oct to 2 Nov" across months, and the
 * years too when they differ ("30 Dec 2026 to 2 Jan 2027"). Null when there are no dates.
 */
export function tripDates(from: string | null, to: string | null): string | null {
  if (from === null || to === null) return null
  const years = from.slice(0, 4) !== to.slice(0, 4)
  const a = parts(from, years)
  const b = parts(to, years)
  if (!a || !b) return null
  const end = `${b.day} ${b.rest}`
  if (from === to) return end
  if (from.slice(0, 7) === to.slice(0, 7)) return t('checkout.dates.range', { from: a.day, to: end })
  return t('checkout.dates.range', { from: `${a.day} ${a.rest}`, to: end })
}

/**
 * The text to share once everyone is square:
 *
 * ```
 * 🏖️ Goa 2026: all square
 * 12 to 15 Nov · ₹48,000 spent · 6 people
 * 3 payments and nobody owes anybody.
 *
 * — split with Settle
 * ```
 */
export function allSquareText(group: Pick<Group, 'name' | 'emoji' | 'currency'>, facts: TripFacts, payments: number): string {
  const spent = formatMoney(facts.spent, group.currency, { trimZeros: true })
  const dates = tripDates(facts.from, facts.to)
  return [
    t('checkout.text.head', { emoji: group.emoji, name: group.name }).trim(),
    dates ? t('checkout.text.stats.dated', { dates, spent, people: facts.people }) : t('checkout.text.stats', { spent, people: facts.people }),
    t('checkout.text.payments', { count: payments }),
    '',
    t('groups.summary.footer', { brand: BRAND.name }),
  ].join('\n')
}
