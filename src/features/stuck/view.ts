/**
 * Words for stuck money on screen: how a payment was made ("UPI to a person · back in 1 day"),
 * who owes it, where it stands in one line ("3 days late · your bank owes you ₹300"), which part
 * of the list it goes in, and the clock on its page. Pure functions of a stuck payment and today's
 * date (the rules are in rules.ts), in the current language.
 */
import { daysBetween, today as todayIso } from '../../engine/dates'
import type { BadgeTone } from '../../components'
import type { StuckBack, StuckPayment, StuckRail, StuckSource, StuckStepKind } from '../../data/stores'
import { t, type MessageKey } from '../../i18n'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { shortDate } from '../recurring/recurringLabels'
import { APP_LABELS, BANK_LABELS } from '../sharein/sms/smsView'
import { walletName } from './help'
import { merchantById } from './merchants'
import {
  backInFull,
  backInPart,
  bankReplied,
  COMPENSATION_PER_DAY,
  compensationDue,
  daysLate,
  dueBy,
  ladderOf,
  nextStep,
  OMBUDSMAN_WAIT_DAYS,
  ombudsmanLastDay,
  ombudsmanTooLate,
  owedForWait,
  RAIL_RULES,
  refundDueBasis,
  rungEnds,
  sortStuck,
  stillOwed,
  UNKNOWN_RAIL_DAYS,
  type StuckNext,
  type StuckStage,
  type StuckSummary,
} from './rules'

/** Rupees as the app writes them ("₹4,700", "₹649.50"). */
export function inr(minor: number): string {
  return formatMoney(minor, 'INR', { trimZeros: true })
}

/** "3 Nov" — with the year when it isn't this year ("3 Nov 2024"), so an old payment never reads as due tomorrow. */
export function stuckDate(iso: string, today: string = todayIso()): string {
  if (iso.slice(0, 4) === today.slice(0, 4)) return shortDate(iso)
  return formatBillDate(iso) ?? shortDate(iso)
}

/** Every way of paying, in the order Add offers them (the everyday ones first). */
export const RAIL_ORDER: readonly StuckRail[] = ['upi_person', 'upi_merchant', 'card_online', 'card_pos', 'atm', 'imps', 'card_transfer', 'wallet', 'nach', 'aeps']
/** Shown on Add straight away; the rest behind "More ways". */
export const COMMON_RAILS: readonly StuckRail[] = ['upi_person', 'upi_merchant', 'card_online', 'card_pos', 'atm']

const RAIL_KEYS: Readonly<Record<StuckRail, MessageKey>> = {
  upi_person: 'stuck.rail.upi_person',
  upi_merchant: 'stuck.rail.upi_merchant',
  imps: 'stuck.rail.imps',
  card_online: 'stuck.rail.card_online',
  card_pos: 'stuck.rail.card_pos',
  card_transfer: 'stuck.rail.card_transfer',
  atm: 'stuck.rail.atm',
  wallet: 'stuck.rail.wallet',
  nach: 'stuck.rail.nach',
  aeps: 'stuck.rail.aeps',
}

/** "UPI to a person", or "Not sure" when it isn't known. */
export function railLabel(rail: StuckRail | null): string {
  return rail ? t(RAIL_KEYS[rail]) : t('stuck.rail.unknown')
}

/** Days after the payment the RBI gives the bank (the longer deadline when the way isn't known). */
export function railDays(rail: StuckRail | null): number {
  return rail ? RAIL_RULES[rail].days : UNKNOWN_RAIL_DAYS
}

/** The businesses offered as one tap on Add, the most asked-about first. */
export const POPULAR_MERCHANTS: readonly string[] = ['amazon', 'flipkart', 'swiggy', 'zomato', 'myntra', 'blinkit', 'zepto', 'irctc', 'makemytrip', 'indigo', 'uber', 'bookmyshow']

/** Where a complaint goes, as a place in a sentence: "your bank", "the RBI Ombudsman", "Swiggy". */
export function stepPlace(kind: StuckStepKind, s: StuckPayment): string {
  switch (kind) {
    case 'bank':
      // A wallet payment's complaint goes to the wallet company, not a bank.
      return walletName(s) ?? t('stuck.place.bank')
    case 'ombudsman':
      return t('stuck.place.ombudsman')
    case 'merchant':
      return knownParty(s) ?? t('stuck.place.business')
    case 'nch':
      return t('stuck.place.nch')
    case 'commission':
      return t('stuck.place.commission')
    case 'airsewa':
      return t('stuck.place.airsewa')
  }
}

