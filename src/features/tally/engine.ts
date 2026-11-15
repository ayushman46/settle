/**
 * Tally: things that come every day and are paid by the month (doodh, tiffin, the paper, dhobi,
 * water cans, chai). Pure: every function is handed the day it is asked about.
 *
 * Counts are whole numbers of quarter units (`Q` to a unit), so half a litre is 2 and money never
 * meets a fraction it cannot hold. A day with nothing written down counts the usual; the usual and
 * the rate are both "this much from this date", so a change never rewrites the days before it.
 */
import { addDays, addMonths, dateInPeriod, isIsoDate, isPeriod, periodOf } from '../../engine/dates'

/** Quarter units in one unit. */
export const Q = 4
/** The key a household's one count is kept under when everyone shares equally. */
export const SHARED = '*'
/** The most of anything in one day (in units). */
export const MAX_DAY_UNITS = 99
/** The month after is "ready to close" for this many days. */
export const CLOSE_NUDGE_DAYS = 5

export const TALLY_UNITS = ['litre', 'meal', 'day', 'piece', 'can', 'cup', 'unit'] as const
export type TallyUnit = (typeof TALLY_UNITS)[number]
export type TallySplit = 'equal' | 'own'

/** The rate, in paise for one unit, from a date on. */
export interface RateStep {
  from: string
  rate: number
}

/** The usual count for a day (quarter units, by `SHARED` or by person), from a date on. */
export interface UsualStep {
  from: string
  counts: Record<string, number>
}

export interface TallyVendor {
  name: string
  upiId: string | null
  /** Ten digits, when a number was given instead of a UPI ID. */
  phone: string | null
}

export interface TallyMonth {
  /** When the month was closed, or null while it is open. */
  closedAt: number | null
  /** The expense closing made, if it made one. */
  expenseId: string | null
  /** When the vendor was marked as paid, or null. */
  paidAt: number | null
}

export interface Tally {
  id: string
  name: string
  unit: TallyUnit
  currency: string
  /** `equal`: one count for the home, shared equally. `own`: each person's own count. */
  split: TallySplit
  /** Who shares it (friend ids, `ME_ID` for you). */
  memberIds: string[]
  /** The group its expense goes into, if any. */
  groupId: string | null
  /** The first day it counts. */
  start: string
  /** Oldest first; the first one holds from `start`. Never empty. */
  rates: RateStep[]
  /** Oldest first. Never empty. */
  usual: UsualStep[]
  /** Days that differ from the usual: date → key → quarter units. */
  days: Record<string, Record<string, number>>
  vendor: TallyVendor | null
  /** By `YYYY-MM`. */
  months: Record<string, TallyMonth>
  createdAt: number
}

/* ------------------------------------------------------------------ small things */

/** "28.5", "1", "0.25": a count in units, without trailing zeros. */
export function formatQty(quarters: number): string {
  const q = Math.max(0, Math.trunc(quarters))
  return `${Math.floor(q / Q)}${['', '.25', '.5', '.75'][q % Q] ?? ''}`
}

/** How much one tap of + or − changes a count: half a litre, one of anything else. */
export function stepOf(unit: TallyUnit): number {
  return unit === 'litre' ? Q / 2 : Q
}

/** Paise for `quarters` at `rate` a unit, to the nearest paisa. */
export function costOf(quarters: number, rate: number): number {
  return Math.round((quarters * rate) / Q)
}

/** The keys a day's counts are kept under. */
export function keysOf(tally: Pick<Tally, 'split' | 'memberIds'>): string[] {
  return tally.split === 'own' ? tally.memberIds : [SHARED]
}

function stepOn<T extends { from: string }>(steps: readonly T[], date: string): T | null {
  let found: T | null = steps[0] ?? null
  for (const step of steps) if (step.from <= date) found = step
  return found
}

/** The rate (paise a unit) on a day. Days before the first rate use the first rate. */
export function rateOn(tally: Pick<Tally, 'rates'>, date: string): number {
  return stepOn(tally.rates, date)?.rate ?? 0
}

/** The usual count for `key` on a day. */
export function usualOn(tally: Pick<Tally, 'usual'>, date: string, key: string): number {
  return stepOn(tally.usual, date)?.counts[key] ?? 0
}

/** What counts for `key` on a day: what was written down, else the usual; nothing before the start. */
export function countOn(tally: Tally, date: string, key: string): number {
  if (date < tally.start) return 0
  return tally.days[date]?.[key] ?? usualOn(tally, date, key)
}

/** Everything that came on a day, all keys together. */
export function dayCount(tally: Tally, date: string): number {
  let sum = 0
  for (const key of keysOf(tally)) sum += countOn(tally, date, key)
  return sum
}

/** True when a day was changed away from the usual. */
export function differsFromUsual(tally: Tally, date: string): boolean {
  return keysOf(tally).some((key) => countOn(tally, date, key) !== usualOn(tally, date, key))
}

/** Every date of a month, in order. */
export function monthDates(period: string): string[] {
  if (!isPeriod(period)) return []
  const last = dateInPeriod(period, 31)
  const out: string[] = []
  for (let d = `${period}-01`; d <= last; d = addDays(d, 1)) out.push(d)
  return out
}

