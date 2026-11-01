/**
 * The rules for money stuck with a bank or a business — when it must be back, what you're owed for
 * the wait, and where to take it next. Pure functions of a stuck payment and today's date.
 *
 * Failed payments follow the RBI's "Harmonisation of Turn Around Time (TAT) and customer
 * compensation for failed transactions using authorised Payment Systems" (RBI/2019-20/67,
 * DPSS.CO.PD No.629/02.01.014/2019-20, 20 September 2019): each kind of payment has a deadline
 * counted from T, the calendar day of the transaction, and beyond it the bank owes ₹100 for each
 * day of delay — paid on its own, without being asked. Unpaid, it's a complaint to the bank, then
 * after 30 days without a fix to the RBI Ombudsman (Reserve Bank – Integrated Ombudsman Scheme,
 * 2026, in force from 1 July 2026: file within 90 days of those 30 days or of the bank's last reply).
 *
 * Refunds follow the business's own promise (or its usual timeline, src/features/stuck/merchants.ts);
 * overdue, it's the business's support, then the National Consumer Helpline, then a consumer
 * commission — or AirSewa for an airline.
 */
import { addDays, daysBetween } from '../../engine/dates'
import type { StuckPayment, StuckRail, StuckStepKind } from '../../data/stores'
import { addWorkingDays, merchantById, refundWorkingDays } from './merchants'

/** One row of the RBI's TAT table: the deadline (days after T) and the row it comes from. */
export interface RailRule {
  /** Back by T + this many calendar days. */
  days: 1 | 5
  /** Where in the circular's annex (for the complaint letter). */
  row: string
}

/** The RBI's deadline for each way a payment can fail (Annex to RBI/2019-20/67). */
export const RAIL_RULES: Readonly<Record<StuckRail, RailRule>> = {
  upi_person: { days: 1, row: 'UPI — account debited but the beneficiary account not credited (I.4.a)' },
  upi_merchant: { days: 5, row: 'UPI — account debited but transaction confirmation not received at merchant location (I.4.b)' },
  imps: { days: 1, row: 'IMPS — account debited but the beneficiary account not credited (I.3.a)' },
  card_online: { days: 5, row: 'Card not present (e-commerce) — account debited but confirmation not received at merchant’s system (I.2.c)' },
  card_pos: { days: 5, row: 'Point of Sale (card present) — account debited but confirmation not received at merchant location (I.2.b)' },
  card_transfer: { days: 1, row: 'Card to card transfer — card account debited but the beneficiary card account not credited (I.2.a)' },
  atm: { days: 5, row: 'ATM / micro-ATM — customer’s account debited but cash not dispensed (I.1.a)' },
  wallet: { days: 1, row: 'Prepaid payment instrument (on-us) — wallet debited but beneficiary or merchant not credited (I.8.b)' },
  nach: { days: 1, row: 'NACH — delay in crediting the beneficiary or account debited despite a revoked mandate (I.7)' },
  aeps: { days: 5, row: 'AePS — account debited but transaction confirmation not received at merchant location (I.5.a)' },
}

/** How a failed payment is treated when how it was paid isn't known: the longer deadline, so a claim is never early. */
export const UNKNOWN_RAIL_DAYS = 5

/** ₹100 a day, in paise. */
export const COMPENSATION_PER_DAY = 10_000

/** The circular itself, for letters and the "why" line. */
export const RBI_CIRCULAR = 'RBI/2019-20/67, DPSS.CO.PD No.629/02.01.014/2019-20 dated 20 September 2019'

/** A bank has this long to answer a complaint before the RBI Ombudsman takes it. */
export const OMBUDSMAN_WAIT_DAYS = 30
/** A business gets a week from your complaint before the National Consumer Helpline. */
export const MERCHANT_WAIT_DAYS = 7
/** The National Consumer Helpline gets a month before a consumer commission. */
export const NCH_WAIT_DAYS = 30
/** The Ombudsman takes a complaint within 90 days of the bank's 30 days running out (or of its last reply), by the 2026 scheme. */
export const OMBUDSMAN_WINDOW_DAYS = 90

/** The day the money should be back by. */
export function dueBy(s: Pick<StuckPayment, 'kind' | 'rail' | 'date' | 'promisedBy' | 'merchant'>): string {
  if (s.kind === 'refund') return s.promisedBy ?? addWorkingDays(s.date, refundWorkingDays(s.merchant))
  return addDays(s.date, s.rail ? RAIL_RULES[s.rail].days : UNKNOWN_RAIL_DAYS)
}

/** Days late: past the deadline up to the day it came back (or today). 0 while it isn't late. */
export function daysLate(s: StuckPayment, today: string): number {
  const end = s.back?.date ?? today
  return Math.max(0, daysBetween(dueBy(s), end))
}

/** Compensation the RBI says the bank owes for the wait (failed payments the money really left on). */
export function compensationDue(s: StuckPayment, today: string): number {
  if (s.kind !== 'failed' || !s.confirmed || s.dismissedAt !== null) return 0
  return daysLate(s, today) * COMPENSATION_PER_DAY
}

/** What's still to come: the money (while it isn't back) and compensation not yet paid. */
export function stillOwed(s: StuckPayment, today: string): { money: number; compensation: number } {
  if (s.dismissedAt !== null) return { money: 0, compensation: 0 }
  const money = s.back === null ? s.amount : Math.max(0, s.amount - s.back.amount)
  const compensation = Math.max(0, compensationDue(s, today) - (s.back?.compensation ?? 0))
  return { money, compensation }
}