/** The name on the payment, or the business Settle knows — null when neither is known. */
export function knownParty(s: Pick<StuckPayment, 'party' | 'merchant'>): string | null {
  const party = s.party?.trim()
  if (party) return party
  return merchantById(s.merchant)?.name ?? null
}

/** Who owes it, as a title: the name, else how it was paid ("ATM, no cash came out"), else what it is. */
export function partyName(s: Pick<StuckPayment, 'party' | 'merchant' | 'kind' | 'rail'>): string {
  const known = knownParty(s)
  if (known) return known
  if (s.kind === 'failed') return s.rail ? railLabel(s.rail) : t('stuck.party.failed')
  return t('stuck.party.refund')
}

/**
 * Its name in the list and on Home, saying what it is — "Failed payment to Neha", "Amazon refund" —
 * so a payee's name never reads like a friend who owes you. Without a name, as partyName().
 */
export function stuckTitle(s: Pick<StuckPayment, 'party' | 'merchant' | 'kind' | 'rail'>): string {
  const name = knownParty(s)
  if (!name) return partyName(s)
  return s.kind === 'failed' ? t('stuck.title.failed', { name }) : t('stuck.title.refund', { name })
}

/**
 * The toast when money comes back: "Your ₹500 to Riya Sharma is back in your account" (a refund:
 * "₹500 from Flipkart is back"), with what the bank still owes for a late one — or, when only part
 * of the payment's amount came back, how much is still to come.
 */
export function backLine(s: Pick<StuckPayment, 'party' | 'merchant'> & Partial<Pick<StuckPayment, 'kind' | 'amount' | 'rail'>>, amount: number, late: number, owed: number): string {
  const name = knownParty(s)
  const failed = s.kind === 'failed'
  if (s.amount !== undefined && amount < s.amount) {
    const part = { back: inr(amount), amount: inr(s.amount), rest: inr(s.amount - amount) }
    if (!name) return t('stuck.back.toastPart', part)
    return failed ? t('stuck.back.toastPartTo', { ...part, name }) : t('stuck.back.toastPartFrom', { ...part, name })
  }
  if (owed > 0) {
    if (!name) return t('stuck.back.toastLateNoName', { amount: inr(amount), count: late, owed: inr(owed) })
    return failed
      ? t(s.rail === 'wallet' ? 'stuck.back.toastFailedLate.wallet' : 'stuck.back.toastFailedLate', { amount: inr(amount), name, count: late, owed: inr(owed) })
      : t('stuck.back.toastLate', { amount: inr(amount), name, count: late, owed: inr(owed) })
  }
  if (!name) return t('stuck.back.toastNoName', { amount: inr(amount) })
  return failed ? t('stuck.back.toastFailed', { amount: inr(amount), name }) : t('stuck.back.toast', { amount: inr(amount), name })
}

/** "HDFC" for a bank Settle knows by id, else what was saved. */
export function bankLabel(bank: string | null): string | null {
  if (!bank) return null
  return Object.hasOwn(BANK_LABELS, bank) ? BANK_LABELS[bank as keyof typeof BANK_LABELS] : bank
}

/** "GPay" for an app Settle knows by id, else what was saved. */
export function appLabel(app: string | null): string | null {
  if (!app) return null
  return Object.hasOwn(APP_LABELS, app) ? APP_LABELS[app as keyof typeof APP_LABELS] : app
}

/** "HDFC ••4821". */
export function accountLine(s: Pick<StuckPayment, 'bank' | 'account'>): string | null {
  const bank = bankLabel(s.bank)
  const digits = s.account ? s.account.replace(/\D/g, '').slice(-4) : ''
  const last = digits ? `••${digits}` : null
  if (bank && last) return `${bank} ${last}`
  return bank ?? last
}

