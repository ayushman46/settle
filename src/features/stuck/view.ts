/**
 * Words for stuck money on screen: how a payment was made ("UPI to a person · back in 1 day"),
 * who owes it, where it stands in one line ("3 days late · your bank owes you ₹300"), which part
 * of the list it goes in, and the clock on its page. Pure functions of a stuck payment and today's
 * date (the rules are in rules.ts), in the current language.
 */
import { daysBetween } from '../../engine/dates'
import type { BadgeTone } from '../../components'
import type { StuckPayment, StuckRail, StuckSource, StuckStepKind } from '../../data/stores'
import { t, type MessageKey } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { shortDate } from '../recurring/recurringLabels'
import { APP_LABELS, BANK_LABELS } from '../sharein/sms/smsView'
import { merchantById } from './merchants'
import { COMPENSATION_PER_DAY, compensationDue, daysLate, dueBy, nextStep, RAIL_RULES, sortStuck, UNKNOWN_RAIL_DAYS, type StuckNext, type StuckStage, type StuckSummary } from './rules'

/** Rupees as the app writes them ("₹4,700", "₹649.50"). */
export function inr(minor: number): string {
  return formatMoney(minor, 'INR', { trimZeros: true })
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
      return t('stuck.place.bank')
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

/** "₹500 from Riya Sharma is back" (or "₹500 is back" when who isn't known), and what the bank still owes for a late one. */
export function backLine(s: Pick<StuckPayment, 'party' | 'merchant'>, amount: number, late: number, owed: number): string {
  const name = knownParty(s)
  if (owed > 0) {
    return name
      ? t('stuck.back.toastLate', { amount: inr(amount), name, count: late, owed: inr(owed) })
      : t('stuck.back.toastLateNoName', { amount: inr(amount), count: late, owed: inr(owed) })
  }
  return name ? t('stuck.back.toast', { amount: inr(amount), name }) : t('stuck.back.toastNoName', { amount: inr(amount) })
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

/** The small status pill on its page: "3 days late", "On its way", "Back". */
export function stageBadge(s: StuckPayment, next: StuckNext, today: string): { label: string; tone: BadgeTone } {
  switch (next.stage) {
    case 'check':
      return { label: t('stuck.badge.check'), tone: 'warning' }
    case 'waiting':
      return { label: t('stuck.badge.waiting'), tone: 'neutral' }
    case 'overdue':
      return { label: t('stuck.badge.late', { count: daysLate(s, today) }), tone: 'negative' }
    case 'raised':
      return { label: t('stuck.badge.raised'), tone: 'neutral' }
    case 'escalate':
      return { label: t('stuck.badge.escalate'), tone: 'warning' }
    case 'escalated':
      return { label: t('stuck.badge.escalated'), tone: 'neutral' }
    case 'compensation':
      return { label: t('stuck.badge.compensation'), tone: 'warning' }
    case 'back':
      return { label: t('stuck.badge.back'), tone: 'positive' }
    case 'dismissed':
      return { label: t('stuck.badge.aside'), tone: 'neutral' }
  }
}

/* ------------------------------------------------------------------ the list */

export type StuckSection = 'needs' | 'onway' | 'back' | 'aside'

/** Which part of the list a stage goes in. */
export function sectionOf(stage: StuckStage): StuckSection {
  switch (stage) {
    case 'check':
    case 'overdue':
    case 'escalate':
    case 'compensation':
      return 'needs'
    case 'waiting':
    case 'raised':
    case 'escalated':
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

/** The list in its four parts, most urgent first in each (rules.ts's order). */
export function groupStuck(list: readonly StuckPayment[], today: string): Record<StuckSection, StuckEntry[]> {
  const out: Record<StuckSection, StuckEntry[]> = { needs: [], onway: [], back: [], aside: [] }
  for (const payment of sortStuck(list, today)) {
    const next = nextStep(payment, today)
    out[sectionOf(next.stage)].push({ payment, next })
  }
  // Got back: the latest first.
  out.back.sort((a, b) => (b.payment.back?.date ?? '').localeCompare(a.payment.back?.date ?? '') || b.payment.updatedAt - a.payment.updatedAt)
  out.aside.sort((a, b) => (b.payment.dismissedAt ?? 0) - (a.payment.dismissedAt ?? 0))
  return out
}

/** "Due back today", "Due back tomorrow", "Due back by 3 Nov". */
export function dueLine(due: string, today: string): string {
  const days = daysBetween(today, due)
  if (days <= 0) return t('stuck.status.dueToday')
  if (days === 1) return t('stuck.status.dueTomorrow')
  return t('stuck.status.dueBy', { date: shortDate(due) })
}

/** The step reached last (the highest rung taken), or null. */
function lastStep(s: StuckPayment): StuckStepKind | null {
  return s.steps.at(-1)?.kind ?? null
}

/** One line for the list: where it stands and what it means for you. */
export function statusLine(s: StuckPayment, next: StuckNext, today: string): string {
  switch (next.stage) {
    case 'check':
      return t('stuck.status.check', { amount: inr(s.amount) })
    case 'waiting':
      return dueLine(next.until ?? dueBy(s), today)
    case 'overdue': {
      const days = daysLate(s, today)
      if (s.kind === 'failed') return t('stuck.status.lateOwed', { count: days, amount: inr(compensationDue(s, today)) })
      return t('stuck.status.lateRaise', { count: days, place: next.step ? stepPlace(next.step, s) : partyName(s) })
    }
    case 'raised': {
      const step = lastStep(s)
      return t('stuck.status.raised', { place: step ? stepPlace(step, s) : t('stuck.place.bank'), date: shortDate(next.until ?? today) })
    }
    case 'escalate':
      return t('stuck.status.escalate', { place: next.step ? stepPlace(next.step, s) : t('stuck.place.ombudsman') })
    case 'escalated': {
      const step = lastStep(s)
      return t('stuck.status.escalated', { place: step ? stepPlace(step, s) : t('stuck.place.ombudsman') })
    }
    case 'compensation':
      return t('stuck.status.compensation', { count: daysLate(s, today), amount: inr(compensationDue(s, today) - (s.back?.compensation ?? 0)) })
    case 'back': {
      const back = s.back
      if (!back) return t('stuck.status.backPlain')
      return back.compensation > 0
        ? t('stuck.status.backPaid', { date: shortDate(back.date), amount: inr(back.compensation) })
        : t('stuck.status.back', { date: shortDate(back.date) })
    }
    case 'dismissed':
      return t('stuck.status.aside')
  }
}

/* ------------------------------------------------------------------ the clock */

export type ClockState = 'done' | 'late' | 'now' | 'next'

export interface ClockEvent {
  key: string
  title: string
  detail: string | null
  /** YYYY-MM-DD, shown beside the event (null when its title already says the day). */
  date: string | null
  state: ClockState
}

/** Why it's due when it is: the RBI's row for failed payments, the business's word for refunds. */
export function dueReason(s: StuckPayment): string {
  if (s.kind === 'failed') {
    if (!s.rail) return t('stuck.clock.due.unknownRail', { count: UNKNOWN_RAIL_DAYS })
    return t('stuck.clock.due.rail', { rail: railLabel(s.rail), count: RAIL_RULES[s.rail].days })
  }
  if (s.promisedBy) return t('stuck.clock.due.promised', { name: partyName(s) })
  const merchant = merchantById(s.merchant)
  if (merchant) return t('stuck.clock.due.merchant', { name: merchant.name, count: merchant.workingDays })
  return t('stuck.clock.due.default')
}

/**
 * The payment's story so far, oldest first: the money left (or the refund was promised), when it's
 * due back and why, how late it is and what that's worth, each complaint raised, the money back,
 * and what's waited on now.
 */
export function clockOf(s: StuckPayment, today: string): ClockEvent[] {
  const next = nextStep(s, today)
  const due = dueBy(s)
  const late = daysLate(s, today)
  const events: ClockEvent[] = []

  events.push({
    key: 'start',
    title: s.kind === 'refund' ? t('stuck.clock.promised') : s.confirmed ? t('stuck.clock.left') : t('stuck.clock.failed'),
    detail: null,
    date: s.date,
    state: 'done',
  })

  const waiting = s.back === null && s.dismissedAt === null && today <= due
  events.push({
    key: 'due',
    title: t('stuck.clock.due', { date: shortDate(due) }),
    detail: dueReason(s),
    date: null,
    state: waiting ? 'now' : 'done',
  })

  if (late > 0) {
    const owed = compensationDue(s, today)
    const open = s.back === null && s.dismissedAt === null
    events.push({
      key: 'late',
      title: t('stuck.clock.late', { count: late }),
      detail:
        owed > 0
          ? open
            ? t('stuck.clock.lateOwedRunning', { amount: inr(owed), perDay: inr(COMPENSATION_PER_DAY) })
            : t('stuck.clock.lateOwed', { amount: inr(owed) })
          : s.kind === 'refund'
            ? t('stuck.clock.lateRefund')
            : null,
      date: null,
      state: 'late',
    })
  }

  for (const step of s.steps) {
    events.push({
      key: `step-${step.kind}`,
      title: t('stuck.clock.raised', { place: stepPlace(step.kind, s) }),
      detail: step.ref ? t('stuck.clock.raisedRef', { ref: step.ref }) : null,
      date: step.date,
      state: 'done',
    })
  }

  if (s.back) {
    events.push({
      key: 'back',
      title: t('stuck.clock.back', { amount: inr(s.back.amount) }),
      detail: s.back.compensation > 0 ? t('stuck.clock.backPaid', { amount: inr(s.back.compensation) }) : null,
      date: s.back.date,
      state: 'done',
    })
  }

  if (s.dismissedAt !== null) {
    events.push({ key: 'aside', title: t('stuck.clock.aside'), detail: null, date: null, state: 'done' })
  } else if ((next.stage === 'raised' || next.stage === 'escalated') && next.until) {
    const step = lastStep(s)
    events.push({
      key: 'wait',
      title: t('stuck.clock.wait', { place: step ? stepPlace(step, s) : t('stuck.place.bank'), date: shortDate(next.until) }),
      detail: null,
      date: null,
      state: 'next',
    })
  }
  return events
}

/* ------------------------------------------------------------------ Home and You */

/** Home's card: the headline, or null when there's nothing to show (nothing open, nothing owed). */
export function homeLines(summary: StuckSummary): { title: string; line: string } | null {
  if (summary.open === 0 && summary.compensation === 0) return null
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
