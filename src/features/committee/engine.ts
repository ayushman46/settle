/**
 * Committee (kitty / BC): N hands each put in the same amount every month and one hand takes the
 * whole pot each month, until every hand has had it once. Everything here is plain arithmetic on
 * the record: no clock (pass `today`), no storage, no randomness of its own (pass the dice in).
 *
 * A "hand" is one seat. A person may hold two: they pay in twice a month and take two pots.
 * There are as many months as hands. The pot is always `amount × hands`: whole, never divided.
 */
import { addMonths, dateInPeriod, daysBetween, isIsoDate, periodOf } from '../../engine/dates'

export const MIN_MEMBERS = 2
export const MAX_MEMBERS = 30
export const MAX_HANDS_EACH = 2
export const MAX_HANDS = MAX_MEMBERS * MAX_HANDS_EACH
export const MAX_NAME = 40
/** The organiser chases a payment once it is this many days past the day. */
export const CHASE_AFTER_DAYS = 3

export const HANDOVER_HOWS = ['upi', 'cash', 'bank'] as const
export type HandoverHow = (typeof HANDOVER_HOWS)[number]
export type TurnMode = 'order' | 'draw'

export interface Hand {
  /** Unique inside its committee ("h1", "h2"…). */
  id: string
  friendId: string
}

export interface PaidMark {
  /** The day the money was paid in. */
  on: string
  /** When the tick was made. */
  at: number
}

export interface DrawRecord {
  at: number
  /** The hands that were in the hat, in the order they were shown. */
  among: string[]
  picked: string
}

export interface Handover {
  on: string
  how: HandoverHow
  at: number
}

export interface MonthRecord {
  /** Hand id → when it paid in. */
  paid: Record<string, PaidMark>
  /** Draw committees: the hand drawn for this month. Fixed-order committees never set it. */
  taker: string | null
  draw: DrawRecord | null
  /** How many times this month has been drawn (an undone draw still counts: the record stays honest). */
  draws: number
  handed: Handover | null
}

export interface Committee {
  id: string
  name: string
  currency: string
  /** Paise per hand, per month. */
  amount: number
  /** Day of the month money is due (the 31st means the last day in shorter months). */
  day: number
  /** The first month, `YYYY-MM`. */
  start: string
  /** The member who collects. */
  organiserId: string
  mode: TurnMode
  /** Every seat. In a fixed-order committee this is the order the pot goes round. */
  hands: Hand[]
  /** One record per month, as many as there are hands. */
  months: MonthRecord[]
  createdAt: number
}

export function emptyMonth(): MonthRecord {
  return { paid: {}, taker: null, draw: null, draws: 0, handed: null }
}

/* ------------------------------------------------------------------ set-up */

export interface SetupInput {
  id: string
  name: string
  currency: string
  amount: number | null
  /** The first day money is due: its month is the first month, its day the day of every month. */
  firstDate: string
  organiserId: string
  mode: TurnMode
  /** One entry per hand, in turn order: a person listed twice holds two hands. */
  people: readonly string[]
  createdAt: number
}

export type SetupProblem = 'members' | 'tooMany' | 'hands' | 'amount' | 'rupees' | 'date' | 'organiser'

/** What is missing from a set-up, or null when it can start. One problem at a time, the first that matters. */
export function setupProblem(input: Pick<SetupInput, 'amount' | 'firstDate' | 'organiserId' | 'people'>): SetupProblem | null {
  const counts = new Map<string, number>()
  for (const id of input.people) counts.set(id, (counts.get(id) ?? 0) + 1)
  if (counts.size < MIN_MEMBERS) return 'members'
  if (counts.size > MAX_MEMBERS) return 'tooMany'
  for (const n of counts.values()) if (n > MAX_HANDS_EACH) return 'hands'
  if (input.amount === null || !Number.isSafeInteger(input.amount) || input.amount <= 0) return 'amount'
  // The pot is read aloud and handed over in notes: whole rupees only.
  if (input.amount % 100 !== 0) return 'rupees'
  if (!isIsoDate(input.firstDate)) return 'date'
  if (!counts.has(input.organiserId)) return 'organiser'
  return null
}