const SOURCE_KEYS: Readonly<Record<StuckSource, MessageKey>> = {
  alert: 'stuck.source.alert',
  sms: 'stuck.source.sms',
  screenshot: 'stuck.source.screenshot',
  manual: 'stuck.source.manual',
}

/** Where Settle heard of it: "A phone alert", "A bank SMS", "A screenshot", "Added by you". */
export function sourceLabel(source: StuckSource): string {
  return t(SOURCE_KEYS[source])
}

/** Done with: all back, or set aside. */
function closed(stage: StuckStage): boolean {
  return stage === 'back' || stage === 'dismissed'
}

/** "Raised · 5 days late": the lateness stays in words once a complaint is raised. */
function withLate(label: string, late: number): string {
  return late > 0 ? t('stuck.badge.withLate', { label, count: late }) : label
}

/** The small status pill on its page: "3 days late", "Raised · 5 days late", "Part back · 2 days late", "Got it back". */
export function stageBadge(s: StuckPayment, next: StuckNext, today: string): { label: string; tone: BadgeTone } {
  const badge = stageOnlyBadge(s, next, today)
  return backInPart(s) && !closed(next.stage) ? { ...badge, label: t('stuck.badge.part', { label: badge.label }) } : badge
}

function stageOnlyBadge(s: StuckPayment, next: StuckNext, today: string): { label: string; tone: BadgeTone } {
  switch (next.stage) {
    case 'check':
      return { label: t('stuck.badge.check'), tone: 'warning' }
    case 'waiting':
      return { label: t('stuck.badge.waiting'), tone: 'neutral' }
    case 'overdue':
      return { label: t('stuck.badge.late', { count: daysLate(s, today) }), tone: 'negative' }
    case 'raised':
      return { label: withLate(t('stuck.badge.raised'), daysLate(s, today)), tone: 'warning' }
    case 'escalate':
      return { label: withLate(t('stuck.badge.escalate'), daysLate(s, today)), tone: 'warning' }
    case 'escalated':
      return { label: withLate(t('stuck.badge.escalated'), daysLate(s, today)), tone: 'warning' }
    case 'compensation':
    case 'compensationEscalate':
      return { label: t('stuck.badge.compensation'), tone: 'warning' }
    case 'compensationRaised':
    case 'compensationEscalated':
      return { label: t('stuck.badge.compensation'), tone: 'neutral' }
    case 'back':
      return { label: t('stuck.badge.back'), tone: 'positive' }
    case 'dismissed':
      return { label: t('stuck.badge.aside'), tone: 'neutral' }
  }
}

/* ------------------------------------------------------------------ the list */

/**
 * The parts of the list: what needs you, what's raised and waiting on them, the money back with
 * only the compensation still owed, what isn't due yet ('onway'), what came back, and what was set aside.
 */
export type StuckSection = 'needs' | 'them' | 'owed' | 'onway' | 'back' | 'aside'

/** Which part of the list a stage goes in. */
export function sectionOf(stage: StuckStage): StuckSection {
  switch (stage) {
    case 'check':
    case 'overdue':
    case 'escalate':
    case 'compensation':
    case 'compensationEscalate':
      return 'needs'
    case 'raised':
    case 'escalated':
      return 'them'
    case 'compensationRaised':
    case 'compensationEscalated':
      return 'owed'
    case 'waiting':
      return 'onway'
    case 'back':
      return 'back'
    case 'dismissed':
      return 'aside'
  }
}

export interface StuckEntry {
  payment: StuckPayment
  next: StuckNext
}

/** The list in its parts, most urgent first in each (rules.ts's order). */
export function groupStuck(list: readonly StuckPayment[], today: string): Record<StuckSection, StuckEntry[]> {
  const out: Record<StuckSection, StuckEntry[]> = { needs: [], them: [], owed: [], onway: [], back: [], aside: [] }
  for (const payment of sortStuck(list, today)) {
    const next = nextStep(payment, today)
    out[sectionOf(next.stage)].push({ payment, next })
  }
  // Got back: the latest first.
  out.back.sort((a, b) => (b.payment.back?.date ?? '').localeCompare(a.payment.back?.date ?? '') || b.payment.updatedAt - a.payment.updatedAt)
  out.aside.sort((a, b) => (b.payment.dismissedAt ?? 0) - (a.payment.dismissedAt ?? 0))
  return out
}

