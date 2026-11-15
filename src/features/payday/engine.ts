/**
 * Payday-aware, the sums. A payday is a day of the month (1 to 31), the last day, or the last
 * working day. From it: when the next one falls (the 31st in a short month is the last day; the
 * last working day steps back over Saturday and Sunday: bank holidays are not known here), the
 * best day to ask someone who owes you (the day after they are paid), and the days your own
 * payday card shows. Pure: `today` always comes in.
 */
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { addDays, addMonths, dateInPeriod, daysBetween, daysInMonth, isIsoDate, periodOf } from '../../engine/dates'
import { payQueue, queueTotal } from '../queue/engine'

/** A day of the month (1 to 31), the last day, or the last working day. */
export type Payday = number | 'last' | 'lastWorking'

/** The paydays most salaries land on: the one-tap picks. */
export const QUICK_PAYDAYS: readonly Payday[] = [1, 5, 7, 10, 'last']

/** The best day to ask is offered when it is this close (days from today). */
export const ASK_WINDOW_DAYS = 10
/** Your payday card shows on payday and this many days after. */
export const CARD_DAYS_AFTER = 2

export function isPayday(value: unknown): value is Payday {
  if (value === 'last' || value === 'lastWorking') return true
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31
}

/** Two paydays told apart ("7", "last"): for lists of ones said no to. */
export function paydayKey(payday: Payday): string {
  return String(payday)
}

