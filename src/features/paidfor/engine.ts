/**
 * Paid for what: in a group, which bills each person has paid their part of, and which bills each
 * payment covered. Splitwise's most-voted idea ("apply payment directly to expense", 985 votes,
 * still not planned) — done here with no extra step: nobody tags a payment, Settle works it out.
 *
 * The rule, per person: their shares of bills somebody else paid are debts, oldest bill first.
 * What covers them is their own money in the group — first what they paid for other people (a
 * bill they fronted), then each payment they sent, in order. Money they were sent back undoes
 * cover, newest first. How much is covered always equals what their balance says, to the paisa:
 * covered = clamp(balance + debts, 0, debts). So a person with a zero balance has paid every part,
 * and someone who owes ₹420 has exactly ₹420 of their oldest-unpaid parts still open.
 *
 * Pure: no clock, no storage. Ties are broken by date, then the time it was added, then id.
 */
import type { Expense, Group, Minor, Settlement } from '../../domain/types'
import { expenseNet, groupBalances } from '../../engine/balances'

export type PartStatus = 'paid' | 'part' | 'open'

/** One person's part of one bill. */
export interface BillPart {
  personId: string
  /** Their share of the bill. */
  share: Minor
  /** How much of it is paid. */
  covered: Minor
  status: PartStatus
  /** The payments that paid it (ids of settlements), and whether fronting other bills paid some of it. */
  paidBy: string[]
  byFronting: boolean
}

/** One bill: its payer, and every other person's part. */
export interface BillCover {
  expenseId: string
  payerId: string
  parts: BillPart[]
  /** Every part paid. */
  settled: boolean
}

/** What one payment paid for: bill ids with the amount of each. */
export interface PaymentCover {
  settlementId: string
  bills: Array<{ expenseId: string; amount: Minor }>
  /** Left over after the payer's bills were all paid (paid in advance, or paid back to them). */
  extra: Minor
}

export interface GroupCover {
  bills: Record<string, BillCover>
  payments: Record<string, PaymentCover>
}

interface Debt {
  expenseId: string
  date: string
  at: number
  amount: Minor
}

function byTime<T extends { date: string; createdAt: number; id: string }>(a: T, b: T): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** The bills that count in the group's balances (its own currency), oldest first. */
function groupBills(group: Group, expenses: readonly Expense[]): Expense[] {
  return expenses.filter((e) => e.groupId === group.id && e.currency === group.currency).sort(byTime)
}

/**
 * Who has paid which part of every bill in `group`, and what each recorded payment paid for.
 * Exact to the paisa against `groupBalances`.
 */
export function groupCover(group: Group, expenses: readonly Expense[]): GroupCover {
  const bills = groupBills(group, expenses)
  const balances = groupBalances(group, bills)
  const settlements = [...group.settlements].filter((s) => Number.isFinite(s.amount) && s.amount > 0 && s.fromId !== s.toId).sort(byTime)

  // Each person's debts (their shares of bills somebody else paid), oldest first.
  const debts = new Map<string, Debt[]>()
  for (const e of bills) {
    for (const [id, raw] of Object.entries(e.shares)) {
      if (id === e.payerId) continue
      const amount = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      if (amount <= 0) continue
      const list = debts.get(id) ?? []
      list.push({ expenseId: e.id, date: e.date, at: e.createdAt, amount })
      debts.set(id, list)
    }
  }

  const out: GroupCover = { bills: {}, payments: {} }
  for (const e of bills) {
    out.bills[e.id] = { expenseId: e.id, payerId: e.payerId, parts: [], settled: true }
  }
  for (const s of settlements) out.payments[s.id] = { settlementId: s.id, bills: [], extra: 0 }

  // Per person: fill their debts in order with their sources of cover.
  const people = new Set<string>([...debts.keys(), ...settlements.map((s) => s.fromId)])
  for (const id of people) {
    const list = debts.get(id) ?? []
    const totalDebt = list.reduce((sum, d) => sum + d.amount, 0)
    const balance = balances[id] ?? 0
    const coveredTotal = Math.min(totalDebt, Math.max(0, balance + totalDebt))

    // Sources, in the order they pay debts: what they fronted for others (net of money sent back
    // to them), then each payment they sent. The total is capped at what the balance allows.
    let fronted = 0
    for (const e of bills) if (e.payerId === id) fronted += expenseNet(e)[id] ?? 0
    const received = settlements.filter((s) => s.toId === id).reduce((sum, s) => sum + s.amount, 0)
    const sent = settlements.filter((s) => s.fromId === id)
    // Money sent back to them first undoes what they fronted, then their own latest payments.
    let undo = received
    const frontCover = Math.max(0, fronted - undo)
    undo = Math.max(0, undo - fronted)
    const sentCover = sent.map((s) => ({ id: s.id, amount: s.amount }))
    for (let k = sentCover.length - 1; k >= 0 && undo > 0; k--) {
      const item = sentCover[k]
      if (!item) continue
      const take = Math.min(item.amount, undo)
      item.amount -= take
      undo -= take
    }
    const sources: Array<{ settlementId: string | null; amount: Minor }> = [
      { settlementId: null, amount: frontCover },
      ...sentCover.map((s) => ({ settlementId: s.id, amount: s.amount })),
    ]

    // Fill the debts, oldest first, never past `coveredTotal`.
    let left = coveredTotal
    let src = 0
    let srcLeft = sources[0]?.amount ?? 0
    for (const debt of list) {
      const part: BillPart = { personId: id, share: debt.amount, covered: 0, status: 'open', paidBy: [], byFronting: false }
      let need = Math.min(debt.amount, left)
      while (need > 0 && src < sources.length) {
        if (srcLeft <= 0) {
          src++
          srcLeft = sources[src]?.amount ?? 0
          continue
        }
        const take = Math.min(need, srcLeft)
        const source = sources[src]
        if (source?.settlementId) {
          if (!part.paidBy.includes(source.settlementId)) part.paidBy.push(source.settlementId)
          const cover = out.payments[source.settlementId]
          if (cover) {
            const line = cover.bills.find((b) => b.expenseId === debt.expenseId)
            if (line) line.amount += take
            else cover.bills.push({ expenseId: debt.expenseId, amount: take })
          }
        } else {
          part.byFronting = true
        }
        part.covered += take
        need -= take
        srcLeft -= take
        left -= take
      }
      // The sources add up to exactly `coveredTotal` (fronted − received + sent, floored at 0), so
      // every paisa the balance allows is placed above.
      part.status = part.covered >= debt.amount ? 'paid' : part.covered > 0 ? 'part' : 'open'
      const bill = out.bills[debt.expenseId]
      if (bill) {
        bill.parts.push(part)
        if (part.status !== 'paid') bill.settled = false
      }
    }

    // What each of their payments didn't spend on their bills.
    for (const s of sent) {
      const cover = out.payments[s.id]
      if (!cover) continue
      const used = cover.bills.reduce((sum, b) => sum + b.amount, 0)
      cover.extra = Math.max(0, s.amount - used)
    }
  }
  return out
}

/** One bill's cover in its group (null for a bill not settled through a group). */
export function billCover(expense: Expense, group: Group | null, expenses: readonly Expense[]): BillCover | null {
  if (!group || expense.groupId !== group.id || expense.currency !== group.currency) return null
  return groupCover(group, expenses).bills[expense.id] ?? null
}

/** What one payment in a group paid for. */
export function paymentCover(settlement: Settlement, group: Group, expenses: readonly Expense[]): PaymentCover | null {
  return groupCover(group, expenses).payments[settlement.id] ?? null
}
