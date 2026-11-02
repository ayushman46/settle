/**
 * The charges in a statement's lines, each with what was around it: its GST (the tax line next to
 * it), what was put back (a reversal line later), the balance before and after it, the ATM
 * withdrawals that went through that month (failed ones, reversed, aren't counted — the RBI says
 * they mustn't be), and for a NEFT or RTGS charge whether the transfer was sent online.
 */
import type { Minor } from '../../domain/types'
import { findBank } from '../sharein/sms/brands'
import { feeKindOf, isReversal, isTaxLine, type FeeKind } from './kinds'
import { balanceBefore, type StatementLine } from './lines'
import type { FeeCharge } from './store'

export type ChargeDraft = Omit<FeeCharge, 'id' | 'addedAt'>

/** The most a charge line can be (a loan's prepayment charge aside): anything bigger is a payment. */
const MAX_CHARGE: Minor = 25_000_00
const MAX_PREPAY: Minor = 5_00_000_00
/** GST on a bank charge: 18% (or 9% + 9% as two lines). */
const GST_RATE = 0.18
/** The GST is inside the charge line itself. */
const GST_INSIDE = /\b(?:inc|incl|including|inclusive of)\.?\s*(?:of\s*)?gst\b|\+\s*gst\b/i

/** A cash withdrawal at an ATM (not its charge). */
const ATM_WITHDRAWAL = /\b(?:atm|nfs|atw|cash\s*wdl|cwdr|cash withdrawal|awb|cash wd|atm wd|atm-wdl|nwd|eaw|vat|mat)\b/i
/** A transfer sent from net banking or the bank's app. */
const ONLINE = /\b(?:inb|ib|nb|netbanking|netbank|net banking|net bank|internet banking|mob|mobile|mb|online|yono|imobile|i-mobile|ibl|ebanking|e-banking|app|neft-inb|rib|cib|mbk|omni)\b/i
/** A transfer made at a branch. */
const BRANCH = /\b(?:branch|counter|chq|cheque|cash|by clearing|brn)\b/i
/** A withdrawal a basic account's four free ones count: cash (ATM or branch), a cheque, a branch transfer — not UPI, IMPS, NEFT, RTGS or a card payment. */
const WITHDRAWAL = /\b(?:atm|nfs|atw|nwd|vat|mat|cwdr|awb|eaw|cash|self|chq|cheque|clg|clearing|to transfer|trf|withdrawal|wdl)\b/i
const DIGITAL = /\b(?:upi|imps|neft|rtgs|pos|ecom|e-com|nach|ach|bil|billpay|bbps|vps|ips|mmt)\b/i
/** Interest, and other credits the bank makes itself: not something you did. */
const BANK_MADE = /\b(?:int\.?\s*pd|interest|int\.?\s*cr|sb\s*int|credit interest|int\.coll)\b/i
/** A quarterly average balance. */
const QUARTERLY = /\b(?:aqb|qab|qtr|qtrly|quarter|quarterly)\b/i
const DAY_MS = 86_400_000

function monthOf(date: string): string {
  return date.slice(0, 7)
}

