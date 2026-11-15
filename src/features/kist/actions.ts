/**
 * What a plan does to the app's records. Paying a part records one real payment between the two
 * of you (in the shared groups first, then off the splits outside groups, oldest first) and ticks
 * the part with exactly what was recorded. Every action hands back an undo that puts the records
 * and the plan back as they were.
 */
import { expensesStore, groupsStore } from '../../data'
import type { Minor, Settlement } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { currencyDigits } from '../../lib/money'
import { payFriend } from '../swap/settle'
import { diffRecords, owedBetween, partPaidSoFar, paymentsSince, paymentsTotal, recordsTotal, sides, type Books, type Direction, type MoneyRecord } from './between'
import {
  countedTotal,
  countParts,
  endPlan,
  isRunning,
  kistView,
  makePlan,
  nextIndex,
  planRecords,
  refitPlan,
  tickPart,
  type KistEvery,
  type KistPlan,
  type KistView,
} from './engine'
import { kistStore, planById, putPlan, removePlan, replacePlan } from './store'

/** One whole unit of the currency in its minor unit (₹1 = 100 paise). */
export function unitOf(currency: string): number {
  return 10 ** currencyDigits(currency)
}

export function booksNow(): Books {
  return { expenses: expensesStore.get(), groups: groupsStore.get() }
}

/** What is owed in the plan's direction right now. */
export function planOwed(plan: KistPlan, books: Books = booksNow()): Minor {
  return owedBetween(plan.friendId, plan.direction, plan.currency, books)
}

/**
 * What was paid between the two since the plan started without going through any plan, less what
 * the person has already counted as parts of this one.
 */
export function planOutside(plan: KistPlan, plans: readonly KistPlan[], books: Books = booksNow()): Minor {
  const { debtorId, creditorId } = sides(plan.friendId, plan.direction)
  const seen = paymentsSince(books, debtorId, creditorId, plan.currency, {
    since: plan.createdAt,
    paidBefore: plan.paidBefore,
    exclude: planRecords(plans.filter((p) => p.friendId === plan.friendId)),
  })
  return Math.max(0, paymentsTotal(seen) - countedTotal(plan))
}

/** The plan as its page shows it, worked out from the records as they are now. */
export function planView(plan: KistPlan, plans: readonly KistPlan[], books: Books, today: string): KistView {
  return kistView(plan, planOwed(plan, books), isRunning(plan) ? planOutside(plan, plans, books) : 0, today)
}

export interface Recorded {
  /** What changed in the records. */
  records: MoneyRecord[]
  /** What it adds up to. */
  amount: Minor
  undo: () => void
}

/**
 * Records one real payment between you and the friend, and reports exactly what it changed.
 * Never more than is owed in that direction: the records are the judge of that.
 */
export function recordBetween(friendId: string, direction: Direction, amount: Minor, currency: string, method: Settlement['method'], date: string = todayIso()): Recorded {
  const before = booksNow()
  const { debtorId, creditorId } = sides(friendId, direction)
  const undo = payFriend(friendId, direction === 'receive' ? 'in' : 'out', amount, before.expenses, before.groups, currency, { method, date })
  const records = diffRecords(before, booksNow(), debtorId, creditorId, currency)
  return { records, amount: recordsTotal(records), undo }
}

export interface StartInput {
  friendId: string
  direction: Direction
  currency: string
  every: KistEvery
  total: Minor
  count: number
  first: string
}

/** Starts a plan. Null when the amount or date cannot make one. */
export function startPlan(input: StartInput, now: number = Date.now()): KistPlan | null {
  const { debtorId, creditorId } = sides(input.friendId, input.direction)
  const plan = makePlan({
    ...input,
    id: newId(),
    unit: unitOf(input.currency),
    now,
    paidBefore: partPaidSoFar(booksNow(), debtorId, creditorId, input.currency),
  })
  if (!plan) return null
  putPlan(plan)
  return planById(plan.id)
}

export interface PlanChange {
  /** What was recorded (0 for a change that moves no money). */
  amount: Minor
  /** The plan after the change. */
  plan: KistPlan
  undo: () => void
}

