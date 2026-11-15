/**
 * Settle Day, worked out: which date a group's day of the month falls on (month ends and "last
 * day" included), where today stands against it, what is open in the group right now, and the
 * calendar file that repeats it every month. Pure: today and now are always passed in.
 */
import type { Expense, Group, Minor } from '../../domain/types'
import { groupBalances, simplifyDebts, type Transfer } from '../../engine/balances'
import { addDays, addMonths, dateInPeriod, daysBetween, isIsoDate, periodOf } from '../../engine/dates'

/** A day of the month every month has (1 to 28), or the month's last day. */
export type SettleDay = number | 'last'

export const MIN_SETTLE_DAY = 1
export const MAX_SETTLE_DAY = 28

/** The quick picks, in the order they are offered. */
export const QUICK_DAYS: readonly SettleDay[] = [1, 5, 10, 'last']

/** A settle day as stored, or null for anything that isn't one (29 to 31 are not offered: "last" covers month ends). */
export function cleanSettleDay(value: unknown): SettleDay | null {
  if (value === 'last') return 'last'
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_SETTLE_DAY && value <= MAX_SETTLE_DAY ? value : null
}

/** How an English ordinal ends: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd. */
export function ordinalSuffix(n: number): 'st' | 'nd' | 'rd' | 'th' {
  const tens = Math.abs(n) % 100
  if (tens >= 11 && tens <= 13) return 'th'
  const ones = tens % 10
  return ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'
}

/** The settle date in a month (`YYYY-MM`): the day itself, or the month's last day. */
export function settleDateIn(period: string, day: SettleDay): string {
  return dateInPeriod(period, day === 'last' ? 31 : day)
}

/** The next settle date on or after `today` (today itself on the day). */
export function nextSettleDate(day: SettleDay, today: string): string {
  if (!isIsoDate(today)) return today
  const here = settleDateIn(periodOf(today), day)
  return here >= today ? here : settleDateIn(addMonths(periodOf(today), 1), day)
}

/** The latest settle date on or before `today`. */
export function lastSettleDate(day: SettleDay, today: string): string {
  if (!isIsoDate(today)) return today
  const here = settleDateIn(periodOf(today), day)
  return here <= today ? here : settleDateIn(addMonths(periodOf(today), -1), day)
}

export type SettlePhase = 'today' | 'yesterday' | 'waiting'

export interface SettleDayStatus {
  /** `today`: it is settle day. `yesterday`: it was yesterday and money is still open. `waiting`: counting down. */
  phase: SettlePhase
  /** The settle date this is about: today, yesterday, or the next one. */
  date: string
  /** The next settle date on or after today. */
  next: string
  /** Whole days from today to `next` (0 on the day). */
  daysToGo: number
}

/**
 * Where today stands. Settle day lasts the day itself; if money is still open it carries over to
 * the day after, and no further. A day that was only picked after it had passed doesn't count as
 * missed (`setOn` is the date it was picked).
 */
export function settleDayStatus(day: SettleDay, today: string, opts: { open: boolean; setOn?: string | null }): SettleDayStatus {
  const next = nextSettleDate(day, today)
  const daysToGo = daysBetween(today, next)
  if (next === today) return { phase: 'today', date: today, next, daysToGo: 0 }
  const yesterday = addDays(today, -1)
  const known = !opts.setOn || !isIsoDate(opts.setOn) || opts.setOn <= yesterday
  if (opts.open && known && lastSettleDate(day, today) === yesterday) return { phase: 'yesterday', date: yesterday, next, daysToGo }
  return { phase: 'waiting', date: next, next, daysToGo }
}

/* ------------------------------------------------------------------ what is open */

