/**
 * Where I stand with one friend, across everything: standalone splits (unpaid shares between us)
 * and every group we share (the simplified payments between us). Mirrors the engine's
 * `overallSummary`, but keeps the sources apart so the screen can say where money comes from —
 * and settle it all in one go.
 */
import { setPaidBack, recordSettlement, deleteSettlement } from '../../data'
import { ME_ID, type Expense, type Group, type Minor, type RecurringTemplate, type Settlement } from '../../domain/types'
import { groupBalances, isSettledInGroup, simplifyDebts } from '../../engine/balances'

/** One share to tick off: `debtorId` paid back the payer of `expenseId`. */
export interface PaidBackMark {
  expenseId: string
  debtorId: string
}

export type FriendSource =
  | {
      kind: 'splits'
      key: string
      currency: string
      /** + they owe me, − I owe them. */
      amount: Minor
      /** Expenses outside groups with money still open between us. */
      count: number
      /** Their titles, newest first (for a reminder's "what it was for"). */
      titles: string[]
      marks: PaidBackMark[]
    }
  | {
      kind: 'group'
      key: string
      group: Group
      currency: string
      /** + they pay me, − I pay them (from the group's simplified payments). */
      amount: Minor
    }

export interface FriendBalance {
  /** Every place money is open between us. */
  sources: FriendSource[]
  /** The net per currency (non-zero only), the given currency first, then A–Z. */
  totals: Array<{ currency: string; amount: Minor }>
}

function newestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.createdAt - a.createdAt
}

export function friendBalance(
  friendId: string,
  expenses: readonly Expense[],
  groups: readonly Group[],
  currency: string,
  meId: string = ME_ID,
): FriendBalance {
  const splits = new Map<string, { amount: Minor; expenses: Expense[]; marks: PaidBackMark[] }>()
  for (const e of [...expenses].sort(newestFirst)) {
    if (friendId === meId || isSettledInGroup(e, groups)) continue
    let amount = 0
    let mark: PaidBackMark | null = null
    if (e.payerId === meId) {
      const share = e.shares[friendId] ?? 0
      if (share > 0 && e.paidBack[friendId] === undefined) {
        amount = share
        mark = { expenseId: e.id, debtorId: friendId }
      }
    } else if (e.payerId === friendId) {
      const share = e.shares[meId] ?? 0
      if (share > 0 && e.paidBack[meId] === undefined) {
        amount = -share
        mark = { expenseId: e.id, debtorId: meId }
      }
    }
    if (!mark) continue
    const slot = splits.get(e.currency) ?? { amount: 0, expenses: [], marks: [] }
    slot.amount += amount
    slot.expenses.push(e)
    slot.marks.push(mark)
    splits.set(e.currency, slot)
  }

  const sources: FriendSource[] = []
  for (const [code, slot] of splits) {
    if (slot.amount === 0 && slot.marks.length === 0) continue
    sources.push({
      kind: 'splits',
      key: `splits:${code}`,
      currency: code,
      amount: slot.amount,
      count: slot.expenses.length,
      titles: [...new Set(slot.expenses.map((e) => e.title))],
      marks: slot.marks,
    })
  }

  for (const group of groups) {
    let amount = 0
    for (const t of simplifyDebts(groupBalances(group, expenses))) {
      if (t.fromId === friendId && t.toId === meId) amount += t.amount
      else if (t.fromId === meId && t.toId === friendId) amount -= t.amount
    }
    if (amount !== 0) sources.push({ kind: 'group', key: `group:${group.id}`, group, currency: group.currency, amount })
  }

  const byCurrency = new Map<string, Minor>()
  for (const s of sources) byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + s.amount)
  const totals = [...byCurrency.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([code, amount]) => ({ currency: code, amount }))
    .sort((a, b) => (a.currency === currency ? -1 : b.currency === currency ? 1 : a.currency < b.currency ? -1 : 1))
  return { sources, totals }
}

/** The net in `currency` (+ they owe me), 0 when nothing's open in it. */
export function netIn(balance: FriendBalance, currency: string): Minor {
  return balance.totals.find((t) => t.currency === currency)?.amount ?? 0
}

/**
 * Settles `sources` with a friend in one go: ticks off every open share outside groups and
 * records one payment per shared group. Returns an undo that puts everything back.
 */
export function settleWithFriend(
  friendId: string,
  sources: readonly FriendSource[],
  opts: { method: Settlement['method']; date: string },
  meId: string = ME_ID,
): () => void {
  const ticked: PaidBackMark[] = []
  const recorded: Array<{ groupId: string; settlementId: string }> = []
  for (const source of sources) {
    if (source.kind === 'splits') {
      for (const mark of source.marks) {
        try {
          setPaidBack(mark.expenseId, mark.debtorId, true)
          ticked.push(mark)
        } catch {
          // Deleted meanwhile (another tab): nothing left to tick.
        }
      }
    } else if (source.amount !== 0) {
      const theyPay = source.amount > 0
      try {
        const s = recordSettlement(source.group.id, {
          fromId: theyPay ? friendId : meId,
          toId: theyPay ? meId : friendId,
          amount: Math.abs(source.amount),
          date: opts.date,
          method: opts.method,
        })
        recorded.push({ groupId: source.group.id, settlementId: s.id })
      } catch {
        // The group went away meanwhile.
      }
    }
  }
  return () => {
    for (const mark of ticked) {
      try {
        setPaidBack(mark.expenseId, mark.debtorId, false)
      } catch {
        // Deleted since: nothing to untick.
      }
    }
    for (const r of recorded) deleteSettlement(r.groupId, r.settlementId)
  }
}

/** What a reminder says it's for: the one group or split, or "our splits" when there are several. */
export function sourcesTitle(sources: readonly FriendSource[]): string {
  if (sources.length === 1) {
    const only = sources[0]
    if (only?.kind === 'group') return only.group.name
    if (only?.kind === 'splits' && only.titles.length === 1) return only.titles[0] ?? 'our splits'
  }
  return 'our splits'
}

/** Why a friend can't be removed yet, for a precise explanation (removeFriend has the final say). */
export interface RemovalBlockers {
  /** Groups where they still owe or are owed. */
  groups: Group[]
  /** Standalone splits with their share (or what they're owed) still open. */
  splits: number
  /** Active recurring splits they're part of. */
  recurring: RecurringTemplate[]
}

export function removalBlockers(
  friendId: string,
  expenses: readonly Expense[],
  groups: readonly Group[],
  recurring: readonly RecurringTemplate[],
): RemovalBlockers {
  const blockedGroups = groups.filter((g) => (groupBalances(g, expenses)[friendId] ?? 0) !== 0)
  let splits = 0
  for (const e of expenses) {
    if (isSettledInGroup(e, groups)) continue
    const open =
      e.payerId === friendId
        ? Object.entries(e.shares).some(([who, share]) => who !== friendId && share > 0 && e.paidBack[who] === undefined)
        : (e.shares[friendId] ?? 0) > 0 && e.paidBack[friendId] === undefined
    if (open) splits += 1
  }
  return {
    groups: blockedGroups,
    splits,
    recurring: recurring.filter((r) => r.active && (r.payerId === friendId || r.participants.some((p) => p.friendId === friendId))),
  }
}
