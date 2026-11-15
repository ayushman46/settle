/**
 * Why this payment? Everything Settle up needs to explain a line, worked out from the group's own
 * expenses and recorded payments (nothing is stored):
 *
 * - each person's account in the group (what they had, what they paid, loans, payments so far);
 * - the pairwise debts: who paid for whom, netted between the two people only;
 * - the direct list ("pay only people I actually owe"): those pairwise debts with closed circles
 *   taken out, so a payment only ever goes to someone the payer directly owes, never for more
 *   than that, and a settled group has nothing left to pay;
 * - for the usual (fewest payments) list, where each payment comes from: the direct debt between
 *   the two, a real chain of direct debts it replaces, or neither.
 *
 * Pure: no clock, no storage. Ties are broken by name (ids differ from phone to phone).
 */
import type { Expense, Group, Minor } from '../../domain/types'
import { simplifyDebts, type Transfer } from '../../engine/balances'

/* ------------------------------------------------------------------ types */

/** One person's side of the group. `balance` is exactly `paid − had + lent − borrowed + sent − received`. */
export interface PersonAccount {
  id: string
  /** Their own share of what the group spent (loans are not spending). */
  had: Minor
  /** The bills they paid, in full (their own share included). */
  paid: Minor
  /** Money they were lent inside the group. */
  borrowed: Minor
  /** Money they lent inside the group. */
  lent: Minor
  /** Recorded payments they made. */
  sent: Minor
  /** Recorded payments they got. */
  received: Minor
  /** + is owed money, − owes money. The same number as `groupBalances`. */
  balance: Minor
}

/** What is between two people only. `net` is exactly `paidFor − paidBack + lent − lentBack − sent + got`, and more than 0. */
export interface PairLedger {
  /** Who owes. */
  fromId: string
  /** Who is owed. */
  toId: string
  /** `to` paid this much for things `from` had. */
  paidFor: Minor
  /** `from` paid this much for things `to` had. */
  paidBack: Minor
  /** `to` lent `from` this much. */
  lent: Minor
  /** `from` lent `to` this much. */
  lentBack: Minor
  /** Recorded payments from `from` to `to`. */
  sent: Minor
  /** Recorded payments from `to` to `from`. */
  got: Minor
  net: Minor
}

/** A closed circle of direct debts (`path[0]` owes `path[1]` … the last owes `path[0]`): `amount` of each cancels out. */
export interface Loop {
  path: string[]
  amount: Minor
}

/** One bill behind a pairwise debt: what `from` had of a bill `to` paid. */
export interface PairEntry {
  expenseId: string
  title: string
  date: string
  amount: Minor
}

/** Where part of a fewest-payments line comes from. */
export type LinkPart =
  /** The two owe each other directly: `owed` is that whole direct debt, `amount` the part of this payment it covers. */
  | { kind: 'direct'; amount: Minor; owed: Minor }
  /**
   * A real chain of direct debts from the payer to the receiver (`path`, both ends included; `owed[i]` is what
   * `path[i]` directly owes `path[i + 1]`). `clean`: the chain is the whole payment, every debt in it is exactly
   * this amount, and the people in between are square, so those payments really do become one.
   */
  | { kind: 'chain'; amount: Minor; path: string[]; owed: Minor[]; clean: boolean }
  /** No chain to show for this part. */
  | { kind: 'rest'; amount: Minor }

export interface SideAccount {
  account: PersonAccount
  /** What they are short (payer) or owed (receiver) in the whole group. More than 0. */
  total: Minor
  /** The part of `total` that is not this payment (their other payments). 0 or more. */
  elsewhere: Minor
  /** Every part of the account is 0 or more, so it can be read out as it is. */
  plain: boolean
}

export interface PaymentCounts {
  /** Payments in the fewest-payments list. */
  simple: number
  /** Payments in the direct list. */
  direct: number
}

export interface SimpleExplanation {
  mode: 'simple'
  transfer: Transfer
  payer: SideAccount
  receiver: SideAccount
  /** Adds up to the payment, in reading order. Never empty. */
  link: LinkPart[]
  counts: PaymentCounts
}

