/**
 * Which bank charges broke a rule, and how much of each can be claimed back — the RBI's rules as
 * they stood on 3 Nov 2026, each with where it is written:
 *
 * - RBC = Reserve Bank of India (Commercial Banks – Responsible Business Conduct) Directions, 2025
 *   (RBI/DOR/2025-26/170, 28 Nov 2025, updated as on 1 Oct 2026), which took in the older circulars.
 * - Minimum balance (RBC para 160): the bank must warn you and give you a month; the charge must be in
 *   proportion to the shortfall; it must not turn your balance negative. None at all on a Basic
 *   Savings (BSBD/Jan Dhan) account (paras 86–89), a government-scholarship account (161) or an
 *   inoperative one (209). Most public-sector banks have stopped charging it on savings accounts.
 * - ATMs (RBI/2021-22/52; RBI/2019-20/41): at least 3 free transactions a month at other banks' ATMs
 *   (5 outside the six metros, 5 at your own bank's); failed ones don't count and can't be charged.
 *   A basic account gets 4 free withdrawals (RBC 86(8)).
 * - NEFT sent online from a savings account is free (RBI/2019-20/116); so is an incoming NEFT or RTGS.
 * - UPI: no charge at all from 1 Jan 2020 (PSS Act s.10A with IT Act s.269SU); from 14 Sep 2026 none
 *   on a UPI payment of up to ₹2,000 (S.O. 5067(E)).
 * - Passbook and monthly statement free (RBC 162–163); no fee to reactivate a dormant account (210).
 * - A charge taken twice, or reversed without its GST: the bank may collect only what it notified (81(7)).
 * - A loan's prepayment charge on a floating-rate loan to an individual (RBI Pre-payment Charges
 *   Directions; earlier circulars since 2014); a card's late fee within 3 days of the due date (Cards
 *   Directions 2025).
 *
 * A finding is `wrong` when the statement or SMS shows it, or `ask` when one answer from you settles
 * it. Charges that are allowed but avoidable are told apart in view.ts, never claimed: the RBI
 * Ombudsman turns away complaints about the size of a charge the bank publishes.
 */
import { accountOf, type FeeCharge, type FeesState } from './store'

export type FeeRule =
  | 'minbalNegative'
  | 'minbalBasic'
  | 'minbalScholarship'
  | 'minbalWaived'
  | 'smsWaived'
  | 'minbalNotShort'
  | 'minbalOverShortfall'
  | 'minbalOverSchedule'
  | 'minbalNotice'
  | 'minbalInoperative'
  | 'minorNegative'
  | 'basicFree'
  | 'basicWithdrawals'
  | 'atmFree'
  | 'atmDecline'
  | 'neftOnline'
  | 'transferInward'
  | 'upi'
  | 'statementFree'
  | 'activation'
  | 'duplicate'
  | 'gstLeft'
  | 'prepay'
  | 'lateFee'

/** The one answer an `ask` finding waits for. */
export type FeeQuestion =
  /** Did the bank warn you a month before charging for the minimum balance? */
  | 'warned'
  /** Did you check your balance (or get a mini statement) at another bank's ATM that month? */
  | 'atmEnquiry'
  /** Was it declined because there wasn't enough money in the account? */
  | 'declineReason'
  /** Did you send this NEFT from net banking or the bank's app? */
  | 'online'
  /** Had you stopped using this account for two years? */
  | 'inoperative'
  /** Was this for a duplicate or extra statement you asked for? */
  | 'duplicateStatement'
  /** Was it a floating-rate loan in your own name, not for a business? */
  | 'floating'
  /** Did you pay the card's bill within 3 days of its due date? */
  | 'paidInTime'
  /** Was the UPI payment it was charged on ₹2,000 or less? */
  | 'upiSmall'

export interface FeeFinding {
  /** `rule:chargeId` — the same each time it's worked out. */
  key: string
  rule: FeeRule
  verdict: 'wrong' | 'ask'
  charge: FeeCharge
  /** Paise: what can be claimed back (GST included). */
  claim: number
  question: FeeQuestion | null
  /** Numbers and days for the words (paise as numbers, days as YYYY-MM-DD). */
  facts: Readonly<Record<string, string | number>>
  /** Other rules the same charge breaks (more reasons for its letter). */
  also: { rule: FeeRule; facts: Readonly<Record<string, string | number>> }[]
  /**
   * A question that could make more of a firm finding claimable (the charge took the balance below
   * zero — and if the bank never warned you, all of it is claimable): asked alongside.
   */
  upgrade: FeeFinding | null
}

