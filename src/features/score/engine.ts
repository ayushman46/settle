/**
 * Settle Score: a number from 300 to 900 for how good you are to share money with, worked out on
 * this phone from your own splits. A game and a nudge to pay back fast, never a credit score.
 *
 * What counts:
 * - every share you owed someone outside a group: from the expense's date to when it was ticked off
 *   as paid back (still open: its age so far);
 * - in each group, every stretch you owed the group, from the day your balance went below zero to the
 *   day a payment brought it back (the same day-by-day story the group's Board tells);
 * - every bill you paid for other people.
 *
 * Tiny amounts can't carry it: a bill under `COUNTS_FROM` (₹100) isn't a split for it, owing someone
 * less than that isn't a debt for it, at most `SPLITS_A_DAY` splits a day count, the full range needs
 * `FULL_PEOPLE` different people, and the top band needs the full range.
 *
 * Pure: no clock, no storage; `today` comes in. Paying something off can never lower the score (an
 * open debt already counts with its age so far, so paying it today only helps). Loans aren't
 * counted: only splits and bills.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { expenseNet, groupBalances, isSettledInGroup, stillOwed } from '../../engine/balances'
import { daysBetween, toIsoDate } from '../../engine/dates'

/* ------------------------------------------------------------------ the rules (shown to people as they are) */

export const MIN_SCORE = 300
export const MAX_SCORE = 900
/** Where everyone starts, and where a short history stays near. */
export const NEUTRAL_SCORE = 600
/** Paid back within this many days counts as on time. */
export const ON_TIME_DAYS = 3
/** Owed for longer than this counts against you. */
export const OVERDUE_DAYS = 7
/** Splits it takes before the score can use its whole range. */
export const FULL_HISTORY = 12
/** Different people it takes before the score can use its whole range (one friend alone can't carry it). */
export const FULL_PEOPLE = 3
/** Times you owed someone (paid back, or still unpaid after `ON_TIME_DAYS`) before the score is shown at all. */
export const READY_AT = 3
/** A bill under this (minor units of its own currency: ₹100) isn't a split for the score; owing less isn't a debt for it. */
export const COUNTS_FROM: Minor = 10_000
/** At most this many splits (and bills paid for others) a day count. */
export const SPLITS_A_DAY = 2
/** Each bill you paid for others adds this much to its factor, up to 100. */
export const FRONTED_STEP = 10
/** Speed: a median of this many days scores 0. */
export const SLOW_DAYS = 20
/** What one overdue debt takes off its factor: a base, plus a point a day past a week (capped). */
export const OVERDUE_BASE = 30
export const OVERDUE_DAYS_CAP = 30

export type FactorId = 'speed' | 'onTime' | 'overdue' | 'fronted' | 'history'

/** How much each factor counts (they add up to 100). */
export const WEIGHTS: Readonly<Record<FactorId, number>> = { speed: 30, onTime: 25, overdue: 25, fronted: 10, history: 10 }

/** Where the top band starts: only a full history can reach it. */
export const GOLD_FROM = 800

export type BandId ='warming' | 'getting' | 'solid' | 'gold'
export const BANDS: ReadonlyArray<{ id: BandId; from: number; to: number }> = [
  { id: 'warming', from: 300, to: 549 },
  { id: 'getting', from: 550, to: 699 },
  { id: 'solid', from: 700, to: 799 },
  { id: 'gold', from: GOLD_FROM, to: 900 },
]

export function bandFor(score: number): BandId {
  let found: BandId = 'warming'
  for (const band of BANDS) if (score >= band.from) found = band.id
  return found
}

/* ------------------------------------------------------------------ what the score says */

