/**
 * What the promises read from, and do to, the app's records: the facts a promise is judged on
 * (what is owed now, what was paid since it was made), noting and removing promises with Undo,
 * and closing the ones whose date has passed.
 */
import type { Minor } from '../../domain/types'
import { isIsoDate, toIsoDate } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import { booksNow } from '../kist/actions'
import { owedBetween, partPaidSoFar, paymentsSince, sides, type Books, type Direction } from '../kist/between'
import { closePassed, promiseView, statsOf, type PromiseEntry, type PromiseFacts, type PromiseStats, type PromiseView } from './engine'
import { promisesNow, putPromise, setPromises, takePromise } from './store'

/** What the records say about a promise right now. */
export function factsOf(promise: PromiseEntry, books: Books = booksNow()): PromiseFacts {
  const { debtorId, creditorId } = sides(promise.friendId, promise.direction)
  let paidByDue = 0
  let paidLate = 0
  for (const p of paymentsSince(books, debtorId, creditorId, promise.currency, { since: promise.createdAt, paidBefore: promise.paidBefore })) {
    if (p.on !== null && p.on > promise.due) paidLate += p.amount
    else paidByDue += p.amount
  }
  return { owedNow: owedBetween(promise.friendId, promise.direction, promise.currency, books), paidByDue, paidLate }
}

/** Every promise as it stands today (pass the lists to stay in step with a screen's own data). */
export function promiseViews(promises: readonly PromiseEntry[], books: Books, today: string): PromiseView[] {
  return promises.map((p) => promiseView(p, factsOf(p, books), today))
}

/** The promise still open with this friend today, or null. */
export function openPromiseWith(friendId: string, views: readonly PromiseView[]): PromiseView | null {
  return views.find((v) => v.promise.friendId === friendId && v.state === 'open') ?? null
}

export interface PromiseInput {
  friendId: string
  direction: Direction
  currency: string
  amount: Minor
  due: string
}

export interface Noted {
  promise: PromiseEntry
  /** The open promise with this friend that it took the place of, if there was one. */
  replaced: PromiseEntry | null
  undo: () => void
}

/**
 * Notes a promise, from this moment: what is owed right now is what it will be measured against.
 * An open promise with the same friend is replaced (a new date, not a broken promise). Null for an
 * amount or date that makes no sense.
 */
export function notePromise(input: PromiseInput, now: Date = new Date()): Noted | null {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_MINOR || !isIsoDate(input.due)) return null
  const books = booksNow()
  const today = toIsoDate(now)
  const { debtorId, creditorId } = sides(input.friendId, input.direction)
  const open = openPromiseWith(input.friendId, promiseViews(promisesNow(), books, today))
  const replaced = open ? takePromise(open.promise.id) : null
  const promise: PromiseEntry = {
    id: newId(),
    friendId: input.friendId,
    direction: input.direction,
    currency: input.currency,
    amount: input.amount,
    owedThen: owedBetween(input.friendId, input.direction, input.currency, books),
    due: input.due,
    createdAt: now.getTime(),
    paidBefore: partPaidSoFar(books, debtorId, creditorId, input.currency),
    outcome: null,
    closedAt: null,
  }
  putPromise(promise)
  return {
    promise,
    replaced,
    undo: () => {
      takePromise(promise.id)
      if (replaced) putPromise(replaced)
    },
  }
}

/** Removes a promise altogether (it is not counted as kept or broken). The undo puts it back. */
export function removePromise(promiseId: string): (() => void) | null {
  const taken = takePromise(promiseId)
  return taken ? () => putPromise(taken) : null
}

/**
 * The person says how it really went ("it was paid on time, I only wrote it down late"): the
 * app cannot see when money moved, only when it was recorded. The undo puts the old outcome back.
 */
export function setOutcome(promiseId: string, outcome: 'kept' | 'broken', now: number = Date.now()): (() => void) | null {
  const before = promisesNow().find((p) => p.id === promiseId)
  if (!before || before.outcome === outcome) return null
  putPromise({ ...before, outcome, closedAt: now })
  return () => putPromise(before)
}

/** Closes the promises whose date has passed, as kept or broken. Returns how many it closed. */
export function sweepPromises(now: Date = new Date()): number {
  const before = promisesNow()
  if (!before.some((p) => p.outcome === null)) return 0
  const books = booksNow()
  const after = closePassed(before, (p) => factsOf(p, books), toIsoDate(now), now.getTime())
  if (after === before) return 0
  setPromises(after)
  return after.filter((p, i) => p !== before[i]).length
}

/**
 * How this friend's promises have gone, theirs to you and yours to them: `{ kept, broken, total,
 * open }` ("kept 3 of 4" is `kept` of `total`). For other features to read.
 */
export function promiseStats(friendId: string, now: Date = new Date()): PromiseStats {
  const mine = promisesNow().filter((p) => p.friendId === friendId)
  if (mine.length === 0) return { kept: 0, broken: 0, total: 0, open: 0 }
  return statsOf(promiseViews(mine, booksNow(), toIsoDate(now)).map((v) => v.state))
}
