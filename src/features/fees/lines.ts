/**
 * Every line of a bank statement, money in and money out, in the order it happened — the same
 * reading "Who's paid?" uses (src/features/whospaid/statement.ts: the header found by its column
 * names, the amounts and days as banks print them), but keeping the narration, the running
 * balance and the reference of each row, because a bank charge is judged by what was around it:
 * the balance it left, the withdrawals before it that month, the transfer it was charged on.
 */
import type { Minor } from '../../domain/types'
import { findHeader, parseAmount, parseDate } from '../whospaid/statement'

export interface StatementLine {
  /** Position in the statement, oldest first (0-based). */
  at: number
  date: string
  /** Paise: money in is positive, money out negative. */
  delta: Minor
  /** The balance after this line, when the statement prints one. */
  balance: Minor | null
  /** The narration as printed, spaces tidied. */
  narration: string
  /** The cheque / reference column, digits and letters only, or ''. */
  ref: string
}

export interface StatementLines {
  lines: StatementLine[]
  /** The balance adds up line to line (or there's no balance to check). */
  trusted: boolean
  /** The first and last day the lines cover. */
  from: string | null
  to: string | null
}

/** The lines of a statement's rows, oldest first; null when no header row could be found. */
export function readLines(rows: readonly string[][]): StatementLines | null {
  const header = findHeader(rows)
  if (!header) return null
  const { cols } = header
  const dateCol = cols.date ?? cols.valueDate ?? 0
  const cell = (row: readonly string[], column: number | undefined) => (column === undefined ? '' : (row[column] ?? ''))
  const read: Omit<StatementLine, 'at'>[] = []
  for (const row of rows.slice(header.at + 1)) {
    if (row.every((c) => c.trim() === '')) {
      if (read.length > 0) break
      continue
    }
    const date = parseDate(cell(row, dateCol))
    if (!date) continue
    // "OPENING BALANCE" / "CLOSING BALANCE" rows aren't transactions (but their balance is the one to start from).
    const balanceRow = /^\s*(?:opening|closing|brought forward|b\/f|carried forward|c\/f)\b/i.test(cell(row, cols.narration))
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
    if (delta === 0 || balanceRow) continue
    const balance = cols.balance !== undefined ? parseAmount(cell(row, cols.balance)) : null
    // Kotak-style files say Dr / Cr for the balance in the next column: a "Dr" balance is below zero.
    const drNext = cols.balance !== undefined && /^\s*dr\.?\s*$/i.test(cell(row, cols.balance + 1))
    read.push({
      date,
      delta,
      balance: balance ? balance.paise * (balance.sign === -1 || drNext ? -1 : 1) : null,
      narration: cell(row, cols.narration).replace(/\s+/g, ' ').trim(),
      ref: cell(row, cols.ref).replace(/[^A-Za-z0-9]/g, ''),
    })
  }
  if (read.length === 0) return { lines: [], trusted: true, from: null, to: null }
  const ordered = oldestFirst(read)
  const lines = ordered.map((line, at) => ({ ...line, at }))
  return { lines, trusted: addsUp(lines), from: lines[0]?.date ?? null, to: lines.at(-1)?.date ?? null }
}

/**
 * The rows oldest first. Statements list them either way; the dates say which, and where every row
 * is on one day the running balance does (the row before plus this one is this one's balance).
 */
function oldestFirst<T extends { date: string; delta: number; balance: number | null }>(rows: readonly T[]): T[] {
  const first = rows[0]?.date ?? ''
  const last = rows.at(-1)?.date ?? ''
  if (first < last) return [...rows]
  if (first > last) return [...rows].reverse()
  const forward = chained(rows)
  const backward = chained([...rows].reverse())
  return backward > forward ? [...rows].reverse() : [...rows]
}

/** How many rows follow from the one before by their balance. */
function chained(rows: readonly { delta: number; balance: number | null }[]): number {
  let n = 0
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]?.balance
    const cur = rows[i]
    if (prev !== null && prev !== undefined && cur && cur.balance !== null && Math.abs(prev + cur.delta - cur.balance) <= 1) n++
  }
  return n
}

/** The running balance agrees with the amounts on 95% of rows (true when there's none to check). */
function addsUp(lines: readonly StatementLine[]): boolean {
  const withBalance = lines.filter((l) => l.balance !== null)
  if (withBalance.length < 3) return true
  return chained(withBalance) / (withBalance.length - 1) >= 0.95
}

/** The balance just before `line`: the one printed on the line before, or this line's less its amount. */
export function balanceBefore(line: StatementLine, lines: readonly StatementLine[]): Minor | null {
  if (line.balance !== null) return line.balance - line.delta
  const prev = lines[line.at - 1]
  return prev?.balance ?? null
}