export type Factor =
  | { id: 'speed'; sub: number; weight: number; medianDays: number | null; count: number; paidBack: number; open: number; oldestOpenDays: number }
  | { id: 'onTime'; sub: number; weight: number; onTime: number; counted: number }
  | { id: 'overdue'; sub: number; weight: number; count: number; oldestDays: number; amount: Minor }
  | { id: 'fronted'; sub: number; weight: number; bills: number }
  | { id: 'history'; sub: number; weight: number; splits: number; people: number; full: boolean }

export type NextStep =
  | { kind: 'friend'; friendId: string; amount: Minor; currency: string; gain: number }
  | { kind: 'group'; groupId: string; amount: Minor; currency: string; gain: number }

export interface SettleScore {
  /** 300–900. */
  score: number
  band: BandId
  /** Enough history to show it: `owed` has reached `READY_AT`. */
  ready: boolean
  /** Times you owed someone that count so far (paid back, or unpaid for over `ON_TIME_DAYS`). */
  owed: number
  /** Splits of `COUNTS_FROM` or more it's worked out from (at most `SPLITS_A_DAY` a day). */
  splits: number
  /** Splits of any size you're in with someone else (0: nothing to show at all). */
  anySplits: number
  factors: Factor[]
  /** The one payment that would help most, or null when you owe nobody. */
  next: NextStep | null
}

export interface ScoreInput {
  expenses: readonly Expense[]
  groups: readonly Group[]
  /** YYYY-MM-DD. */
  today: string
  me?: string
  /** Names, to break ties between two next steps the same on every phone (never by id). */
  nameOf?: (kind: 'friend' | 'group', id: string) => string
  /** The profile currency: the overdue amount is told in it. */
  currency?: string
}

/* ------------------------------------------------------------------ debts, as the score sees them */

interface Debt {
  /** Where it's paid: a friend (outside groups) or a group's settle-up. */
  source: { kind: 'friend' | 'group'; id: string }
  /** The day it began. */
  from: string
  /** The day it was paid off, or null while open. */
  to: string | null
  /** What's still open (0 once paid). */
  amount: Minor
  /** How big it was: the share, or the most owed during a group stretch. Paying doesn't change it. */
  size: Minor
  currency: string
}

/** Whether a debt is big enough to count (a small one still shows as a next step, worth nothing). */
const counts = (d: Debt): boolean => d.size >= COUNTS_FROM

/** The local calendar day of an epoch-ms time (no clock is read: the time is given). */
function dayOf(ms: number): string {
  return toIsoDate(new Date(ms))
}

function looseDebts(expenses: readonly Expense[], groups: readonly Group[], today: string, me: string): Debt[] {
  const debts: Debt[] = []
  for (const e of expenses) {
    if (e.kind === 'loan' || e.date > today || e.payerId === me || isSettledInGroup(e, groups)) continue
    const share = e.shares[me]
    if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0) continue
    const paidAt = e.paidBack[me]
    let to = paidAt !== undefined && Number.isFinite(paidAt) ? dayOf(paidAt) : null
    if (to !== null && to < e.date) to = e.date
    if (to !== null && to > today) to = today
    debts.push({ source: { kind: 'friend', id: e.payerId }, from: e.date, to, amount: to === null ? stillOwed(e, me) : 0, size: share, currency: e.currency })
  }
  return debts
}

/**
 * The stretches I owed each group, replayed day by day like the Board does: a day's bills first,
 * then its payments; a debt begins the day my balance goes below zero and ends the day it's back.
 */
