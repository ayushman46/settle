/**
 * The rules for money stuck with a bank or a business — when it must be back, what you're owed for
 * the wait, and where to take it next. Pure functions of a stuck payment and today's date.
 *
 * Failed payments follow the RBI's "Harmonisation of Turn Around Time (TAT) and customer
 * compensation for failed transactions using authorised Payment Systems" (RBI/2019-20/67,
 * DPSS.CO.PD No.629/02.01.014/2019-20, 20 September 2019): each kind of payment has a deadline
 * counted from T, the calendar day of the transaction, and beyond it the bank owes ₹100 for each
 * day of delay — paid on its own, without being asked. Unpaid, it's a complaint to the bank, then
 * to the RBI Ombudsman once the bank has turned it down or replied without fixing it, or has had 30
 * days (Reserve Bank – Integrated Ombudsman Scheme, 2026, in force from 1 July 2026: file within 90
 * days of those 30 days or of the bank's reply).
 *
 * Refunds follow the business's own promise (or its usual timeline, src/features/stuck/merchants.ts);
 * overdue, it's the business's support, then the National Consumer Helpline, then a consumer
 * commission — or AirSewa for an airline.
 */
import { addDays, daysBetween } from '../../engine/dates'
import type { StuckBackPart, StuckPayment, StuckRail, StuckStepKind } from '../../data/stores'
import { addWorkingDays, DEFAULT_REFUND_WORKING_DAYS, merchantById, refundWorkingDays } from './merchants'

/** One row of the RBI's TAT table: the deadline (days after T) and the row it comes from. */
export interface RailRule {
  /** Back by T + this many calendar days. */
  days: 1 | 5
  /** Where in the circular's annex (for the complaint letter). */
  row: string
}

/**
 * The RBI's deadline for each way a payment can fail (Annex to RBI/2019-20/67). 'wallet' is a
 * payment from the wallet's balance within the same wallet (on-us): T + 1. A wallet app that paid
 * over UPI or a card (off-us) follows that rail's row instead — so that's the way to pick, and when
 * it isn't known, "Not sure" counts the longest deadline, so a claim is never early.
 */
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

/**
 * A NACH debit after you revoked the mandate with your bank: its own row of the annex, 7(b) — your
 * bank is responsible for that debit, and reverses it by T + 1. (7(a), a delay in crediting the
 * beneficiary, is the other side's.) For a letter about a revoked mandate.
 */
export const NACH_REVOKED_RULE: RailRule = { days: 1, row: 'NACH — account debited despite revocation of the debit mandate with the bank by the customer (I.7.b)' }

/** How a failed payment is treated when how it was paid isn't known: the longer deadline, so a claim is never early. */
export const UNKNOWN_RAIL_DAYS = 5

/** ₹100 a day, in paise. */
export const COMPENSATION_PER_DAY = 10_000

/** The circular itself, for letters and the "why" line. */
export const RBI_CIRCULAR = 'RBI/2019-20/67, DPSS.CO.PD No.629/02.01.014/2019-20 dated 20 September 2019'

/** A bank has this long to answer a complaint before the RBI Ombudsman takes it (unless it replies sooner). */
export const OMBUDSMAN_WAIT_DAYS = 30
/** A business gets a week from your complaint before the National Consumer Helpline. */
export const MERCHANT_WAIT_DAYS = 7
/** The National Consumer Helpline gets a month before a consumer commission. */
export const NCH_WAIT_DAYS = 30
/** The Ombudsman takes a complaint within 90 days of the bank's 30 days running out or of its last reply, whichever is later (the 2026 scheme). */
export const OMBUDSMAN_WINDOW_DAYS = 90

/**
 * An airline refunds a ticket paid by card within 7 days, whatever it says itself (DGCA, Civil
 * Aviation Requirement on refunds of airline tickets, Section 3, Series M, Part II). Paid any other
 * way (cash, a travel agent or portal: 14 working days), the airline's own timeline stands.
 */
