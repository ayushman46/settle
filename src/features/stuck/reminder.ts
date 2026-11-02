/**
 * A reminder for a stuck payment's next date. Settle sends no notifications, so the day that matters
 * — the day after it was due back, the day a complaint's time runs out, or tomorrow when the next
 * step is yours to take now — goes in your calendar instead: an .ics file any calendar app opens,
 * or a Google Calendar link. Both are made on this phone; nothing is sent to a server. The event
 * says what's still owed, by whom and for what, and links back to the payment in Settle.
 */
import type { StuckPayment, StuckStepKind } from '../../data/stores'
import { addDays } from '../../engine/dates'
import { t } from '../../i18n'
import { stuckPath } from './paths'
import { backInPart, dueBy, ladderOf, ombudsmanLastDay, stillOwed, type StuckNext } from './rules'
import { inr, stepPlace, stuckDate, stuckTitle } from './view'

/** Settle's address: a reminder, and a win shared, link back to it. */
export const SETTLE_URL = 'https://settleupi.vercel.app'

/** What it reminds you of: it's due back, a complaint's time is up, or a step that's yours to take now. */
export type StuckReminderKind = 'due' | 'next' | 'act'

export interface StuckReminder {
  kind: StuckReminderKind
  /** The day to be reminded on, YYYY-MM-DD. */
  date: string
  /** The event's title: what's still owed, by whom and for what, and what to do. */
  title: string
  /** The event's notes, with the link to the payment in Settle. */
  details: string
}

/** The payment's page in Settle, for the event's link. */
export function stuckUrl(id: string): string {
  return `${SETTLE_URL}${stuckPath(id)}`
}

/** The place after the highest one it's been taken to, or null at the top. */
function rungAfter(s: StuckPayment): StuckStepKind | null {
  const ladder = ladderOf(s)
  const reached = Math.max(-1, ...s.steps.map((x) => ladder.indexOf(x.kind)))
  return ladder[reached + 1] ?? null
}

/**
 * The next day worth a reminder, or null when there's nothing to wait for (it's closed, with them,
 * or past the last day). A step that's yours to take now is tomorrow's reminder, in case today
 * isn't the day — with the RBI Ombudsman's last day in it when there is one.
 */
export function reminderFor(s: StuckPayment, next: StuckNext, today: string): StuckReminder | null {
  const owed = stillOwed(s, today)
  // What it's called in the list ("Failed payment to Neha"), and what's still to come of it.
  const name = stuckTitle(s)
  const amount = backInPart(s) ? t('stuck.remind.event.part', { rest: inr(owed.money), amount: inr(s.amount) }) : inr(s.amount)
  const vars = { name, amount }
  // The money's back: the bank (or the wallet company) owes the compensation.
  const wait = { name, owed: inr(owed.compensation), place: stepPlace('bank', s) }
  const tomorrow = addDays(today, 1)
  let reminder: Omit<StuckReminder, 'details'> | null = null
  switch (next.stage) {
    case 'waiting':
      // Not back by its last day: the day after, it's time to raise it.
      reminder = { kind: 'due', date: addDays(next.until ?? dueBy(s), 1), title: t('stuck.remind.event.due', vars) }
      break
    case 'raised': {
      const then = rungAfter(s)
      if (next.until && then) reminder = { kind: 'next', date: addDays(next.until, 1), title: t('stuck.remind.event.nextTo', { ...vars, place: stepPlace(then, s) }) }
      break
    }
    case 'compensationRaised':
      if (next.until) reminder = { kind: 'next', date: addDays(next.until, 1), title: t('stuck.remind.event.nextOwed', wait) }
      break
    case 'overdue':
      reminder = { kind: 'act', date: tomorrow, title: t('stuck.remind.event.act', { ...vars, place: stepPlace(next.step ?? 'bank', s) }) }
      break
    case 'compensation':
      reminder = { kind: 'act', date: tomorrow, title: t('stuck.remind.event.actOwed', wait) }
      break
    case 'escalate':
    case 'compensationEscalate': {
      if (next.step !== 'ombudsman') {
        if (next.step) reminder = { kind: 'act', date: tomorrow, title: t('stuck.remind.event.take', { ...vars, place: stepPlace(next.step, s) }) }
        break
      }
      // Past the RBI Ombudsman's last day by tomorrow: nothing left to file in time.
      const last = ombudsmanLastDay(s)
      if (!last || last < tomorrow) break
      const date = stuckDate(last, today)
      reminder = { kind: 'act', date: tomorrow, title: next.stage === 'escalate' ? t('stuck.remind.event.lastDay', { ...vars, date }) : t('stuck.remind.event.lastDayOwed', { ...wait, date }) }
      break
    }
    default:
      return null
  }
  if (!reminder || reminder.date <= today) return null
  return { ...reminder, details: `${t('stuck.remind.event.details')}\n${stuckUrl(s.id)}` }
}

/** "Remind me tomorrow", or "Remind me on 3 Nov" — the button and its sheet say the same. */
export function remindLabel(reminder: StuckReminder, today: string): string {
  return reminder.date === addDays(today, 1) ? t('stuck.remind.tomorrow') : t('stuck.remind.title', { date: stuckDate(reminder.date, today) })
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

/** The reminder as an .ics file: one all-day event on its day, with an alert at 9 that morning and a link to the payment. */
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
    `URL:${stuckUrl(id)}`,
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