function groupDebts(expenses: readonly Expense[], groups: readonly Group[], today: string, me: string): Debt[] {
  const debts: Debt[] = []
  for (const group of groups) {
    const mine = expenses.filter((e) => e.groupId === group.id && e.currency === group.currency && e.kind !== 'loan' && e.date <= today)
    const payments = group.settlements.filter((s) => Number.isFinite(s.amount) && s.amount > 0 && s.fromId !== s.toId && s.date <= today && (s.fromId === me || s.toId === me))
    const dates = [...new Set([...mine.map((e) => e.date), ...payments.map((s) => s.date)])].sort()
    let balance = 0
    let since: string | null = null
    let peak = 0
    for (const date of dates) {
      for (const e of mine) if (e.date === date) balance += expenseNet(e)[me] ?? 0
      if (balance < 0 && since === null) since = date
      if (since !== null) peak = Math.max(peak, -balance)
      for (const s of payments) {
        if (s.date !== date) continue
        if (s.fromId === me) balance += s.amount
        else balance -= s.amount
      }
      if (balance >= 0 && since !== null) {
        debts.push({ source: { kind: 'group', id: group.id }, from: since, to: date, amount: 0, size: peak, currency: group.currency })
        since = null
        peak = 0
      } else if (balance < 0 && since === null) since = date
      if (since !== null) peak = Math.max(peak, -balance)
    }
    if (since !== null) {
      // What's open is the group's real balance (loans and all), never more than the stretch shows.
      const real = -(groupBalances(group, expenses)[me] ?? 0)
      debts.push({ source: { kind: 'group', id: group.id }, from: since, to: null, amount: real > 0 ? real : -balance, size: peak, currency: group.currency })
    }
  }
  return debts
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value))

interface Worked {
  score: number
  factors: Factor[]
  /** Times owed that count (the on-time factor's `counted`). */
  owed: number
}

interface History {
  bills: number
  splits: number
  people: number
}

function work(all: readonly Debt[], { bills, splits, people }: History, today: string, currency: string): Worked {
  const debts = all.filter(counts)
  const days = debts.map((d) => Math.max(0, daysBetween(d.from, d.to ?? today)))
  let paidBack = 0
  let open = 0
  let oldestOpen = 0
  debts.forEach((d, i) => {
    if (d.to !== null) paidBack++
    else {
      open++
      oldestOpen = Math.max(oldestOpen, days[i] ?? 0)
    }
  })

  const med = median(days)
  const speed = med === null ? 50 : clamp(100 - (100 * med) / SLOW_DAYS, 0, 100)

  let onTime = 0
  let counted = 0
  debts.forEach((d, i) => {
    const age = days[i] ?? 0
    if (d.to !== null) {
      counted++
      if (age <= ON_TIME_DAYS) onTime++
    } else if (age > ON_TIME_DAYS) counted++
  })
  const onTimeSub = counted === 0 ? 50 : (100 * onTime) / counted

  let penalty = 0
  let overdue = 0
  let oldest = 0
  let overdueAmount = 0
  debts.forEach((d, i) => {
    const age = days[i] ?? 0
    if (d.to !== null || age <= OVERDUE_DAYS) return
    overdue++
    oldest = Math.max(oldest, age)
    if (d.currency === currency) overdueAmount += d.amount
    penalty += OVERDUE_BASE + Math.min(OVERDUE_DAYS_CAP, age - OVERDUE_DAYS)
  })
  const overdueSub = 100 - Math.min(100, penalty)

  const frontedSub = Math.min(100, bills * FRONTED_STEP)
  const confidence = Math.min(1, splits / FULL_HISTORY, people / FULL_PEOPLE)
  const historySub = confidence * 100

  const blend = (WEIGHTS.speed * speed + WEIGHTS.onTime * onTimeSub + WEIGHTS.overdue * overdueSub + WEIGHTS.fronted * frontedSub + WEIGHTS.history * historySub) / 100
  const raw = MIN_SCORE + ((MAX_SCORE - MIN_SCORE) * blend) / 100
  // A short history stays near the middle: two splits can't make a gold standard (or a slow one).
  const spread = Math.round(clamp(NEUTRAL_SCORE + (raw - NEUTRAL_SCORE) * confidence, MIN_SCORE, MAX_SCORE))
  // The top band needs real history: the full range, not a run of small or one-friend splits.
  const score = confidence < 1 ? Math.min(spread, GOLD_FROM - 1) : spread

  const r = (x: number): number => Math.round(x)
  return {
    score,
    owed: counted,
    factors: [
      { id: 'speed', sub: r(speed), weight: WEIGHTS.speed, medianDays: med, count: debts.length, paidBack, open, oldestOpenDays: oldestOpen },
      { id: 'onTime', sub: r(onTimeSub), weight: WEIGHTS.onTime, onTime, counted },
      { id: 'overdue', sub: r(overdueSub), weight: WEIGHTS.overdue, count: overdue, oldestDays: oldest, amount: overdueAmount },
      { id: 'fronted', sub: r(frontedSub), weight: WEIGHTS.fronted, bills },
      { id: 'history', sub: r(historySub), weight: WEIGHTS.history, splits, people, full: confidence >= 1 },
    ],
  }
}

