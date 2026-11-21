/**
 * Bring your Splitwise: reads a group's "Export as spreadsheet" file (CSV) and plans the same
 * group in Settle — the people, every bill and every payment — so the balances come over exactly.
 *
 * The file (one per group or friend): a header `Date,Description,Category,Cost,Currency,<person>…`,
 * then one row per bill or payment, and a closing `Total balance` row. Each person's column is
 * what they paid minus what they owed on that row ("paid − owe"), so a row's columns add to zero.
 *
 * From "paid − owe" alone, a bill paid by one person is exact: everyone below zero owes that much,
 * and the payer's own share is the cost less their column. A bill paid by several people (rare) is
 * planned as one bill per payer, each for what the others owed them — every balance stays the same
 * to the paisa. Payments ("Category: Payment") become recorded payments. At the end the planned
 * balances are checked against the file's own "Total balance" row.
 *
 * Pure: nothing is saved here (see apply.ts).
 */
import type { CategoryId, Minor } from '../../domain/types'
import { isKnownCurrency } from '../../lib/currencies'
import { toMinor } from '../../lib/money'

/** One row of the file, amounts in minor units of its currency. */
export interface SplitwiseRow {
  line: number
  date: string
  description: string
  category: string
  cost: Minor | null
  currency: string
  /** Person (as the file names them) → paid − owe. */
  nets: Record<string, Minor>
  isPayment: boolean
}

export interface SplitwiseFile {
  people: string[]
  rows: SplitwiseRow[]
  /** The file's "Total balance" row, per currency. */
  totals: Record<string, Record<string, Minor>>
  /** Lines that couldn't be read, with why. */
  problems: Array<{ line: number; reason: string }>
}

export class SplitwiseFormatError extends Error {}

/* ------------------------------------------------------------------ CSV */

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/* ------------------------------------------------------------------ reading */

const KNOWN = ['date', 'description', 'category', 'cost', 'currency'] as const

/** "1,200.50", "-400.00", "₹ 99" → a number; null when it isn't one. */
function amount(raw: string): number | null {
  const clean = raw.trim().replace(/[₹$€£\s]/g, '').replace(/,(?=\d{2,3}(?:\D|$))/g, '')
  if (clean === '' || clean === '-') return null
  if (!/^-?\d+(?:\.\d+)?$/.test(clean)) return null
  return Number(clean)
}

