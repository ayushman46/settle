/**
 * A reminder for a stuck payment's next date. Settle sends no notifications, so the day that matters
 * — the day after it was due back, the day a complaint's time runs out, a week before the last day
 * for the RBI Ombudsman — goes in your calendar instead: an .ics file any calendar app opens, or a
 * Google Calendar link. Both are made on this phone; nothing is sent to a server.
 */
import type { StuckPayment } from '../../data/stores'
import { addDays } from '../../engine/dates'
import { t } from '../../i18n'
import { dueBy, ombudsmanLastDay, type StuckNext } from './rules'
import { inr, partyName, stuckDate } from './view'

/** What it reminds you of: it's due back, a complaint's time is up, or the RBI Ombudsman's last week. */
export type StuckReminderKind = 'due' | 'next' | 'lastDay'

export interface StuckReminder {
  kind: StuckReminderKind
  /** The day to be reminded on, YYYY-MM-DD. */
  date: string
  /** The event's title: what's stuck, with whom, and what to do. */
  title: string
  /** The event's notes. */
  details: string
}

/** The RBI Ombudsman's last day comes a week early, while there's still time to file. */
const LAST_DAY_NOTICE = 7

/** The next day worth a reminder, or null when there's nothing to wait for (it's yours to do now, or it's closed). */
export function reminderFor(s: StuckPayment, next: StuckNext, today: string): StuckReminder | null {
  const vars = { amount: inr(s.amount), name: partyName(s) }
  let reminder: Omit<StuckReminder, 'details'> | null = null
  switch (next.stage) {
    case 'waiting':
      // Not back by its last day: the day after, it's time to raise it.
      reminder = { kind: 'due', date: addDays(next.until ?? dueBy(s), 1), title: t('stuck.remind.event.due', vars) }
      break
    case 'raised':
    case 'compensationRaised':
      if (next.until) reminder = { kind: 'next', date: addDays(next.until, 1), title: t('stuck.remind.event.next', vars) }
      break
    case 'escalate':
    case 'compensationEscalate': {
      const last = next.step === 'ombudsman' ? ombudsmanLastDay(s) : null
      if (last) {
        const early = addDays(last, -LAST_DAY_NOTICE)
        reminder = { kind: 'lastDay', date: early > today ? early : last, title: t('stuck.remind.event.lastDay', { ...vars, date: stuckDate(last, today) }) }
      }
      break
    }
    default:
      return null
  }
  if (!reminder || reminder.date <= today) return null
  return { ...reminder, details: t('stuck.remind.event.details') }
}

/** YYYY-MM-DD as iCalendar and Google Calendar write a day: YYYYMMDD. */
function compact(iso: string): string {
  return iso.replace(/-/g, '')
}

/** Text as an iCalendar TEXT value: backslashes, semicolons, commas and line breaks escaped (RFC 5545 §3.3.11). */
function icsText(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')
}

/** A content line folded at 75 octets (RFC 5545 §3.1), never inside a character — rupee signs and Indic text are several bytes each. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const bytes = encoder.encode(ch).length
    if (size + bytes > 75) {
      parts.push(current)
      current = ' '
      size = 1
    }
    current += ch
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n')
}

/** The reminder as an .ics file: one all-day event on its day, with an alert at 9 that morning. */
export function icsFor(reminder: StuckReminder, id: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Settle//Stuck money//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:stuck-${id}-${reminder.kind}-${compact(reminder.date)}@settle`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(reminder.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(reminder.date, 1))}`,
    `SUMMARY:${icsText(reminder.title)}`,
    `DESCRIPTION:${icsText(reminder.details)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(reminder.title)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** The same event as a Google Calendar link: its "new event" page, filled in, for you to save. */
export function googleCalendarUrl(reminder: StuckReminder): string {
  const dates = `${compact(reminder.date)}/${compact(addDays(reminder.date, 1))}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminder.title)}&dates=${dates}&details=${encodeURIComponent(reminder.details)}`
}