/** The amount on its row: what's still to come (only the compensation, once the money's back), or what it was once it's closed. */
export function rowAmount(s: StuckPayment, next: StuckNext, today: string): number {
  if (closed(next.stage)) return s.amount
  const owed = stillOwed(s, today)
  return owedForWait(next.stage) ? owed.compensation : owed.money
}

/** "Order …5566778": tells two refunds from the same business apart. Null without an order number. */
export function orderTail(s: Pick<StuckPayment, 'orderId' | 'merchant'>): string | null {
  const id = s.orderId?.trim()
  if (!id) return null
  // The end of a long one ("…5432100"); a short one (a PNR) whole.
  const ref = id.length > 8 ? `…${id.slice(-7)}` : id
  const category = merchantById(s.merchant)?.category
  return t(category === 'airline' || category === 'rail' ? 'stuck.list.pnr' : 'stuck.list.order', { ref })
}

/** "Due back today", "Due back tomorrow", "Due back by 3 Nov". */
export function dueLine(due: string, today: string): string {
  const days = daysBetween(today, due)
  if (days <= 0) return t('stuck.status.dueToday')
  if (days === 1) return t('stuck.status.dueTomorrow')
  return t('stuck.status.dueBy', { date: stuckDate(due, today) })
}

/** The step reached last (the highest rung taken), or null. */
function lastStep(s: StuckPayment): StuckStepKind | null {
  return s.steps.at(-1)?.kind ?? null
}

/** One line for the list: where it stands and what it means for you — with what's still to come when part of it is back. */
export function statusLine(s: StuckPayment, next: StuckNext, today: string): string {
  const line = stageLine(s, next, today)
  if (!backInPart(s) || closed(next.stage)) return line
  return `${t('stuck.status.partBack', { amount: inr(stillOwed(s, today).money) })} · ${line}`
}

function stageLine(s: StuckPayment, next: StuckNext, today: string): string {
  const late = daysLate(s, today)
  const owed = stillOwed(s, today).compensation
  switch (next.stage) {
    case 'check':
      return t('stuck.status.check', { amount: inr(s.amount) })
    case 'waiting':
      return dueLine(next.until ?? dueBy(s), today)
    case 'overdue':
      if (s.kind === 'failed') return t(s.rail === 'wallet' ? 'stuck.status.lateOwed.wallet' : 'stuck.status.lateOwed', { count: late, amount: inr(compensationDue(s, today)) })
      return t('stuck.status.lateRaise', { count: late, place: next.step ? stepPlace(next.step, s) : partyName(s) })
    case 'raised': {
      const step = lastStep(s)
      const place = step ? stepPlace(step, s) : t('stuck.place.bank')
      const date = stuckDate(next.until ?? today, today)
      if (late > 0 && owed > 0) return t('stuck.status.raisedOwed', { count: late, amount: inr(owed) })
      if (late > 0) return t('stuck.status.raisedLate', { place, count: late, date })
      return t('stuck.status.raised', { place, date })
    }
    case 'escalate': {
      const place = next.step ? stepPlace(next.step, s) : t('stuck.place.ombudsman')
      if (next.step === 'ombudsman' && ombudsmanTooLate(s, today)) return t('stuck.status.ombudsmanClosed', { count: late })
      if (late > 0 && owed > 0) return t('stuck.status.escalateOwed', { count: late, amount: inr(owed), place })
      if (late > 0) return t('stuck.status.escalateLate', { count: late, place })
      return t('stuck.status.escalate', { place })
    }
    case 'escalated': {
      const step = lastStep(s)
      const place = step ? stepPlace(step, s) : t('stuck.place.ombudsman')
      if (late > 0 && owed > 0) return t('stuck.status.escalatedOwed', { place, count: late, amount: inr(owed) })
      if (late > 0) return t('stuck.status.escalatedLate', { place, count: late })
      return t('stuck.status.escalated', { place })
    }
    case 'compensation':
      return (s.back?.compensation ?? 0) > 0
        ? t('stuck.status.compensationRest', { count: late, amount: inr(owed) })
        : t('stuck.status.compensation', { count: late, amount: inr(owed) })
    case 'compensationRaised':
      return t('stuck.status.owedRaised', { back: inr(s.amount), amount: inr(owed), date: stuckDate(next.until ?? today, today) })
    case 'compensationEscalate':
      if (ombudsmanTooLate(s, today)) return t('stuck.status.owedClosed', { back: inr(s.amount), amount: inr(owed) })
      return t('stuck.status.owedEscalate', { back: inr(s.amount), amount: inr(owed), place: t('stuck.place.ombudsman') })
    case 'compensationEscalated':
      return t('stuck.status.owedEscalated', { back: inr(s.amount), amount: inr(owed), place: t('stuck.place.ombudsman') })
    case 'back': {
      const back = s.back
      if (!back) return t('stuck.status.backPlain')
      return back.compensation > 0
        ? t('stuck.status.backPaid', { date: stuckDate(back.date, today), amount: inr(back.compensation) })
        : t('stuck.status.back', { date: stuckDate(back.date, today) })
    }
    case 'dismissed':
      return t('stuck.status.aside')
  }
}