/** YYYY-MM-DD (Splitwise's own), also DD/MM/YYYY and MM/DD/YYYY when unambiguous. */
function isoDate(raw: string): string | null {
  const s = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (dmy) {
    const a = Number(dmy[1])
    const b = Number(dmy[2])
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

/** Reads a Splitwise export. Throws SplitwiseFormatError when it isn't one. */
export function readSplitwise(text: string, fallbackCurrency = 'INR'): SplitwiseFile {
  const table = parseCsv(text)
  const headerAt = table.findIndex((r) => r.length >= 5 && r[0]?.trim().toLowerCase() === 'date' && r.some((c) => c.trim().toLowerCase() === 'cost'))
  if (headerAt < 0) throw new SplitwiseFormatError('Not a Splitwise export: no “Date … Cost” header.')
  const header = (table[headerAt] ?? []).map((h) => h.trim())
  const col = (name: (typeof KNOWN)[number]) => header.findIndex((h) => h.toLowerCase() === name)
  const lastKnown = Math.max(...KNOWN.map((k) => col(k)))
  const personCols = header.map((h, i) => ({ h, i })).filter(({ h, i }) => i > lastKnown && h !== '')
  if (personCols.length < 2) throw new SplitwiseFormatError('Not a Splitwise export: fewer than two people.')
  const people = personCols.map((p) => p.h)

  const out: SplitwiseFile = { people, rows: [], totals: {}, problems: [] }
  for (let r = headerAt + 1; r < table.length; r++) {
    const cells = table[r] ?? []
    const line = r + 1
    if (cells.every((c) => c.trim() === '')) continue
    const description = (cells[col('description')] ?? '').trim()
    const currencyRaw = col('currency') >= 0 ? (cells[col('currency')] ?? '').trim().toUpperCase() : ''
    const currency = isKnownCurrency(currencyRaw) ? currencyRaw : fallbackCurrency
    const nets: Record<string, Minor> = {}
    let bad = false
    for (const { h, i } of personCols) {
      const value = amount(cells[i] ?? '')
      if (value === null) {
        if ((cells[i] ?? '').trim() !== '') bad = true
        nets[h] = 0
      } else nets[h] = toMinor(value, currency)
    }
    if (/^total balance$/i.test(description)) {
      out.totals[currency] = nets
      continue
    }
    const date = isoDate(cells[col('date')] ?? '')
    if (!date) {
      out.problems.push({ line, reason: 'no date' })
      continue
    }
    if (bad) {
      out.problems.push({ line, reason: 'an amount that isn’t a number' })
      continue
    }
    const sum = Object.values(nets).reduce((a, b) => a + b, 0)
    if (sum !== 0) {
      out.problems.push({ line, reason: `the columns don’t add up (off by ${sum})` })
      continue
    }
    const costValue = amount(cells[col('cost')] ?? '')
    const category = (cells[col('category')] ?? '').trim()
    out.rows.push({
      line,
      date,
      description,
      category,
      cost: costValue === null ? null : toMinor(costValue, currency),
      currency,
      nets,
      isPayment: /^payment$/i.test(category),
    })
  }
  return out
}

/* ------------------------------------------------------------------ planning */

export type PlannedItem =
  | {
      kind: 'bill'
      line: number
      date: string
      title: string
      category: CategoryId
      currency: string
      payer: string
      /** Person → their share (the payer's own share included when known). */
      shares: Record<string, Minor>
      total: Minor
      /** Part of a bill several people paid. */
      part: boolean
    }
  | { kind: 'payment'; line: number; date: string; currency: string; from: string; to: string; amount: Minor }

/** Pairs who's above zero with who's below, largest first; Σ of each side is the same. */
function pairUp(nets: Readonly<Record<string, Minor>>): Array<{ up: string; down: string; amount: Minor }> {
  const ups = Object.entries(nets).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }))
  const downs = Object.entries(nets).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }))
  const out: Array<{ up: string; down: string; amount: Minor }> = []
  const order = (a: { id: string; v: number }, b: { id: string; v: number }) => b.v - a.v || (a.id < b.id ? -1 : 1)
  while (ups.length > 0 && downs.length > 0) {
    ups.sort(order)
    downs.sort(order)
    const up = ups[0]
    const down = downs[0]
    if (!up || !down) break
    const amt = Math.min(up.v, down.v)
    out.push({ up: up.id, down: down.id, amount: amt })
    up.v -= amt
    down.v -= amt
    if (up.v === 0) ups.shift()
    if (down.v === 0) downs.shift()
  }
  return out
}

const CATEGORY_MAP: ReadonlyArray<[RegExp, CategoryId]> = [
  [/dining|food|restaurant|liquor|drink/i, 'food'],
  [/grocer/i, 'groceries'],
  [/rent|mortgage/i, 'rent'],
  [/electric|gas\/|heat|water|trash|internet|phone|tv|utilit|cleaning|maintenance/i, 'utilities'],
  [/hotel|plane|flight|travel|vacation/i, 'travel'],
  [/taxi|bus|train|car|fuel|parking|bicycle|transport/i, 'transport'],
  [/cloth|electronic|furniture|household|shopping/i, 'shopping'],
  [/movie|music|game|sport|entertain/i, 'entertainment'],
  [/gift/i, 'gift'],
  [/medical|health/i, 'health'],
]