/* ---------------------------------------------------------------- the dated rules */

/** UPI and RuPay payments couldn't be charged at all from this day (PSS Act s.10A, IT Act s.269SU). */
export const UPI_FREE_FROM = '2020-01-01'
/** s.10A was amended (Act 21 of 2026) and, until S.O. 5067(E), no payment mode was specified. */
export const UPI_GAP_FROM = '2026-08-17'
/** From this day UPI payments of up to ₹2,000 can't be charged (S.O. 5067(E), 14 Sep 2026). */
export const UPI_SMALL_FROM = '2026-09-14'
export const UPI_SMALL_LIMIT = 2000_00
/** Online NEFT from a savings account is free from this day (RBI/2019-20/116). */
export const NEFT_ONLINE_FREE_FROM = '2020-01-01'
/** The stricter Basic Savings rules (free card with no annual fee, digital payments not counted as withdrawals) from this day. */
export const BASIC_2026_FROM = '2026-04-01'
/** At least this many free ATM transactions a month anywhere (other banks' ATMs in the six metros). */
export const ATM_FREE_ANYWHERE = 3
/** A Basic Savings account's free withdrawals a month. */
export const BASIC_FREE_WITHDRAWALS = 4
/** An account with nothing you did for over two years is inoperative (RBC 4(16)). */
export const INOPERATIVE_DAYS = 730

/**
 * Public-sector banks that stopped charging for the minimum balance on savings accounts, and from
 * when (the banks' own announcements; the Finance Ministry told the Rajya Sabha on 28 Jul 2026 that
 * 10 of 12 have). A charge after that day isn't one the bank still notifies (RBC 81(7)).
 */
export const MINBAL_WAIVED: Readonly<Record<string, { from: string; note: 'all' | 'standard' }>> = {
  sbi: { from: '2020-03-11', note: 'all' },
  canara: { from: '2025-06-01', note: 'all' },
  pnb: { from: '2025-07-01', note: 'all' },
  bob: { from: '2025-07-01', note: 'standard' },
  indianbank: { from: '2025-07-07', note: 'all' },
  union: { from: '2025-07-01', note: 'standard' },
}

/**
 * Banks' own published charges for a minimum-balance shortfall (their schedules as read in Nov
 * 2026), for the required balance each is written for: the most they may take (paise, before GST)
 * for a month's average of `avg` against `mab`, or null when the schedule isn't for that balance.
 * Taking more breaks the bank's own notified charge (RBC 81(7)).
 */
export const MINBAL_SCHEDULES: Readonly<Record<string, (mab: number, avg: number) => number | null>> = {
  // HDFC Regular Savings: ₹10,000 (metro/urban) in four slabs, ₹5,000 (semi-urban) in two.
  hdfc: (mab, avg) =>
    mab === 10000_00 ? (avg >= 7500_00 ? 150_00 : avg >= 5000_00 ? 300_00 : avg >= 2500_00 ? 450_00 : 600_00) : mab === 5000_00 ? (avg >= 2500_00 ? 150_00 : 300_00) : null,
  // 6% of the shortfall, capped.
  icici: (mab, avg) => Math.min(Math.round(0.06 * (mab - avg)), 500_00),
  kotak: (mab, avg) => Math.min(Math.round(0.06 * (mab - avg)), 500_00),
  axis: (mab, avg) => Math.min(Math.round(0.06 * (mab - avg)), 600_00),
}

/** Banks that stopped charging for SMS alerts on savings accounts (SBI's announcement of 11 Mar 2020, with the minimum balance). */
export const SMS_WAIVED: Readonly<Record<string, string>> = {
  sbi: '2020-03-11',
}

/** The most an ATM transaction may cost beyond the free ones (before GST), by the day it was charged. */
export function atmCap(date: string): number {
  if (date >= '2025-05-01') return 23_00
  if (date >= '2022-01-01') return 21_00
  return 20_00
}

