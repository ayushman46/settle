/**
 * Checking a statement: the file read on the phone (src/features/whospaid/statementFile.ts), its
 * lines, which bank and account it's for (from the rows above the table — the bank's name, the
 * IFSC, "Account No: XXXXXX4821", the product name — or the file's name), and the charges in it,
 * kept (src/features/fees/actions.ts). Only the charges are kept; the rest of the statement isn't.
 */
import { BANKS } from '../sharein/sms/brands'
import { findHeader, parseDate } from '../whospaid/statement'
import { rowsOf } from '../whospaid/statementFile'
import { addCharges, addLate, setAccount, type AddResult } from './actions'
import { readLines, type StatementLine } from './lines'
import { scanCharges } from './scan'
import { accountKey, feesStore, type AccountType } from './store'

/** The bank an IFSC's first four letters name. */
const IFSC_BANKS: Readonly<Record<string, string>> = {
  HDFC: 'hdfc',
  SBIN: 'sbi',
  ICIC: 'icici',
  UTIB: 'axis',
  KKBK: 'kotak',
  PUNB: 'pnb',
  BARB: 'bob',
  YESB: 'yes',
  IDFB: 'idfc',
  INDB: 'indusind',
  CNRB: 'canara',
  UBIN: 'union',
  BKID: 'boi',
  CBIN: 'central',
  IDIB: 'indianbank',
  IOBA: 'iob',
  UCBA: 'uco',
  MAHB: 'mahabank',
  IBKL: 'idbi',
  FDRL: 'federal',
  SIBL: 'southindian',
  KVBL: 'kvb',
  CIUB: 'cub',
  TMBL: 'tmb',
  KARB: 'karnataka',
  RATN: 'rbl',
  AUBL: 'au',
  ESFB: 'equitas',
  PYTM: 'paytm',
  AIRP: 'airtel',
}

export interface StatementMeta {
  bank: string | null
  /** "XX4821". */
  account: string | null
  /** What the statement says the account is, when it says. */
  type: AccountType | null
  /** The days the statement says it covers ("Statement From : 01/10/2026 To : 03/11/2026"), when it says. */
  period?: { from: string; to: string } | null
}

/** "From 01/10/2026 To 03/11/2026", "Period: 1 Apr 2026 to 30 Sep 2026". */
const PERIOD = /\b(?:from|period)\b\s*[:-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][a-z]{3}[a-z]*[\s-]\d{2,4}|\d{4}-\d{2}-\d{2})\s*(?:to|-|–)\s*[:-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][a-z]{3}[a-z]*[\s-]\d{2,4}|\d{4}-\d{2}-\d{2})/i