/** 0 Sunday … 6 Saturday; -1 for something that isn't a date. */
export function weekday(iso: string): number {
  if (!isIsoDate(iso)) return -1
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

export function isWeekend(iso: string): boolean {
  const day = weekday(iso)
  return day === 0 || day === 6
}

/** `iso` itself on a weekday; the Friday before on a Saturday or Sunday. */
export function workingDayOnOrBefore(iso: string): string {
  const day = weekday(iso)
  return day === 6 ? addDays(iso, -1) : day === 0 ? addDays(iso, -2) : iso
}

/** `iso` itself on a weekday; the Monday after on a Saturday or Sunday. */
export function workingDayOnOrAfter(iso: string): string {
  const day = weekday(iso)
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : iso
}

/** The last day of a month (`YYYY-MM`). */
function lastDayOf(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return dateInPeriod(period, daysInMonth(y ?? 1970, m ?? 1))
}

/** The payday's date in a month (`YYYY-MM`): the 31st in a 30-day month is the 30th. */
export function paydayIn(payday: Payday, period: string): string {
  if (payday === 'last') return lastDayOf(period)
  if (payday === 'lastWorking') return workingDayOnOrBefore(lastDayOf(period))
  return dateInPeriod(period, payday)
}

/** The first payday on or after `from` (a payday today counts). */
export function nextPayday(payday: Payday, from: string): string {
  if (!isIsoDate(from)) return from
  const period = periodOf(from)
  const here = paydayIn(payday, period)
  return here >= from ? here : paydayIn(payday, addMonths(period, 1))
}

/** The latest payday on or before `today` (a payday today counts). */
export function lastPayday(payday: Payday, today: string): string {
  if (!isIsoDate(today)) return today
  const period = periodOf(today)
  const here = paydayIn(payday, period)
  return here <= today ? here : paydayIn(payday, addMonths(period, -1))
}

export interface AskDay {
  /** The payday the ask follows. */
  paidOn: string
  /** The day after it: today at the earliest. */
  askOn: string
  /** Days from today to `askOn` (0 = today). */
  inDays: number
}

/** The next "day after their payday", today included (so a payday yesterday means ask today). */
export function askAfter(payday: Payday, today: string): AskDay | null {
  if (!isPayday(payday) || !isIsoDate(today)) return null
  const period = periodOf(today)
  for (const p of [addMonths(period, -1), period, addMonths(period, 1)]) {
    const paidOn = paydayIn(payday, p)
    const askOn = addDays(paidOn, 1)
    if (askOn >= today) return { paidOn, askOn, inDays: daysBetween(today, askOn) }
  }
  return null
}

/** The day after their payday when it falls within the next 10 days (today counts), else null. */
export function bestAsk(payday: Payday | null | undefined, today: string): AskDay | null {
  if (payday === null || payday === undefined) return null
  const ask = askAfter(payday, today)
  return ask && ask.inDays <= ASK_WINDOW_DAYS ? ask : null
}

/** On your payday and the two days after: which payday, and how long ago. Null on any other day. */
export function paydayWindow(payday: Payday | null | undefined, today: string): { paidOn: string; daysSince: number } | null {
  if (payday === null || payday === undefined || !isPayday(payday) || !isIsoDate(today)) return null
  const paidOn = lastPayday(payday, today)
  const daysSince = daysBetween(paidOn, today)
  return daysSince >= 0 && daysSince <= CARD_DAYS_AFTER ? { paidOn, daysSince } : null
}

const byName = (a: { name: string; friendId: string }, b: { name: string; friendId: string }): number => {
  const an = a.name.toLocaleLowerCase('en')
  const bn = b.name.toLocaleLowerCase('en')
  if (an !== bn) return an < bn ? -1 : 1
  return a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0
}

export interface AskRow {
  friendId: string
  name: string
  /** What they owe you, net (positive). */
  amount: Minor
  /** Their payday, when you have told Settle. */
  payday: Payday | null
  /** The next day after their payday (today at the earliest); null when their payday isn't known. */
  ask: AskDay | null
}

/**
 * Who to ask when: everyone who owes you (your currency's nets), the soonest day to ask first;
 * the same day by the larger amount, then by name. People whose payday isn't known come last.
 */
export function askList(
  byFriend: Readonly<Record<string, Minor>>,
  friendsById: Readonly<Record<string, Friend>>,
  paydays: Readonly<Record<string, Payday>>,
  today: string,
): AskRow[] {
  const rows: AskRow[] = []
  for (const [friendId, net] of Object.entries(byFriend)) {
    const friend = friendsById[friendId]
    if (friendId === ME_ID || !friend || !Number.isSafeInteger(net) || net <= 0) continue
    const payday = paydays[friendId]
    const known = payday !== undefined && isPayday(payday) ? payday : null
    rows.push({ friendId, name: friend.name, amount: net, payday: known, ask: known === null ? null : askAfter(known, today) })
  }
  return rows.sort((a, b) => {
    if ((a.ask === null) !== (b.ask === null)) return a.ask === null ? 1 : -1
    if (a.ask && b.ask && a.ask.askOn !== b.ask.askOn) return a.ask.askOn < b.ask.askOn ? -1 : 1
    if (a.amount !== b.amount) return b.amount - a.amount
    return byName(a, b)
  })
}

/** The people who owe you whose payday was yesterday: today is the day to ask. */
export function askToday(rows: readonly AskRow[]): AskRow[] {
  return rows.filter((row) => row.ask !== null && row.ask.inDays === 0)
}

export interface PaydayDue {
  /** The payday this is about (its date): what "not this month" remembers. */
  paidOn: string
  /** 0 on payday, 1 the day after, 2 the day after that. */
  daysSince: number
  /** Everything you owe, in your currency: the same total "Clear everything" shows. */
  amount: Minor
  /** How many people that is. */
  people: number
  /** Who, when it is one person. */
  only: { friendId: string; name: string } | null
}

/**
 * Your payday card: on payday and the two days after, when you owe anything, unless this payday's
 * card was put away. The total and the count are the ones "Clear everything" goes through.
 */
export function paydayDue(
  mine: Payday | null,
  dismissed: string | null,
  byFriend: Readonly<Record<string, Minor>>,
  friendsById: Readonly<Record<string, Friend>>,
  today: string,
): PaydayDue | null {
  const window = paydayWindow(mine, today)
  if (!window || window.paidOn === dismissed) return null
  const queue = payQueue(byFriend, friendsById)
  const amount = queueTotal(queue)
  if (queue.length === 0 || amount <= 0) return null
  const first = queue[0]
  return { ...window, amount, people: queue.length, only: queue.length === 1 && first ? { friendId: first.friendId, name: first.name } : null }
}