/** "Yes, it left — ₹249 to Zepto": a check button's name, so two rows' buttons aren't heard as the same. */
export function checkLabel(s: StuckPayment, label: string): string {
  const name = knownParty(s)
  return name ? t('stuck.check.aria', { label, amount: inr(s.amount), name }) : t('stuck.check.ariaNoName', { label, amount: inr(s.amount) })
}

/* ------------------------------------------------------------------ the clock */

/** 'back' is the money back in full: the last, good step. */
export type ClockState = 'done' | 'late' | 'now' | 'next' | 'back'

export interface ClockEvent {
  key: string
  title: string
  detail: string | null
  /** YYYY-MM-DD, shown beside the event (null when its title already says the day). */
  date: string | null
  state: ClockState
}

/** Why it's due when it is: the RBI's row for failed payments, the business's word (or its usual time) for refunds. */
export function dueReason(s: StuckPayment): string {
  if (s.kind === 'failed') {
    if (!s.rail) return t('stuck.clock.due.unknownRail', { count: UNKNOWN_RAIL_DAYS })
    return t('stuck.clock.due.rail', { rail: railLabel(s.rail), count: RAIL_RULES[s.rail].days })
  }
  const basis = refundDueBasis(s)
  switch (basis.kind) {
    case 'dgca':
      return t('stuck.clock.due.dgca', { count: basis.days })
    case 'promised':
      return t('stuck.clock.due.promised', { name: partyName(s) })
    case 'merchant':
      return t('stuck.clock.due.merchant', { name: basis.name, count: basis.workingDays })
    case 'default':
      return t('stuck.clock.due.usual', { count: basis.workingDays })
  }
}

/** A late refund, against what it was due by: the date they gave, their own timeline, or the usual time. */
function lateRefund(s: StuckPayment): string {
  switch (refundDueBasis(s).kind) {
    case 'dgca':
      return t('stuck.clock.lateRefund.dgca')
    case 'promised':
      return t('stuck.clock.lateRefund.promised')
    case 'merchant':
      return t('stuck.clock.lateRefund')
    case 'default':
      return t('stuck.clock.lateRefund.usual')
  }
}

/**
 * "What to do now" for a refund that isn't back, in its own words: the date the business gave, its
 * own timeline, or the usual time — never a promise it didn't make. For the waiting and overdue stages.
 */
export function refundDueText(s: StuckPayment, today: string): string {
  const due = dueBy(s)
  const date = stuckDate(due, today)
  const name = partyName(s)
  const basis = refundDueBasis(s)
  if (basis.kind === 'dgca') return t(today <= due ? 'stuck.now.waiting.refund.dgca' : 'stuck.now.overdue.refund.dgca', { name, count: basis.days, date })
  if (today <= due) {
    if (basis.kind === 'promised') return t('stuck.now.waiting.refund', { name, date })
    return basis.kind === 'merchant' ? t('stuck.now.waiting.refund.merchant', { name: basis.name, date }) : t('stuck.now.waiting.refund.usual', { date })
  }
  if (basis.kind === 'promised') return t('stuck.now.overdue.refund.text', { name, date })
  return basis.kind === 'merchant'
    ? t('stuck.now.overdue.refund.merchant', { name: basis.name, count: basis.workingDays, date })
    : t('stuck.now.overdue.refund.usual', { count: basis.workingDays, date })
}

