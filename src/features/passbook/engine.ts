/**
 * Statement: a passbook between me and one friend. Every bill one of us paid for the other, every
 * loan and every payment, oldest first, with a running balance (+ they owe me, − I owe them).
 *
 * The closing balance is the friend page's balance (`friendBalance`), always:
 * - outside groups, a bill adds the share and each payment (ticked off, or part paid) takes it off,
 *   which is exactly what is still owed;
 * - inside a group, the bills and payments between the two of us are listed as they happened, and
 *   where the group's fewest-payments settling makes the two of us pay each other a different
 *   amount, one line per group says so and carries the difference.
 * Money in different currencies is never mixed: one ledger each.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { stillOwed } from '../../engine/balances'
import { addMonths, dateInPeriod, isIsoDate, periodOf, toIsoDate } from '../../engine/dates'
import { friendBalance } from '../friends/friendBalance'

export const PASSBOOK_RANGES = ['month', 'three', 'all'] as const
/** This month, the last three months, or everything. */
export type PassbookRange = (typeof PASSBOOK_RANGES)[number]

export type PassbookKind =
  /** I paid a bill; this is their share of it. */
  | 'paidForThem'
  /** They paid a bill; this is my share of it. */
  | 'paidForYou'
  /** Money I handed them (udhaar). */
  | 'lent'
  /** Money they handed me. */
  | 'borrowed'
  /** They paid me: a share ticked off, a part payment, or a payment recorded in a group. */
  | 'theyPaid'
  /** I paid them. */
  | 'youPaid'
  /** A group settles in the fewest payments: the difference that makes for the two of us. */
  | 'group'

export interface PassbookEntry {
  id: string
  /** YYYY-MM-DD. */
  date: string
  kind: PassbookKind
  /** The bill's or loan's title; empty for a payment recorded in a group and for a group's line. */
  title: string
  expenseId: string | null
  groupId: string | null
  groupName: string | null
  /** A part payment (the rest of the share is still open). */
  part: boolean
  /** + they owe me this much more, − this much less. Never 0. */
  amount: Minor
  /** The running balance after this entry: + they owe me, − I owe them. */
  balance: Minor
}

export interface PassbookAdjustment {
  groupId: string
  groupName: string
  amount: Minor
}

export interface PassbookLedger {
  currency: string
  /** The balance before the first entry shown. */
  opening: Minor
  /** The balance after the last entry: what the friend page shows in this currency. */
  closing: Minor
  /** Σ of the + entries shown ("you gave"). */
  gave: Minor
  /** Σ of the − entries shown, as a positive number ("you got"). */
  got: Minor
  /** The entries in the dates asked for, oldest first. */
  entries: PassbookEntry[]
  /** How many earlier entries the opening balance stands for. */
  earlier: number
  /** Groups whose settling changed the total, and by how much (each also has its own entry). */
  adjusted: PassbookAdjustment[]
  /** The closing balance is the friend page's balance (it always should be; the screen only says so when it is). */
  matches: boolean
}

export interface Passbook {
  /** First day shown, or null for everything. */
  from: string | null
  /** The day it was made. */
  to: string
  /** One per currency: the asked-for currency first, then A–Z. */
  ledgers: PassbookLedger[]
  /** Every entry there is, in any currency, whatever the dates. */
  count: number
}

export interface PassbookInput {
  friendId: string
  expenses: readonly Expense[]
  groups: readonly Group[]
  /** The profile currency: its ledger comes first. */
  currency: string
  /** YYYY-MM-DD. */
  today: string
  range?: PassbookRange
  meId?: string
}

/** The first day a range shows, or null for everything. "Three months" runs from the same day three months back. */
export function rangeStart(range: PassbookRange, today: string): string | null {
  if (range === 'all' || !isIsoDate(today)) return null
  if (range === 'month') return `${periodOf(today)}-01`
  return dateInPeriod(addMonths(periodOf(today), -3), Number(today.slice(8, 10)))
}

interface Raw {
  id: string
  date: string
  /** Orders entries of the same day: when each was written down. */
  at: number
  /** A bill before its own payment, whatever the clocks said. */
  step: number
  kind: PassbookKind
  title: string
  expenseId: string | null
  groupId: string | null
  groupName: string | null
  part: boolean
  amount: Minor
}

function share(e: Pick<Expense, 'shares'>, id: string): Minor {
  const v = e.shares[id]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

function stamp(ms: number | undefined, fallback: number): number {
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : fallback
}

/** The local day of a moment, never before `notBefore` (a bill re-dated after it was paid back). */
function dayOf(ms: number, notBefore: string): string {
  const day = toIsoDate(new Date(ms))
  return isIsoDate(day) && day > notBefore ? day : notBefore
}

function byTime(a: Raw, b: Raw): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.expenseId !== null && a.expenseId === b.expenseId) return a.step - b.step
  return a.at - b.at || a.step - b.step || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** `first` before everything else, then A–Z. */
function byCurrency(a: string, b: string, first: string): number {
  if (a === b) return 0
  if (a === first) return -1
  if (b === first) return 1
  return a < b ? -1 : 1
}

/**
 * The passbook between `meId` and `friendId`. Pure: `today` comes in, nothing is read from the clock
 * (a payment's day is the day its own timestamp fell on).
 */