/** The last day of the latest closed month, or '' when no month is closed. */
export function lockedThrough(tally: Pick<Tally, 'months'>): string {
  let last = ''
  for (const [period, month] of Object.entries(tally.months)) {
    if (month.closedAt !== null && isPeriod(period)) {
      const end = dateInPeriod(period, 31)
      if (end > last) last = end
    }
  }
  return last
}

export function isClosed(tally: Pick<Tally, 'months'>, period: string): boolean {
  return (tally.months[period]?.closedAt ?? null) !== null
}

/**
 * `total` paise dealt equally to `count` people (in the order given). The odd paise go to as many
 * people as there are, starting from `offset` and going round, so it is not always the first.
 */
export function dealEqually(total: number, count: number, offset = 0): number[] {
  if (count <= 0) return []
  const base = Math.floor(total / count)
  const odd = total - base * count
  const start = ((Math.trunc(offset) % count) + count) % count
  return Array.from({ length: count }, (_, i) => base + ((i - start + count) % count < odd ? 1 : 0))
}

/* ------------------------------------------------------------------ the month's bill */

export interface BillLine {
  /** Paise a unit. */
  rate: number
  /** Quarter units at this rate. */
  qty: number
  amount: number
}

export interface BillPart {
  id: string
  /** Their own count (quarter units), or null when the tally is shared equally. */
  qty: number | null
  amount: number
}

export interface MonthBill {
  period: string
  /** First and last day counted ('' when no day of the month counts yet). */
  from: string
  to: string
  /** Quarter units in all. */
  qty: number
  /** One line for each rate the month had, oldest first. */
  lines: BillLine[]
  total: number
  /** Each person's part, in name order; adds up to `total` exactly. */
  parts: BillPart[]
  /** The month is over (or today is its last day): it can be closed. */
  ended: boolean
}

interface Run {
  rate: number
  byKey: Map<string, number>
}

/**
 * A month's bill as of `today`: the days from the start (or the 1st) up to today (or the month's
 * end), each at the rate it had. Shared equally, the total is dealt to the paisa; by own count,
 * each person pays for what they had and the total is the sum of those.
 */
export function monthBill(tally: Tally, period: string, today: string, nameOf: (id: string) => string = (id) => id): MonthBill {
  const first = `${period}-01`
  const last = dateInPeriod(period, 31)
  const from = tally.start > first ? tally.start : first
  const to = today < last ? today : last
  const counted = isPeriod(period) && isIsoDate(today) && from <= to
  const keys = keysOf(tally)
  const lines: BillLine[] = []
  const own = new Map<string, { qty: number; amount: number }>(keys.map((k) => [k, { qty: 0, amount: 0 }]))

  // Runs of days at one rate; within a run each key's quarters are added up, then priced once.
  const runs: Run[] = []
  if (counted) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const rate = rateOn(tally, d)
      let run = runs[runs.length - 1]
      if (!run || run.rate !== rate) {
        run = { rate, byKey: new Map() }
        runs.push(run)
      }
      for (const key of keys) run.byKey.set(key, (run.byKey.get(key) ?? 0) + countOn(tally, d, key))
    }
  }
  for (const run of runs) {
    let qty = 0
    let amount = 0
    for (const [key, q] of run.byKey) {
      const cost = costOf(q, run.rate)
      const mine = own.get(key)
      if (mine) {
        mine.qty += q
        mine.amount += cost
      }
      qty += q
      amount += cost
    }
    if (qty > 0) lines.push({ rate: run.rate, qty, amount })
  }

  const qty = lines.reduce((sum, l) => sum + l.qty, 0)
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const people = [...tally.memberIds].sort((a, b) => byName(nameOf(a), nameOf(b)) || (a < b ? -1 : a > b ? 1 : 0))
  let parts: BillPart[]
  if (tally.split === 'own') {
    parts = people.map((id) => ({ id, qty: own.get(id)?.qty ?? 0, amount: own.get(id)?.amount ?? 0 }))
  } else {
    const m = /^(\d{4})-(\d{2})$/.exec(period)
    const turn = m ? Number(m[1]) * 12 + Number(m[2]) : 0
    const dealt = dealEqually(total, people.length, turn)
    parts = people.map((id, i) => ({ id, qty: null, amount: dealt[i] ?? 0 }))
  }
  return { period, from: counted ? from : '', to: counted ? to : '', qty, lines, total, parts, ended: isIsoDate(today) && today >= last }
}

function byName(a: string, b: string): number {
  const x = a.toLocaleLowerCase()
  const y = b.toLocaleLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * The month that is ready to close today: last month, in the first five days of this one, when
 * something came in it and it has not been closed. Otherwise null.
 */
export function readyToClose(tally: Tally, today: string): string | null {
  if (!isIsoDate(today) || Number(today.slice(8, 10)) > CLOSE_NUDGE_DAYS) return null
  const period = addMonths(periodOf(today), -1)
  if (isClosed(tally, period)) return null
  return monthBill(tally, period, today).total > 0 ? period : null
}

/** The months a tally has had, oldest first, up to the one `today` is in. */
export function tallyPeriods(tally: Pick<Tally, 'start'>, today: string): string[] {
  const out: string[] = []
  const end = periodOf(today)
  for (let p = periodOf(tally.start); p <= end && out.length < 240; p = addMonths(p, 1)) out.push(p)
  return out
}
