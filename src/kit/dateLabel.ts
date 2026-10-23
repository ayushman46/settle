/** Friendly labels for an expense's calendar date ("Today", "Yesterday", "18 Oct"). */
import { daysBetween, isIsoDate, today as todayIso } from '../engine/dates'
import { getLanguage, intlLocale, t } from '../i18n'

function formatter(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(locale, locale === undefined ? options : { ...options, numberingSystem: 'latn' })
  } catch {
    return null
  }
}

interface DateFormats {
  short: Intl.DateTimeFormat | null
  withYear: Intl.DateTimeFormat | null
  full: Intl.DateTimeFormat | null
}

const FORMATS = new Map<string, DateFormats>()

/**
 * The date formats for the UI language: English keeps the phone's own date order (as it always
 * has); other languages use their Indian locale ("18 अक्टू॰"), always with Latin digits.
 */
function formats(): DateFormats {
  const lang = getLanguage()
  let found = FORMATS.get(lang)
  if (!found) {
    const locale = lang === 'en' ? undefined : intlLocale(lang)
    found = {
      short: formatter(locale, { day: 'numeric', month: 'short' }),
      withYear: formatter(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      full: formatter(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    }
    FORMATS.set(lang, found)
  }
  return found
}

/** A local Date at noon on `iso` (noon keeps it clear of any daylight-saving edge). */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(2000, 0, 1, 12)
  date.setFullYear(y ?? 2000, (m ?? 1) - 1, d ?? 1)
  return date
}

/**
 * "Today", "Yesterday", "Tomorrow"; otherwise a short date in the person's locale — "18 Oct"
 * this year, "18 Oct 2025" for other years. Anything that isn't a real `YYYY-MM-DD` → "Pick a date".
 */
export function relativeDateLabel(iso: string, today: string = todayIso()): string {
  if (!isIsoDate(iso)) return t('kit.date.pick')
  if (isIsoDate(today)) {
    const diff = daysBetween(today, iso)
    if (diff === 0) return t('common.date.today')
    if (diff === -1) return t('common.date.yesterday')
    if (diff === 1) return t('kit.date.tomorrow')
  }
  const sameYear = isIsoDate(today) && today.slice(0, 4) === iso.slice(0, 4)
  const fmt = sameYear ? formats().short : formats().withYear
  return fmt ? fmt.format(localDate(iso)) : iso
}

/** The whole date for assistive tech: "Saturday, 18 October 2026" (locale order). */
export function fullDateLabel(iso: string): string {
  if (!isIsoDate(iso)) return ''
  const full = formats().full
  return full ? full.format(localDate(iso)) : iso
}
