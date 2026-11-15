/**
 * Pay in parts (kist): a plan between you and one friend to clear a big amount in a few dated
 * parts. Pure: the plan only holds the schedule and which parts are ticked. What is owed always
 * comes from the app's own records, and every tick stands for one real payment in them (or one
 * the person asked to count), so money is never counted twice.
 */
import type { Minor } from '../../domain/types'
import { addDays, addMonths, dateInPeriod, daysBetween, isIsoDate, periodOf } from '../../engine/dates'
import type { Direction, MoneyRecord } from './between'

export type KistEvery = 'month' | 'week'

export const MIN_PARTS = 2
export const MAX_PARTS = 12
export const DEFAULT_PARTS = 3

export interface KistPart {
  amount: Minor
  /** The day it is due, `YYYY-MM-DD`. */
  due: string
  /** Epoch ms when it was ticked; null while it is still to pay. */
  paidAt: number | null
  /** The day it was ticked. */
  paidOn: string | null
  /** `plan`: paid from the plan. `counted`: a payment made elsewhere that the person counted here. */
  how: 'plan' | 'counted' | null
  /** What paying it changed in the app's records (so it is never offered again as a payment made elsewhere). */
  records: MoneyRecord[]
}

export interface KistPlan {
  id: string
  friendId: string
  direction: Direction
  currency: string
  every: KistEvery
  parts: KistPart[]
  createdAt: number
  /** Set when the plan was finished before every part was paid (nothing more was owed). */
  endedAt: number | null
  /** Shares outside groups that were already part paid when the plan started (split id → paid). */
  paidBefore: Record<string, Minor>
}

/* ------------------------------------------------------------------ amounts */

/** The most parts `total` can make with at least one whole unit (a rupee) in each. */
export function mostParts(total: Minor, unit: number): number {
  if (!Number.isSafeInteger(total) || total <= 0 || !(unit > 0)) return 1
  return Math.max(1, Math.min(MAX_PARTS, Math.floor(total / unit)))
}

/**
 * `total` in `count` parts of whole units (rupees); the last part takes whatever is left over,
 * paise included, so the parts always add up to the total. Fewer parts come back when the total
 * is too small to put a whole unit in each.
 */
export function splitParts(total: Minor, count: number, unit = 100): Minor[] {
  if (!Number.isSafeInteger(total) || total <= 0) return []
  const size = unit > 0 ? unit : 1
  const wanted = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1
  const n = Math.min(wanted, Math.max(1, Math.floor(total / size)))
  const each = Math.floor(total / n / size) * size
  const parts = new Array<number>(n).fill(each)
  parts[n - 1] = total - each * (n - 1)
  return parts
}

/* ------------------------------------------------------------------ dates */

/** The 1st of the month after `today`. */
export function nextFirst(today: string): string {
  return `${addMonths(periodOf(today), 1)}-01`
}

/** Where a new plan starts: the next 1st for a monthly plan, a week from today for a weekly one. */
export function defaultFirstDue(today: string, every: KistEvery): string {
  return every === 'week' ? addDays(today, 7) : nextFirst(today)
}

/**
 * The due dates: every week from `first`, or the same day every month. A day the month does not
 * have means its last day (the 31st → 30 Apr, 28 or 29 Feb), and goes back to the 31st after.
 */
export function partDates(first: string, every: KistEvery, count: number): string[] {
  if (!isIsoDate(first)) return []
  const n = Math.max(0, Math.trunc(count))
  const out: string[] = []
  const day = Number(first.slice(8, 10))
  for (let i = 0; i < n; i += 1) {
    out.push(every === 'week' ? addDays(first, 7 * i) : dateInPeriod(addMonths(periodOf(first), i), day))
  }
  return out
}

export interface DraftPart {
  amount: Minor
  due: string
}

/** The schedule a plan would have, to show before saving. */
export function draftParts(total: Minor, count: number, first: string, every: KistEvery, unit = 100): DraftPart[] {
  const amounts = splitParts(total, count, unit)
  const dates = partDates(first, every, amounts.length)
  if (dates.length !== amounts.length) return []
  return amounts.map((amount, i) => ({ amount, due: dates[i] ?? first }))
}

export interface PlanInput {
  id: string
  friendId: string
  direction: Direction
  currency: string
  every: KistEvery
  total: Minor
  count: number
  first: string
  unit?: number
  now: number
  paidBefore?: Record<string, Minor>
}

/** A new plan, or null when the amount or the first date cannot make one. */
export function makePlan(input: PlanInput): KistPlan | null {
  const parts = draftParts(input.total, input.count, input.first, input.every, input.unit ?? 100)
  if (parts.length === 0) return null
  return {
    id: input.id,
    friendId: input.friendId,
    direction: input.direction,
    currency: input.currency,
    every: input.every,
    parts: parts.map((p) => ({ ...p, paidAt: null, paidOn: null, how: null, records: [] })),
    createdAt: input.now,
    endedAt: null,
    paidBefore: input.paidBefore ?? {},
  }
}

