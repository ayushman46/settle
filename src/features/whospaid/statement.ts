/**
 * Reading a bank statement on the phone — nothing leaves it: CSV, tab-separated text, the HTML
 * table many banks send as ".xls", and .xlsx (see `xlsx.ts`). The header row is found by its
 * column names (Narration, Deposit Amt., Particulars, Cr/Dr…), only money received is kept, and each
 * narration is read token by token — UTR, UPI ID, IFSC, bank names, markers — rather than by
 * position, because the same bank orders its fields differently between layouts. A running
 * balance, when there is one, checks the reading: if it doesn't add up, nothing is ticked for you.
 */
import type { Minor } from '../../domain/types'
import type { Credit } from './match'

export interface StatementRead {
  credits: Credit[]
  /** Rows of money going out (not listed). */
  debits: number
  /** False when a running balance didn't add up: show the matches, tick none. */
  trusted: boolean
}

const BANKS = [
  'HDFC',
  'HDFC BANK',
  'SBI',
  'SBIN',
  'STATE BANK',
  'ICICI',
  'ICICI BANK',
  'AXIS',
  'AXIS BANK',
  'KOTAK',
  'YES BANK',
  'YESB',
  'PAYTM PAYMENTS',
  'PAYTM PAYMENTS BANK',
  'AIRTEL PAYMENTS',
  'IDFC FIRST',
  'IDFC',
  'BANK OF BARODA',
  'PUNJAB NATIONAL',
  'CANARA',
  'UNION BANK',
  'INDUSIND',
  'FEDERAL',
  'AU SMALL',
  'BANK OF INDIA',
  'INDIAN BANK',
  'IDBI',
  'RBL',
  'JUPITER',
  'FI',
]
const MARKER = /^(?:UPI|CR|DR|P2A|P2P|IMPS|NEFT|RTGS|MMT|BY TRANSFER|TO TRANSFER|TRANSFER|INB|MOB|BIL|UPIAR|NA|N A)$/i
/** Payments that aren't a person paying you back. */
const NOT_A_PERSON = /\b(?:P2M|REV|RVSL|REVERSAL|REFUND|RET|RETURN|CASHBACK|CHARGEBACK|INT\.?PD|INTEREST|SALARY|DIVIDEND|NACH|ECS)\b/i
/** Notes apps fill in themselves: never a name. */
const DEFAULT_NOTE = /^(?:payment|upi|upi payment|sent using paytm upi|sent from paytm|payment from phonepe|paid via cred|na|n a|nil|test)$/i
const VPA = /^[a-z0-9*][a-z0-9._*-]{0,63}@[a-z][a-z0-9.]{1,30}$/i
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i

const SYNONYMS: Record<'date' | 'valueDate' | 'narration' | 'ref' | 'debit' | 'credit' | 'amount' | 'type' | 'balance', readonly string[]> = {
  date: ['date', 'txn date', 'transaction date', 'tran date', 'trans date', 'posting date', 'txn dt', 'transaction dt'],
  valueDate: ['value date', 'value dt'],
  narration: ['narration', 'description', 'particulars', 'transaction remarks', 'remarks', 'transaction details', 'details', 'transaction description', 'narrative'],
  ref: ['chq./ref.no.', 'ref no./cheque no.', 'cheque number', 'chqno', 'chq / ref no.', 'chq/ref no', 'reference no', 'upi ref no.', 'ref no', 'chq no', 'cheque no', 'reference'],
  debit: ['withdrawal amt.', 'withdrawal amount (inr)', 'withdrawal amount', 'withdrawals', 'withdrawal', 'debit', 'debit amount', 'debit amount (inr)', 'dr', 'debits'],
  credit: ['deposit amt.', 'deposit amount (inr)', 'deposit amount', 'deposits', 'deposit', 'credit', 'credit amount', 'credit amount (inr)', 'cr', 'credits'],
  amount: ['amount', 'transaction amount', 'amount (inr)', 'txn amount', 'amount(inr)'],
  type: ['dr/cr', 'cr/dr', 'type', 'transaction type', 'debit/credit', 'dr / cr'],
  balance: ['closing balance', 'balance', 'balance (inr)', 'bal', 'available balance', 'running balance'],
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '')

/* ---------------------------------------------------------------- rows from a file */

/** Rows of a CSV, tab-, semicolon- or pipe-separated file (quoted fields handled). */
export function parseDelimited(text: string): string[][] {
  const clean = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, '\n')
  const sample = clean.split('\n').slice(0, 30).join('\n')
  const counts = ['\t', ',', ';', '|'].map((d) => ({ d, n: sample.split(d).length }))
  const delimiter = counts.sort((a, b) => b.n - a.n)[0]?.d ?? ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field.trim() === '') {
      quoted = true
      field = ''
    } else if (ch === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}

