/** Notes and coins in words: "three ₹500 notes", "2 × ₹500, ₹200, ₹20". */
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { LARGEST_COIN, type Pile } from './engine'

/** "₹500" for a note or coin of `value` rupees. */
export function noteLabel(value: number): string {
  return formatMoney(value * 100, 'INR', { trimZeros: true })
}

/**
 * One kind of note: "three ₹500 notes" (or "one ₹5 coin"). Several kinds: each with its count
 * where there is more than one, largest first: "2 × ₹500, ₹200, ₹20".
 */
export function pilesText(piles: readonly Pile[]): string {
  const [only] = piles
  if (piles.length === 1 && only) {
    return t(only.value <= LARGEST_COIN ? 'notes.pile.coin' : 'notes.pile.note', { count: only.count, value: noteLabel(only.value) })
  }
  return piles
    .map((pile) => (pile.count === 1 ? noteLabel(pile.value) : t('notes.pile.many', { count: pile.count, value: noteLabel(pile.value) })))
    .join(', ')
}

/** Whose side of the cash "you" are on, worked out from the names the caller shows. */
export type Who = 'payer' | 'receiver' | 'plain' | 'other'

/** `plain` when a name is missing (the sentences then read "Give ₹1,500", "Get ₹130 back"). */
export function whoIsYou(payerName: string, receiverName: string): Who {
  const you = t('common.people.you')
  if (!payerName.trim() || !receiverName.trim()) return 'plain'
  if (payerName === you) return 'payer'
  if (receiverName === you) return 'receiver'
  return 'other'
}