function byText(a: string, b: string): number {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * Payments in the order a person wants them: theirs to pay, theirs to receive, then the rest;
 * larger first; ties by name (ids differ from phone to phone, names don't).
 */
export function orderPayments(transfers: readonly Transfer[], meId: string, nameOf: (id: string) => string): Transfer[] {
  const rank = (t: Transfer): number => (t.fromId === meId ? 0 : t.toId === meId ? 1 : 2)
  return [...transfers].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.amount - a.amount ||
      byText(nameOf(a.fromId), nameOf(b.fromId)) ||
      byText(nameOf(a.toId), nameOf(b.toId)) ||
      byText(a.fromId, b.fromId) ||
      byText(a.toId, b.toId),
  )
}

/**
 * Everything to settle in the group right now: the app's own fewest payments, from the group's
 * expenses in its own currency (loans included: lent money is owed too) and the payments already
 * recorded.
 */
export function openPayments(group: Group, expenses: readonly Expense[], meId: string, nameOf: (id: string) => string): Transfer[] {
  return orderPayments(simplifyDebts(groupBalances(group, expenses)), meId, nameOf)
}

/** Nobody owes anybody in the group: every balance is exactly zero (true for an empty group too). */
export function isSquare(group: Group, expenses: readonly Expense[]): boolean {
  return Object.values(groupBalances(group, expenses)).every((v) => v === 0)
}

export interface OpenSummary {
  /** Payments still to make. */
  count: number
  /** All of them added up. */
  total: Minor
  /** What the owner has to pay, and how many payments that is. */
  youPay: Minor
  youPayCount: number
  /** What is coming to the owner. */
  youGet: Minor
}

export function summarizeOpen(transfers: readonly Transfer[], meId: string): OpenSummary {
  const out: OpenSummary = { count: transfers.length, total: 0, youPay: 0, youPayCount: 0, youGet: 0 }
  for (const t of transfers) {
    out.total += t.amount
    if (t.fromId === meId) {
      out.youPay += t.amount
      out.youPayCount += 1
    } else if (t.toId === meId) out.youGet += t.amount
  }
  return out
}

/* ------------------------------------------------------------------ the calendar file */

export interface SettleDayIcsInput {
  day: SettleDay
  /** The calendar starts at the next settle date on or after this day. */
  today: string
  /** When the file is made (its DTSTAMP). */
  now: Date
  /** Stable per group, so adding the file again updates the entry instead of doubling it. */
  uid: string
  /** The entry's title, e.g. "Settle day: Flat 4B". */
  summary: string
  /** A line or two under it. */
  description: string
}

/** Text as RFC 5545 wants it: backslash, semicolon and comma escaped; a line break is `\n`. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const ENCODER = new TextEncoder()

/** Folds one content line at 75 bytes (never inside a character); continuation lines start with a space. */
export function icsFold(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = ENCODER.encode(char).length
    // A continuation line's leading space counts towards its 75.
    if (bytes + size > 75) {
      out.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.join('\r\n')
}

function compact(iso: string): string {
  return iso.replace(/-/g, '')
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** `now` in UTC as `YYYYMMDDTHHMMSSZ` (the epoch for an unusable date). */
function utcStamp(now: Date): string {
  const d = Number.isFinite(now.getTime()) ? now : new Date(0)
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/** The repeat rule: the same day every month, or the last day of every month. */
export function settleDayRule(day: SettleDay): string {
  return `FREQ=MONTHLY;BYMONTHDAY=${day === 'last' ? -1 : day}`
}

/**
 * The calendar file: one all-day entry on the next settle date, repeating monthly with no end,
 * shown as free time, with a 9 am alert on the day where the calendar honours it. CRLF line
 * ends, as calendars expect.
 */
export function settleDayIcs(input: SettleDayIcsInput): string {
  const start = nextSettleDate(input.day, input.today)
  const uid = input.uid.replace(/[^A-Za-z0-9.@_-]/g, '-') || 'settle-day'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Settle//Settle Day//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(input.now)}`,
    `DTSTART;VALUE=DATE:${compact(start)}`,
    // All-day entries end on the following day (the end is not included).
    `DTEND;VALUE=DATE:${compact(addDays(start, 1))}`,
    `RRULE:${settleDayRule(input.day)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(input.summary)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(icsFold).join('\r\n') + '\r\n'
}