/** Puts the plan back exactly as it was (or back in the list, if it was deleted since). */
function restorer(before: KistPlan): () => void {
  return () => {
    if (planById(before.id)) replacePlan(before)
    else putPlan(before)
  }
}

/**
 * Pays the next part: records the payment and ticks the part. When less is owed than the part
 * says, only what is owed is recorded and the part shows that amount. If nothing is owed after
 * it, the plan is finished. Null when there was nothing to record.
 */
export function payNextPart(planId: string, method: Settlement['method'], now: number = Date.now()): PlanChange | null {
  const before = planById(planId)
  if (!before || !isRunning(before)) return null
  const index = nextIndex(before)
  const part = before.parts[index]
  if (!part) return null
  const amount = Math.min(part.amount, planOwed(before))
  if (!(amount > 0)) return null
  const today = todayIso(new Date(now))
  const done = recordBetween(before.friendId, before.direction, amount, before.currency, method, today)
  if (!(done.amount > 0)) {
    done.undo()
    return null
  }
  let plan = tickPart(before, index, { now, today, how: 'plan', records: done.records, amount: done.amount })
  if (isRunning(plan) && planOwed(plan) === 0) plan = endPlan(plan, now)
  replacePlan(plan)
  const putBack = restorer(before)
  return {
    amount: done.amount,
    plan,
    undo: () => {
      done.undo()
      putBack()
    },
  }
}

/**
 * Pays off everything the plan has left in one payment (or all that is still owed, when that is
 * less): the parts still to pay are spread over what was recorded, and all of them are ticked.
 */
export function payOffPlan(planId: string, method: Settlement['method'], now: number = Date.now()): PlanChange | null {
  const before = planById(planId)
  if (!before || !isRunning(before)) return null
  const view = kistView(before, planOwed(before), 0, todayIso(new Date(now)))
  if (!(view.payOff > 0)) return null
  const today = todayIso(new Date(now))
  const done = recordBetween(before.friendId, before.direction, view.payOff, before.currency, method, today)
  if (!(done.amount > 0)) {
    done.undo()
    return null
  }
  let plan = done.amount === view.left ? before : refitPlan(before, done.amount, unitOf(before.currency), now)
  // The records sit on the first of the parts ticked together.
  let first = true
  while (nextIndex(plan) !== -1 && plan.endedAt === null) {
    plan = tickPart(plan, nextIndex(plan), { now, today, how: 'plan', records: first ? done.records : [] })
    first = false
  }
  replacePlan(plan)
  const putBack = restorer(before)
  return {
    amount: done.amount,
    plan,
    undo: () => {
      done.undo()
      putBack()
    },
  }
}

/** Counts a payment made outside the plan as its next part(s). Records nothing: the money is already in the books. */
export function countOutside(planId: string, count: number, now: number = Date.now()): PlanChange | null {
  const before = planById(planId)
  if (!before || !isRunning(before) || !(count > 0)) return null
  const plan = countParts(before, count, now, todayIso(new Date(now)))
  if (plan === before) return null
  replacePlan(plan)
  return { amount: 0, plan, undo: restorer(before) }
}

/** Spreads what is owed now over the parts still to pay. */
export function fitPlan(planId: string, now: number = Date.now()): PlanChange | null {
  const before = planById(planId)
  if (!before || !isRunning(before)) return null
  const plan = refitPlan(before, planOwed(before), unitOf(before.currency), now)
  replacePlan(plan)
  return { amount: 0, plan, undo: restorer(before) }
}

/** Finishes a plan whose remaining parts are no longer needed. */
export function finishPlan(planId: string, now: number = Date.now()): PlanChange | null {
  const before = planById(planId)
  if (!before || !isRunning(before)) return null
  const plan = endPlan(before, now)
  replacePlan(plan)
  return { amount: 0, plan, undo: restorer(before) }
}

/** Deletes the plan (payments already recorded stay). The undo puts it back. */
export function deletePlan(planId: string): (() => void) | null {
  const removed = removePlan(planId)
  return removed ? () => putPlan(removed) : null
}

/** Every plan, for callers outside React. */
export function plansNow(): KistPlan[] {
  return kistStore.get().plans
}
