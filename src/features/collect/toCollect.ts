/**
 * Everyone who owes you, for "To collect": what each owes (net, across splits and groups), since
 * when, and the reminders you've sent since then. The longest-waiting first; someone who pays
 * drops off the list, and with them their reminders (the next time they owe, it starts friendly).
 */
import { remindersFor } from '../../data/reminders'
import type { Reminder } from '../../data/stores'
import { ME_ID, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { friendBalance, netIn, sourcesTitle, type FriendSource } from '../friends/friendBalance'

export interface CollectRow {
  friend: Friend
  /** What they owe you, net, in the list's currency. */
  amount: Minor
  /** Where it comes from (splits outside groups, groups), in that currency. */
  sources: FriendSource[]
  /** What a reminder says it's for. */
  title: string
  /** The oldest unpaid split they owe you for (YYYY-MM-DD), or null when it's all in groups. */
  since: string | null
  /** Reminders sent to them since then, oldest first. */
  reminders: Reminder[]
}

/** Local midnight of a YYYY-MM-DD date, in epoch ms. */
function startOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
}

/** How far back reminders count when there's no split date to go by (money owed in groups). */
const GROUP_WINDOW_MS = 60 * 86_400_000

export function toCollect(
  friends: readonly Friend[],
  expenses: readonly Expense[],
  groups: readonly Group[],
  currency: string,
  reminders: readonly Reminder[],
  now: number = Date.now(),
): CollectRow[] {
  const dateOf = new Map(expenses.map((e) => [e.id, e.date]))
  const rows: CollectRow[] = []
  for (const friend of friends) {
    if (friend.id === ME_ID) continue
    const balance = friendBalance(friend.id, expenses, groups, currency)
    const amount = netIn(balance, currency)
    if (amount <= 0) continue
    const sources = balance.sources.filter((s) => s.currency === currency)
    let since: string | null = null
    for (const source of sources) {
      if (source.kind !== 'splits') continue
      for (const mark of source.marks) {
        const date = mark.debtorId === friend.id ? dateOf.get(mark.expenseId) : undefined
        if (date !== undefined && (since === null || date < since)) since = date
      }
    }
    rows.push({
      friend,
      amount,
      sources,
      title: sourcesTitle(sources),
      since,
      reminders: remindersFor(reminders, friend.id, since !== null ? startOf(since) : now - GROUP_WINDOW_MS),
    })
  }
  // The longest wait first (group-only money after), then the most owed.
  return rows.sort((a, b) => {
    if (a.since !== b.since) {
      if (a.since === null) return 1
      if (b.since === null) return -1
      return a.since < b.since ? -1 : 1
    }
    return b.amount - a.amount || a.friend.name.localeCompare(b.friend.name)
  })
}
