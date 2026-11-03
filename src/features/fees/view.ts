/**
 * What Bank charges' screens show, worked out from the store: the totals, the findings sorted into
 * what needs one answer and what can be claimed (grouped by bank and account, one claim each),
 * the claims as they go — the bank's 30 days, then the RBI Ombudsman's 90 — the charges that are
 * allowed but avoidable, and each line's words.
 */
import { addDays } from '../../engine/dates'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { intlLocale } from '../../i18n/languages'
import { getLanguage } from '../../i18n/runtime'
import { formatMoney } from '../../lib/money'
import { bankName } from '../stuck/letters'
import { BANK_REPLY_DAYS, OMBUDSMAN_DAYS } from './letters'
import { findingsOf, MINBAL_WAIVED, open, type FeeFinding, type FeeQuestion, type FeeRule } from './rules'
import type { FeeCharge, FeeClaim, FeeKind, FeesState } from './store'

type Translate = typeof t

export const inr = (paise: number): string => formatMoney(paise, 'INR', { trimZeros: true })

/** "−₹490" for a negative balance (a word joiner keeps the sign with the amount). */
export const signedInr = (paise: number): string => (paise < 0 ? `−⁠${inr(-paise)}` : inr(paise))

/** A date in the app's language ("2 Nov 2026", "2 नव॰ 2026"), digits always 0–9. */
function formatDay(y: number, m: number, d: number | null): string {
  try {
    const options: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn', ...(d === null ? {} : { day: 'numeric' }) }
    return new Intl.DateTimeFormat(intlLocale(getLanguage()), options).format(new Date(Date.UTC(y, m - 1, d ?? 1)))
  } catch {
    return d === null ? `${y}-${String(m).padStart(2, '0')}` : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
}

/** "2 Nov 2026", in the app's language. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return y && m && d ? formatDay(y, m, d) : iso
}

/** "Oct 2026", or "Jul–Sep 2026" for a quarter, in the app's language. */
export function periodLabel(period: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(period)
  if (q) {
    const year = Number(q[1])
    const first = (Number(q[2]) - 1) * 3 + 1
    return `${formatDay(year, first, null)}–${formatDay(year, first + 2, null)}`
  }
  const [y, m] = period.split('-').map(Number)
  return y && m ? formatDay(y, m, null) : period
}

export const KIND_KEYS: Readonly<Record<FeeKind, MessageKey>> = {
  minbal: 'fees.kind.minbal',
  atm: 'fees.kind.atm',
  atmDecline: 'fees.kind.atmDecline',
  sms: 'fees.kind.sms',
  card: 'fees.kind.card',
  neft: 'fees.kind.neft',
  rtgs: 'fees.kind.rtgs',
  imps: 'fees.kind.imps',
  upi: 'fees.kind.upi',
  chequeBook: 'fees.kind.chequeBook',
  bounce: 'fees.kind.bounce',
  cash: 'fees.kind.cash',
  dormant: 'fees.kind.dormant',
  prepay: 'fees.kind.prepay',
  late: 'fees.kind.late',
  statement: 'fees.kind.statement',
  other: 'fees.kind.other',
}

export function kindLabel(kind: FeeKind): string {
  return t(KIND_KEYS[kind])
}

/** Where each rule is written, as the line under its reason shows it (in English, as the RBI writes it). */
export const RULE_REFS: Readonly<Record<FeeRule, string>> = {
  minbalNegative: 'RBI/DOR/2025-26/170, para 160(6)',
  minorNegative: 'RBI/DOR/2025-26/170, para 190',
  minbalBasic: 'RBI/DOR/2025-26/170, paras 86–89',
  minbalScholarship: 'RBI/DOR/2025-26/170, para 161',
  minbalWaived: 'RBI/DOR/2025-26/170, para 81(7)',
  smsWaived: 'RBI/DOR/2025-26/170, para 81(7)',
  minbalNotShort: 'RBI/DOR/2025-26/170, para 160(4)',
  minbalOverShortfall: 'RBI/DOR/2025-26/170, para 160(4)–(5)',
  minbalOverSchedule: 'RBI/DOR/2025-26/170, para 81(7)',
  minbalNotice: 'RBI/DOR/2025-26/170, para 160(1)–(2)',
  minbalInoperative: 'RBI/DOR/2025-26/170, para 209',
  basicWithdrawals: 'RBI/DOR/2025-26/170, para 86(8)',
  basicFree: 'RBI/DOR/2025-26/170, para 86',
  atmFree: 'RBI/2021-22/52; RBI/2019-20/41',
  atmDecline: 'RBI/2019-20/41, para 3',
  neftOnline: 'RBI/2019-20/116',
  transferInward: 'RBI NEFT and RTGS FAQs',
  upi: 'PSS Act s.10A',
  statementFree: 'RBI/DOR/2025-26/170, paras 162–163',
  activation: 'RBI/DOR/2025-26/170, para 210',
  duplicate: 'RBI/DOR/2025-26/170, para 81(7)',
  gstLeft: 'CGST Act s.34',
  prepay: 'RBI/DOR/2025-26/170, paras 352–353',
  lateFee: 'RBI/DOR/2025-26/155, para 23(5)',
}

/** A finding's reason in a line, in the app's language. */
export function whyLine(f: Pick<FeeFinding, 'rule' | 'facts' | 'charge'>): string {
  const n = (key: string) => Number(f.facts[key] ?? 0)
  const s = (key: string) => String(f.facts[key] ?? '')
  const c = f.charge
  switch (f.rule) {
    case 'minbalNegative':
      return t('fees.why.minbalNegative', { before: signedInr(n('before')), after: signedInr(n('after')) })
    case 'minorNegative':
      return t('fees.why.minorNegative')
    case 'minbalBasic':
      return t('fees.why.minbalBasic')
    case 'minbalScholarship':
      return t('fees.why.minbalScholarship')
    case 'minbalWaived': {
      const from = dayLabel(MINBAL_WAIVED[c.bank ?? '']?.from ?? s('from'))
      const bank = bankName(c.bank) ?? ''
      return t(n('standard') ? 'fees.why.minbalWaived.standard' : 'fees.why.minbalWaived', { bank, from })
    }
    case 'smsWaived':
      return t('fees.why.smsWaived', { bank: bankName(c.bank) ?? '', from: dayLabel(s('from')) })
    case 'minbalNotShort':
      return t('fees.why.minbalNotShort', { period: periodLabel(s('period')), avg: inr(n('avg')), mab: inr(n('mab')) })
    case 'minbalOverShortfall':
      return t('fees.why.minbalOverShortfall', { shortfall: inr(n('shortfall')), amount: inr(c.amount) })
    case 'minbalOverSchedule':
      return t('fees.why.minbalOverSchedule', { bank: bankName(c.bank) ?? '', allowed: inr(n('allowed')), avg: inr(n('avg')), amount: inr(c.amount) })
    case 'minbalNotice':
      return f.facts['notice'] ? t('fees.why.minbalNotice.early', { date: dayLabel(c.date), notice: dayLabel(s('notice')) }) : t('fees.why.minbalNotice')
    case 'minbalInoperative':
      return t('fees.why.minbalInoperative')
    case 'basicWithdrawals':
      return t('fees.why.basicWithdrawals', { count: n('count') })
    case 'basicFree':
      return t('fees.why.basicFree')
    case 'atmFree':
      return t('fees.why.atmFree', { count: n('count'), failed: n('failed') })
    case 'atmDecline':
      return t('fees.why.atmDecline')
    case 'neftOnline':
      return t('fees.why.neftOnline')
    case 'transferInward':
      return t('fees.why.transferInward')
    case 'upi':
      return t(s('era') === 'small' ? 'fees.why.upi.small' : 'fees.why.upi')
    case 'statementFree':
      return t('fees.why.statementFree')
    case 'activation':
      return t('fees.why.activation')
    case 'duplicate':
      return t('fees.why.duplicate', { first: dayLabel(s('first')) })
    case 'gstLeft':
      return t('fees.why.gstLeft', { gst: inr(n('gst')) })
    case 'prepay':
      return t('fees.why.prepay')
    case 'lateFee':
      return t('fees.why.lateFee')
  }
}

export const QUESTION_KEYS: Readonly<Record<FeeQuestion, MessageKey>> = {
  warned: 'fees.q.warned',
  atmEnquiry: 'fees.q.atmEnquiry',
  declineReason: 'fees.q.declineReason',
  online: 'fees.q.online',
  inoperative: 'fees.q.inoperative',
  duplicateStatement: 'fees.q.duplicateStatement',
  floating: 'fees.q.floating',
  paidInTime: 'fees.q.paidInTime',
  upiSmall: 'fees.q.upiSmall',
}

/**
 * Which answer makes the charge wrong, per question: "Yes" for some ("Did you send it online?"),
 * "No" for others ("Did the bank warn you?").
 */
export const WRONG_IF_YES: Readonly<Record<FeeQuestion, boolean>> = {
  warned: false,
  atmEnquiry: false,
  declineReason: false,
  online: true,
  inoperative: true,
  duplicateStatement: false,
  floating: true,
  paidInTime: true,
  upiSmall: true,
}

/* ---------------------------------------------------------------- the whole picture */

export interface ClaimGroup {
  /** `bank:account`. */
  key: string
  bank: string | null
  account: string | null
  findings: FeeFinding[]
  amount: number
}

export interface ClaimView {
  claim: FeeClaim
  findings: FeeFinding[]
  stage: 'ready' | 'raised' | 'ombudsman' | 'replied' | 'ombudsmanRaised' | 'closed' | 'back' | 'dropped'
  /** The day the bank's 30 days end, and the last day for the RBI Ombudsman. */
  until: string | null
  last: string | null
  /** Money back so far (noted, or the reversals of its charges), and what's still to come. */
  backSoFar: number
  rest: number
}

export interface FeesView {
  /** Every finding, with your answers applied. */
  findings: FeeFinding[]
  /** Findings that need one answer (and questions that could make a firm one claim more). */
  asks: FeeFinding[]
  /** Wrong charges not yet in a claim, per bank and account. */
  groups: ClaimGroup[]
  claims: ClaimView[]
  /** What the bank owes: wrong charges claimable or claimed, less what's back. */
  owed: number
  owedCount: number
  /** Charges found against the rules, claimed or not (what's come back included). */
  found: number
  /** Money back from claims. */
  back: number
  /** All charges kept: total (GST included), how many, and the days they cover. */
  total: number
  count: number
  from: string | null
  to: string | null
  /** Allowed charges by kind, the biggest first: what could be avoided. */
  avoidable: { kind: FeeKind; amount: number; count: number }[]
  /** Charges by kind, the biggest first. */
  byKind: { kind: FeeKind; amount: number; charges: FeeCharge[] }[]
}

/** A credit card's charges and a loan's are claimed apart from the savings account's. */
export function productOf(kind: FeeKind): 'card' | 'loan' | 'account' {
  return kind === 'late' ? 'card' : kind === 'prepay' ? 'loan' : 'account'
}

function groupKey(c: Pick<FeeCharge, 'bank' | 'account' | 'kind'>): string {
  return `${c.bank ?? '?'}:${(c.account ?? '').replace(/\D/g, '').slice(-4) || '?'}:${productOf(c.kind)}`
}

/** Where a claim stands on `today`, with `backSoFar` of it back. */
export function claimStage(claim: FeeClaim, today: string, backSoFar: number = claim.back?.amount ?? 0): Pick<ClaimView, 'stage' | 'until' | 'last' | 'backSoFar' | 'rest'> {
  const rest = Math.max(0, claim.amount - backSoFar)
  const money = { backSoFar, rest }
  if (claim.dismissedAt !== null) return { stage: 'dropped', until: null, last: null, ...money }
  // All of it back (a rupee's leeway for rounding).
  if (backSoFar > 0 && rest <= 100) return { stage: 'back', until: null, last: null, ...money }
  const ombudsman = claim.steps.find((s) => s.kind === 'ombudsman')
  if (ombudsman) return { stage: 'ombudsmanRaised', until: null, last: null, ...money }
  const bank = claim.steps.find((s) => s.kind === 'bank')
  if (!bank) return { stage: 'ready', until: null, last: null, ...money }
  const until = addDays(bank.date, BANK_REPLY_DAYS)
  // The RBI Ombudsman's 90 days run from the later of the bank's 30 days and its last reply.
  const from = claim.repliedAt !== null && claim.repliedAt > until ? claim.repliedAt : until
  const last = addDays(from, OMBUDSMAN_DAYS)
  if (today > last) return { stage: 'closed', until, last, ...money }
  if (claim.repliedAt !== null) return { stage: 'replied', until, last, ...money }
  return { stage: today >= until ? 'ombudsman' : 'raised', until, last, ...money }
}

const byDate = (a: FeeFinding, b: FeeFinding) => a.charge.date.localeCompare(b.charge.date)

/** Everything Bank charges' screen shows, on `today`. */
export function feesView(state: FeesState, today: string): FeesView {
  const findings = findingsOf(state)
  const byId = new Map(findings.map((f) => [f.charge.id, f]))
  const charges = new Map(state.charges.map((c) => [c.id, c]))
  const inClaim = new Set<string>()
  const claims: ClaimView[] = []
  for (const claim of state.claims) {
    const own = claim.chargeIds
      .map((id) => byId.get(id))
      .filter((f): f is FeeFinding => f !== undefined && f.verdict === 'wrong')
      .sort(byDate)
    // Back so far: what you noted, or what the bank's reversals of these charges add up to, whichever is more.
    const reversed = claim.chargeIds.reduce((sum, id) => sum + (charges.get(id)?.reversed ?? 0), 0)
    const stage = claimStage(claim, today, Math.max(claim.back?.amount ?? 0, reversed))
    if (stage.stage !== 'dropped') for (const id of claim.chargeIds) inClaim.add(id)
    claims.push({ claim, findings: own, ...stage })
  }
  const asks = [
    ...findings.filter((f) => f.verdict === 'ask' && !inClaim.has(f.charge.id)),
    ...findings.flatMap((f) => (f.upgrade && !inClaim.has(f.charge.id) ? [f.upgrade] : [])),
  ]
  const groupsMap = new Map<string, ClaimGroup>()
  for (const f of findings) {
    if (f.verdict !== 'wrong' || inClaim.has(f.charge.id) || f.claim <= 0) continue
    const key = groupKey(f.charge)
    const g = groupsMap.get(key) ?? { key, bank: f.charge.bank, account: f.charge.account, findings: [], amount: 0 }
    g.findings.push(f)
    g.amount += f.claim
    groupsMap.set(key, g)
  }
  const groups = [...groupsMap.values()].map((g) => ({ ...g, findings: g.findings.sort(byDate) })).sort((a, b) => b.amount - a.amount)
  const live = claims.filter((c) => c.stage !== 'back' && c.stage !== 'dropped' && c.stage !== 'closed')
  const owed = groups.reduce((s, g) => s + g.amount, 0) + live.reduce((s, c) => s + c.rest, 0)
  const owedCount = groups.reduce((s, g) => s + g.findings.length, 0) + live.reduce((s, c) => s + c.claim.chargeIds.length, 0)
  const found = groups.reduce((s, g) => s + g.findings.length, 0) + claims.filter((c) => c.stage !== 'dropped').reduce((s, c) => s + c.claim.chargeIds.length, 0)
  const back = claims.filter((c) => c.stage !== 'dropped').reduce((s, c) => s + c.backSoFar, 0)

  const flagged = new Set([...findings.map((f) => f.charge.id), ...inClaim])
  const kinds = new Map<FeeKind, { kind: FeeKind; amount: number; charges: FeeCharge[] }>()
  const avoid = new Map<FeeKind, { kind: FeeKind; amount: number; count: number }>()
  let total = 0
  let from: string | null = null
  let to: string | null = null
  for (const c of state.charges) {
    const cost = open(c)
    total += c.amount + c.gst
    if (from === null || c.date < from) from = c.date
    if (to === null || c.date > to) to = c.date
    const k = kinds.get(c.kind) ?? { kind: c.kind, amount: 0, charges: [] }
    k.amount += c.amount + c.gst
    k.charges.push(c)
    kinds.set(c.kind, k)
    if (!flagged.has(c.id) && cost > 0) {
      const a = avoid.get(c.kind) ?? { kind: c.kind, amount: 0, count: 0 }
      a.amount += cost
      a.count += 1
      avoid.set(c.kind, a)
    }
  }
  for (const check of state.checks) {
    if (from === null || check.from < from) from = check.from
    if (to === null || check.to > to) to = check.to
  }
  const byKind = [...kinds.values()].map((k) => ({ ...k, charges: k.charges.sort((a, b) => b.date.localeCompare(a.date)) })).sort((a, b) => b.amount - a.amount)
  const avoidable = [...avoid.values()].sort((a, b) => b.amount - a.amount)
  return { findings, asks, groups, claims, owed, owedCount, found, back, total, count: state.charges.length, from, to, avoidable, byKind }
}

/** What a claim group's or claim's heading says: "HDFC Bank owes you ₹590" — or, all of it back, "HDFC Bank put back ₹590". */
export function owesLine(bank: string | null, amount: number, back = false): string {
  const name = bankName(bank)
  if (back) return name ? t('fees.claim.titleBack', { bank: name, amount: inr(amount) }) : t('fees.claim.titleBackAny', { amount: inr(amount) })
  return name ? t('fees.claim.title', { bank: name, amount: inr(amount) }) : t('fees.claim.titleAny', { amount: inr(amount) })
}

/** "··4821". */
export function accountTail(account: string | null): string | null {
  const digits = (account ?? '').replace(/\D/g, '').slice(-4)
  return digits ? `··${digits}` : null
}

/** The avoidable line for a kind. */
export function avoidLine(kind: FeeKind, amount: number): string {
  const key: MessageKey =
    kind === 'minbal'
      ? 'fees.avoid.minbal'
      : kind === 'atm'
        ? 'fees.avoid.atm'
        : kind === 'sms'
          ? 'fees.avoid.sms'
          : kind === 'imps'
            ? 'fees.avoid.imps'
            : kind === 'card'
              ? 'fees.avoid.card'
              : kind === 'bounce'
                ? 'fees.avoid.bounce'
                : kind === 'atmDecline'
                  ? 'fees.avoid.atmDecline'
                  : 'fees.avoid.other'
  return t(key, { amount: inr(amount) })
}

/** Where a claim stands, in a line (part of it back: said first). */
export function statusLine(c: ClaimView, t: Translate): string {
  const bank = c.claim.steps.find((s) => s.kind === 'bank')
  const ombudsman = c.claim.steps.find((s) => s.kind === 'ombudsman')
  const part = c.backSoFar > 0 && c.stage !== 'back' ? `${t('fees.claim.status.part', { back: inr(c.backSoFar), amount: inr(c.claim.amount), rest: inr(c.rest) })} ` : ''
  switch (c.stage) {
    case 'ready':
      return part + t('fees.claim.status.ready')
    case 'raised':
      return part + t('fees.claim.status.raised', { date: dayLabel(bank?.date ?? ''), until: dayLabel(c.until ?? '') }) + (bank?.ref ? ` ${t('fees.claim.ref', { ref: bank.ref })}` : '')
    case 'ombudsman':
      return part + t('fees.claim.status.ombudsman', { last: dayLabel(c.last ?? '') })
    case 'replied':
      return part + t('fees.claim.status.replied', { date: dayLabel(c.claim.repliedAt ?? ''), last: dayLabel(c.last ?? '') })
    case 'ombudsmanRaised':
      return part + t('fees.claim.status.ombudsmanRaised', { date: dayLabel(ombudsman?.date ?? '') }) + (ombudsman?.ref ? ` ${t('fees.claim.ref', { ref: ombudsman.ref })}` : '')
    case 'closed':
      return part + t('fees.claim.status.closed', { last: dayLabel(c.last ?? '') })
    case 'back':
      return c.claim.back ? t('fees.claim.status.back', { amount: inr(c.backSoFar), date: dayLabel(c.claim.back.date) }) : t('fees.claim.status.backAll', { amount: inr(c.backSoFar) })
    case 'dropped':
      return ''
  }
}

