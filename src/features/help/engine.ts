/**
 * House help's salary: the numbers. One person who works at your home (maid, cook, driver…),
 * a monthly salary, and what happened through each month: an advance taken, a day off, extra
 * work, a bonus. Everything here is pure: dates come in as `YYYY-MM-DD`, months as `YYYY-MM`,
 * money as integer paise, and "today" is always passed in.
 *
 * The rules, each explainable in one sentence:
 * - A month's salary is due on the pay day after the month ends (pay day 1 to 15), or on the pay
 *   day inside the month (pay day 16 to 31; "the 31st" in a short month is its last day).
 * - Days off up to the paid leave cost nothing. Beyond that a day's pay (salary ÷ days in that
 *   month, to the whole rupee) is cut only when "cut pay" is on.
 * - An advance counts in the month it was taken. It is cut from that month's pay; what the pay
 *   cannot cover (or what you chose not to cut yet) carries to the next month.
 * - A raise applies from its month onward; earlier months keep the old salary.
 * - A paid month is frozen as it was paid.
 */
import { addMonths, dateInPeriod, daysBetween, daysInMonth, periodOf } from '../../engine/dates'
import type { Minor } from '../../domain/types'
import { currencyDigits } from '../../lib/money'

export const HELP_WORKS = ['maid', 'cook', 'driver', 'nanny', 'gardener', 'car', 'other'] as const
export type HelpWork = (typeof HELP_WORKS)[number]

export const HELP_ENTRY_KINDS = ['advance', 'dayOff', 'extra', 'bonus'] as const
export type HelpEntryKind = (typeof HELP_ENTRY_KINDS)[number]

export const DEFAULT_PAY_DAY = 1
export const DEFAULT_PAID_LEAVE = 2
export const MAX_PAID_LEAVE = 31
/** A pay day from this date on pays for the month it is in; an earlier one pays for the month before. */
export const SAME_MONTH_FROM = 16
export const MAX_PARTS = 9
/** No ledger is walked further than this many months (50 years). */
export const MAX_MONTHS = 600

export interface HelpEntry {
  id: string
  kind: HelpEntryKind
  /** The day it happened. */
  date: string
  /** Paise; 0 for a day off. */
  amount: Minor
  note: string | null
  /** An advance: who handed the money over (a friend id; `ME_ID` for you). */
  byId: string
  /** An advance shared with flatmates: the expense it became, if it was added. */
  expenseId: string | null
  /** When it was written down (ms). */
  at: number
}

/** A month that has been paid, frozen with the numbers it was paid on. */
export interface HelpPayment {
  period: string
  paidOn: string
  at: number
  payerId: string
  method: 'upi' | 'cash'
  salary: Minor
  daysOff: number
  leaveCut: Minor
  extra: Minor
  bonus: Minor
  advanceCut: Minor
  /** What was handed over: salary − leaveCut + extra + bonus − advanceCut. */
  amount: Minor
  /** The expense it became in a group or between flatmates, if it was added. */
  expenseId: string | null
}

export interface HelpRaise {
  /** The first month (`YYYY-MM`) paid at the new salary. */
  from: string
  salary: Minor
}

export interface HelpSharer {
  friendId: string
  /** 1 each means equal. */
  parts: number
}

export interface Helper {
  id: string
  name: string
  work: HelpWork
  currency: string
  /** The salary at the start; later changes are `raises`. */
  salary: Minor
  raises: HelpRaise[]
  /** 1..31. */
  payDay: number
  /** Who bears the cost; just you when it is one entry for `ME_ID`. */
  sharers: HelpSharer[]
  /** The group shared expenses go into, if any. */
  groupId: string | null
  /** Their UPI ID, or a mobile number. */
  upi: string | null
  /** Days off a month with no cut. */
  paidLeave: number
  /** Cut a day's pay for days off beyond the paid leave. Off unless the family says so. */
  cutPay: boolean
  /** The day they were added: no month before it is ever asked for. */
  startedOn: string
  entries: HelpEntry[]
  payments: HelpPayment[]
  /** Chosen by hand: how much of the open advance to cut in a month (`YYYY-MM` → paise). */
  cuts: Record<string, Minor>
  createdAt: number
}