/** Rows of the largest HTML table in `html` (the ".xls" statements that are web pages inside). */
export function parseHtmlTable(html: string): string[][] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = [...doc.querySelectorAll('table')]
  const biggest = tables.sort((a, b) => b.rows.length - a.rows.length)[0]
  if (!biggest) return []
  return [...biggest.rows].map((tr) => [...tr.cells].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()))
}

/* ---------------------------------------------------------------- values */

/** Paise from "1,25,000.50", "₹ 1,250", "Rs.420.00 Cr"; the sign from a +/−, a Cr/Dr suffix. Null when not money. */
export function parseAmount(text: string): { paise: Minor; sign: 1 | -1 | 0 } | null {
  let t = text.trim()
  if (t === '' || t === '-') return null
  let sign: 1 | -1 | 0 = 0
  if (/\b(?:cr|credit)\.?$/i.test(t)) sign = 1
  else if (/\b(?:dr|debit)\.?$/i.test(t)) sign = -1
  t = t.replace(/\b(?:cr|dr|credit|debit)\.?$/i, '').replace(/₹|rs\.?|inr/gi, '').replace(/[\s,]/g, '')
  if (t.startsWith('(') && t.endsWith(')')) {
    t = t.slice(1, -1)
    sign = -1
  }
  if (t.startsWith('+')) {
    sign = 1
    t = t.slice(1)
  } else if (t.startsWith('-') || t.startsWith('−')) {
    sign = -1
    t = t.slice(1)
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return null
  return { paise: Math.round(Number(t) * 100), sign }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const iso = (y: number, m: number, d: number): string | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 ? date.toISOString().slice(0, 10) : null
}
const fullYear = (y: number) => (y < 100 ? 2000 + y : y)

/** YYYY-MM-DD from the ways statements print a day (always day before month), or an Excel day number. */
export function parseDate(text: string): string | null {
  const t = text.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(t)
  if (m) return iso(fullYear(Number(m[3])), Number(m[2]), Number(m[1]))
  m = /^(\d{1,2})[\s/-]([a-z]{3})[a-z]*[\s/,-]+(\d{2,4})\b/i.exec(t)
  if (m) return iso(fullYear(Number(m[3])), MONTHS.indexOf((m[2] ?? '').toLowerCase()) + 1, Number(m[1]))
  m = /^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(t)
  if (m) return iso(Number(m[3]), MONTHS.indexOf((m[1] ?? '').toLowerCase()) + 1, Number(m[2]))
  // Excel's day number (days since 30 Dec 1899) — a date cell in an .xlsx.
  if (/^\d{5}(?:\.\d+)?$/.test(t)) {
    const serial = Math.floor(Number(t))
    if (serial > 30_000 && serial < 80_000) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10)
  }
  return null
}

/* ---------------------------------------------------------------- narrations */

export interface Narration {
  utr: string | null
  vpa: string | null
  /** Text pieces that may be the payer's name (first is the likeliest). */
  names: string[]
  /** Not a person paying back: a refund, cashback, interest, salary, a merchant. */
  notPerson: boolean
}

/** Reads a narration like `UPI/P2A/629618427311/RIYA SHARMA/HDFC BANK/STL R7K Goa` or `UPI-RIYA SHARMA-riya.s@okhdfcbank-HDFC0000123-629618427311-NOTE`. */
export function readNarration(text: string): Narration {
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/-{2,}\s*$/, '')
    .replace(/^BY TRANSFER-\s*/i, '')
    .replace(/^TRANSFER FROM \S+\s*-?\s*/i, '')
    .trim()
  const notPerson = NOT_A_PERSON.test(t)
  let parts = t.split('/')
  if (parts.length < 3) parts = t.split(/\s*-\s*(?=\S)/)
  let utr: string | null = null
  let vpa: string | null = null
  const names: string[] = []
  for (const raw of parts) {
    const part = raw.trim()
    if (part === '') continue
    const digits = /^0{0,4}(\d{12})$/.exec(part)
    if (digits) {
      utr ??= digits[1] ?? null
      continue
    }
    if (VPA.test(part)) {
      vpa ??= part.toLowerCase()
      continue
    }
    if (IFSC.test(part) || MARKER.test(part)) continue
    const upper = part.toUpperCase()
    if (BANKS.some((bank) => upper === bank || upper.startsWith(`${bank} `) || upper.startsWith(`${bank}BANK`))) continue
    // Internal references: long runs with digits ("ICI0a1b2c3d…", "T2610231842…").
    if (/\d/.test(part) && /^[A-Za-z0-9]{10,}$/.test(part)) continue
    if (!/\p{L}{2,}/u.test(part) || DEFAULT_NOTE.test(part)) continue
    names.push(part)
  }
  return { utr, vpa, names, notPerson }
}

