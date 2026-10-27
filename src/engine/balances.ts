/**
 * Who owes whom. Balances are signed integer minor units per friend: positive = is owed money,
 * negative = owes money. Every function is pure and keeps the books balanced to the paisa.
 */
import type { Expense, Group, Minor } from '../domain/types'

export interface Transfer {
  fromId: string
  toId: string
  amount: Minor
}

export interface OverallSummary {
  /** The profile currency; the totals below are in it. */
  currency: string
  /** Σ of what friends owe me, net per friend. */
  owedToMe: Minor
  /** Σ of what I owe friends, net per friend. */
  iOwe: Minor
  /** friendId → + they owe me, − I owe them (profile currency, non-zero entries only). */
  byFriend: Record<string, Minor>
  /** The same totals for money in other currencies (never converted). */
  otherCurrencies: Record<string, { owedToMe: Minor; iOwe: Minor }>
}

function add(map: Record<string, Minor>, id: string, amount: Minor): void {
  const next = (map[id] ?? 0) + amount
  map[id] = next === 0 ? 0 : next
}

function shareOf(e: Pick<Expense, 'shares'>, id: string): Minor {
  const v = e.shares[id]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * What `id` still owes the payer on a standalone expense: their share, less what they've paid of it
 * (`partPaid`); 0 once they're ticked off as paid back.
 */
export function stillOwed(e: Pick<Expense, 'shares' | 'paidBack' | 'partPaid'>, id: string): Minor {
  if (e.paidBack[id] !== undefined) return 0
  return Math.max(0, shareOf(e, id) - (e.partPaid?.[id] ?? 0))
}

/** One expense's effect on everyone: payer +(total − own share), everyone else −share. Σ === 0. */
export function expenseNet(e: Expense): Record<string, Minor> {
  const net: Record<string, Minor> = {}
  let othersOwe = 0
  for (const [id, raw] of Object.entries(e.shares)) {
    if (id === e.payerId) continue
    const share = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    add(net, id, -share)
    othersOwe += share
  }
  add(net, e.payerId, othersOwe)
  return net
}

/**
 * Net balance of every member of a group: the group's expenses (in the group's currency) plus
 * recorded settlements (the sender's balance goes up, the receiver's down). Σ === 0.
 * Members with nothing outstanding are listed with 0; former members still owed are kept.
 */
export function groupBalances(group: Group, expenses: readonly Expense[]): Record<string, Minor> {
  const balances: Record<string, Minor> = {}
  for (const id of group.memberIds) balances[id] = 0
  for (const e of expenses) {
    if (e.groupId !== group.id || e.currency !== group.currency) continue
    for (const [id, amount] of Object.entries(expenseNet(e))) add(balances, id, amount)
  }
  for (const s of group.settlements) {
    if (!Number.isFinite(s.amount) || s.fromId === s.toId) continue
    add(balances, s.fromId, s.amount)
    add(balances, s.toId, -s.amount)
  }
  return balances
}

/** Largest amount first; ties broken by id so the result never depends on input order. */
function byAmountThenId(a: { id: string; amount: Minor }, b: { id: string; amount: Minor }): number {
  return b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * The payments that square everyone up: the largest debtor pays the largest creditor, again
 * and again. Each payment clears at least one person, so n people need at most n − 1 payments.
 * Deterministic, and when the balances sum to zero they settle exactly.
 */
export function simplifyDebts(balances: Readonly<Record<string, Minor>>): Transfer[] {
  const debtors: Array<{ id: string; amount: Minor }> = []
  const creditors: Array<{ id: string; amount: Minor }> = []
  for (const [id, raw] of Object.entries(balances)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const amount = Math.round(raw)
    if (amount < 0) debtors.push({ id, amount: -amount })
    else if (amount > 0) creditors.push({ id, amount })
  }

  const transfers: Transfer[] = []
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountThenId)
    creditors.sort(byAmountThenId)
    const debtor = debtors[0]
    const creditor = creditors[0]
    if (!debtor || !creditor) break
    const amount = Math.min(debtor.amount, creditor.amount)
    transfers.push({ fromId: debtor.id, toId: creditor.id, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) debtors.shift()
    if (creditor.amount === 0) creditors.shift()
  }
  return transfers
}

/**
 * True when an expense is settled through its group's balances: it belongs to an existing group
 * and is in that group's currency. Anything else (no group, a deleted group, another currency)
 * is settled person-to-person by ticking shares off as paid back.
 */
export function isSettledInGroup(e: Pick<Expense, 'groupId' | 'currency'>, groups: readonly Group[]): boolean {
  if (e.groupId === null) return false
  const group = groups.find((g) => g.id === e.groupId)
  return group !== undefined && group.currency === e.currency
}

/**
 * Where I stand with everyone. Standalone expenses count each unpaid share between me and the
 * payer (ticking someone off as paid clears it). Group expenses count the simplified group
 * payments that involve me (see `isSettledInGroup`). Per friend, what we owe each other is netted; totals sum the nets.
 */
export function overallSummary(
  expenses: readonly Expense[],
  groups: readonly Group[],
  meId: string,
  currency: string,
): OverallSummary {
  // currency → friendId → net (+ they owe me)
  const nets = new Map<string, Record<string, Minor>>()
  const netsIn = (code: string): Record<string, Minor> => {
    let map = nets.get(code)
    if (!map) {
      map = {}
      nets.set(code, map)
    }
    return map
  }

  for (const e of expenses) {
    if (isSettledInGroup(e, groups)) continue
    const map = netsIn(e.currency)
    if (e.payerId === meId) {
      for (const id of Object.keys(e.shares)) {
        const owed = id === meId ? 0 : stillOwed(e, id)
        if (owed > 0) add(map, id, owed)
      }
    } else {
      const mine = stillOwed(e, meId)
      if (mine > 0) add(map, e.payerId, -mine)
    }
  }

  for (const group of groups) {
    const transfers = simplifyDebts(groupBalances(group, expenses))
    const map = netsIn(group.currency)
    for (const t of transfers) {
      if (t.toId === meId) add(map, t.fromId, t.amount)
      else if (t.fromId === meId) add(map, t.toId, -t.amount)
    }
  }

  const totals = (map: Record<string, Minor>) => {
    let owedToMe = 0
    let iOwe = 0
    for (const v of Object.values(map)) {
      if (v > 0) owedToMe += v
      else iOwe -= v
    }
    return { owedToMe, iOwe }
  }

  const byFriend: Record<string, Minor> = {}
  for (const [id, v] of Object.entries(nets.get(currency) ?? {})) if (v !== 0) byFriend[id] = v
  const otherCurrencies: Record<string, { owedToMe: Minor; iOwe: Minor }> = {}
  for (const [code, map] of [...nets.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (code === currency) continue
    const t = totals(map)
    if (t.owedToMe !== 0 || t.iOwe !== 0) otherCurrencies[code] = t
  }
  return { currency, ...totals(byFriend), byFriend, otherCurrencies }
}

/**
 * Collection progress on one expense: how much of what the others owe the payer has been
 * ticked off as paid back. People with a zero share are not counted.
 */
export function collectProgress(e: Expense): {
  collected: Minor
  outstanding: Minor
  total: Minor
  paidCount: number
  peopleCount: number
} {
  let total = 0
  let collected = 0
  let paidCount = 0
  let peopleCount = 0
  for (const [id, share] of Object.entries(e.shares)) {
    if (id === e.payerId || !(share > 0)) continue
    total += share
    peopleCount += 1
    if (e.paidBack[id] !== undefined) {
      collected += share
      paidCount += 1
    } else {
      collected += share - stillOwed(e, id)
    }
  }
  return { collected, outstanding: total - collected, total, paidCount, peopleCount }
}

export interface ExpenseStanding {
  /** I paid for it, I owe the payer, or I'm not part of it. */
  role: 'paid' | 'owe' | 'none'
  /** My own share of the expense. */
  myShare: Minor
  /** What the expense means for me on its own: + I lent this much, − I borrowed this much. */
  net: Minor
  /**
   * What's still open on this expense between me and others: + still owed to me, − I still owe.
   * Null for expenses settled through their group's balances (see `isSettledInGroup`).
   */
  outstanding: Minor | null
  /** People who still have to pay me back (when I paid). */
  pending: number
}

/** One expense from my point of view — for list rows ("you lent ₹540 · 2 pending") and filters. */
export function expenseStanding(e: Expense, meId: string, groups: readonly Group[] = []): ExpenseStanding {
  const myShare = shareOf(e, meId)
  const net = expenseNet(e)[meId] ?? 0
  const role = e.payerId === meId ? 'paid' : myShare > 0 ? 'owe' : 'none'
  if (isSettledInGroup(e, groups)) return { role, myShare, net, outstanding: null, pending: 0 }
  if (role === 'paid') {
    const progress = collectProgress(e)
    return { role, myShare, net, outstanding: progress.outstanding, pending: progress.peopleCount - progress.paidCount }
  }
  const outstanding = role === 'owe' ? -stillOwed(e, meId) : 0
  return { role, myShare, net, outstanding: outstanding === 0 ? 0 : outstanding, pending: 0 }
}