/* ---------------------------------------------------------------- helpers */

const DAY_MS = 86_400_000
const days = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/** What's still claimable on a charge: its amount and GST, less what was put back. */
export function open(charge: FeeCharge): number {
  return Math.max(0, charge.amount + charge.gst - charge.reversed)
}

/** The GST on `part` of a charge, in the proportion the charge carried. */
function withGst(charge: FeeCharge, part: number): number {
  if (charge.amount <= 0) return part
  return Math.round(part * (1 + charge.gst / charge.amount))
}

function finding(rule: FeeRule, charge: FeeCharge, claim: number, facts: Record<string, string | number> = {}, question: FeeQuestion | null = null): FeeFinding {
  return { key: `${rule}:${charge.id}`, rule, verdict: question ? 'ask' : 'wrong', charge, claim: Math.max(0, Math.min(claim, open(charge))), question, facts, also: [], upgrade: null }
}

/** Your bank's warning, from its SMS: the latest one up to `date`. */
function noticeBefore(state: Pick<FeesState, 'notices'>, charge: FeeCharge): string | null {
  const last4 = (a: string | null) => (a ?? '').replace(/\D/g, '').slice(-4)
  let latest: string | null = null
  for (const n of state.notices) {
    if (n.date > charge.date) continue
    if (n.bank !== null && charge.bank !== null && n.bank !== charge.bank) continue
    if (n.account !== null && charge.account !== null && last4(n.account) !== last4(charge.account)) continue
    if (latest === null || n.date > latest) latest = n.date
  }
  return latest
}

/** A month after `date` (the same day next month; the month's last day when it has no such day). */
function monthAfter(date: string): string {
  const [y = 2000, m = 1, d = 1] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m, 1))
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}

/* ---------------------------------------------------------------- per kind */

function minbalFindings(state: Pick<FeesState, 'accounts' | 'notices'>, c: FeeCharge): FeeFinding[] {
  const account = accountOf(state, c)
  const total = open(c)
  // No minimum balance applies at all: the whole charge.
  if (account.type === 'basic') return [finding('minbalBasic', c, total)]
  if (account.type === 'scholarship') return [finding('minbalScholarship', c, total)]
  const waived = c.bank ? MINBAL_WAIVED[c.bank] : undefined
  if (waived && c.date >= waived.from) return [finding('minbalWaived', c, total, { from: waived.from, standard: waived.note === 'standard' ? 1 : 0 })]
  const out: FeeFinding[] = []
  if (c.avg !== null && account.mab !== null && account.mab > 0) {
    // The statement shows the average for the period it's for: not short at all, or charged more than the shortfall.
    const shortfall = account.mab - c.avg.balance
    const facts = { avg: c.avg.balance, mab: account.mab, shortfall: Math.max(0, shortfall), period: c.avg.period }
    if (shortfall <= 0) out.push(finding('minbalNotShort', c, total, facts))
    else if (c.amount > shortfall) out.push(finding('minbalOverShortfall', c, withGst(c, c.amount - shortfall), facts))
    // More than the bank's own schedule allows for that shortfall (a rupee's leeway for rounding).
    const allowed = shortfall > 0 && c.bank ? (MINBAL_SCHEDULES[c.bank]?.(account.mab, c.avg.balance) ?? null) : null
    if (allowed !== null && c.amount > allowed + 100) out.push(finding('minbalOverSchedule', c, withGst(c, c.amount - allowed), { ...facts, allowed }))
  }
  // It turned the balance negative: the part below zero (the whole charge when it was at zero or below already).
  if (c.balanceAfter !== null && c.balanceAfter < 0) {
    const before = c.balanceBefore ?? c.balanceAfter + c.amount + c.gst
    const below = before > 0 ? c.amount + c.gst - before : c.amount + c.gst
    out.push(finding(account.type === 'minor' ? 'minorNegative' : 'minbalNegative', c, below, { before, after: c.balanceAfter }))
  }
  if (c.idleDays !== null && c.idleDays > INOPERATIVE_DAYS) out.push(finding('minbalInoperative', c, total, { idle: c.idleDays }, 'inoperative'))
  // The warning and the month: from the bank's SMS on Android, else your answer.
  const notice = noticeBefore(state, c)
  if (notice !== null) {
    if (c.date < monthAfter(notice)) out.push(finding('minbalNotice', c, total, { notice, until: monthAfter(notice) }))
  } else {
    out.push(finding('minbalNotice', c, total, {}, 'warned'))
  }
  return out
}