export interface DirectExplanation {
  mode: 'direct'
  transfer: Transfer
  ledger: PairLedger
  /** Every part of the ledger is 0 or more. */
  plain: boolean
  /** `ledger.net − transfer.amount`: what circles took out. 0 or more. */
  cancelled: Minor
  /** The circles through these two. Their amounts add up to `cancelled`. */
  loops: Loop[]
  /** The bills that make up `ledger.paidFor`, biggest first. Their amounts add up to it. */
  bills: PairEntry[]
  counts: PaymentCounts
}

export type Explanation = SimpleExplanation | DirectExplanation
export type WhyMode = Explanation['mode']

export interface SettlePlan {
  accounts: Record<string, PersonAccount>
  /** The fewest payments (what Settle up has always shown). */
  simple: Transfer[]
  /** Only between people who directly owe each other. Biggest first, then by name. */
  direct: Transfer[]
  /** The circles taken out of the pairwise debts to make `direct`. */
  loops: Loop[]
  /** The two lists are not the same payments. */
  differs: boolean
  /** Pairwise debts (before circles), by who owes then who is owed. */
  ledgers: ReadonlyMap<string, ReadonlyMap<string, PairLedger>>
  /** For each fewest-payments line (payer, then receiver): where it comes from. */
  links: ReadonlyMap<string, ReadonlyMap<string, LinkPart[]>>
  /** The bills behind each pairwise debt (who had it, then who paid). */
  bills: ReadonlyMap<string, ReadonlyMap<string, PairEntry[]>>
}

/* ------------------------------------------------------------------ small tools */

type Table = Map<string, Map<string, number>>

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function bump(table: Table, a: string, b: string, amount: number): void {
  let row = table.get(a)
  if (!row) {
    row = new Map()
    table.set(a, row)
  }
  row.set(b, (row.get(b) ?? 0) + amount)
}

function at(table: ReadonlyMap<string, ReadonlyMap<string, number>>, a: string, b: string): number {
  return table.get(a)?.get(b) ?? 0
}

/**
 * Everyone's place in line: by name (case and spaces ignored), and only then by id. Two phones
 * that know the same names put people in the same order.
 */
export function nameOrder(ids: Iterable<string>, nameOf: (id: string) => string): Map<string, number> {
  const keyed = [...new Set(ids)].map((id) => ({ id, key: nameOf(id).trim().toLowerCase() }))
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return new Map(keyed.map((entry, index) => [entry.id, index]))
}

