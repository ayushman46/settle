/** Small text helpers shared by the kitty's sheet and card. */
import { daysBetween } from '../../engine/dates'
import { getLanguage, intlLocale } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'

/**
 * "Today", "Tomorrow", a weekday within the week ("Sat"), else a short date ("21 Nov"), for the
 * day the kitty runs out.
 */
export function lastsLabel(iso: string, today: string): string {
  const days = daysBetween(today, iso)
  if (days >= 2 && days <= 6) {
    try {
      const lang = getLanguage()
      const [y, m, d] = iso.split('-').map(Number)
      const date = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12)
      return new Intl.DateTimeFormat(lang === 'en' ? undefined : intlLocale(lang), { weekday: 'short' }).format(date)
    } catch {
      // Fall through to the short date.
    }
  }
  return relativeDateLabel(iso)
}

/**
 * When the kitty started, to read inside a sentence: the time when it started today ("2:10 pm"),
 * else "today", "yesterday" or "12 Nov".
 */
export function sinceLabel(iso: string, today: string, startedAt?: number): string {
  if (iso === today && typeof startedAt === 'number' && Number.isFinite(startedAt)) {
    try {
      const lang = getLanguage()
      const time = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : intlLocale(lang), { hour: 'numeric', minute: '2-digit' }).format(new Date(startedAt))
      return lang === 'en' ? time.toLowerCase() : time
    } catch {
      // Fall through to the day.
    }
  }
  const label = relativeDateLabel(iso)
  return daysBetween(iso, today) <= 1 ? label.toLowerCase() : label
}