export function mapCategory(splitwiseCategory: string, title: string, fromText: (t: string) => CategoryId | null): CategoryId {
  for (const [pattern, id] of CATEGORY_MAP) if (pattern.test(splitwiseCategory)) return id
  return fromText(title) ?? 'other'
}

export interface Plan {
  items: PlannedItem[]
  /** Rows with no money between people (someone's own spend): nothing to bring over. */
  skipped: number[]
}

/** What to add to Settle for the file's rows (names as the file has them). */
export function planSplitwise(file: SplitwiseFile, fromText: (t: string) => CategoryId | null): Plan {
  const items: PlannedItem[] = []
  const skipped: number[] = []
  for (const row of file.rows) {
    const pairs = pairUp(row.nets)
    if (pairs.length === 0) {
      skipped.push(row.line)
      continue
    }
    if (row.isPayment) {
      for (const p of pairs) items.push({ kind: 'payment', line: row.line, date: row.date, currency: row.currency, from: p.up, to: p.down, amount: p.amount })
      continue
    }
    const title = row.description || 'Bill'
    const category = mapCategory(row.category, title, fromText)
    const payers = Object.entries(row.nets).filter(([, v]) => v > 0)
    if (payers.length === 1) {
      const [payer, payerNet] = payers[0] as [string, Minor]
      const shares: Record<string, Minor> = {}
      for (const [id, v] of Object.entries(row.nets)) if (v < 0) shares[id] = -v
      // The payer's own share: the cost less what the others owed them (when the cost says so).
      const own = row.cost !== null ? row.cost - payerNet : 0
      if (own > 0) shares[payer] = own
      const total = Object.values(shares).reduce((a, b) => a + b, 0)
      items.push({ kind: 'bill', line: row.line, date: row.date, title, category, currency: row.currency, payer, shares, total, part: false })
      continue
    }
    // Paid by several people: one bill per payer, for what the others owed them.
    const byPayer = new Map<string, Record<string, Minor>>()
    for (const p of pairs) {
      const shares = byPayer.get(p.up) ?? {}
      shares[p.down] = (shares[p.down] ?? 0) + p.amount
      byPayer.set(p.up, shares)
    }
    for (const [payer, shares] of byPayer) {
      const total = Object.values(shares).reduce((a, b) => a + b, 0)
      items.push({ kind: 'bill', line: row.line, date: row.date, title, category, currency: row.currency, payer, shares, total, part: true })
    }
  }
  return { items, skipped }
}

/** Everyone's balance (paid − owe) after `items`, per currency — the same sum Splitwise shows. */
export function plannedBalances(items: readonly PlannedItem[]): Record<string, Record<string, Minor>> {
  const out: Record<string, Record<string, Minor>> = {}
  const add = (cur: string, id: string, v: Minor) => {
    const book = (out[cur] ??= {})
    book[id] = (book[id] ?? 0) + v
  }
  for (const item of items) {
    if (item.kind === 'payment') {
      add(item.currency, item.from, item.amount)
      add(item.currency, item.to, -item.amount)
      continue
    }
    for (const [id, share] of Object.entries(item.shares)) add(item.currency, id, -share)
    add(item.currency, item.payer, item.total)
  }
  return out
}

/**
 * Does the plan give everyone the balance the file's "Total balance" row says? The people (and
 * currencies) whose balance differs, with both numbers; empty when it all matches.
 */
export function checkTotals(file: SplitwiseFile, plan: Plan): Array<{ currency: string; person: string; splitwise: Minor; settle: Minor }> {
  const planned = plannedBalances(plan.items)
  const out: Array<{ currency: string; person: string; splitwise: Minor; settle: Minor }> = []
  for (const [currency, totals] of Object.entries(file.totals)) {
    for (const person of file.people) {
      const splitwise = totals[person] ?? 0
      const settle = planned[currency]?.[person] ?? 0
      if (splitwise !== settle) out.push({ currency, person, splitwise, settle })
    }
  }
  return out
}