/**
 * The payment's story, in date order: the money left (or the refund started), how long it's been,
 * when it's due back and why, each complaint raised and the bank's reply, the money back — then,
 * while it's open, how late it is today and what that's worth, what's waited on, and the last day
 * for the RBI Ombudsman.
 */
export function clockOf(s: StuckPayment, today: string): ClockEvent[] {
  const next = nextStep(s, today)
  const due = dueBy(s)
  const late = daysLate(s, today)
  const open = !backInFull(s) && s.dismissedAt === null
  // Events on a day, sorted by it below (on the same day, in the order they're added).
  const dated: Array<{ at: string; event: ClockEvent }> = []
  const add = (at: string, event: ClockEvent): void => {
    dated.push({ at, event })
  }

  add(s.date, {
    key: 'start',
    title: s.kind === 'refund' ? t('stuck.clock.promised') : s.confirmed ? t('stuck.clock.left') : t('stuck.clock.failed'),
    detail: null,
    date: s.date,
    state: 'done',
  })

  // In time: how long it's been so far is today's marker, and the due day comes after it.
  const waiting = open && today <= due
  const since = waiting && s.confirmed && today < due ? daysBetween(s.date, today) : 0
  if (since > 0) add(today, { key: 'since', title: t('stuck.clock.since', { count: since }), detail: null, date: today, state: 'now' })
  add(due, {
    key: 'due',
    title: t('stuck.clock.due', { date: stuckDate(due, today) }),
    detail: dueReason(s),
    date: null,
    state: !waiting ? 'done' : since > 0 ? 'next' : 'now',
  })

  for (const step of s.steps) {
    add(step.date, {
      key: `step-${step.kind}`,
      title: t('stuck.clock.raised', { place: stepPlace(step.kind, s) }),
      detail: step.ref ? t('stuck.clock.raisedRef', { ref: step.ref }) : null,
      date: step.date,
      state: 'done',
    })
  }
  if (s.repliedAt !== null && bankReplied(s)) add(s.repliedAt, { key: 'replied', title: t('stuck.clock.replied'), detail: null, date: s.repliedAt, state: 'done' })
  // Taken higher because the bank had its 30 days and didn't fix it: the day they ran out.
  const bank = s.steps.find((x) => x.kind === 'bank')
  if (bank && (next.stage === 'escalate' || next.stage === 'compensationEscalate') && next.step === 'ombudsman' && !bankReplied(s)) {
    const ended = rungEnds('bank', bank.date)
    add(ended, { key: 'bank-time-up', title: t('stuck.clock.bankTimeUp', { count: OMBUDSMAN_WAIT_DAYS }), detail: null, date: ended, state: 'done' })
  }

  // How late, and what that's worth: today's marker while it's open, a fact once it's all back (not shown once set aside).
  const owed = compensationDue(s, today)
  const lateEvent: ClockEvent | null =
    late > 0 && s.dismissedAt === null
      ? {
          key: 'late',
          title: t('stuck.clock.late', { count: late }),
          detail:
            owed > 0
              ? open
                ? t('stuck.clock.lateOwedRunning', { amount: inr(owed), perDay: inr(COMPENSATION_PER_DAY) })
                : t('stuck.clock.lateOwed', { amount: inr(owed) })
              : s.kind === 'refund'
                ? lateRefund(s)
                : null,
          date: open ? today : null,
          state: open ? 'late' : 'done',
        }
      : null
  if (open) {
    if (s.back) add(s.back.date, backEvent(s, s.back))
    if (lateEvent) add(today, lateEvent)
  } else if (s.back) {
    if (lateEvent) add(s.back.date, lateEvent)
    add(s.back.date, backEvent(s, s.back))
  }

  // The last day for the RBI Ombudsman: still to come, or (in its place among the rest) gone.
  const lastDay = closed(next.stage) ? null : ombudsmanLastDay(s)
  const lastDayGone = lastDay !== null && today > lastDay
  if (lastDay && lastDayGone) add(lastDay, { key: 'ombudsman-by', title: t('stuck.clock.ombudsmanClosed'), detail: null, date: lastDay, state: 'done' })

  dated.sort((a, b) => a.at.localeCompare(b.at))
  const events = dated.map((d) => d.event)

  if (s.dismissedAt !== null) {
    events.push({ key: 'aside', title: t('stuck.clock.aside'), detail: null, date: null, state: 'done' })
    return events
  }
  if (next.stage === 'raised' && next.until) {
    const step = lastStep(s)
    const then = rungAfter(s)
    events.push({
      key: 'wait',
      title: t('stuck.clock.wait', { place: step ? stepPlace(step, s) : t('stuck.place.bank'), date: stuckDate(next.until, today) }),
      detail: then ? t('stuck.clock.then', { place: stepPlace(then, s) }) : null,
      date: null,
      state: 'next',
    })
  } else if (next.stage === 'compensationRaised' && next.until) {
    events.push({
      key: 'wait',
      title: t('stuck.clock.waitOwed', { amount: inr(stillOwed(s, today).compensation), date: stuckDate(next.until, today) }),
      detail: null,
      date: null,
      state: 'next',
    })
  } else if ((next.stage === 'escalated' || next.stage === 'compensationEscalated') && lastStep(s) === 'ombudsman') {
    events.push({ key: 'follow', title: t('stuck.clock.followUp'), detail: null, date: null, state: 'next' })
  }
  if (lastDay && !lastDayGone) events.push({ key: 'ombudsman-by', title: t('stuck.clock.ombudsmanBy'), detail: null, date: lastDay, state: 'next' })
  return events
}