/* ------------------------------------------------------------------ reading a plan */

export function isPaid(part: KistPart): boolean {
  return part.paidAt !== null
}

/** The first part still to pay, or -1. */
export function nextIndex(plan: KistPlan): number {
  return plan.parts.findIndex((p) => !isPaid(p))
}

/** True while there is still a part to pay and the plan has not been finished early. */
export function isRunning(plan: KistPlan): boolean {
  return plan.endedAt === null && nextIndex(plan) !== -1
}

export function planTotal(plan: KistPlan): Minor {
  return plan.parts.reduce((sum, p) => sum + p.amount, 0)
}

export function planPaid(plan: KistPlan): Minor {
  return plan.parts.reduce((sum, p) => sum + (isPaid(p) ? p.amount : 0), 0)
}

/** What the plan still has to pay: 0 once it is done or finished early. */
export function planLeft(plan: KistPlan): Minor {
  return plan.endedAt === null ? planTotal(plan) - planPaid(plan) : 0
}

/** Every record the plans' own payments made (so they are never taken for payments made elsewhere). */
export function planRecords(plans: readonly KistPlan[]): MoneyRecord[] {
  return plans.flatMap((plan) => plan.parts.flatMap((p) => p.records))
}

/** What parts counted from elsewhere add up to: that much of the outside payments is spoken for. */
export function countedTotal(plan: KistPlan): Minor {
  return plan.parts.reduce((sum, p) => sum + (p.how === 'counted' ? p.amount : 0), 0)
}

export type PartState = 'paid' | 'counted' | 'late' | 'today' | 'next' | 'later' | 'dropped'

export interface PartView {
  index: number
  amount: Minor
  due: string
  state: PartState
  /** Days past its date (0 unless late). */
  daysLate: number
  paidOn: string | null
}

export type Drift =
  /** The plan and what is owed agree. */
  | 'none'
  /** More is owed than the plan has left (new expenses, or the plan was made for a part of it). */
  | 'more'
  /** Less is owed than the plan has left (something was paid or changed outside the plan). */
  | 'less'
  /** Nothing is owed any more, but parts are still to pay. */
  | 'clear'

export interface KistView {
  parts: PartView[]
  count: number
  paidCount: number
  total: Minor
  paid: Minor
  left: Minor
  /** Index of the part to pay next, or -1. */
  next: number
  state: 'running' | 'done' | 'ended'
  /** What is owed in the plan's direction right now, from the app's records. */
  owed: Minor
  drift: Drift
  /** How far apart `owed` and `left` are. */
  gap: Minor
  /** How many of the next parts a payment made outside the plan covers in full. */
  countable: number
  /** What those parts add up to. */
  countAmount: Minor
  /** What paying the next part records: its amount, or all that is still owed when that is less. */
  payNow: Minor
  /** What paying everything off records. */
  payOff: Minor
  /** Parts due today or earlier, and what they add up to. */
  dueCount: number
  dueAmount: Minor
  /** Days the oldest unpaid part is late (0 when none is). */
  daysLate: number
}

/**
 * Everything the plan's page shows. `owed` is what the records say is owed in the plan's
 * direction now; `outside` is what was paid between the two since the plan started without going
 * through it (and not yet counted).
 */
export function kistView(plan: KistPlan, owed: Minor, outside: Minor, today: string): KistView {
  const ended = plan.endedAt !== null
  const next = ended ? -1 : nextIndex(plan)
  const parts: PartView[] = plan.parts.map((p, index) => {
    let state: PartState
    if (isPaid(p)) state = p.how === 'counted' ? 'counted' : 'paid'
    else if (ended) state = 'dropped'
    else if (p.due < today) state = 'late'
    else if (p.due === today) state = 'today'
    else state = index === next ? 'next' : 'later'
    return { index, amount: p.amount, due: p.due, state, daysLate: state === 'late' ? daysBetween(p.due, today) : 0, paidOn: p.paidOn }
  })
  const total = planTotal(plan)
  const paid = planPaid(plan)
  const left = planLeft(plan)
  const paidCount = plan.parts.filter(isPaid).length
  const state = next !== -1 ? 'running' : ended ? 'ended' : 'done'
  const open = Math.max(0, Number.isFinite(owed) ? Math.round(owed) : 0)

  let drift: Drift = 'none'
  if (state === 'running') {
    if (open === 0) drift = 'clear'
    else if (open > left) drift = 'more'
    else if (open < left) drift = 'less'
  }
  const gap = Math.abs(open - left)

  let countable = 0
  let countAmount = 0
  if (drift === 'less' || drift === 'clear') {
    const room = Math.min(Math.max(0, outside), gap)
    for (const p of plan.parts) {
      if (isPaid(p)) continue
      if (countAmount + p.amount > room) break
      countAmount += p.amount
      countable += 1
    }
  }

  const due = parts.filter((p) => p.state === 'late' || p.state === 'today')
  const nextAmount = next === -1 ? 0 : (plan.parts[next]?.amount ?? 0)
  return {
    parts,
    count: plan.parts.length,
    paidCount,
    total,
    paid,
    left,
    next,
    state,
    owed: open,
    drift,
    gap,
    countable,
    countAmount,
    payNow: Math.min(nextAmount, open),
    payOff: Math.min(left, open),
    dueCount: due.length,
    dueAmount: due.reduce((sum, p) => sum + p.amount, 0),
    daysLate: due.reduce((most, p) => Math.max(most, p.daysLate), 0),
  }
}