export interface MonthSheet {
  period: string
  /** The day this month's salary is due. */
  due: string
  salary: Minor
  daysOff: number
  paidLeave: number
  /** Days off beyond the paid leave. */
  extraDaysOff: number
  leaveCut: Minor
  extra: Minor
  bonus: Minor
  /** salary − leaveCut + extra + bonus. */
  gross: Minor
  /** Advance still open when the month began. */
  advanceBefore: Minor
  /** Advances taken in this month. */
  advanceTaken: Minor
  advanceCut: Minor
  /** Advance still open after this month's cut: carried to the next month. */
  advanceAfter: Minor
  /** gross − advanceCut: what is handed over. */
  toPay: Minor
  paid: HelpPayment | null
  /** This month's entries, oldest first. */
  entries: HelpEntry[]
}

/* ------------------------------------------------------------------ months and pay days */

export function isSharedHelper(helper: Pick<Helper, 'sharers'>): boolean {
  return helper.sharers.length > 1
}

/** The day the salary for `period` is due. */
export function dueDate(period: string, payDay: number): string {
  return payDay >= SAME_MONTH_FROM ? dateInPeriod(period, payDay) : dateInPeriod(addMonths(period, 1), payDay)
}

/** The first month kept for this person: the earliest one whose pay day had not passed when they were added. */
export function firstPeriod(helper: Pick<Helper, 'startedOn' | 'payDay'>): string {
  const here = periodOf(helper.startedOn)
  for (const p of [addMonths(here, -1), here]) if (dueDate(p, helper.payDay) >= helper.startedOn) return p
  return addMonths(here, 1)
}

/** The month being worked towards the next pay day: the earliest one due today or later. */
export function workingPeriod(helper: Pick<Helper, 'startedOn' | 'payDay'>, today: string): string {
  const first = firstPeriod(helper)
  const here = periodOf(today)
  for (const p of [addMonths(here, -1), here]) if (p >= first && dueDate(p, helper.payDay) >= today) return p
  const next = addMonths(here, 1)
  return next >= first ? next : first
}

/** The salary in force in `period`: the latest raise that has started, or the starting salary. */
export function salaryFor(helper: Pick<Helper, 'salary' | 'raises'>, period: string): Minor {
  let salary = helper.salary
  let from = ''
  for (const r of helper.raises) {
    if (r.from <= period && r.from >= from) {
      salary = r.salary
      from = r.from
    }
  }
  return salary
}

/** Pay cut for `days` days off in `period`: salary ÷ days in the month each, to the whole rupee, never more than the salary. */
export function leaveCutFor(salary: Minor, days: number, period: string, currency: string): Minor {
  if (!(days > 0) || !(salary > 0)) return 0
  const [year, month] = period.split('-').map(Number)
  const length = daysInMonth(year ?? 0, month ?? 1)
  const unit = 10 ** currencyDigits(currency)
  const cut = Math.round((salary * days) / length / unit) * unit
  return Math.min(salary, Math.max(0, cut))
}

/** The month an entry counts in: its own, or the first month kept when it is dated before that. */
export function entryPeriod(entry: Pick<HelpEntry, 'date'>, first: string): string {
  const p = periodOf(entry.date)
  return p < first ? first : p
}

function sum(entries: readonly HelpEntry[], kind: HelpEntryKind): Minor {
  let total = 0
  for (const e of entries) if (e.kind === kind) total += e.amount
  return total
}

/* ------------------------------------------------------------------ the ledger */

/**
 * Every month from the first one kept up to `upTo`, in order, each with its salary, cuts and
 * extras, and the advance carried from month to month. Empty when `upTo` is before the first month.
 */
