/**
 * Recording money between you and one friend, for part of what's open as well as all of it
 * (`settleWithFriend` settles whole places at once). Used by Pay it forward: "Riya paid Sam"
 * is Riya paying you and you paying Sam, each for the swap's amount.
 */
import { expensesStore, groupsStore, recordPartPayment } from '../../data'
import { ME_ID, type Expense, type Group, type Minor, type Settlement } from '../../domain/types'
import { stillOwed } from '../../engine/balances'
import { friendBalance, netIn, settleWithFriend, type FriendSource } from '../friends/friendBalance'
import type { Swap } from './engine'

export interface PayOptions {
  method: Settlement['method']
  date: string
}

/**
 * Records `amount` moving between you and `friendId`: `in` they paid you, `out` you paid them.
 * All of what's open: everything is settled in one go. Less: payments in shared groups first
 * (clean records), then splits outside groups, oldest first, the last one in part. Capped at
 * what's open in that direction. Returns an undo that puts everything back.
 */
export function payFriend(
  friendId: string,
  direction: 'in' | 'out',
  amount: Minor,
  expenses: readonly Expense[],
  groups: readonly Group[],
  currency: string,
  opts: PayOptions,
): () => void {
  const balance = friendBalance(friendId, expenses, groups, currency)
  const sources = balance.sources.filter((s) => s.currency === currency)
  const net = netIn(balance, currency)
  const sign = direction === 'in' ? 1 : -1
  const open = net * sign
  if (!(amount > 0) || open <= 0) return () => undefined
  if (amount >= open) return settleWithFriend(friendId, sources, opts)

  const undos: Array<() => void> = []
  let left = amount
  for (const source of sources) {
    if (left <= 0) break
    if (source.kind !== 'group' || source.amount * sign <= 0) continue
    const take = Math.min(left, Math.abs(source.amount))
    undos.push(settleWithFriend(friendId, [{ ...source, amount: take * sign }], opts))
    left -= take
  }
  const debtorId = direction === 'in' ? friendId : ME_ID
  const byId = new Map(expenses.map((e) => [e.id, e]))
  for (const source of sources) {
    if (left <= 0) break
    if (source.kind !== 'splits') continue
    // Marks come newest first: pay off the oldest first.
    for (const mark of [...source.marks].reverse()) {
      if (left <= 0) break
      const e = byId.get(mark.expenseId)
      if (!e || mark.debtorId !== debtorId) continue
      const owed = stillOwed(e, debtorId)
      if (owed <= 0) continue
      if (owed <= left) {
        const one: FriendSource = { ...source, amount: owed * sign, count: 1, titles: [e.title], marks: [mark] }
        undos.push(settleWithFriend(friendId, [one], opts))
        left -= owed
      } else {
        try {
          undos.push(recordPartPayment(e.id, debtorId, left).undo)
          left = 0
        } catch {
          // Deleted meanwhile (another tab).
        }
      }
    }
  }
  return () => {
    for (const undo of undos.reverse()) undo()
  }
}

/**
 * "Riya paid Sam": records Riya paying you and you paying Sam, each for the swap's amount. Reads
 * the data afresh for each side (Riya's payment can move a shared group's balances). Returns one
 * undo for both.
 */
export function recordSwap(swap: Swap, currency: string, opts: PayOptions): () => void {
  const undoIn = payFriend(swap.fromId, 'in', swap.amount, expensesStore.get(), groupsStore.get(), currency, opts)
  const undoOut = payFriend(swap.toId, 'out', swap.amount, expensesStore.get(), groupsStore.get(), currency, opts)
  return () => {
    undoOut()
    undoIn()
  }
}
