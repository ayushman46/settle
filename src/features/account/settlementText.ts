import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { Settlement } from './api'

export const inr = (paise: number): string => formatMoney(paise, 'INR')

/** Where a payment stands, in words, naming the person who has to act. */
export function statusText(s: Settlement, me?: string): string {
  const mine = s.receiverId === me
  switch (s.status) {
    case 'pending':
      return t('account.cloud.status.pending')
    case 'initiated':
      return t('account.cloud.status.initiated')
    case 'awaiting_confirmation':
      return mine ? t('account.cloud.status.awaiting_confirmation.you') : t('account.cloud.status.awaiting_confirmation', { name: s.receiverName })
    case 'confirmed':
      return mine ? t('account.cloud.status.confirmed.you') : t('account.cloud.status.confirmed', { name: s.receiverName })
    case 'failed':
      return t('account.cloud.status.failed')
    case 'disputed':
      return mine ? t('account.cloud.status.disputed.you') : t('account.cloud.status.disputed', { name: s.receiverName })
    case 'cancelled':
      return t('account.cloud.status.cancelled')
  }
}

/** "You → Riya", "Riya → you" or "Riya → Sam". */
export function lineText(s: Settlement, me: string): string {
  if (s.senderId === me) return t('account.cloud.settlement.youPaid', { name: s.receiverName })
  if (s.receiverId === me) return t('account.cloud.settlement.paidYou', { name: s.senderName })
  return t('account.cloud.settlement.line', { from: s.senderName, to: s.receiverName })
}

/** The UPI reference the payer gave, if any (only the two people involved can see it). */
export function referenceOf(s: Settlement): string | null {
  for (let i = s.events.length - 1; i >= 0; i -= 1) {
    const ref = s.events[i]!.data.transaction_reference
    if (typeof ref === 'string' && ref) return ref
  }
  return null
}

/** One line for "Needs you": what this open payment is waiting for, from my side. */
export function needsText(s: Settlement, me: string): string {
  const amount = inr(s.amountPaise)
  if (s.receiverId === me) {
    return s.status === 'awaiting_confirmation' ? t('account.cloud.needs.confirm', { name: s.senderName, amount }) : statusText(s, me)
  }
  if (s.status === 'disputed') return t('account.cloud.needs.disputed', { name: s.receiverName, amount })
  if (s.status === 'awaiting_confirmation') return t('account.cloud.needs.waiting', { name: s.receiverName, amount })
  return t('account.cloud.needs.finish', { name: s.receiverName, amount })
}

export const isOpen = (s: Settlement): boolean => s.status !== 'confirmed' && s.status !== 'cancelled'