function ranked(ids: Iterable<string>, rank: ReadonlyMap<string, number>): string[] {
  return [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
}

/* ------------------------------------------------------------------ the books */

interface Books {
  accounts: Record<string, PersonAccount>
  /** who had it → who paid → how much (spending). */
  spend: Table
  /** who borrowed → who lent → how much. */
  loans: Table
  /** who paid → who got it → how much (recorded payments). */
  payments: Table
  bills: Map<string, Map<string, PairEntry[]>>
}

/** One pass over the group's own-currency expenses and its recorded payments, counted exactly as `groupBalances` counts them. */
function readBooks(group: Group, expenses: readonly Expense[]): Books {
  const accounts: Record<string, PersonAccount> = {}
  const account = (id: string): PersonAccount => (accounts[id] ??= { id, had: 0, paid: 0, borrowed: 0, lent: 0, sent: 0, received: 0, balance: 0 })
  for (const id of group.memberIds) account(id)
  const spend: Table = new Map()
  const loans: Table = new Map()
  const payments: Table = new Map()
  const bills = new Map<string, Map<string, PairEntry[]>>()

  for (const e of expenses) {
    if (e.groupId !== group.id || e.currency !== group.currency) continue
    const loan = e.kind === 'loan'
    const payer = account(e.payerId)
    for (const [id, raw] of Object.entries(e.shares)) {
      const share = num(raw)
      const own = id === e.payerId
      if (loan) {
        // A loan to yourself moves nothing.
        if (own) continue
        account(id).borrowed += share
        payer.lent += share
        if (share !== 0) bump(loans, id, e.payerId, share)
        continue
      }
      account(id).had += share
      payer.paid += share
      if (own || share === 0) continue
      bump(spend, id, e.payerId, share)
      let row = bills.get(id)
      if (!row) {
        row = new Map()
        bills.set(id, row)
      }
      const list = row.get(e.payerId)
      const entry: PairEntry = { expenseId: e.id, title: e.title, date: e.date, amount: share }
      if (list) list.push(entry)
      else row.set(e.payerId, [entry])
    }
  }

  for (const s of group.settlements) {
    if (!Number.isFinite(s.amount) || s.fromId === s.toId) continue
    account(s.fromId).sent += s.amount
    account(s.toId).received += s.amount
    if (s.amount !== 0) bump(payments, s.fromId, s.toId, s.amount)
  }

  for (const a of Object.values(accounts)) {
    const balance = a.paid - a.had + a.lent - a.borrowed + a.sent - a.received
    a.balance = balance === 0 ? 0 : balance
  }
  for (const row of bills.values()) {
    for (const list of row.values()) {
      list.sort((a, b) => b.amount - a.amount || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
    }
  }
  return { accounts, spend, loans, payments, bills }
}

/** Each person's account in the group. Balances are the same numbers `groupBalances` gives, and sum to 0. */
export function personAccounts(group: Group, expenses: readonly Expense[]): Record<string, PersonAccount> {
  return readBooks(group, expenses).accounts
}

function ledgersFrom(books: Books): PairLedger[] {
  const seen = new Map<string, Set<string>>()
  const out: PairLedger[] = []
  const visit = (a: string, b: string): void => {
    if (seen.get(a)?.has(b) || seen.get(b)?.has(a)) return
    let set = seen.get(a)
    if (!set) {
      set = new Set()
      seen.set(a, set)
    }
    set.add(b)
    // As if `a` owes `b`; turned round below when it is the other way.
    const one = (fromId: string, toId: string): PairLedger => {
      const paidFor = at(books.spend, fromId, toId)
      const paidBack = at(books.spend, toId, fromId)
      const lent = at(books.loans, fromId, toId)
      const lentBack = at(books.loans, toId, fromId)
      const sent = at(books.payments, fromId, toId)
      const got = at(books.payments, toId, fromId)
      return { fromId, toId, paidFor, paidBack, lent, lentBack, sent, got, net: paidFor - paidBack + lent - lentBack - sent + got }
    }
    const forward = one(a, b)
    if (forward.net > 0) out.push(forward)
    else if (forward.net < 0) out.push(one(b, a))
  }
  for (const table of [books.spend, books.loans, books.payments]) {
    for (const [a, row] of table) for (const b of row.keys()) visit(a, b)
  }
  return out
}

/**
 * Who paid for whom: for every two people with something between them, what one owes the other
 * counting only the bills one paid for the other, loans between them and payments between them.
 * Pairs that come to nothing are left out. For each person, what they owe less what they are owed
 * across their pairs is exactly what they owe the group.
 */
export function pairwiseDebts(group: Group, expenses: readonly Expense[]): PairLedger[] {
  return ledgersFrom(readBooks(group, expenses))
}

/* ------------------------------------------------------------------ circles */

/** The first closed circle of debts, walking people and who they owe in name order; null when there is none. */
function findLoop(edges: Table, order: readonly string[], next: ReadonlyMap<string, readonly string[]>): string[] | null {
  const done = new Set<string>()
  for (const start of order) {
    if (done.has(start)) continue
    const stack: Array<{ id: string; i: number }> = [{ id: start, i: 0 }]
    const onStack = new Set<string>([start])
    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (!top) break
      const options = next.get(top.id) ?? []
      let moved = false
      while (top.i < options.length) {
        const to = options[top.i++]
        if (to === undefined || at(edges, top.id, to) <= 0 || done.has(to)) continue
        if (onStack.has(to)) {
          const from = stack.findIndex((frame) => frame.id === to)
          return stack.slice(from).map((frame) => frame.id)
        }
        stack.push({ id: to, i: 0 })
        onStack.add(to)
        moved = true
        break
      }
      if (moved) continue
      done.add(top.id)
      onStack.delete(top.id)
      stack.pop()
    }
  }
  return null
}

/**
 * Takes closed circles out of a set of debts (A owes B, B owes C, C owes A: the smallest of the
 * three cancels out of each), until none is left. Nobody's total changes, no debt grows and no
 * new one appears. Changes `edges`; returns the circles, each starting at its first person by name.
 */
function cancelLoops(edges: Table, rank: ReadonlyMap<string, number>): Loop[] {
  const order = ranked(edges.keys(), rank)
  const next = new Map<string, string[]>()
  for (const [id, row] of edges) next.set(id, ranked(row.keys(), rank))
  const loops: Loop[] = []
  for (;;) {
    const cycle = findLoop(edges, order, next)
    if (!cycle) break
    let amount = Infinity
    cycle.forEach((id, i) => {
      amount = Math.min(amount, at(edges, id, cycle[(i + 1) % cycle.length] ?? id))
    })
    if (!(amount > 0) || amount === Infinity) break
    cycle.forEach((id, i) => {
      const to = cycle[(i + 1) % cycle.length] ?? id
      const left = at(edges, id, to) - amount
      const row = edges.get(id)
      if (left > 0) row?.set(to, left)
      else row?.delete(to)
    })
    let first = 0
    cycle.forEach((id, i) => {
      if ((rank.get(id) ?? 0) < (rank.get(cycle[first] ?? id) ?? 0)) first = i
    })
    loops.push({ path: [...cycle.slice(first), ...cycle.slice(0, first)], amount })
  }
  return loops
}

export interface DirectDebts {
  transfers: Transfer[]
  loops: Loop[]
}

/**
 * "Pay only people I actually owe": the pairwise debts, less any closed circles. Every payment goes
 * to someone the payer directly owes and is never more than that debt; each person pays and gets,
 * in total, exactly what the fewest-payments list has them pay or get; and when everyone is square
 * the list is empty. Biggest first, then by the payer's name, then the receiver's.
 */
export function directDebts(ledgers: readonly PairLedger[], nameOf: (id: string) => string): DirectDebts {
  const edges: Table = new Map()
  const ids: string[] = []
  for (const l of ledgers) {
    const amount = Math.round(l.net)
    if (!(amount > 0)) continue
    bump(edges, l.fromId, l.toId, amount)
    ids.push(l.fromId, l.toId)
  }
  const rank = nameOrder(ids, nameOf)
  const loops = cancelLoops(edges, rank)
  return { transfers: transfersOf(edges, rank), loops }
}

function transfersOf(edges: Table, rank: ReadonlyMap<string, number>): Transfer[] {
  const transfers: Transfer[] = []
  for (const [fromId, row] of edges) for (const [toId, amount] of row) if (amount > 0) transfers.push({ fromId, toId, amount })
  const r = (id: string): number => rank.get(id) ?? 0
  return transfers.sort((a, b) => b.amount - a.amount || r(a.fromId) - r(b.fromId) || r(a.toId) - r(b.toId))
}

/* ------------------------------------------------------------------ chains */

/** Longest chain worth reading out: payer, two people in between, receiver. */
export const MAX_CHAIN_STEPS = 3
/** Chains shown for one payment; anything beyond is left unexplained. */
const MAX_CHAINS = 2

/**
 * The shortest chain of debts from `fromId` to `toId` (both included), at most `maxSteps` debts
 * long, trying people in name order; null when there is none. Only debts of more than 0 count.
 */
export function findPath(
  edges: ReadonlyMap<string, ReadonlyMap<string, number>>,
  fromId: string,
  toId: string,
  rank: ReadonlyMap<string, number>,
  maxSteps: number = MAX_CHAIN_STEPS,
): string[] | null {
  if (fromId === toId || maxSteps < 1) return null
  const cameFrom = new Map<string, string>()
  const depth = new Map<string, number>([[fromId, 0]])
  const queue: string[] = [fromId]
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]
    if (id === undefined) break
    const d = depth.get(id) ?? 0
    if (d >= maxSteps) continue
    const row = edges.get(id)
    if (!row) continue
    for (const to of ranked(row.keys(), rank)) {
      if ((row.get(to) ?? 0) <= 0 || depth.has(to)) continue
      depth.set(to, d + 1)
      cameFrom.set(to, id)
      if (to === toId) {
        const path = [to]
        let step = id
        while (step !== fromId) {
          path.push(step)
          step = cameFrom.get(step) ?? fromId
        }
        path.push(fromId)
        return path.reverse()
      }
      queue.push(to)
    }
  }
  return null
}