function prevMonth(date: string): string {
  const [y, m] = date.split('-').map(Number)
  if (!y || !m) return monthOf(date)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** The tax line for a charge: next to it, the same day, about 18% of it (or 9% when CGST and SGST are two lines). */
function taxFor(line: StatementLine, lines: readonly StatementLine[], used: Set<number>): Minor {
  const amount = -line.delta
  let tax = 0
  for (const near of [lines[line.at + 1], lines[line.at + 2], lines[line.at - 1]]) {
    if (!near || used.has(near.at) || near.delta >= 0 || near.date !== line.date || !isTaxLine(near.narration)) continue
    const value = -near.delta
    const full = Math.abs(value - amount * GST_RATE) <= Math.max(2, amount * 0.005)
    const half = Math.abs(value - amount * (GST_RATE / 2)) <= Math.max(2, amount * 0.005)
    if (full || half) {
      used.add(near.at)
      tax += value
      if (full) break
    }
  }
  return tax
}

/** A charge line that's really GST alone (with no charge next to it): kept as its own charge of the kind it names. */
function isLoneTax(line: StatementLine): boolean {
  return line.delta < 0 && isTaxLine(line.narration)
}

/** The reversals in the statement: credits that put back a charge of a kind. */
function reversalsOf(lines: readonly StatementLine[]): { line: StatementLine; kind: FeeKind | null }[] {
  return lines.filter((l) => l.delta > 0 && isReversal(l.narration) && (feeKindOf(l.narration) !== null || isTaxLine(l.narration))).map((line) => ({ line, kind: feeKindOf(line.narration) }))
}

/** ATM withdrawals that went through, by month, each with its position — and how many failed (reversed). */
function atmByMonth(lines: readonly StatementLine[]): { done: Map<string, number[]>; failed: Map<string, number> } {
  const done = new Map<string, number[]>()
  const failed = new Map<string, number>()
  const withdrawals = lines.filter((l) => l.delta < 0 && ATM_WITHDRAWAL.test(l.narration) && feeKindOf(l.narration) === null && !isTaxLine(l.narration))
  const reversals = lines.filter((l) => l.delta > 0 && ATM_WITHDRAWAL.test(l.narration) && isReversal(l.narration))
  const usedReversal = new Set<number>()
  for (const w of withdrawals) {
    const rev = reversals.find((r) => !usedReversal.has(r.at) && r.delta === -w.delta && r.at > w.at && Date.parse(r.date) - Date.parse(w.date) <= 15 * 86_400_000)
    const month = monthOf(w.date)
    if (rev) {
      usedReversal.add(rev.at)
      failed.set(month, (failed.get(month) ?? 0) + 1)
      continue
    }
    done.set(month, [...(done.get(month) ?? []), w.at])
  }
  return { done, failed }
}

/** The transfer a NEFT/RTGS charge was for: the line next to it on the same day naming the same rail. */
function transferFor(line: StatementLine, lines: readonly StatementLine[], rail: 'neft' | 'rtgs'): StatementLine | null {
  const word = rail === 'neft' ? /\bneft\b/i : /\brtgs\b/i
  for (const near of [lines[line.at - 1], lines[line.at + 1], lines[line.at - 2], lines[line.at + 2]]) {
    if (near && near.delta < 0 && near.date === line.date && word.test(near.narration) && feeKindOf(near.narration) === null) return near
  }
  return null
}

function onlineOf(transfer: StatementLine | null): boolean | null {
  if (!transfer) return null
  if (ONLINE.test(transfer.narration)) return true
  if (BRANCH.test(transfer.narration)) return false
  return null
}

const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
const dateOf = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10)