/** A new committee from a complete set-up; null when something is missing (see `setupProblem`). */
export function buildCommittee(input: SetupInput): Committee | null {
  if (setupProblem(input) !== null || input.amount === null) return null
  const hands = input.people.map((friendId, i): Hand => ({ id: `h${i + 1}`, friendId }))
  return {
    id: input.id,
    name: input.name.trim().slice(0, MAX_NAME),
    currency: input.currency,
    amount: input.amount,
    day: Number(input.firstDate.slice(8, 10)),
    start: periodOf(input.firstDate),
    organiserId: input.organiserId,
    mode: input.mode,
    hands,
    months: hands.map(emptyMonth),
    createdAt: input.createdAt,
  }
}

/**
 * A whole number from 0 to `count − 1`, every one equally likely. `next32` gives a random 32-bit
 * number each call; numbers that would tilt the odds are thrown away and asked for again.
 */
export function pickFair(count: number, next32: () => number): number {
  if (!Number.isSafeInteger(count) || count <= 1) return 0
  const span = 2 ** 32
  const limit = span - (span % count)
  for (let tries = 0; tries < 64; tries++) {
    const n = Math.floor(next32()) >>> 0
    if (n < limit) return n % count
  }
  return 0
}

/** A fair shuffle (Fisher–Yates) of a copy of `list`. */
export function shuffled<T>(list: readonly T[], next32: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickFair(i + 1, next32)
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/* ------------------------------------------------------------------ the schedule */

export function monthCount(c: Committee): number {
  return c.hands.length
}

/** The whole pot one hand takes home. */
export function potOf(c: Committee): number {
  return c.amount * c.hands.length
}

export function periodAt(c: Committee, index: number): string {
  return addMonths(c.start, index)
}

/** The day money is due in month `index` (the 31st in a 30-day month is the 30th). */
export function dueAt(c: Committee, index: number): string {
  return dateInPeriod(periodAt(c, index), c.day)
}

function handById(c: Committee, id: string | null | undefined): Hand | null {
  return id ? (c.hands.find((h) => h.id === id) ?? null) : null
}

function monthAt(c: Committee, index: number): MonthRecord {
  return c.months[index] ?? emptyMonth()
}

/** Draw committees: the hands that have not been given a month yet, in seat order. */
export function eligibleHands(c: Committee): Hand[] {
  const taken = new Set(c.months.map((m) => m.taker).filter((id): id is string => id !== null))
  return c.hands.filter((h) => !taken.has(h.id))
}

export type TakerHow = 'order' | 'draw' | 'last'

/**
 * Who takes the pot in month `index`, and how that was decided: the fixed order, a recorded draw,
 * or being the last hand left (no draw is needed for one chit). Null while a draw is still to come.
 */
export function takerAt(c: Committee, index: number): { hand: Hand; how: TakerHow } | null {
  if (index < 0 || index >= c.hands.length) return null
  if (c.mode === 'order') {
    const hand = c.hands[index]
    return hand ? { hand, how: 'order' } : null
  }
  const drawn = handById(c, monthAt(c, index).taker)
  if (drawn) return { hand: drawn, how: 'draw' }
  const left = eligibleHands(c)
  const open = c.months.filter((m) => m.taker === null).length
  const last = left[0]
  return left.length === 1 && open === 1 && last ? { hand: last, how: 'last' } : null
}

export interface HandView {
  hand: Hand
  /** Which of this person's hands it is (1 or 2) and how many they hold. */
  nth: number
  of: number
  paid: PaidMark | null
  /** Days past the day: still counting when not paid, fixed at the day it was paid when it is. */
  daysLate: number
}

export interface MonthView {
  index: number
  period: string
  due: string
  pot: number
  taker: Hand | null
  takerHow: TakerHow | null
  draw: DrawRecord | null
  draws: number
  hands: HandView[]
  paidCount: number
  unpaid: HandView[]
  /** Not paid and past the day. */
  late: HandView[]
  allPaid: boolean
  handed: Handover | null
  /** Everyone has paid and the pot is handed over. */
  closed: boolean
  /** The month has begun (its calendar month is this one or earlier). */
  started: boolean
}

export function monthView(c: Committee, index: number, today: string): MonthView {
  const record = monthAt(c, index)
  const due = dueAt(c, index)
  const seen = new Map<string, number>()
  const totals = new Map<string, number>()
  for (const h of c.hands) totals.set(h.friendId, (totals.get(h.friendId) ?? 0) + 1)
  const hands = c.hands.map((hand): HandView => {
    const nth = (seen.get(hand.friendId) ?? 0) + 1
    seen.set(hand.friendId, nth)
    const paid = record.paid[hand.id] ?? null
    const daysLate = Math.max(0, daysBetween(due, paid ? paid.on : today))
    return { hand, nth, of: totals.get(hand.friendId) ?? 1, paid, daysLate }
  })
  const unpaid = hands.filter((h) => !h.paid)
  const taker = takerAt(c, index)
  const allPaid = hands.length > 0 && unpaid.length === 0
  return {
    index,
    period: periodAt(c, index),
    due,
    pot: potOf(c),
    taker: taker?.hand ?? null,
    takerHow: taker?.how ?? null,
    draw: record.draw,
    draws: record.draws,
    hands,
    paidCount: hands.length - unpaid.length,
    unpaid,
    late: unpaid.filter((h) => h.daysLate > 0),
    allPaid,
    handed: record.handed,
    closed: allPaid && record.handed !== null,
    started: periodAt(c, index) <= periodOf(today),
  }
}

export function schedule(c: Committee, today: string): MonthView[] {
  return c.months.map((_m, i) => monthView(c, i, today))
}

function isClosed(c: Committee, index: number): boolean {
  const record = monthAt(c, index)
  return record.handed !== null && c.hands.every((h) => record.paid[h.id] !== undefined)
}

/** The oldest month that is not closed: the one to deal with. Null when every month is closed. */
export function currentIndex(c: Committee): number | null {
  for (let i = 0; i < c.months.length; i++) if (!isClosed(c, i)) return i
  return null
}

export function isFinished(c: Committee): boolean {
  return c.months.length > 0 && currentIndex(c) === null
}

/* ------------------------------------------------------------------ changes (each returns a new committee) */

function withMonth(c: Committee, index: number, change: (m: MonthRecord) => MonthRecord): Committee {
  if (index < 0 || index >= c.hands.length) return c
  const months = c.hands.map((_h, i) => (i === index ? change(monthAt(c, i)) : monthAt(c, i)))
  return { ...c, months }
}

/** Puts one month back exactly as it was (Undo), on the committee as it is now. */
export function putMonth(c: Committee, index: number, record: MonthRecord): Committee {
  return withMonth(c, index, () => record)
}

/** Ticks one hand as paid in (`mark`), or takes the tick off (`null`). */
export function markPaid(c: Committee, index: number, handId: string, mark: PaidMark | null): Committee {
  if (!handById(c, handId)) return c
  return withMonth(c, index, (m) => {
    const paid = { ...m.paid }
    if (mark) paid[handId] = mark
    else delete paid[handId]
    return { ...m, paid }
  })
}

/** Ticks every hand that has not paid yet. Ticks already there keep their own dates. */
export function markAllPaid(c: Committee, index: number, mark: PaidMark): Committee {
  return withMonth(c, index, (m) => {
    const paid = { ...m.paid }
    for (const h of c.hands) paid[h.id] ??= mark
    return { ...m, paid }
  })
}

/**
 * Records a draw for month `index`: `pick` is the place in the hat (`eligibleHands`, as shown)
 * that came up. Nothing changes in a fixed-order committee, when the month already has a taker,
 * or when the pick is not in the hat.
 */
export function recordDraw(c: Committee, index: number, pick: number, at: number): Committee {
  if (c.mode !== 'draw' || takerAt(c, index) !== null) return c
  const hat = eligibleHands(c)
  const picked = hat[pick]
  if (!picked) return c
  return withMonth(c, index, (m) => ({ ...m, taker: picked.id, draw: { at, among: hat.map((h) => h.id), picked: picked.id }, draws: m.draws + 1 }))
}

/** Takes a draw back (and the handover with it). The count of draws stays, so a re-draw shows. */
export function undoDraw(c: Committee, index: number): Committee {
  if (c.mode !== 'draw') return c
  return withMonth(c, index, (m) => ({ ...m, taker: null, draw: null, handed: null }))
}

/** "Pot handed over" (needs someone to hand it to), or takes that back with `null`. */
export function markHanded(c: Committee, index: number, handover: Handover | null): Committee {
  if (handover && takerAt(c, index) === null) return c
  return withMonth(c, index, (m) => ({ ...m, handed: handover }))
}

/* ------------------------------------------------------------------ everyone's position */

export interface Position {
  friendId: string
  hands: number
  /** Paid in so far, and what they pay over the whole committee. */
  paidIn: number
  toPay: number
  /** Pots handed over to them so far. */
  received: number
  /** Months whose pot is theirs (known ones only, in a draw committee), and those already handed over. */
  potMonths: number[]
  gotMonths: number[]
  /** Their next pot still to come, as a month index; null when none is known. */
  nextPot: number | null
  /** Months from the current month to that pot (0 = this month); null when none is known. */
  monthsToGo: number | null
  /** Hands of theirs still waiting for a draw. */
  undrawn: number
}

/** One line per person, in seat order of their first hand. Sums: paidIn adds up to every tick × amount. */
export function positions(c: Committee): Position[] {
  const current = currentIndex(c)
  const byFriend = new Map<string, Position>()
  for (const h of c.hands) {
    const p = byFriend.get(h.friendId) ?? { friendId: h.friendId, hands: 0, paidIn: 0, toPay: 0, received: 0, potMonths: [], gotMonths: [], nextPot: null, monthsToGo: null, undrawn: 0 }
    p.hands += 1
    p.toPay += c.amount * c.hands.length
    for (let i = 0; i < c.hands.length; i++) if (monthAt(c, i).paid[h.id]) p.paidIn += c.amount
    byFriend.set(h.friendId, p)
  }
  for (let i = 0; i < c.hands.length; i++) {
    const taker = takerAt(c, i)
    const p = taker ? byFriend.get(taker.hand.friendId) : undefined
    if (!p) continue
    p.potMonths.push(i)
    if (monthAt(c, i).handed) {
      p.gotMonths.push(i)
      p.received += potOf(c)
    } else if (p.nextPot === null) {
      p.nextPot = i
      p.monthsToGo = current === null ? null : Math.max(0, i - current)
    }
  }
  for (const p of byFriend.values()) p.undrawn = p.hands - p.potMonths.length
  return [...byFriend.values()]
}

/* ------------------------------------------------------------------ what is due today */

export interface DueToday {
  /** Your own hands not paid in, in months whose day has come: the months and the total. */
  pay: { months: number[]; amount: number } | null
  /** You organise: the oldest month with hands (not yours) unpaid 3 days past the day. */
  chase: { index: number; hands: HandView[] } | null
  /** You organise: the oldest month where everyone has paid and the pot is not handed over. */
  handover: { index: number; hand: Hand } | null
  /** You organise: the oldest month whose day has come with no draw done. */
  draw: { index: number } | null
}

export function dueToday(c: Committee, today: string, meId: string): DueToday {
  const out: DueToday = { pay: null, chase: null, handover: null, draw: null }
  const organiser = c.organiserId === meId
  for (let i = 0; i < c.hands.length; i++) {
    if (dueAt(c, i) > today) break
    if (isClosed(c, i)) continue
    const view = monthView(c, i, today)
    const mine = view.unpaid.filter((h) => h.hand.friendId === meId)
    if (mine.length > 0) {
      out.pay ??= { months: [], amount: 0 }
      out.pay.months.push(i)
      out.pay.amount += c.amount * mine.length
    }
    if (!organiser) continue
    const late = view.unpaid.filter((h) => h.hand.friendId !== meId && h.daysLate >= CHASE_AFTER_DAYS)
    if (late.length > 0) out.chase ??= { index: i, hands: late }
    if (!view.taker) out.draw ??= { index: i }
    else if (view.allPaid && !view.handed) out.handover ??= { index: i, hand: view.taker }
  }
  return out
}
