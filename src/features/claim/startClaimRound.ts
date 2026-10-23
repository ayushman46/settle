/**
 * Starting a claim link from any of its entry points: the bill flow ("Let everyone pick their
 * own", "Send link") saves the bill first; a saved bill starts straight away. Both land on the
 * round's board with `?share=1` (your UPI ID first when it's missing, then sharing).
 */
import { navigate } from '../../app/router'
import { DataError, saveExpense } from '../../data'
import { createClaimRound } from '../../data/claims'
import type { ClaimRound } from '../../domain/types'
import { today } from '../../engine/dates'
import { t } from '../../i18n'
import { CLAIM_LIMITS } from '../../share/claim'
import type { Session } from '../../types'
import { billExpenseDraft } from '../bill/billExpense'

/** The board of a round, opening the share step once. */
export function claimBoardPath(roundId: string, share = false): string {
  return `/app/claims/${roundId}${share ? '?share=1' : ''}`
}

/** Why a round couldn't start, in words for a toast. */
export function claimStartError(error: unknown): string {
  if (error instanceof DataError && error.code === 'invalid') return t('claim.entry.tooMany')
  return t('claim.entry.failed')
}

/** True when a bill has more items than one claim link carries. */
export function tooManyForClaims(itemCount: number): boolean {
  return itemCount > CLAIM_LIMITS.items
}

/**
 * Saves the bill in progress (items nobody's on yet stay unassigned — shared by everyone — until
 * claims arrive) and starts its round. Throws ExpenseError / DataError.
 */
export function claimRoundFromBill(session: Session): ClaimRound {
  if (tooManyForClaims(session.items.length)) throw new DataError('invalid')
  const expense = saveExpense(billExpenseDraft(session, today()))
  return createClaimRound(expense.id)
}

type Listener = (message: string) => void
const listeners = new Set<Listener>()

/** Hears problems starting a round from the expense ⋮ menu (it has no toast of its own). */
export function onClaimStartError(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Starts a round for a saved bill and opens its board; problems go to `onClaimStartError`. */
export function startClaimRound(expenseId: string): void {
  try {
    const round = createClaimRound(expenseId)
    navigate(claimBoardPath(round.id, true))
  } catch (error) {
    const message = claimStartError(error)
    for (const listener of listeners) listener(message)
  }
}