const IFSC = /\b([A-Z]{4})0[A-Z0-9]{6}\b/
const ACCOUNT = /\b(?:a\/?c|acct|account)(?:\s*(?:no|number|num))?\.?\s*[:#-]?\s*[x*]*\s*(\d{4,18})\b/i
const MASKED = /\b[x*]{2,}\s?(\d{3,4})\b/i
const BASIC = /\b(?:bsbd|bsbda|basic savings|basic saving|pmjdy|jan dhan|jandhan|small account|bsba|no frills|no-frills)\b/i
const MINOR = /\b(?:minor|junior|kids?|young star|future stars?|champs)\b/i
const SCHOLARSHIP = /\b(?:scholarship|nsp|post matric|pre matric)\b/i
const SALARY = /\b(?:salary|payroll|corporate salary)\b/i
const SENIOR = /\b(?:senior citizen|pension|pensioner)\b/i

/**
 * The bank, account and account type the rows above the table say — or `around`, the text outside
 * it (a web-page ".xls" puts them in a table of their own) — and the file's name.
 */
export function statementMeta(rows: readonly string[][], fileName = '', around = ''): StatementMeta {
  const header = findHeader(rows)
  const top = `${rows.slice(0, header ? header.at : Math.min(rows.length, 25)).map((r) => r.join(' ')).join('\n')}\n${around.slice(0, 4000)}`
  const text = `${top}\n${fileName.replace(/[_.-]+/g, ' ')}`
  let bank: string | null = null
  const ifsc = IFSC.exec(top)
  if (ifsc?.[1]) bank = IFSC_BANKS[ifsc[1]] ?? null
  if (!bank) bank = BANKS.find(([, pattern]) => pattern.test(text))?.[0] ?? null
  const digits = ACCOUNT.exec(top)?.[1] ?? MASKED.exec(top)?.[1] ?? null
  const account = digits ? `XX${digits.slice(-4)}` : null
  const type: AccountType | null = BASIC.test(top)
    ? 'basic'
    : SCHOLARSHIP.test(top)
      ? 'scholarship'
      : MINOR.test(top)
        ? 'minor'
        : SALARY.test(top)
          ? 'salary'
          : SENIOR.test(top)
            ? 'senior'
            : null
  const range = PERIOD.exec(top)
  const from = range?.[1] ? parseDate(range[1]) : null
  const to = range?.[2] ? parseDate(range[2]) : null
  return { bank, account, type, period: from && to && from <= to ? { from, to } : null }
}

/** An ATM withdrawal that failed and came back after the RBI's 5 days: the bank owes ₹100 a day for the wait (Stuck money claims it). */
export interface LateReversal {
  date: string
  backOn: string
  amount: number
  text: string
}

const ATM = /\b(?:atm|nfs|atw|cash\s*wdl|cwdr|nwd|cash withdrawal)\b/i
const REVERSAL = /\b(?:rev|revd|rvsl|reversal|reversed|refund|chargeback)\b/i
const COMPENSATION = /\b(?:compensation|comp\b|tat\s*comp|penalty\s*cr|late\s*credit)\b/i

/** ATM withdrawals put back more than 5 days later with no compensation line after them. */
export function lateAtmReversals(lines: readonly StatementLine[]): LateReversal[] {
  const out: LateReversal[] = []
  const used = new Set<number>()
  for (const w of lines) {
    if (w.delta >= 0 || !ATM.test(w.narration) || REVERSAL.test(w.narration)) continue
    const back = lines.find((l) => !used.has(l.at) && l.at > w.at && l.delta === -w.delta && ATM.test(l.narration) && REVERSAL.test(l.narration))
    if (!back) continue
    used.add(back.at)
    const wait = Math.round((Date.parse(back.date) - Date.parse(w.date)) / 86_400_000)
    if (wait <= 5) continue
    const paid = lines.some((l) => l.at > back.at && l.delta > 0 && COMPENSATION.test(l.narration))
    if (!paid) out.push({ date: w.date, backOn: back.date, amount: -w.delta, text: w.narration.slice(0, 120) })
  }
  return out
}

export type StatementCheck =
  | {
      kind: 'read'
      meta: StatementMeta
      from: string | null
      to: string | null
      lines: number
      /** The running balance added up line to line. */
      trusted: boolean
      result: AddResult
      lateReversals: LateReversal[]
    }
  /** No table of dated amounts (or an old binary .xls). */
  | { kind: 'unreadable'; oldXls: boolean }
  /** Read, but with no money moving in it. */
  | { kind: 'empty' }

/** Reads rows already opened (a file, or text pasted from net banking). */
export function checkRows(rows: readonly string[][], fileName = '', now: number = Date.now(), around = ''): StatementCheck {
  const read = readLines(rows)
  if (!read) return { kind: 'unreadable', oldXls: false }
  if (read.lines.length === 0) return { kind: 'empty' }
  const meta = statementMeta(rows, fileName, around)
  const { charges } = scanCharges(read.lines, { bank: meta.bank, account: meta.account, trusted: read.trusted })
  const check = {
    at: now,
    from: meta.period?.from ?? read.from ?? read.lines[0]?.date ?? '1970-01-01',
    to: meta.period?.to ?? read.to ?? read.lines.at(-1)?.date ?? '1970-01-01',
    bank: meta.bank,
    account: meta.account,
    lines: read.lines.length,
    charges: charges.length,
  }
  const before = feesStore.get()
  const added = addCharges(charges, check, now)
  // The statement says what kind of account it is (a Basic Savings, scholarship or minor's account): no need to ask.
  const known = before.accounts[accountKey(meta.bank, meta.account)]
  if (meta.type && meta.type !== 'salary' && meta.type !== 'senior' && (!known || known.type === 'unknown')) setAccount(meta.bank, meta.account, { type: meta.type })
  const result: AddResult = { ...added, undo: () => feesStore.set(before) }
  // Late ATM refunds: kept (with the account) until claimed in Stuck money.
  const lateReversals = lateAtmReversals(read.lines)
  if (lateReversals.length > 0) addLate(lateReversals.map((l) => ({ ...l, bank: meta.bank, account: meta.account })))
  return { kind: 'read', meta, from: check.from, to: check.to, lines: read.lines.length, trusted: read.trusted, result, lateReversals }
}

/** Reads a statement file on the phone and keeps its charges. */
export async function checkStatementFile(file: File): Promise<StatementCheck> {
  const rows = await rowsOf(file).catch(() => null)
  if (rows === null) {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer().catch(() => new ArrayBuffer(0)))
    return { kind: 'unreadable', oldXls: head[0] === 0xd0 && head[1] === 0xcf }
  }
  return checkRows(rows, file.name, Date.now(), await textAround(file))
}

/** A web-page statement's text outside its biggest table (where banks put the account details). */
async function textAround(file: File): Promise<string> {
  const head = await file
    .slice(0, 200_000)
    .text()
    .catch(() => '')
  if (!/<table[\s>]/i.test(head) || typeof DOMParser === 'undefined') return ''
  return htmlTextAround(head)
}

/** The text of every table but the biggest, and of the page around them. */
export function htmlTextAround(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = [...doc.querySelectorAll('table')].sort((a, b) => b.rows.length - a.rows.length)
  tables[0]?.remove()
  return (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
}