/**
 * For each fewest-payments line, where it comes from in the direct debts. Each rupee of a direct
 * debt is given to one line only: first to the line between the same two people, then to chains
 * (lines taken in name order), so two lines never lean on the same debt twice.
 */
function linkTransfers(
  simple: readonly Transfer[],
  direct: readonly Transfer[],
  accounts: Readonly<Record<string, PersonAccount>>,
  rank: ReadonlyMap<string, number>,
): Map<string, Map<string, LinkPart[]>> {
  const owed: Table = new Map()
  const left: Table = new Map()
  for (const t of direct) {
    bump(owed, t.fromId, t.toId, t.amount)
    bump(left, t.fromId, t.toId, t.amount)
  }
  const r = (id: string): number => rank.get(id) ?? 0
  const lines = [...simple].sort((a, b) => r(a.fromId) - r(b.fromId) || r(a.toId) - r(b.toId))
  const parts = new Map<Transfer, LinkPart[]>()
  const todo = new Map<Transfer, number>()

  for (const t of lines) {
    const between = at(owed, t.fromId, t.toId)
    const amount = Math.min(t.amount, between)
    if (amount > 0) {
      parts.set(t, [{ kind: 'direct', amount, owed: between }])
      left.get(t.fromId)?.set(t.toId, between - amount)
    } else {
      parts.set(t, [])
    }
    todo.set(t, t.amount - Math.max(0, amount))
  }

  for (const t of lines) {
    const list = parts.get(t) ?? []
    let remaining = todo.get(t) ?? 0
    for (let chains = 0; remaining > 0 && chains < MAX_CHAINS; chains++) {
      const path = findPath(left, t.fromId, t.toId, rank)
      if (!path) break
      let amount = remaining
      for (let i = 0; i + 1 < path.length; i++) amount = Math.min(amount, at(left, path[i] ?? '', path[i + 1] ?? ''))
      if (!(amount > 0)) break
      const debts: number[] = []
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i] ?? ''
        const b = path[i + 1] ?? ''
        left.get(a)?.set(b, at(left, a, b) - amount)
        debts.push(at(owed, a, b))
      }
      list.push({ kind: 'chain', amount, path, owed: debts, clean: false })
      remaining -= amount
    }
    if (remaining > 0) list.push({ kind: 'rest', amount: remaining })
    const only = list.length === 1 ? list[0] : undefined
    if (only?.kind === 'chain') {
      only.clean = only.owed.every((debt) => debt === only.amount) && only.path.slice(1, -1).every((id) => (accounts[id]?.balance ?? 0) === 0)
    }
    parts.set(t, list)
  }

  const out = new Map<string, Map<string, LinkPart[]>>()
  for (const [t, list] of parts) {
    let row = out.get(t.fromId)
    if (!row) {
      row = new Map()
      out.set(t.fromId, row)
    }
    row.set(t.toId, list)
  }
  return out
}

