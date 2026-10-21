/** Friendly labels for an expense's calendar date ("Today", "Yesterday", "18 Oct"). */
import { daysBetween, isIsoDate, today as todayIso } from '../engine/dates'

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, options)
  } catch {
    return null
  }
}

const SHORT = formatter({ day: 'numeric', month: 'short' })
const WITH_YEAR = formatter({ day: 'numeric', month: 'short', year: 'numeric' })
const FULL = formatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

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
  if (!isIsoDate(iso)) return 'Pick a date'
  if (isIsoDate(today)) {
    const diff = daysBetween(today, iso)
    if (diff === 0) return 'Today'
    if (diff === -1) return 'Yesterday'
    if (diff === 1) return 'Tomorrow'
  }
  const sameYear = isIsoDate(today) && today.slice(0, 4) === iso.slice(0, 4)
  const fmt = sameYear ? SHORT : WITH_YEAR
  return fmt ? fmt.format(localDate(iso)) : iso
}

/** The whole date for assistive tech: "Saturday, 18 October 2026" (locale order). */
export function fullDateLabel(iso: string): string {
  if (!isIsoDate(iso)) return ''
  return FULL ? FULL.format(localDate(iso)) : iso
}