export function passbook(input: PassbookInput): Passbook {
  const { friendId, expenses, groups, currency, today } = input
  const meId = input.meId ?? ME_ID
  const from = rangeStart(input.range ?? 'all', today)
  if (friendId === meId || friendId === '') return { from, to: today, ledgers: [], count: 0 }

  // The first group with an id wins, as in `isSettledInGroup`.
  const groupsById = new Map<string, Group>()
  for (const g of groups) if (!groupsById.has(g.id)) groupsById.set(g.id, g)

  const raws = new Map<string, Raw[]>()
  const push = (code: string, raw: Raw): void => {
    const list = raws.get(code)
    if (list) list.push(raw)
    else raws.set(code, [raw])
  }
  /** Group → what the bills and payments between the two of us add up to there. */
  const direct = new Map<string, Minor>()

  for (const e of expenses) {
    const mine = e.payerId === meId
    if (!mine && e.payerId !== friendId) continue
    const debtor = mine ? friendId : meId
    const owed = share(e, debtor)
    if (owed === 0) continue
    const sign = mine ? 1 : -1
    const group = e.groupId === null ? undefined : groupsById.get(e.groupId)
    const loan = e.kind === 'loan'
    push(e.currency, {
      id: `e:${e.id}`,
      date: e.date,
      at: stamp(e.createdAt, 0),
      step: 0,
      kind: mine ? (loan ? 'lent' : 'paidForThem') : loan ? 'borrowed' : 'paidForYou',
      title: e.title,
      expenseId: e.id,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      part: false,
      amount: sign * owed,
    })
    if (group !== undefined && group.currency === e.currency) {
      // Settled through the group's balances: its payments are the group's own (below).
      direct.set(group.id, (direct.get(group.id) ?? 0) + sign * owed)
      continue
    }
    // Outside a group: what has been paid of the share is the share less what is still owed.
    const paid = owed - stillOwed(e, debtor)
    if (paid <= 0) continue
    const tickedAt = e.paidBack[debtor]
    const whole = tickedAt !== undefined
    const at = whole ? stamp(tickedAt, stamp(e.updatedAt, 0)) : stamp(e.updatedAt, stamp(e.createdAt, 0))
    push(e.currency, {
      id: `p:${e.id}`,
      date: dayOf(at, e.date),
      at,
      step: 1,
      kind: mine ? 'theyPaid' : 'youPaid',
      title: e.title,
      expenseId: e.id,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      part: !whole,
      amount: -sign * paid,
    })
  }

  for (const group of groupsById.values()) {
    for (const s of group.settlements) {
      if (!Number.isFinite(s.amount) || s.amount === 0 || s.fromId === s.toId) continue
      const theyPaid = s.fromId === friendId && s.toId === meId
      if (!theyPaid && !(s.fromId === meId && s.toId === friendId)) continue
      const amount = theyPaid ? -s.amount : s.amount
      push(group.currency, {
        id: `s:${group.id}:${s.id}`,
        date: isIsoDate(s.date) ? s.date : dayOf(stamp(s.createdAt, 0), '0001-01-01'),
        at: stamp(s.createdAt, 0),
        step: 1,
        kind: amount < 0 ? 'theyPaid' : 'youPaid',
        title: '',
        expenseId: null,
        groupId: group.id,
        groupName: group.name,
        part: false,
        amount,
      })
      direct.set(group.id, (direct.get(group.id) ?? 0) + amount)
    }
  }

  // Where a group's fewest-payments settling has the two of us pay each other something else, one line says so.
  const page = friendBalance(friendId, expenses, groups, currency, meId)
  const pageGroups = new Map<string, Minor>()
  for (const s of page.sources) if (s.kind === 'group') pageGroups.set(s.group.id, (pageGroups.get(s.group.id) ?? 0) + s.amount)
  const adjustedBy = new Map<string, PassbookAdjustment[]>()
  let order = 0
  for (const group of groupsById.values()) {
    const diff = (pageGroups.get(group.id) ?? 0) - (direct.get(group.id) ?? 0)
    if (diff === 0) continue
    push(group.currency, {
      id: `g:${group.id}`,
      date: today,
      at: Number.MAX_SAFE_INTEGER,
      step: 2 + order++,
      kind: 'group',
      title: '',
      expenseId: null,
      groupId: group.id,
      groupName: group.name,
      part: false,
      amount: diff,
    })
    const list = adjustedBy.get(group.currency) ?? []
    list.push({ groupId: group.id, groupName: group.name, amount: diff })
    adjustedBy.set(group.currency, list)
  }

  const ledgers: PassbookLedger[] = []
  let count = 0
  for (const code of [...raws.keys()].sort((a, b) => byCurrency(a, b, currency))) {
    const all = (raws.get(code) ?? []).slice()
    // A group's line always closes the statement, whatever a future-dated bill says.
    all.sort((a, b) => (a.kind === 'group' ? 1 : 0) - (b.kind === 'group' ? 1 : 0) || byTime(a, b))
    count += all.length
    let balance = 0
    let opening = 0
    let earlier = 0
    let gave = 0
    let got = 0
    const entries: PassbookEntry[] = []
    for (const raw of all) {
      balance += raw.amount
      if (from !== null && raw.kind !== 'group' && raw.date < from) {
        opening = balance
        earlier += 1
        continue
      }
      if (raw.amount > 0) gave += raw.amount
      else got -= raw.amount
      entries.push({
        id: raw.id,
        date: raw.date,
        kind: raw.kind,
        title: raw.title,
        expenseId: raw.expenseId,
        groupId: raw.groupId,
        groupName: raw.groupName,
        part: raw.part,
        amount: raw.amount,
        balance,
      })
    }
    const onPage = page.totals.find((total) => total.currency === code)?.amount ?? 0
    ledgers.push({
      currency: code,
      opening,
      closing: balance,
      gave,
      got,
      entries,
      earlier,
      adjusted: adjustedBy.get(code) ?? [],
      matches: balance === onPage,
    })
  }
  return { from, to: today, ledgers, count }
}