/* ------------------------------------------------------------------ the plan */

function sameTransfers(a: readonly Transfer[], b: readonly Transfer[]): boolean {
  if (a.length !== b.length) return false
  const table: Table = new Map()
  for (const t of a) bump(table, t.fromId, t.toId, t.amount)
  return b.every((t) => at(table, t.fromId, t.toId) === t.amount)
}

/**
 * Both ways of settling a group, and what is needed to explain any line of either.
 * `nameOf` gives people's real names (the owner's too): it only decides the order of ties.
 */
export function settlePlan(group: Group, expenses: readonly Expense[], nameOf: (id: string) => string): SettlePlan {
  const books = readBooks(group, expenses)
  const balances: Record<string, Minor> = {}
  for (const a of Object.values(books.accounts)) balances[a.id] = a.balance
  const simple = simplifyDebts(balances)

  const ledgerList = ledgersFrom(books)
  const ledgers = new Map<string, Map<string, PairLedger>>()
  for (const l of ledgerList) {
    let row = ledgers.get(l.fromId)
    if (!row) {
      row = new Map()
      ledgers.set(l.fromId, row)
    }
    row.set(l.toId, l)
  }
  const { transfers: direct, loops } = directDebts(ledgerList, nameOf)
  const rank = nameOrder(Object.keys(books.accounts), nameOf)
  return {
    accounts: books.accounts,
    simple,
    direct,
    loops,
    differs: !sameTransfers(simple, direct),
    ledgers,
    links: linkTransfers(simple, direct, books.accounts, rank),
    bills: books.bills,
  }
}