/* ------------------------------------------------------------------ changing a plan */

export interface Tick {
  now: number
  today: string
  how: 'plan' | 'counted'
  records?: MoneyRecord[]
  /** What was really recorded, when it is not the part's own amount. */
  amount?: Minor
}

/** Ticks one part. Its amount becomes what was really recorded, so paid parts always add up to real money. */
export function tickPart(plan: KistPlan, index: number, tick: Tick): KistPlan {
  const part = plan.parts[index]
  if (!part || isPaid(part)) return plan
  const amount = tick.amount !== undefined && Number.isSafeInteger(tick.amount) && tick.amount > 0 ? tick.amount : part.amount
  const parts = plan.parts.map((p, i) =>
    i === index ? { ...p, amount, paidAt: tick.now, paidOn: tick.today, how: tick.how, records: tick.records ?? [] } : p,
  )
  return { ...plan, parts }
}

/** Ticks the next `count` parts as paid elsewhere: no payment is recorded, they only stop being asked for. */
export function countParts(plan: KistPlan, count: number, now: number, today: string): KistPlan {
  let out = plan
  for (let i = 0; i < count; i += 1) {
    const index = nextIndex(out)
    if (index === -1) break
    out = tickPart(out, index, { now, today, how: 'counted' })
  }
  return out
}

/**
 * Spreads `target` over the parts still to pay (whole units, the last takes what is left over),
 * keeping their dates. Parts that would get nothing are dropped from the end; a target of 0
 * finishes the plan.
 */
export function refitPlan(plan: KistPlan, target: Minor, unit: number, now: number): KistPlan {
  if (plan.endedAt !== null) return plan
  const paid = plan.parts.filter(isPaid)
  const unpaid = plan.parts.filter((p) => !isPaid(p))
  if (unpaid.length === 0) return plan
  const amounts = splitParts(target, unpaid.length, unit)
  if (amounts.length === 0) return { ...plan, endedAt: now }
  const kept = amounts.map((amount, i) => ({ ...(unpaid[i] as KistPart), amount }))
  return { ...plan, parts: [...paid, ...kept] }
}

/** Finishes the plan as it stands: parts still to pay are no longer asked for. */
export function endPlan(plan: KistPlan, now: number): KistPlan {
  return plan.endedAt !== null || nextIndex(plan) === -1 ? plan : { ...plan, endedAt: now }
}

/* ------------------------------------------------------------------ lists */

export interface DuePlan {
  plan: KistPlan
  /** The part to pay next. */
  index: number
  /** Parts due today or earlier. */
  count: number
  amount: Minor
  /** Days the oldest of them is late (0 = due today). */
  daysLate: number
}

/** Running plans with a part due today or earlier, the longest overdue first. */
export function duePlans(plans: readonly KistPlan[], today: string): DuePlan[] {
  const out: DuePlan[] = []
  for (const plan of plans) {
    if (!isRunning(plan)) continue
    const due = plan.parts.filter((p) => !isPaid(p) && p.due <= today)
    const first = due[0]
    if (!first) continue
    out.push({
      plan,
      index: nextIndex(plan),
      count: due.length,
      amount: due.reduce((sum, p) => sum + p.amount, 0),
      daysLate: Math.max(0, daysBetween(first.due, today)),
    })
  }
  return out.sort((a, b) => b.daysLate - a.daysLate || a.plan.createdAt - b.plan.createdAt)
}

/** The date of the part to pay next ('' when there is none). */
export function nextDue(plan: KistPlan): string {
  return plan.parts[nextIndex(plan)]?.due ?? ''
}

/**
 * Plans in the order a list shows them: the soonest part first; the same day by the friend's
 * name (names are the same on every phone, ids are not), then the older plan.
 */
export function sortPlans(plans: readonly KistPlan[], nameOf: (friendId: string) => string): KistPlan[] {
  return [...plans].sort((a, b) => {
    const da = nextDue(a)
    const db = nextDue(b)
    if (da !== db) return da < db ? -1 : 1
    const na = nameOf(a.friendId).toLocaleLowerCase()
    const nb = nameOf(b.friendId).toLocaleLowerCase()
    if (na !== nb) return na < nb ? -1 : 1
    return a.createdAt - b.createdAt
  })
}