export const DGCA_CARD_REFUND_DAYS = 7

const CARD_RAILS: ReadonlySet<StuckRail> = new Set<StuckRail>(['card_online', 'card_pos', 'card_transfer'])

type DueFields = Pick<StuckPayment, 'kind' | 'rail' | 'date' | 'promisedBy' | 'merchant'>

/** The DGCA's last day for an airline refund paid by card, or null when the rule doesn't apply. */
function dgcaDue(s: DueFields): string | null {
  if (s.kind !== 'refund' || s.rail === null || !CARD_RAILS.has(s.rail) || merchantById(s.merchant)?.category !== 'airline') return null
  return addDays(s.date, DGCA_CARD_REFUND_DAYS)
}

/** A refund's own due day: the date the business gave, or its usual timeline. */
function ownRefundDue(s: DueFields): string {
  return s.promisedBy ?? addWorkingDays(s.date, refundWorkingDays(s.merchant))
}

/** The day the money should be back by. */
export function dueBy(s: DueFields): string {
  if (s.kind === 'refund') {
    const own = ownRefundDue(s)
    const dgca = dgcaDue(s)
    return dgca !== null && dgca < own ? dgca : own
  }
  return addDays(s.date, s.rail ? RAIL_RULES[s.rail].days : UNKNOWN_RAIL_DAYS)
}

/** Where a refund's due date comes from: the DGCA's 7 days for a card-paid flight, a date the business gave, its own usual timeline, or the usual 7 working days. */
export type RefundDueBasis =
  | { kind: 'dgca'; days: number }
  | { kind: 'promised' }
  | { kind: 'merchant'; name: string; workingDays: number }
  | { kind: 'default'; workingDays: number }

/** Why a refund is due when it is, in dueBy()'s order — so nothing claims a promise the business never made. */
export function refundDueBasis(s: DueFields): RefundDueBasis {
  const dgca = dgcaDue(s)
  // On the same day, the DGCA's rule is the one to cite: it binds the airline, its own timeline doesn't.
  if (dgca !== null && dgca <= ownRefundDue(s)) return { kind: 'dgca', days: DGCA_CARD_REFUND_DAYS }
  if (s.promisedBy) return { kind: 'promised' }
  const merchant = merchantById(s.merchant)
  if (merchant) return { kind: 'merchant', name: merchant.name, workingDays: merchant.workingDays }
  return { kind: 'default', workingDays: DEFAULT_REFUND_WORKING_DAYS }
}

/** Days late: past the deadline up to the day it came back (or today). 0 while it isn't late. */
export function daysLate(s: StuckPayment, today: string): number {
  // Part of it back is still late: the wait ends when all of it is.
  const end = s.back !== null && backInFull(s) ? s.back.date : today
  return Math.max(0, daysBetween(dueBy(s), end))
}

/** All of it came back (a part refund leaves the rest owed, and still late). */
export function backInFull(s: Pick<StuckPayment, 'amount' | 'back'>): boolean {
  return s.back !== null && s.back.amount >= s.amount
}

/** Some of it came back, not all. */
export function backInPart(s: Pick<StuckPayment, 'amount' | 'back'>): boolean {
  return s.back !== null && s.back.amount > 0 && s.back.amount < s.amount
}

/**
 * Each time money came in for it, in date order (on the same day, in the order it came): part of
 * the payment and/or compensation, each with its own day. Saved before the parts were kept (or set
 * as totals), the totals are the one part. None while nothing is back.
 */