function atmFindings(state: Pick<FeesState, 'accounts'>, c: FeeCharge): FeeFinding[] {
  const account = accountOf(state, c)
  // A decline the SMS or narration already says was for too little money: the bank may charge it.
  if (c.kind === 'atmDecline') return /\b(?:insuff|insufficient|insuf|low bal|no bal)/i.test(c.text) ? [] : [finding('atmDecline', c, open(c), {}, 'declineReason')]
  if (account.type === 'basic' && c.monthWithdrawals !== null && c.monthWithdrawals <= BASIC_FREE_WITHDRAWALS) {
    return [finding('basicWithdrawals', c, open(c), { count: c.monthWithdrawals, month: c.date.slice(0, 7) })]
  }
  if (c.monthAtm !== null && c.monthAtm <= ATM_FREE_ANYWHERE) {
    return [finding('atmFree', c, open(c), { count: c.monthAtm, failed: c.onFailed ? 1 : 0, month: c.date.slice(0, 7) }, 'atmEnquiry')]
  }
  return []
}

/** NEFT sent online from a savings account (the accounts Settle sees are people's savings accounts): free. */
function neftFindings(c: FeeCharge): FeeFinding[] {
  if (c.date < NEFT_ONLINE_FREE_FROM || c.online === false) return []
  return [finding('neftOnline', c, open(c), {}, c.online === true ? null : 'online')]
}

function upiFindings(c: FeeCharge): FeeFinding[] {
  // A "convenience fee" an app or a biller adds (no bank, no account) isn't a bank's charge.
  if (c.date < UPI_FREE_FROM || (c.source !== 'statement' && c.bank === null && c.account === null)) return []
  // Any UPI payment, up to the 2026 amendment.
  if (c.date < UPI_GAP_FROM) return [finding('upi', c, open(c), { era: 'all' })]
  // The weeks with no mode specified: nothing firm to claim.
  if (c.date < UPI_SMALL_FROM) return []
  return [finding('upi', c, open(c), { era: 'small', limit: UPI_SMALL_LIMIT }, 'upiSmall')]
}

/** Each kind's charges taken twice in one period: the later ones. */
function duplicates(charges: readonly FeeCharge[]): Map<string, FeeCharge> {
  const twice = new Map<string, FeeCharge>()
  const periodOf = (c: FeeCharge): string | null => {
    if (c.kind === 'minbal') return c.date.slice(0, 7)
    if (c.kind === 'sms') return `${c.date.slice(0, 4)}-Q${Math.floor((Number(c.date.slice(5, 7)) - 1) / 3) + 1}`
    return null
  }
  const seen = new Map<string, FeeCharge>()
  const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date))
  for (const c of sorted) {
    if (c.kind === 'card') {
      // An annual card fee twice within ten months.
      const earlier = sorted.find((o) => o !== c && o.kind === 'card' && o.amount === c.amount && o.account === c.account && o.date <= c.date && days(o.date, c.date) < 300 && !twice.has(o.id))
      if (earlier && /\b(?:annual|amc|renewal)\b/i.test(c.text)) twice.set(c.id, earlier)
      continue
    }
    const period = periodOf(c)
    if (period === null) continue
    const key = `${c.kind}|${c.account ?? ''}|${period}|${c.amount}`
    const first = seen.get(key)
    if (first) twice.set(c.id, first)
    else seen.set(key, c)
  }
  return twice
}

/* ---------------------------------------------------------------- all of it */

/**
 * Every finding on the charges kept, with your answers applied (FeesState.answers, by finding key;
 * true is the answer that makes it wrong): an `ask` answered that way turns `wrong`, answered the
 * other way it's gone. Findings you set aside are left out. A charge gets one finding — a firm one
 * before a question, then the one that claims the most — and the other rules it breaks ride along
 * in `also`, as reasons for its letter.
 */