/** Where a stuck payment stands, and so what to do next. */
export type StuckStage =
  /** An app said a payment failed: did the money leave? One tap. */
  | 'check'
  /** Within the deadline: nothing to do yet. */
  | 'waiting'
  /** Past the deadline, no complaint yet: raise it with the bank / the business. */
  | 'overdue'
  /** Complained; their time to answer isn't up. */
  | 'raised'
  /** Their time is up: take it higher (RBI Ombudsman, National Consumer Helpline, a commission). */
  | 'escalate'
  /** Taken as high as Settle can take it; waiting on them. */
  | 'escalated'
  /** The money's back but the bank still owes compensation for the delay. */
  | 'compensation'
  /** All back. */
  | 'back'
  /** Set aside. */
  | 'dismissed'

export interface StuckNext {
  stage: StuckStage
  /** The complaint to raise now, when there is one. */
  step: StuckStepKind | null
  /** The day the current wait ends (waiting, raised, escalated), or null. */
  until: string | null
}

function stepOn(s: StuckPayment, kind: StuckStepKind) {
  return s.steps.find((x) => x.kind === kind) ?? null
}

/** The ladder for a refund from this business: its support, then AirSewa (airlines) or the National Consumer Helpline, then a commission. */
function refundLadder(s: StuckPayment): StuckStepKind[] {
  const airline = merchantById(s.merchant)?.category === 'airline'
  return airline ? ['merchant', 'airsewa', 'nch', 'commission'] : ['merchant', 'nch', 'commission']
}

/** How long each rung gets before the next. */
function waitFor(kind: StuckStepKind): number {
  if (kind === 'bank') return OMBUDSMAN_WAIT_DAYS
  if (kind === 'merchant') return MERCHANT_WAIT_DAYS
  return NCH_WAIT_DAYS
}

/** Where it stands today and what to do about it. */
export function nextStep(s: StuckPayment, today: string): StuckNext {
  if (s.dismissedAt !== null) return { stage: 'dismissed', step: null, until: null }
  if (s.back !== null) {
    const owed = stillOwed(s, today)
    if (owed.compensation > 0) {
      const bank = stepOn(s, 'bank')
      if (!bank) return { stage: 'compensation', step: 'bank', until: null }
      if (stepOn(s, 'ombudsman')) return { stage: 'escalated', step: null, until: null }
      const until = addDays(bank.date, OMBUDSMAN_WAIT_DAYS)
      return today >= until ? { stage: 'escalate', step: 'ombudsman', until: null } : { stage: 'raised', step: null, until }
    }
    return { stage: 'back', step: null, until: null }
  }
  if (!s.confirmed) return { stage: 'check', step: null, until: null }
  const due = dueBy(s)
  if (today <= due) return { stage: 'waiting', step: null, until: due }
  const ladder: StuckStepKind[] = s.kind === 'failed' ? ['bank', 'ombudsman'] : refundLadder(s)
  // The highest rung reached so far.
  let reached = -1
  for (let i = 0; i < ladder.length; i++) if (stepOn(s, ladder[i] as StuckStepKind)) reached = i
  if (reached < 0) return { stage: 'overdue', step: ladder[0] as StuckStepKind, until: null }
  const last = ladder[reached] as StuckStepKind
  const lastStep = stepOn(s, last)
  const until = addDays(lastStep?.date ?? today, waitFor(last))
  if (reached === ladder.length - 1) return { stage: 'escalated', step: null, until }
  return today >= until ? { stage: 'escalate', step: ladder[reached + 1] as StuckStepKind, until: null } : { stage: 'raised', step: null, until }
}

/** Open ones first by urgency, then the newest. */
const STAGE_ORDER: Readonly<Record<StuckStage, number>> = {
  escalate: 0,
  overdue: 1,
  compensation: 2,
  check: 3,
  raised: 4,
  escalated: 5,
  waiting: 6,
  back: 7,
  dismissed: 8,
}

export function stageRank(stage: StuckStage): number {
  return STAGE_ORDER[stage]
}

/** Needs you to do something today. */
export function needsAction(stage: StuckStage): boolean {
  return stage === 'escalate' || stage === 'overdue' || stage === 'compensation' || stage === 'check'
}

export interface StuckSummary {
  /** Not back yet (and not set aside). */
  open: number
  /** Their money, in paise. */
  stuck: number
  /** Compensation owed and not yet paid, in paise. */
  compensation: number
  /** How many need you to act today. */
  act: number
  /** Got back so far (money and compensation), in paise. */
  recovered: number
  /** How many came back. */
  recoveredCount: number
}

export function summarize(list: readonly StuckPayment[], today: string): StuckSummary {
  const out: StuckSummary = { open: 0, stuck: 0, compensation: 0, act: 0, recovered: 0, recoveredCount: 0 }
  for (const s of list) {
    if (s.dismissedAt !== null) continue
    const owed = stillOwed(s, today)
    const stage = nextStep(s, today).stage
    if (s.back === null) {
      out.open += 1
      if (s.confirmed) out.stuck += owed.money
    } else {
      out.recovered += s.back.amount + s.back.compensation
      out.recoveredCount += 1
    }
    out.compensation += owed.compensation
    if (needsAction(stage)) out.act += 1
  }
  return out
}

/** Sorted for the list: what needs you first, then the rest, newest first. */
export function sortStuck(list: readonly StuckPayment[], today: string): StuckPayment[] {
  return [...list].sort((a, b) => stageRank(nextStep(a, today).stage) - stageRank(nextStep(b, today).stage) || b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

/** The Ombudsman's window has closed: 90 days after the bank's 30 days ran out (a later reply from the bank reopens it). */
export function ombudsmanTooLate(s: StuckPayment, today: string): boolean {
  const bank = stepOn(s, 'bank')
  return bank !== null && daysBetween(bank.date, today) > OMBUDSMAN_WINDOW_DAYS + OMBUDSMAN_WAIT_DAYS
}