/* ------------------------------------------------------------------ the score */

export function settleScore({ expenses, groups, today, me = ME_ID, nameOf = (_kind, id) => id, currency = 'INR' }: ScoreInput): SettleScore {
  const debts = [...looseDebts(expenses, groups, today, me), ...groupDebts(expenses, groups, today, me)]

  let bills = 0
  let splits = 0
  let anySplits = 0
  const people = new Set<string>()
  const perDay = new Map<string, { splits: number; bills: number }>()
  for (const e of expenses) {
    if (e.kind === 'loan' || e.date > today) continue
    const others = Object.entries(e.shares)
      .filter(([id, amount]) => id !== e.payerId && id !== me && typeof amount === 'number' && amount > 0)
      .map(([id]) => id)
    const fronted = e.payerId === me && others.length > 0
    if (!fronted && !(e.payerId !== me && (e.shares[me] ?? 0) > 0)) continue
    anySplits++
    if (!(e.total >= COUNTS_FROM)) continue
    for (const id of fronted ? others : [e.payerId]) people.add(id)
    const day = perDay.get(e.date) ?? { splits: 0, bills: 0 }
    if (day.splits < SPLITS_A_DAY) {
      day.splits++
      splits++
    }
    if (fronted && day.bills < SPLITS_A_DAY) {
      day.bills++
      bills++
    }
    perDay.set(e.date, day)
  }
  const history: History = { bills, splits, people: people.size }

  const { score, factors, owed } = work(debts, history, today, currency)

  /* ---- the one payment that helps most ---- */
  const open = new Map<string, { kind: 'friend' | 'group'; id: string; amounts: Map<string, Minor> }>()
  for (const d of debts) {
    if (d.to !== null) continue
    const key = `${d.source.kind}:${d.source.id}`
    const slot = open.get(key) ?? { kind: d.source.kind, id: d.source.id, amounts: new Map<string, Minor>() }
    slot.amounts.set(d.currency, (slot.amounts.get(d.currency) ?? 0) + d.amount)
    open.set(key, slot)
  }
  let next: NextStep | null = null
  let nextName = ''
  for (const slot of open.values()) {
    const after = work(
      debts.map((d) => (d.to === null && d.source.kind === slot.kind && d.source.id === slot.id ? { ...d, to: today, amount: 0 } : d)),
      history,
      today,
      currency,
    ).score
    const gain = after - score
    const code = slot.amounts.has(currency) ? currency : ([...slot.amounts.keys()].sort()[0] ?? currency)
    const amount = slot.amounts.get(code) ?? 0
    const name = nameOf(slot.kind, slot.id)
    const better = next === null || gain > next.gain || (gain === next.gain && (amount > next.amount || (amount === next.amount && name.localeCompare(nextName) < 0)))
    if (!better) continue
    nextName = name
    next = slot.kind === 'friend' ? { kind: 'friend', friendId: slot.id, amount, currency: code, gain } : { kind: 'group', groupId: slot.id, amount, currency: code, gain }
  }

  return { score, band: bandFor(score), ready: owed >= READY_AT, owed, splits, anySplits, factors, next }
}
