/**
 * Where my money goes. "Spent" is always MY share of each expense — what the expense really
 * cost me — never the whole bill I happened to pay for.
 */
import { CATEGORY_IDS, type CategoryId, type Expense, type Minor } from '../domain/types'
import { isIsoDate, periodOf, periodsBetween } from './dates'

export interface InsightsOptions {
  meId: string
  /** Only expenses in this currency are counted (amounts are never converted). */
  currency: string
  /** Inclusive `YYYY-MM-DD` bounds; omitted = open-ended. */
  from?: string
  to?: string
}

export interface Insights {
  /** Σ of my shares. */
  spent: Minor
  /** Σ of totals I paid up front for everyone. */
  paidOut: Minor
  /** My spend per category, largest first (categories I spent nothing on are left out). */
  byCategory: Array<{ category: CategoryId; amount: Minor; count: number }>
  /** My spend per month, oldest first, with empty months in between filled with 0. */
  byMonth: Array<{ month: string; amount: Minor }>
  /** Friends I share expenses with, by my spend on those expenses, largest first. */
  topFriends: Array<{ friendId: string; amount: Minor; count: number }>
  /** Expenses I was part of (had a share in or paid for). */
  count: number
}

export function insights(expenses: readonly Expense[], opts: InsightsOptions): Insights {
  const { meId, currency } = opts
  const from = opts.from && isIsoDate(opts.from) ? opts.from : null
  const to = opts.to && isIsoDate(opts.to) ? opts.to : null

  let spent = 0
  let paidOut = 0
  let count = 0
  const categories = new Map<CategoryId, { amount: Minor; count: number }>()
  const months = new Map<string, Minor>()
  const friends = new Map<string, { amount: Minor; count: number }>()

  for (const e of expenses) {
    if (e.currency !== currency) continue
    if ((from && e.date < from) || (to && e.date > to)) continue
    const raw = e.shares[meId]
    const mine = typeof raw === 'number' && raw > 0 ? raw : 0
    const iPaid = e.payerId === meId
    if (mine === 0 && !iPaid) continue

    count += 1
    if (iPaid) paidOut += e.total
    if (mine === 0) continue
    spent += mine

    const cat = categories.get(e.category) ?? { amount: 0, count: 0 }
    categories.set(e.category, { amount: cat.amount + mine, count: cat.count + 1 })
    const month = periodOf(e.date)
    months.set(month, (months.get(month) ?? 0) + mine)

    const others = new Set<string>([e.payerId, ...Object.keys(e.shares)])
    others.delete(meId)
    for (const id of others) {
      const f = friends.get(id) ?? { amount: 0, count: 0 }
      friends.set(id, { amount: f.amount + mine, count: f.count + 1 })
    }
  }

  const categoryOrder = (c: CategoryId) => CATEGORY_IDS.indexOf(c)
  const byCategory = [...categories.entries()]
    .map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount || categoryOrder(a.category) - categoryOrder(b.category))

  const seen = [...months.keys()].sort()
  const first = from ? periodOf(from) : seen[0]
  const last = to ? periodOf(to) : seen[seen.length - 1]
  const byMonth =
    first !== undefined && last !== undefined
      ? periodsBetween(first, last).map((month) => ({ month, amount: months.get(month) ?? 0 }))
      : []

  const topFriends = [...friends.entries()]
    .map(([friendId, v]) => ({ friendId, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count || (a.friendId < b.friendId ? -1 : 1))

  return { spent, paidOut, byCategory, byMonth, topFriends, count }
}
