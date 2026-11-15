/**
 * "I've paid" to a friend abroad: the due is settled through the same path as any other payment
 * between you (method "other"), and what it cost you is kept on this phone.
 */
import { expensesStore, groupsStore, profileStore } from '../../data'
import type { Minor } from '../../domain/types'
import { newId } from '../../lib/ids'
import { friendBalance, netIn } from '../friends/friendBalance'
import { payFriend } from '../swap/settle'
import { abroadView } from './engine'
import { logSent, removeSent, type AbroadSent } from './store'

export interface AbroadPaidInput {
  friendId: string
  /** The currency of what you owe. */
  currency: string
  /** What it clears, in `currency`'s minor units; more than what is owed clears what is owed. */
  settled: Minor
  /** What it cost you, in `currency`'s minor units. */
  cost: Minor
  theirCurrency: string
  /** Units of their currency per 1 of `currency`, or null when there was no rate. */
  rate: string | null
  /** YYYY-MM-DD. */
  date: string
}

export interface AbroadPaid {
  sent: AbroadSent
  /** What you still owe them in that currency afterwards. */
  left: Minor
  /** Puts everything back exactly: the payments, the ticks and the record of what it cost. */
  undo: () => void
}

function owedNow(friendId: string, currency: string): Minor {
  return Math.max(0, -netIn(friendBalance(friendId, expensesStore.get(), groupsStore.get(), profileStore.get().currency), currency))
}

/** Records that you paid a friend abroad. Null when you owed them nothing (nothing is changed). */
export function recordAbroadPaid(input: AbroadPaidInput, now: number = Date.now()): AbroadPaid | null {
  const owedBefore = owedNow(input.friendId, input.currency)
  if (owedBefore <= 0 || !(input.settled > 0)) return null
  const undoPayment = payFriend(input.friendId, 'out', input.settled, expensesStore.get(), groupsStore.get(), input.currency, {
    method: 'other',
    date: input.date,
  })
  const left = owedNow(input.friendId, input.currency)
  const settled = owedBefore - left
  if (settled <= 0) {
    undoPayment()
    return null
  }
  const sent: AbroadSent = {
    id: newId(),
    friendId: input.friendId,
    settled,
    cost: input.cost > 0 ? input.cost : settled,
    currency: input.currency,
    theirAmount: abroadView(-settled, input.currency, input.theirCurrency, input.rate).theirAmount,
    theirCurrency: input.theirCurrency,
    date: input.date,
    createdAt: now,
  }
  logSent(sent)
  return {
    sent,
    left,
    undo: () => {
      undoPayment()
      removeSent(sent.id)
    },
  }
}