/** The period a minimum-balance charge on `date` is most likely for: [first day, last day] and a label ("2026-10", "2026-Q3"). */
export function chargePeriod(date: string, quarterly: boolean): { from: string; to: string; label: string } {
  const [y = 2000, m = 1, d = 1] = date.split('-').map(Number)
  if (quarterly) {
    // The quarter that ended last, unless it's taken in the last fortnight of a quarter (charged at its end).
    let q = Math.floor((m - 1) / 3)
    let year = y
    const lastMonthOfQuarter = m % 3 === 0
    if (!(lastMonthOfQuarter && d >= 16)) {
      q -= 1
      if (q < 0) {
        q = 3
        year -= 1
      }
    }
    const from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`
    const end = new Date(Date.UTC(year, q * 3 + 3, 0)).toISOString().slice(0, 10)
    return { from, to: end, label: `${year}-Q${q + 1}` }
  }
  // Taken in the first half of a month: last month's average. Later: this month's (charged at its end).
  const month = d <= 15 ? (m === 1 ? 12 : m - 1) : m
  const year = d <= 15 && m === 1 ? y - 1 : y
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { from, to, label: from.slice(0, 7) }
}

/**
 * The average of the day-end balances over a period, as banks work out a monthly (or quarterly)
 * average balance — with the minimum-balance charges themselves left out (they come after the
 * average is worked out). Null when the statement didn't cover the whole period or its balances
 * don't add up.
 */
export function periodAverage(lines: readonly StatementLine[], from: string, to: string, isFee: (line: StatementLine) => boolean): Minor | null {
  const withBalance = lines.filter((l) => l.balance !== null)
  const first = withBalance[0]
  const last = lines.at(-1)
  if (!first || !last) return null
  // The statement must reach the period's first days and its end (a line on or after the last day, or within 2 days of it).
  if (dayNumber(first.date) > dayNumber(from) + 3 || dayNumber(last.date) < dayNumber(to) - 2) return null
  const start = dayNumber(from)
  const end = dayNumber(to)
  let i = 0
  let closing: number | null = null
  // The balance as the period began: the last line before it, or the first line's balance before it.
  while (i < lines.length && (lines[i]?.date ?? '') < from) {
    const b = lines[i]?.balance
    if (b !== null && b !== undefined) closing = b
    i++
  }
  if (closing === null) closing = balanceBefore(lines[i] ?? first, lines)
  if (closing === null) return null
  let feesSoFar = 0
  let total = 0
  for (let day = start; day <= end; day++) {
    const date = dateOf(day)
    while (i < lines.length && lines[i]?.date === date) {
      const line = lines[i] as StatementLine
      if (isFee(line)) feesSoFar += -line.delta
      if (line.balance !== null) closing = line.balance
      else closing += line.delta
      i++
    }
    total += closing + feesSoFar
  }
  return Math.round(total / (end - start + 1))
}

export interface ScanResult {
  charges: ChargeDraft[]
  /** The bank, when the statement's lines name one. */
  bank: string | null
}

/** The charges in `lines` (oldest first), for the account `account` at `bank` when known. */
export function scanCharges(lines: readonly StatementLine[], opts: { bank?: string | null; account?: string | null; trusted?: boolean } = {}): ScanResult {
  const trusted = opts.trusted ?? true
  const used = new Set<number>()
  const atm = atmByMonth(lines)
  const reversals = reversalsOf(lines)
  const usedReversal = new Set<number>()
  const bank = opts.bank ?? bankOfLines(lines)
  const charges: ChargeDraft[] = []
  for (const line of lines) {
    if (line.delta >= 0 || used.has(line.at)) continue
    let kind = feeKindOf(line.narration)
    const loneTax = kind === null && isLoneTax(line)
    if (kind === null && !loneTax) continue
    kind ??= 'other'
    const amount = -line.delta
    if (amount > (kind === 'prepay' ? MAX_PREPAY : MAX_CHARGE)) continue
    used.add(line.at)
    let gst = loneTax ? 0 : taxFor(line, lines, used)
    let base = amount
    // HDFC's "AMB CHRG INCL GST", ICICI's "MABchgs-Feb21+GST": the GST is inside the one line.
    if (gst === 0 && GST_INSIDE.test(line.narration)) {
      base = Math.round(amount / (1 + GST_RATE))
      gst = amount - base
    }
    const before = balanceBefore(line, lines)
    const lastTax = lines[line.at + 1] && used.has(line.at + 1) ? lines[line.at + 1] : lines[line.at + 2] && used.has(line.at + 2) ? lines[line.at + 2] : null
    const after = (lastTax ?? line).balance
    // Put back: a later reversal of this amount (or with its GST), the same kind when it names one.
    const rev = reversals.find(
      (r) =>
        !usedReversal.has(r.line.at) &&
        r.line.at > line.at &&
        (r.kind === null || r.kind === kind) &&
        (r.line.delta === amount || r.line.delta === base || r.line.delta === base + gst) &&
        Date.parse(r.line.date) - Date.parse(line.date) <= 180 * 86_400_000,
    )
    if (rev) usedReversal.add(rev.line.at)
    let monthAtm: number | null = null
    let onFailed = false
    if (kind === 'atm' || kind === 'atmDecline') {
      const month = monthOf(line.date)
      const doneThisMonth = (atm.done.get(month) ?? []).filter((at) => at < line.at).length
      // Charges for a month are often taken in the first days of the next: count that month too, and keep the larger (the fairer to the bank).
      const day = Number(line.date.slice(8, 10))
      const doneLastMonth = day <= 10 ? (atm.done.get(prevMonth(line.date)) ?? []).length : 0
      monthAtm = Math.max(doneThisMonth, doneLastMonth)
      onFailed = (atm.failed.get(month) ?? 0) + (day <= 10 ? (atm.failed.get(prevMonth(line.date)) ?? 0) : 0) > 0
    }
    const online = kind === 'neft' || kind === 'rtgs' ? onlineOf(transferFor(line, lines, kind)) : null
    let avg: ChargeDraft['avg'] = null
    if (kind === 'minbal' && trusted) {
      const period = chargePeriod(line.date, QUARTERLY.test(line.narration))
      const balance = periodAverage(lines, period.from, period.to, isMinbalLine)
      if (balance !== null) avg = { period: period.label, balance }
    }
    charges.push({
      date: line.date,
      kind,
      amount: base,
      gst,
      reversed: rev ? rev.line.delta : 0,
      text: line.narration.slice(0, 200),
      bank,
      account: opts.account ?? null,
      balanceBefore: before,
      balanceAfter: after,
      monthAtm,
      onFailed,
      online,
      avg,
      idleDays: idleBefore(line, lines),
      monthWithdrawals: withdrawalsIn(monthOf(line.date), lines),
      source: 'statement',
    })
  }
  return { charges, bank }
}

/** A minimum-balance charge line, or the GST line right after one. */
function isMinbalLine(line: StatementLine): boolean {
  return line.delta < 0 && (feeKindOf(line.narration) === 'minbal' || (isTaxLine(line.narration) && /\b(?:mab|amb|aqb|qab|min|bal|maint)/i.test(line.narration)))
}

/** Something you did, not the bank: any line but a charge, its tax, its reversal or interest. */
function isCustomerMade(line: StatementLine): boolean {
  if (feeKindOf(line.narration) !== null || isTaxLine(line.narration)) return false
  if (line.delta > 0 && BANK_MADE.test(line.narration)) return false
  return true
}

/**
 * Days since the last thing you did before `line` — when the statement shows one, or (when it
 * shows none) reaches back at least two years with nothing you did in it. Else null.
 */
function idleBefore(line: StatementLine, lines: readonly StatementLine[]): number | null {
  for (let i = line.at - 1; i >= 0; i--) {
    const prev = lines[i]
    if (prev && isCustomerMade(prev)) return Math.max(0, dayNumber(line.date) - dayNumber(prev.date))
  }
  const first = lines[0]
  if (!first) return null
  const span = dayNumber(line.date) - dayNumber(first.date)
  return span >= 730 ? span : null
}

/** A basic account's withdrawals in `month`: cash at an ATM or the branch, cheques and branch transfers (failed ones left out). */
function withdrawalsIn(month: string, lines: readonly StatementLine[]): number {
  const reversedAmounts = lines.filter((l) => l.delta > 0 && monthOf(l.date) === month && isReversal(l.narration)).map((l) => l.delta)
  let n = 0
  for (const l of lines) {
    if (l.delta >= 0 || monthOf(l.date) !== month || !isCustomerMade(l) || !WITHDRAWAL.test(l.narration) || DIGITAL.test(l.narration)) continue
    const at = reversedAmounts.indexOf(-l.delta)
    if (at >= 0) {
      reversedAmounts.splice(at, 1)
      continue
    }
    n++
  }
  return n
}

/** The bank most of the lines name (UPI narrations carry the other side's bank, so it needs a clear lead). */
function bankOfLines(lines: readonly StatementLine[]): string | null {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (feeKindOf(line.narration) === null) continue
    const bank = findBank(line.narration)
    if (bank) counts.set(bank, (counts.get(bank) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return best ? best[0] : null
}