export function findingsOf(state: Pick<FeesState, 'charges' | 'accounts' | 'notices' | 'dismissed' | 'answers'>): FeeFinding[] {
  const twice = duplicates(state.charges)
  const all: FeeFinding[] = []
  for (const c of state.charges) {
    if (open(c) <= 0) continue
    const account = accountOf(state, c)
    const found: FeeFinding[] = []
    // Reversed, but its GST kept.
    if (c.reversed > 0 && c.reversed === c.amount && c.gst > 0) found.push(finding('gstLeft', c, c.gst, { gst: c.gst }))
    if (c.reversed < c.amount) {
      const first = twice.get(c.id)
      if (first) found.push(finding('duplicate', c, open(c), { first: first.date }))
      switch (c.kind) {
        case 'minbal':
          found.push(...minbalFindings(state, c))
          break
        case 'atm':
        case 'atmDecline':
          found.push(...atmFindings(state, c))
          break
        case 'neft':
          found.push(...neftFindings(c))
          break
        case 'upi':
          found.push(...upiFindings(c))
          break
        case 'sms': {
          const from = c.bank ? SMS_WAIVED[c.bank] : undefined
          if (from && c.date >= from) found.push(finding('smsWaived', c, open(c), { from }))
          break
        }
        case 'statement':
          if (!/\b(?:dup|duplicate|adhoc|ad-hoc|cert|certificate)\b/i.test(c.text)) found.push(finding('statementFree', c, open(c), {}, 'duplicateStatement'))
          break
        case 'dormant':
          if (/\b(?:activation|reactivation|re-activation|revival)\b/i.test(c.text)) found.push(finding('activation', c, open(c)))
          break
        case 'card':
        case 'chequeBook':
        case 'cash':
          if (account.type === 'basic' && (c.kind !== 'card' || c.date >= BASIC_2026_FROM)) found.push(finding('basicFree', c, open(c), { kind: c.kind }))
          break
        case 'prepay':
          found.push(finding('prepay', c, open(c), {}, 'floating'))
          break
        case 'late':
          found.push(finding('lateFee', c, open(c), {}, 'paidInTime'))
          break
        default:
          break
      }
      // An incoming NEFT or RTGS can't be charged (the RBI's NEFT and RTGS FAQs).
      if ((c.kind === 'neft' || c.kind === 'rtgs') && /\b(?:inward|i\/w|incoming)\b/i.test(c.text)) found.push(finding('transferInward', c, open(c)))
    }
    for (const f of found) {
      if (state.dismissed.includes(f.key)) continue
      if (f.verdict === 'ask') {
        const answer = state.answers[f.key]
        if (answer === false) continue
        if (answer === true || answer === 'unsure') {
          all.push({ ...f, verdict: 'wrong', question: null, facts: answer === 'unsure' ? { ...f.facts, unsure: 1 } : f.facts })
          continue
        }
      }
      all.push(f)
    }
  }
  return strongestPerCharge(all)
}

function strongestPerCharge(findings: readonly FeeFinding[]): FeeFinding[] {
  const byCharge = new Map<string, FeeFinding[]>()
  for (const f of findings) byCharge.set(f.charge.id, [...(byCharge.get(f.charge.id) ?? []), f])
  const out: FeeFinding[] = []
  for (const list of byCharge.values()) {
    const [best, ...rest] = [...list].sort((a, b) => rank(b) - rank(a))
    if (!best) continue
    // A question that would claim more than the firm finding does.
    const upgrade = best.verdict === 'wrong' ? (rest.filter((r) => r.verdict === 'ask' && r.claim > best.claim).sort((a, b) => b.claim - a.claim)[0] ?? null) : null
    out.push({ ...best, also: rest.filter((r) => r.verdict === 'wrong' && r.rule !== best.rule).map((r) => ({ rule: r.rule, facts: r.facts })), upgrade })
  }
  return out.sort((a, b) => b.charge.date.localeCompare(a.charge.date))
}

function rank(f: FeeFinding): number {
  return (f.verdict === 'wrong' ? 1e12 : 0) + f.claim
}