export function backParts(s: Pick<StuckPayment, 'back'>): StuckBackPart[] {
  const back = s.back
  if (!back) return []
  if (back.parts && back.parts.length > 0) return [...back.parts].sort((a, b) => a.date.localeCompare(b.date))
  if (back.amount <= 0 && back.compensation <= 0) return []
  return [{ date: back.date, amount: back.amount, compensation: back.compensation }]
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
  /** The money's back but the bank still owes compensation for the delay: claim it. */
  | 'compensation'
  /** The money's back; the compensation is raised with the bank, and its time to answer isn't up. */
  | 'compensationRaised'
  /** The money's back; the bank hasn't paid the compensation in its time (or turned it down): the RBI Ombudsman. */
  | 'compensationEscalate'
  /** The money's back; the compensation is with the RBI Ombudsman. */
  | 'compensationEscalated'
  /** All back. */
  | 'back'
  /** Set aside. */
  | 'dismissed'

export interface StuckNext {
  stage: StuckStage
  /** The complaint to raise now, when there is one. */
  step: StuckStepKind | null
  /** The last day of the current wait (waiting, raised), or null. */
  until: string | null
}

function stepOn(s: StuckPayment, kind: StuckStepKind) {
  return s.steps.find((x) => x.kind === kind) ?? null
}

/** The bank answered the complaint (turned it down, or replied without fixing it): the Ombudsman needn't wait for its 30 days. */
export function bankReplied(s: StuckPayment): boolean {
  const bank = stepOn(s, 'bank')
  return bank !== null && s.repliedAt !== null && s.repliedAt >= bank.date
}

/** The bank's time to answer is up (the last day it had has passed), or it has answered. */
function bankDone(s: StuckPayment, bank: { date: string }, today: string): boolean {
  return bankReplied(s) || today > rungEnds('bank', bank.date)
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

/** The places it's taken, in order: the bank, then the RBI Ombudsman; or the business, (AirSewa,) the helpline, a commission. */
export function ladderOf(s: StuckPayment): StuckStepKind[] {
  return s.kind === 'failed' ? ['bank', 'ombudsman'] : refundLadder(s)
}

/** The last day a complaint raised at this rung on `date` gets before the next rung opens. */
export function rungEnds(kind: StuckStepKind, date: string): string {
  return addDays(date, waitFor(kind))
}

/**
 * Where it stands today and what to do about it. Each wait runs to its last day (`until`); the next
 * rung opens the day after — or at once for the RBI Ombudsman when the bank has replied. The last
 * rung has no deadline of its own (the Ombudsman and a commission take their own time).
 */
export function nextStep(s: StuckPayment, today: string): StuckNext {
  if (s.dismissedAt !== null) return { stage: 'dismissed', step: null, until: null }
  // All of it back: what's left is the compensation. (Part of it back walks the same ladder as none.)
  if (backInFull(s)) {
    if (stillOwed(s, today).compensation === 0) return { stage: 'back', step: null, until: null }
    const bank = stepOn(s, 'bank')
    if (!bank) return { stage: 'compensation', step: 'bank', until: null }
    if (stepOn(s, 'ombudsman')) return { stage: 'compensationEscalated', step: null, until: null }
    if (bankDone(s, bank, today)) return { stage: 'compensationEscalate', step: 'ombudsman', until: null }
    return { stage: 'compensationRaised', step: null, until: rungEnds('bank', bank.date) }
  }
  if (!s.confirmed) return { stage: 'check', step: null, until: null }
  const due = dueBy(s)
  if (today <= due) return { stage: 'waiting', step: null, until: due }
  const ladder = ladderOf(s)
  // The highest rung reached so far.
  let reached = -1
  for (let i = 0; i < ladder.length; i++) if (stepOn(s, ladder[i] as StuckStepKind)) reached = i
  if (reached < 0) return { stage: 'overdue', step: ladder[0] as StuckStepKind, until: null }
  if (reached === ladder.length - 1) return { stage: 'escalated', step: null, until: null }
  const last = ladder[reached] as StuckStepKind
  const lastStep = stepOn(s, last)
  const until = rungEnds(last, lastStep?.date ?? today)
  const done = last === 'bank' && lastStep ? bankDone(s, lastStep, today) : today > until
  return done ? { stage: 'escalate', step: ladder[reached + 1] as StuckStepKind, until: null } : { stage: 'raised', step: null, until }
}

/** Open ones first by urgency (within a stage, sortStuck() puts the most urgent first). */
const STAGE_ORDER: Readonly<Record<StuckStage, number>> = {
  escalate: 0,
  compensationEscalate: 0,
  overdue: 1,
  compensation: 2,
  check: 3,
  raised: 4,
  compensationRaised: 4,
  escalated: 5,
  compensationEscalated: 5,
  waiting: 6,
  back: 7,
  dismissed: 8,
}

export function stageRank(stage: StuckStage): number {
  return STAGE_ORDER[stage]
}

/** Needs you to do something today. */
export function needsAction(stage: StuckStage): boolean {
  return stage === 'escalate' || stage === 'compensationEscalate' || stage === 'overdue' || stage === 'compensation' || stage === 'check'
}

/** The money is back and only compensation for the wait is still owed. */
export function owedForWait(stage: StuckStage): boolean {
  return stage === 'compensation' || stage === 'compensationRaised' || stage === 'compensationEscalate' || stage === 'compensationEscalated'
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
  /** Their money got back so far (all of it, or part), in paise — never the compensation, so it's never more than was stuck. */
  recovered: number
  /** Compensation for the wait paid so far, in paise (on its own: it isn't their money coming back). */
  recoveredCompensation: number
  /** How many came back. */
  recoveredCount: number
}

export function summarize(list: readonly StuckPayment[], today: string): StuckSummary {
  const out: StuckSummary = { open: 0, stuck: 0, compensation: 0, act: 0, recovered: 0, recoveredCompensation: 0, recoveredCount: 0 }
  for (const s of list) {
    if (s.dismissedAt !== null) continue
    const owed = stillOwed(s, today)
    const stage = nextStep(s, today).stage
    if (!backInFull(s)) {
      out.open += 1
      if (s.confirmed) out.stuck += owed.money
    } else {
      out.recoveredCount += 1
    }
    if (s.back !== null) {
      out.recovered += Math.min(s.amount, s.back.amount)
      out.recoveredCompensation += s.back.compensation
    }
    out.compensation += owed.compensation
    if (needsAction(stage)) out.act += 1
  }
  return out
}

/**
 * Sorted for the list: what needs you first, then the rest — and at each stage the most urgent
 * first: the soonest last day (due back, or their time to answer), else the latest (the most days
 * late, then the most owed), else the oldest.
 */
export function sortStuck(list: readonly StuckPayment[], today: string): StuckPayment[] {
  const keyed = list.map((s) => {
    const next = nextStep(s, today)
    const owed = stillOwed(s, today)
    return { s, rank: stageRank(next.stage), until: next.until ?? '9999-12-31', late: daysLate(s, today), owed: owed.money + owed.compensation }
  })
  keyed.sort((a, b) => a.rank - b.rank || a.until.localeCompare(b.until) || b.late - a.late || b.owed - a.owed || a.s.date.localeCompare(b.s.date) || a.s.createdAt - b.s.createdAt)
  return keyed.map((k) => k.s)
}

/**
 * The last day to take it to the RBI Ombudsman: 90 days from the end of the bank's 30 days or from
 * its last reply, whichever is later (RB-IOS 2026; RBI's FAQ on the scheme, Q17) — so noting an
 * early reply never shortens it. Null when there's no complaint to the bank yet, or it's already
 * with the Ombudsman.
 */
export function ombudsmanLastDay(s: StuckPayment): string | null {
  const bank = stepOn(s, 'bank')
  if (!bank || stepOn(s, 'ombudsman')) return null
  const timeUp = rungEnds('bank', bank.date)
  const from = bankReplied(s) && s.repliedAt !== null && s.repliedAt > timeUp ? s.repliedAt : timeUp
  return addDays(from, OMBUDSMAN_WINDOW_DAYS)
}

/** The Ombudsman's window has closed (a later reply from the bank reopens it). */
export function ombudsmanTooLate(s: StuckPayment, today: string): boolean {
  const last = ombudsmanLastDay(s)
  return last !== null && today > last
}