/** What each person pays less what they get, over a list of payments (people with nothing are left out). */
export function netPayments(transfers: readonly Transfer[]): Record<string, Minor> {
  const out: Record<string, Minor> = {}
  for (const t of transfers) {
    out[t.fromId] = (out[t.fromId] ?? 0) + t.amount
    out[t.toId] = (out[t.toId] ?? 0) - t.amount
  }
  for (const [id, value] of Object.entries(out)) if (value === 0) delete out[id]
  return out
}

/* ------------------------------------------------------------------ explaining one line */

function plainAccount(a: PersonAccount): boolean {
  return a.had >= 0 && a.paid >= 0 && a.borrowed >= 0 && a.lent >= 0 && a.sent >= 0 && a.received >= 0
}

function isMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

/**
 * Why `transfer` is in the list `mode` shows, with the numbers behind it. Null when the line is
 * not one of the plan's, or its numbers do not add up the way the explanation would say: then
 * there is nothing true to tell, and nothing is told.
 */
export function explainTransfer(plan: SettlePlan, transfer: Transfer, mode: WhyMode): Explanation | null {
  const { fromId, toId, amount } = transfer
  if (!isMoney(amount) || fromId === toId) return null
  const counts: PaymentCounts = { simple: plan.simple.length, direct: plan.direct.length }

  if (mode === 'direct') {
    if (!plan.direct.some((t) => t.fromId === fromId && t.toId === toId && t.amount === amount)) return null
    const ledger = plan.ledgers.get(fromId)?.get(toId)
    if (!ledger) return null
    const cancelled = ledger.net - amount
    const loops = plan.loops.filter((loop) => loop.path.some((id, i) => id === fromId && loop.path[(i + 1) % loop.path.length] === toId))
    if (cancelled < 0 || loops.reduce((sum, loop) => sum + loop.amount, 0) !== cancelled) return null
    const bills = plan.bills.get(fromId)?.get(toId) ?? []
    const plain = [ledger.paidFor, ledger.paidBack, ledger.lent, ledger.lentBack, ledger.sent, ledger.got].every((v) => v >= 0)
    return { mode, transfer: { fromId, toId, amount }, ledger, plain, cancelled, loops, bills: plain ? bills : [], counts }
  }

  if (!plan.simple.some((t) => t.fromId === fromId && t.toId === toId && t.amount === amount)) return null
  const payer = plan.accounts[fromId]
  const receiver = plan.accounts[toId]
  if (!payer || !receiver) return null
  const short = -payer.balance
  const over = receiver.balance
  if (!isMoney(short) || !isMoney(over) || amount > short || amount > over) return null
  const link = plan.links.get(fromId)?.get(toId)
  const parts: LinkPart[] = link && link.length > 0 && link.reduce((sum, part) => sum + part.amount, 0) === amount ? link : [{ kind: 'rest', amount }]
  return {
    mode,
    transfer: { fromId, toId, amount },
    payer: { account: payer, total: short, elsewhere: short - amount, plain: plainAccount(payer) },
    receiver: { account: receiver, total: over, elsewhere: over - amount, plain: plainAccount(receiver) },
    link: parts,
    counts,
  }
}