/** The place after the highest one it's been taken to, or null at the top. */
function rungAfter(s: StuckPayment): StuckStepKind | null {
  const ladder = ladderOf(s)
  const reached = Math.max(-1, ...s.steps.map((x) => ladder.indexOf(x.kind)))
  return ladder[reached + 1] ?? null
}

/** The money back: in full, the good last step; in part, how much of it. */
function backEvent(s: StuckPayment, back: StuckBack): ClockEvent {
  return {
    key: 'back',
    title: backInPart(s) ? t('stuck.clock.backPart', { amount: inr(back.amount), total: inr(s.amount) }) : t('stuck.clock.back', { amount: inr(back.amount) }),
    detail: back.compensation > 0 ? t('stuck.clock.backPaid', { amount: inr(back.compensation) }) : null,
    date: back.date,
    state: backInFull(s) ? 'back' : 'done',
  }
}

/* ------------------------------------------------------------------ Home and You */

/**
 * Home's card: the headline, or null when there's nothing to show (nothing open, nothing owed).
 * With the list, one payment is named, as its row says it, with its id to open it straight away.
 */
export function homeLines(summary: StuckSummary, list: readonly StuckPayment[] = [], today: string = todayIso()): { title: string; line: string; id?: string } | null {
  if (summary.open === 0 && summary.compensation === 0) return null
  const owing = list.map((payment) => ({ payment, next: nextStep(payment, today) })).filter((e) => !closed(e.next.stage))
  const only = owing.length === 1 ? owing[0] : undefined
  if (only) {
    const { payment: s, next } = only
    if (owedForWait(next.stage)) return { title: t('stuck.home.titleCompensation', { amount: inr(rowAmount(s, next, today)) }), line: stuckTitle(s), id: s.id }
    return { title: t('stuck.home.one', { name: stuckTitle(s), amount: inr(rowAmount(s, next, today)) }), line: statusLine(s, next, today), id: s.id }
  }
  const title =
    summary.stuck > 0
      ? t('stuck.home.title', { amount: inr(summary.stuck) })
      : summary.compensation > 0
        ? t('stuck.home.titleCompensation', { amount: inr(summary.compensation) })
        : t('stuck.home.titleCheck', { count: summary.open })
  const parts: string[] = []
  if (summary.act > 0) parts.push(t('stuck.home.act', { count: summary.act }))
  else parts.push(t('stuck.home.onway'))
  if (summary.compensation > 0 && summary.stuck > 0) parts.push(t('stuck.home.compensation', { amount: inr(summary.compensation) }))
  return { title, line: parts.join(' · ') }
}
