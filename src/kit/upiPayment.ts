/**
 * Who pays whom, and how much, for a `UpiPaySheet` — from a share of an expense (ShareList's
 * "UPI QR" / "Pay Riya") or from a settle-up payment (TransferRow's "Pay via UPI"). Pure, so
 * screens just spread the result into the sheet.
 */
import type { Friend, Expense, Minor } from '../domain/types'
import type { Transfer } from '../engine/balances'
import { friendLabel } from './friendName'
import type { UpiPayee, UpiPayer } from './UpiPaySheet'

/** Everything `UpiPaySheet` needs besides `open` / `onClose`. */
export interface UpiPayment {
  payee: UpiPayee
  payer: UpiPayer
  amount: Minor
  currency: string
  note: string | null
}

type FriendsById = Readonly<Record<string, Friend>>

function payeeOf(id: string, friendsById: FriendsById): UpiPayee {
  const friend = friendsById[id] ?? null
  return { id, name: friendLabel(id, friend), upiId: friend?.upiId ?? null, color: friend?.color ?? 0 }
}

function payerOf(id: string, friendsById: FriendsById): UpiPayer {
  const friend = friendsById[id] ?? null
  return { id, name: friendLabel(id, friend), color: friend?.color ?? 0 }
}

/**
 * `friendId` paying the expense's payer their share (the expense title is the UPI note).
 * Null for the payer themselves or anyone with nothing to pay.
 */
export function upiPaymentForShare(e: Expense, friendId: string, friendsById: FriendsById): UpiPayment | null {
  const amount = e.shares[friendId] ?? 0
  if (friendId === e.payerId || !(amount > 0)) return null
  return {
    payee: payeeOf(e.payerId, friendsById),
    payer: payerOf(friendId, friendsById),
    amount,
    currency: e.currency,
    note: e.title,
  }
}

/** One settle-up payment (`simplifyDebts`), with the group's name as the UPI note when given. */
export function upiPaymentForTransfer(
  transfer: Transfer,
  currency: string,
  friendsById: FriendsById,
  note: string | null = null,
): UpiPayment {
  return {
    payee: payeeOf(transfer.toId, friendsById),
    payer: payerOf(transfer.fromId, friendsById),
    amount: transfer.amount,
    currency,
    note,
  }
}
