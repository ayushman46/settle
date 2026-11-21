/**
 * Proof of repayments: every rupee your friends paid you back, with what it was for, in one
 * statement. Two real problems it answers, with nothing to fill in:
 *
 * - A bank holds or freezes an account over a payment that came in (cyber-crime complaints and
 *   "mule account" checks hit people who collect money from a group). Banks and courts ask what
 *   each payment was for; this lists each one with the date, who sent it, the UPI reference when
 *   Settle saw it, and the shared bills it paid for.
 * - The Income-tax Act taxes gifts from people who aren't relatives once they add up to more than
 *   ₹50,000 in a year. Money paid back for a shared bill is shown here apart from gifts (the Shagun
 *   book), so it's clear which is which. A record, not tax advice.
 *
 * Sources: payments recorded in groups (and the bills each paid for, see Paid for what), shares
 * ticked off as paid back on bills outside groups, loans returned, UPI references read from
 * screenshots, and gifts received in the Shagun book. Pure: no clock, no storage.
 */
import type { ProofRef } from '../../data/stores'
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { isSettledInGroup } from '../../engine/balances'
import { groupCover } from '../paidfor/engine'
import type { ShagunEntry } from '../shagun/types'

export type ReceivedKind = 'repayment' | 'loan'

export interface ForBill {
  expenseId: string
  title: string
  date: string
  /** The bill's whole amount, and what this payment paid of it. */
  total: Minor
  amount: Minor
}

export interface ReceivedLine {
  /** YYYY-MM-DD the money came (for a share ticked off: the day it was ticked). */
  date: string
  fromId: string
  amount: Minor
  currency: string
  kind: ReceivedKind
  /** "UPI", "Cash", "Other", or null when not recorded. */
  method: 'upi' | 'cash' | 'other' | null
  /** The UPI reference (UTR), when Settle read it from a payment screenshot. */
  utr: string | null
  groupName: string | null
  forBills: ForBill[]
  /** Money paid ahead of any bill (counts towards later ones). */
  ahead: Minor
  /** Only part of a share, ticked without a date (the day shown is the day it was last updated). */
  undated: boolean
}

export interface GiftLine {
  date: string
  name: string
  amount: Minor
  gift: string | null
}

export interface Statement {
  from: string
  to: string
  lines: ReceivedLine[]
  gifts: GiftLine[]
  /** Per currency. */
  totals: Record<string, { repayments: Minor; loans: Minor }>
  giftsTotal: Minor
}