export function ledger(helper: Helper, upTo: string): MonthSheet[] {
  const first = firstPeriod(helper)
  const byPeriod = new Map<string, HelpEntry[]>()
  for (const e of helper.entries) {
    const p = entryPeriod(e, first)
    const list = byPeriod.get(p)
    if (list) list.push(e)
    else byPeriod.set(p, [e])
  }
  const paid = new Map(helper.payments.map((p) => [p.period, p]))
  const out: MonthSheet[] = []
  let open = 0
  for (let period = first; period <= upTo && out.length < MAX_MONTHS; period = addMonths(period, 1)) {
    const entries = (byPeriod.get(period) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at))
    const advanceBefore = open
    const advanceTaken = sum(entries, 'advance')
    open += advanceTaken
    const payment = paid.get(period) ?? null
    const due = dueDate(period, helper.payDay)
    if (payment) {
      const advanceCut = Math.min(payment.advanceCut, open)
      open -= advanceCut
      out.push({
        period,
        due,
        salary: payment.salary,
        daysOff: payment.daysOff,
        paidLeave: helper.paidLeave,
        extraDaysOff: Math.max(0, payment.daysOff - helper.paidLeave),
        leaveCut: payment.leaveCut,
        extra: payment.extra,
        bonus: payment.bonus,
        gross: payment.amount + payment.advanceCut,
        advanceBefore,
        advanceTaken,
        advanceCut: payment.advanceCut,
        advanceAfter: open,
        toPay: payment.amount,
        paid: payment,
        entries,
      })
      continue
    }
    const salary = salaryFor(helper, period)
    const daysOff = new Set(entries.filter((e) => e.kind === 'dayOff').map((e) => e.date)).size
    const extraDaysOff = Math.max(0, daysOff - helper.paidLeave)
    const leaveCut = helper.cutPay ? leaveCutFor(salary, extraDaysOff, period, helper.currency) : 0
    const extra = sum(entries, 'extra')
    const bonus = sum(entries, 'bonus')
    const gross = salary - leaveCut + extra + bonus
    const wanted = helper.cuts[period]
    const advanceCut = Math.max(0, Math.min(open, gross, wanted === undefined ? Number.POSITIVE_INFINITY : wanted))
    open -= advanceCut
    out.push({
      period,
      due,
      salary,
      daysOff,
      paidLeave: helper.paidLeave,
      extraDaysOff,
      leaveCut,
      extra,
      bonus,
      gross,
      advanceBefore,
      advanceTaken,
      advanceCut,
      advanceAfter: open,
      toPay: gross - advanceCut,
      paid: null,
      entries,
    })
  }
  return out
}

/** One month's sheet, or null for a month before the first one kept. */
export function monthSheet(helper: Helper, period: string): MonthSheet | null {
  const rows = ledger(helper, period)
  const last = rows[rows.length - 1]
  return last && last.period === period ? last : null
}

/** The month to open on: the oldest one not paid yet, up to the month being worked; that month when all are paid. */
export function openPeriod(helper: Helper, today: string): string {
  const working = workingPeriod(helper, today)
  const paid = new Set(helper.payments.map((p) => p.period))
  let count = 0
  for (let p = firstPeriod(helper); p <= working && count < MAX_MONTHS; p = addMonths(p, 1), count += 1) if (!paid.has(p)) return p
  return working
}

export interface HelpDue {
  sheet: MonthSheet
  /** 0 on the pay day itself. */
  daysLate: number
}

/** The salary to deal with today: the latest month whose pay day has come, when it is not paid yet. */
export function dueNow(helper: Helper, today: string): HelpDue | null {
  const first = firstPeriod(helper)
  const here = periodOf(today)
  const latest = [here, addMonths(here, -1), addMonths(here, -2)].find((p) => p >= first && dueDate(p, helper.payDay) <= today)
  if (!latest) return null
  const sheet = monthSheet(helper, latest)
  if (!sheet || sheet.paid) return null
  return { sheet, daysLate: Math.max(0, daysBetween(sheet.due, today)) }
}

