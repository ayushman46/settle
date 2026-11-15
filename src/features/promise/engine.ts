/**
 * Promise to pay: a date on money that is owed between you and one friend. Pure. A promise is
 * kept when, by the end of its date, the one who promised has paid at least the promised amount
 * (or what was owed when it was made has gone down by that much some other way); otherwise it is
 * broken. The payments and what is owed always come from the app's own records.
 */
import type { Minor } from '../../domain/types'
import { addDays, addMonths, daysBetween, isIsoDate, periodOf } from '../../engine/dates'
import type { Direction } from '../kist/between'

export interface PromiseEntry {
  id: string
  friendId: string
  /** `pay`: you promised the friend. `receive`: the friend promised you. */
  direction: Direction
  currency: string
  amount: Minor
  /** What was owed that way at the moment the promise was made. */
  owedThen: Minor
  /** The day it is promised by, `YYYY-MM-DD`. */
  due: string
  createdAt: number
  /** Shares outside groups that were already part paid at that moment (split id → paid). */
  paidBefore: Record<string, Minor>
  /** Set once its date has passed (or by hand): how it ended. Null while that is still open. */
  outcome: 'kept' | 'broken' | null
  closedAt: number | null
}

/** What the records say about a promise right now. */
export interface PromiseFacts {
  /** What is owed that way now. */
  owedNow: Minor
  /** Paid by the one who promised since it was made, on or before its date (payments with no date of their own count here). */
  paidByDue: Minor
  /** Paid since it was made, but dated after its date. */
  paidLate: Minor
}

export type PromiseState = 'open' | 'kept' | 'broken'

/* ------------------------------------------------------------------ dates */

/** 0 = Sunday … 6 = Saturday; -1 for a date that is not real. */
export function weekday(iso: string): number {
  if (!isIsoDate(iso)) return -1
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/** The next Friday after `today` (a week on when today is Friday). */
export function nextFriday(today: string): string {
  const day = weekday(today)
  if (day === -1) return today
  return addDays(today, (5 - day + 7) % 7 || 7)
}

export type QuickDate = 'tomorrow' | 'friday' | 'first'

/** The one-tap dates: tomorrow, the coming Friday, the next 1st. Two that fall on the same day are offered once. */
export function quickDates(today: string): Array<{ id: QuickDate; date: string }> {
  if (!isIsoDate(today)) return []
  const all: Array<{ id: QuickDate; date: string }> = [
    { id: 'tomorrow', date: addDays(today, 1) },
    { id: 'friday', date: nextFriday(today) },
    { id: 'first', date: `${addMonths(periodOf(today), 1)}-01` },
  ]
  return all.filter((q, i) => all.findIndex((other) => other.date === q.date) === i)
}

/** The date a new promise starts on: the coming Friday. */
export function defaultDue(today: string): string {
  return nextFriday(today)
}

/* ------------------------------------------------------------------ kept or broken */

/** How much of the promised amount has been met by its date. */
export function metByDue(promise: PromiseEntry, facts: PromiseFacts): Minor {
  // Either real payments on time, or what was owed then going down some other way (an expense
  // changed, a due waived). A payment dated after the date explains none of the second.
  const dropped = promise.owedThen - facts.owedNow - facts.paidLate
  return Math.max(0, facts.paidByDue, dropped)
}

/** How much of it has been met at all, late payments included. */
export function metEver(promise: PromiseEntry, facts: PromiseFacts): Minor {
  return Math.max(0, facts.paidByDue + facts.paidLate, promise.owedThen - facts.owedNow)
}

/**
 * Kept, broken or still open, as the records stand on `today`. A promise that was closed (its
 * date passed, or the person said how it went) keeps that outcome whatever happens later.
 */
export function promiseState(promise: PromiseEntry, facts: PromiseFacts, today: string): PromiseState {
  if (promise.outcome !== null) return promise.outcome
  if (metByDue(promise, facts) >= promise.amount) return 'kept'
  return today > promise.due ? 'broken' : 'open'
}

/** Days past its date (0 on or before it). */
export function daysOverdue(promise: PromiseEntry, today: string): number {
  return Math.max(0, daysBetween(promise.due, today))
}

/**
 * Closes every promise whose date has passed, with the outcome the records give it. Until its
 * date passes a promise stays open in the store, so a payment that is undone before then takes
 * the "kept" back with it. Returns the same list when nothing changed.
 */
export function closePassed(promises: readonly PromiseEntry[], factsOf: (p: PromiseEntry) => PromiseFacts, today: string, now: number): readonly PromiseEntry[] {
  let changed = false
  const out = promises.map((p) => {
    if (p.outcome !== null || !(today > p.due)) return p
    const state = promiseState(p, factsOf(p), today)
    if (state === 'open') return p
    changed = true
    return { ...p, outcome: state, closedAt: now }
  })
  return changed ? out : promises
}

/* ------------------------------------------------------------------ reading */

export interface PromiseStats {
  kept: number
  broken: number
  /** Promises that have ended either way. */
  total: number
  /** Still running. */
  open: number
}

/** "Kept 3 of 4": how one friend's promises went (theirs to you and yours to them alike). */
export function statsOf(states: readonly PromiseState[]): PromiseStats {
  const kept = states.filter((s) => s === 'kept').length
  const broken = states.filter((s) => s === 'broken').length
  return { kept, broken, total: kept + broken, open: states.length - kept - broken }
}

export interface PromiseView {
  promise: PromiseEntry
  state: PromiseState
  /** Days past its date. */
  overdue: number
  /** What is still to pay of it (0 once met, on time or late). */
  unmet: Minor
  /** What paying it now would record: never more than is owed. */
  payable: Minor
}

export function promiseView(promise: PromiseEntry, facts: PromiseFacts, today: string): PromiseView {
  const unmet = Math.max(0, promise.amount - metEver(promise, facts))
  return {
    promise,
    state: promiseState(promise, facts, today),
    overdue: daysOverdue(promise, today),
    unmet,
    payable: Math.min(unmet, Math.max(0, facts.owedNow)),
  }
}

/**
 * The promise a friend's row shows: the one still open, or else the last broken one while it is
 * still unpaid. Null when there is nothing to say.
 */
export function shownPromise(views: readonly PromiseView[]): PromiseView | null {
  const newestFirst = [...views].sort((a, b) => b.promise.createdAt - a.promise.createdAt)
  const open = newestFirst.find((v) => v.state === 'open')
  if (open) return open
  const last = newestFirst[0]
  return last && last.state === 'broken' && last.unmet > 0 ? last : null
}

/** Open promises first by date (the soonest first), then by name; names, not ids, break ties. */
export function sortOpen(views: readonly PromiseView[], nameOf: (friendId: string) => string): PromiseView[] {
  return [...views].sort((a, b) => {
    if (a.promise.due !== b.promise.due) return a.promise.due < b.promise.due ? -1 : 1
    const na = nameOf(a.promise.friendId).toLocaleLowerCase()
    const nb = nameOf(b.promise.friendId).toLocaleLowerCase()
    if (na !== nb) return na < nb ? -1 : 1
    return a.promise.createdAt - b.promise.createdAt
  })
}

/** Ended promises, the latest date first. */
export function sortHistory(views: readonly PromiseView[]): PromiseView[] {
  return [...views].sort((a, b) => (a.promise.due !== b.promise.due ? (a.promise.due < b.promise.due ? 1 : -1) : b.promise.createdAt - a.promise.createdAt))
}