/* ---------------------------------------------------------------- the table */

type Column = keyof typeof SYNONYMS

function columnsOf(header: readonly string[]): Partial<Record<Column, number>> {
  const out: Partial<Record<Column, number>> = {}
  const cells = header.map((cell) => ({ plain: cell.toLowerCase().replace(/\s+/g, ' ').trim(), squashed: squash(cell) }))
  for (const column of Object.keys(SYNONYMS) as Column[]) {
    for (const synonym of SYNONYMS[column]) {
      const at = cells.findIndex((c) => c.plain === synonym || (c.squashed !== '' && c.squashed === squash(synonym)))
      if (at >= 0 && !Object.values(out).includes(at)) {
        out[column] = at
        break
      }
    }
  }
  return out
}

/** The header row: within the first 40, a date column and a money column. */
function findHeader(rows: readonly string[][]): { at: number; cols: Partial<Record<Column, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cols = columnsOf(rows[i] ?? [])
    const date = cols.date ?? cols.valueDate
    if (date !== undefined && (cols.credit !== undefined || cols.amount !== undefined)) return { at: i, cols }
  }
  return null
}

let counter = 0

/** Money received in a statement's rows; null when no header row could be found. */
export function readStatement(rows: readonly string[][]): StatementRead | null {
  const header = findHeader(rows)
  if (!header) return null
  const { cols } = header
  const dateCol = cols.date ?? cols.valueDate ?? 0
  const cell = (row: readonly string[], column: number | undefined) => (column === undefined ? '' : (row[column] ?? ''))
  const credits: Credit[] = []
  let debits = 0
  const balances: { delta: number; balance: number }[] = []
  for (const row of rows.slice(header.at + 1)) {
    if (row.every((c) => c.trim() === '')) {
      if (credits.length + debits > 0) break
      continue
    }
    const first = row.join(' ').toLowerCase()
    if (/statement summary|^\s*total\b|opening balance|closing balance/.test(first) && !parseDate(cell(row, dateCol))) continue
    const date = parseDate(cell(row, dateCol))
    if (!date) continue

    let delta = 0
    const credit = cols.credit !== undefined ? parseAmount(cell(row, cols.credit)) : null
    const debit = cols.debit !== undefined ? parseAmount(cell(row, cols.debit)) : null
    if (credit && credit.paise > 0 && credit.sign !== -1) delta = credit.paise
    else if (debit && debit.paise > 0) delta = -debit.paise
    else if (cols.amount !== undefined) {
      const amount = parseAmount(cell(row, cols.amount))
      const type = cell(row, cols.type).toLowerCase()
      if (amount && amount.paise > 0) {
        const sign = /^c|credit/.test(type) ? 1 : /^d|debit/.test(type) ? -1 : amount.sign
        delta = sign === 1 ? amount.paise : sign === -1 ? -amount.paise : 0
      }
    }
    const balance = cols.balance !== undefined ? parseAmount(cell(row, cols.balance)) : null
    if (balance) balances.push({ delta, balance: balance.paise * (balance.sign === -1 ? -1 : 1) })
    if (delta < 0) {
      debits++
      continue
    }
    if (delta === 0) continue

    const narration = readNarration(cell(row, cols.narration))
    if (narration.notPerson) continue
    const ref = cell(row, cols.ref).replace(/\D/g, '')
    const utr = narration.utr ?? (ref.length >= 12 && ref.length <= 16 ? ref.slice(-12) : null)
    credits.push({
      id: `st${++counter}`,
      source: 'statement',
      amount: delta,
      date,
      name: narration.names[0] ?? null,
      otherNames: narration.names.slice(1),
      vpa: narration.vpa,
      utr,
      status: 'success',
      sure: true,
    })
  }
  const trusted = balanceAddsUp(balances)
  if (!trusted) for (const credit of credits) credit.sure = false
  return { credits, debits, trusted }
}

/**
 * A running balance agrees with the amounts read (±1 paisa on 95% of rows), in whichever order the
 * statement lists them. True when there's no balance to check.
 */
function balanceAddsUp(rows: readonly { delta: number; balance: number }[]): boolean {
  if (rows.length < 3) return true
  const share = (ok: (prev: { delta: number; balance: number }, cur: { delta: number; balance: number }) => boolean) => {
    let n = 0
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const cur = rows[i]
      if (prev && cur && ok(prev, cur)) n++
    }
    return n / (rows.length - 1)
  }
  // Oldest first: the balance before, plus this row, is this row's balance. Newest first: the other way round.
  const ascending = share((prev, cur) => Math.abs(prev.balance + cur.delta - cur.balance) <= 1)
  const descending = share((prev, cur) => Math.abs(cur.balance + prev.delta - prev.balance) <= 1)
  return Math.max(ascending, descending) >= 0.95
}
