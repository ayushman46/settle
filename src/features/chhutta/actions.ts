/** Calling a small due even: the payment that clears it, the log entry, and an Undo that takes both back. */
import { DataError, deleteSettlement, recordSettlement } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { newId } from '../../lib/ids'
import { settleWithFriend, type FriendBalance } from '../friends/friendBalance'
import { gentleKey, type ChhuttaEntry, type SmallDue } from './engine'
import { addChhuttaEntries, chhuttaStore, removeChhuttaEntries, skipChhutta, unskipChhutta } from './store'

/**
 * Records a group's small due as settled (a payment marked "other") and logs who let it go. A
 * one-time offer is used up. Returns the Undo, or null when the group wouldn't take the payment.
 */
export function callGroupEven(group: Group, due: SmallDue, today: string, now: number = Date.now()): (() => void) | null {
  let settlementId: string
  try {
    settlementId = recordSettlement(group.id, { fromId: due.fromId, toId: due.toId, amount: due.amount, date: today, method: 'other' }).id
  } catch (error) {
    if (!(error instanceof DataError)) throw error
    return null
  }
  const entry: ChhuttaEntry = {
    id: newId(),
    groupId: group.id,
    fromId: due.fromId,
    toId: due.toId,
    amount: due.amount,
    currency: group.currency,
    date: today,
    at: now,
    settlementId,
  }
  addChhuttaEntries([entry])
  const usedOffer = due.gentle && !chhuttaStore.get().skipped.includes(gentleKey(group.id))
  if (usedOffer) skipChhutta(gentleKey(group.id))
  return () => {
    deleteSettlement(group.id, settlementId)
    removeChhuttaEntries([entry.id])
    if (usedOffer) unskipChhutta(gentleKey(group.id))
  }
}

/**
 * Clears everything open with a friend whose whole balance is small change, and logs the net let
 * go in each currency. Returns the Undo.
 */
export function callFriendEven(friendId: string, balance: FriendBalance, today: string, now: number = Date.now()): () => void {
  const undoSettle = settleWithFriend(friendId, balance.sources, { method: 'other', date: today })
  const entries: ChhuttaEntry[] = balance.totals
    .filter((total) => total.amount !== 0)
    .map((total) => ({
      id: newId(),
      groupId: null,
      // + they owe me: I let them off.
      fromId: total.amount > 0 ? friendId : ME_ID,
      toId: total.amount > 0 ? ME_ID : friendId,
      amount: Math.abs(total.amount),
      currency: total.currency,
      date: today,
      at: now,
      settlementId: null,
    }))
  addChhuttaEntries(entries)
  return () => {
    undoSettle()
    removeChhuttaEntries(entries.map((entry) => entry.id))
  }
}
