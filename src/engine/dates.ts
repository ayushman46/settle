/**
 * Calendar helpers on plain local dates (`YYYY-MM-DD`) and months (`YYYY-MM`). Expenses store
 * the local calendar day they happened on, so all arithmetic here is done on the calendar, in
 * UTC, which has no daylight-saving gaps.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIOD = /^(\d{4})-(\d{2})$/
const DAY_MS = 86_400_000

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function utcDays(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function fromUtcDays(days: number): string {
  const d = new Date(days * DAY_MS)
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function parts(iso: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

/** Days in a month (`month` is 1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** True for a real calendar date written `YYYY-MM-DD` ("2026-02-30" is false). */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && parts(value) !== null
}

/** True for a month written `YYYY-MM`. */
export function isPeriod(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = PERIOD.exec(value)
  return m !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12
}

/** The local calendar date of `date` as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today on this device, as a local `YYYY-MM-DD`. */
export function today(now: Date = new Date()): string {
  return toIsoDate(now)
}

/** `iso` moved by `days` (may be negative). Invalid input comes back unchanged. */
export function addDays(iso: string, days: number): string {
  const p = parts(iso)
  if (!p || !Number.isFinite(days)) return iso
  return fromUtcDays(utcDays(p.year, p.month, p.day) + Math.trunc(days))
}

/** Whole days from `from` to `to` (negative when `to` is earlier); 0 when either is invalid. */
export function daysBetween(from: string, to: string): number {
  const a = parts(from)
  const b = parts(to)
  if (!a || !b) return 0
  return utcDays(b.year, b.month, b.day) - utcDays(a.year, a.month, a.day)
}

/** The month (`YYYY-MM`) a date falls in. */
export function periodOf(iso: string): string {
  return iso.slice(0, 7)
}

/** `period` moved by `months` (may be negative). */
export function addMonths(period: string, months: number): string {
  const m = PERIOD.exec(period)
  if (!m || !Number.isFinite(months)) return period
  const index = Number(m[1]) * 12 + (Number(m[2]) - 1) + Math.trunc(months)
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`
}

/** Every month from `from` to `to`, inclusive and in order (empty when `to` is before `from`). */
export function periodsBetween(from: string, to: string, max = 1200): string[] {
  if (!isPeriod(from) || !isPeriod(to)) return []
  const out: string[] = []
  for (let p = from; p <= to && out.length < max; p = addMonths(p, 1)) out.push(p)
  return out
}

/** The date of `dayOfMonth` in `period`, clamped to the month's length (`2026-02` + 31 → `2026-02-28`). */
export function dateInPeriod(period: string, dayOfMonth: number): string {
  const m = PERIOD.exec(period)
  if (!m) return `${period}-01`
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Math.min(Math.max(1, Math.trunc(dayOfMonth) || 1), daysInMonth(year, month))
  return `${period}-${pad(day)}`
}