export interface StatementInput {
  expenses: readonly Expense[]
  groups: readonly Group[]
  proofRefs: readonly ProofRef[]
  shagun: readonly ShagunEntry[]
  /** Inclusive YYYY-MM-DD bounds. */
  from: string
  to: string
  /** Only this person (null: everyone). */
  personId?: string | null
  /** Local date for an epoch (injected so the engine has no clock or time zone). */
  dayOf: (epochMs: number) => string
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to

/** The Indian financial year a date falls in: 1 April to 31 March. */
export function financialYear(date: string): { from: string; to: string; label: string } {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const start = month >= 4 ? year : year - 1
  return { from: `${start}-04-01`, to: `${start + 1}-03-31`, label: `FY ${start}–${String((start + 1) % 100).padStart(2, '0')}` }
}

export function buildStatement(input: StatementInput): Statement {
  const { expenses, groups, from, to, dayOf } = input
  const lines: ReceivedLine[] = []
  const byId = new Map(expenses.map((e) => [e.id, e]))

  // 1. Payments recorded in groups, to you, and what each paid for.
  for (const group of groups) {
    const mine = group.settlements.filter((s) => s.toId === ME_ID && s.fromId !== ME_ID && s.amount > 0 && inRange(s.date, from, to))
    if (mine.length === 0) continue
    const cover = groupCover(group, expenses)
    for (const s of mine) {
      const paid = cover.payments[s.id]
      lines.push({
        date: s.date,
        fromId: s.fromId,
        amount: s.amount,
        currency: group.currency,
        kind: 'repayment',
        method: s.method,
        utr: null,
        groupName: group.name,
        forBills: (paid?.bills ?? []).map((b) => {
          const e = byId.get(b.expenseId)
          return { expenseId: b.expenseId, title: e?.title ?? '', date: e?.date ?? '', total: e?.total ?? 0, amount: b.amount }
        }),
        ahead: paid?.extra ?? 0,
        undated: false,
      })
    }
  }

  // 2. Bills outside groups that you paid: shares ticked off as paid back, and part payments.
  for (const e of expenses) {
    if (e.payerId !== ME_ID || isSettledInGroup(e, groups)) continue
    const kind: ReceivedKind = e.kind === 'loan' ? 'loan' : 'repayment'
    const bill = (amount: Minor): ForBill[] => (kind === 'loan' ? [] : [{ expenseId: e.id, title: e.title, date: e.date, total: e.total, amount }])
    for (const [id, at] of Object.entries(e.paidBack)) {
      if (id === ME_ID) continue
      const share = e.shares[id] ?? 0
      const date = dayOf(at)
      if (share <= 0 || !inRange(date, from, to)) continue
      lines.push({ date, fromId: id, amount: share, currency: e.currency, kind, method: null, utr: null, groupName: null, forBills: bill(share), ahead: 0, undated: false })
    }
    for (const [id, amount] of Object.entries(e.partPaid ?? {})) {
      if (id === ME_ID || amount <= 0 || e.paidBack[id] !== undefined) continue
      const date = dayOf(e.updatedAt)
      if (!inRange(date, from, to)) continue
      lines.push({ date, fromId: id, amount, currency: e.currency, kind, method: null, utr: null, groupName: null, forBills: bill(amount), ahead: 0, undated: true })
    }
  }

  // 3. UPI references read from screenshots: the same person and amount, within a week.
  const refs = [...input.proofRefs]
  for (const line of lines) {
    const at = refs.findIndex((r) => r.friendId === line.fromId && r.amount === line.amount && Math.abs(daysApart(dayOf(r.at), line.date)) <= 7)
    if (at >= 0) {
      line.utr = refs[at]?.utr ?? null
      line.method ??= 'upi'
      refs.splice(at, 1)
    }
  }

  const filtered = input.personId ? lines.filter((l) => l.fromId === input.personId) : lines
  filtered.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.fromId < b.fromId ? -1 : 1))

  const totals: Statement['totals'] = {}
  for (const l of filtered) {
    const t = (totals[l.currency] ??= { repayments: 0, loans: 0 })
    if (l.kind === 'loan') t.loans += l.amount
    else t.repayments += l.amount
  }

  const gifts = input.personId
    ? []
    : input.shagun
        .filter((g) => g.direction === 'received' && g.amount > 0 && inRange(g.date, from, to))
        .map((g) => ({ date: g.date, name: g.name, amount: g.amount, gift: g.gift }))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const giftsTotal = gifts.reduce((sum, g) => sum + g.amount, 0)
  return { from, to, lines: filtered, gifts, totals, giftsTotal }
}

function daysApart(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)
}

/** The statement as CSV, for a bank, a CA or a spreadsheet. */
export function statementCsv(s: Statement, nameOf: (id: string) => string, money: (minor: Minor, currency: string) => string): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [['Date', 'From', 'Amount', 'Currency', 'Type', 'Method', 'UPI reference', 'Group', 'Paid for'].join(',')]
  for (const l of s.lines) {
    const paidFor = l.forBills.map((b) => `${b.title} (${b.date}) ${money(b.amount, l.currency)}`).join('; ') + (l.ahead > 0 ? `${l.forBills.length ? '; ' : ''}paid ahead ${money(l.ahead, l.currency)}` : '')
    rows.push(
      [l.date, nameOf(l.fromId), money(l.amount, l.currency), l.currency, l.kind === 'loan' ? 'Loan returned' : 'Repayment for shared bills', l.method ?? '', l.utr ?? '', l.groupName ?? '', paidFor]
        .map((v) => esc(String(v)))
        .join(','),
    )
  }
  for (const g of s.gifts) rows.push([g.date, g.name, money(g.amount, 'INR'), 'INR', 'Gift (Shagun book)', '', '', '', g.gift ?? ''].map((v) => esc(String(v))).join(','))
  return rows.join('\r\n') + '\r\n'
}
