/**
 * Clear everything: everyone you owe, in your own currency, the largest first. Pure: the
 * profile currency's nets (`overallSummary().byFriend`) and your people in, the queue out.
 */
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { isValidUpiId } from '../../lib/upi'

export interface QueueEntry {
  friendId: string
  name: string
  /** What you owe them, net (positive). */
  amount: Minor
  /** A valid UPI ID is saved for them. */
  hasUpi: boolean
}

/** Everyone you owe, largest first; ties by name (then id), so every phone agrees. */
export function payQueue(byFriend: Readonly<Record<string, Minor>>, friendsById: Readonly<Record<string, Friend>>): QueueEntry[] {
  const out: QueueEntry[] = []
  for (const [friendId, net] of Object.entries(byFriend)) {
    const friend = friendsById[friendId]
    if (friendId === ME_ID || !friend || !Number.isSafeInteger(net) || net >= 0) continue
    out.push({ friendId, name: friend.name, amount: -net, hasUpi: friend.upiId !== null && isValidUpiId(friend.upiId) })
  }
  return out.sort((a, b) => {
    if (a.amount !== b.amount) return b.amount - a.amount
    const an = a.name.toLocaleLowerCase('en')
    const bn = b.name.toLocaleLowerCase('en')
    if (an !== bn) return an < bn ? -1 : 1
    return a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0
  })
}

/** What the whole queue adds up to. */
export function queueTotal(queue: readonly QueueEntry[]): Minor {
  return queue.reduce((sum, e) => sum + e.amount, 0)
}