/* ------------------------------------------------------------------ flatmates' parts */

export interface HelpShare {
  friendId: string
  amount: Minor
}

/** A number that moves on by one each month, so the odd paisa is not always the same person's. */
export function turnOf(period: string): number {
  const [year, month] = period.split('-').map(Number)
  return (year ?? 0) * 12 + (month ?? 1) - 1
}

/**
 * `amount` between the people who share the cost, by their parts. Always adds up to `amount`.
 * People with the same parts differ by at most one paisa, and the odd paise are dealt starting
 * from a different person each `turn`.
 */
export function splitShares(amount: Minor, sharers: readonly HelpSharer[], turn = 0): HelpShare[] {
  const n = sharers.length
  if (n === 0) return []
  const total = Math.max(0, Math.trunc(amount) || 0)
  const parts = sharers.map((s) => (Number.isFinite(s.parts) && s.parts >= 1 ? Math.min(MAX_PARTS, Math.trunc(s.parts)) : 1))
  const whole = parts.reduce((a, b) => a + b, 0)
  const amounts = parts.map((p) => Math.floor((total * p) / whole))
  const remainders = parts.map((p) => (total * p) % whole)
  let left = total - amounts.reduce((a, b) => a + b, 0)
  const start = ((Math.trunc(turn) % n) + n) % n
  const place = (i: number): number => (i - start + n) % n
  const order = sharers.map((_, i) => i).sort((a, b) => (remainders[b] ?? 0) - (remainders[a] ?? 0) || place(a) - place(b))
  for (const i of order) {
    if (left <= 0) break
    amounts[i] = (amounts[i] ?? 0) + 1
    left -= 1
  }
  return sharers.map((s, i) => ({ friendId: s.friendId, amount: amounts[i] ?? 0 }))
}

/* ------------------------------------------------------------------ the year */

export interface YearRow {
  period: string
  sheet: MonthSheet
}

export interface YearView {
  year: number
  /** The months of this year that are kept, oldest first. */
  rows: YearRow[]
  /** Handed over in the months of this year that are paid. */
  paid: Minor
  monthsPaid: number
  /** Bonus inside those paid months. */
  bonus: Minor
  /** Advances taken in this year. */
  advanceTaken: Minor
  /** Advance still open after the last month shown. */
  advanceOpen: Minor
}

/** One calendar year: each month kept (up to the month being worked), what was paid, bonus given, advance still open. */
export function yearView(helper: Helper, year: number, today: string): YearView {
  const working = workingPeriod(helper, today)
  const last = `${String(year).padStart(4, '0')}-12`
  const rows = ledger(helper, working < last ? working : last)
    .filter((s) => Number(s.period.slice(0, 4)) === year)
    .map((sheet) => ({ period: sheet.period, sheet }))
  let paid = 0
  let monthsPaid = 0
  let bonus = 0
  let advanceTaken = 0
  for (const { sheet } of rows) {
    advanceTaken += sheet.advanceTaken
    if (!sheet.paid) continue
    paid += sheet.paid.amount
    bonus += sheet.paid.bonus
    monthsPaid += 1
  }
  return { year, rows, paid, monthsPaid, bonus, advanceTaken, advanceOpen: rows[rows.length - 1]?.sheet.advanceAfter ?? 0 }
}

/** The numbers a payment is frozen with, from an unpaid month's sheet. */
export function paymentFrom(sheet: MonthSheet, how: { paidOn: string; at: number; payerId: string; method: 'upi' | 'cash' }): HelpPayment {
  return {
    period: sheet.period,
    paidOn: how.paidOn,
    at: how.at,
    payerId: how.payerId,
    method: how.method,
    salary: sheet.salary,
    daysOff: sheet.daysOff,
    leaveCut: sheet.leaveCut,
    extra: sheet.extra,
    bonus: sheet.bonus,
    advanceCut: sheet.advanceCut,
    amount: sheet.toPay,
    expenseId: null,
  }
}
