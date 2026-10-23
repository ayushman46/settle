import { useId } from 'react'
import { ArrowRight, BellRing, Check, QrCode } from 'lucide-react'
import { Button, Money } from '../components'
import { useFriendsById } from '../data'
import { ME_ID } from '../domain/types'
import { t, useT } from '../i18n'
import type { Transfer } from '../engine/balances'
import { cx } from '../lib/cx'
import { formatMoney } from '../lib/money'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel, friendObjectLabel } from './friendName'
import styles from './TransferRow.module.css'

export interface TransferRowProps {
  /** One payment from `simplifyDebts`. */
  transfer: Transfer
  currency: string
  /** "Pay via UPI" — for a payment you make (show it when the payee has a UPI ID). */
  onPay?: () => void
  /** "Record payment" — once the money has changed hands (UPI, cash…). */
  onRecord?: () => void
  /** "Remind" — nudge whoever pays (for money coming to you). */
  onRemind?: () => void
  className?: string
}

/** "Riya pays you", "You pay Riya", "Riya pays Sam". */
function transferSentence(fromName: string, toName: string, fromId: string, toId: string): string {
  if (fromId === ME_ID) return t('kit.transfer.youPay', { name: toName })
  if (toId === ME_ID) return t('kit.transfer.paysYou', { name: fromName })
  return t('kit.transfer.pays', { from: fromName, to: toName })
}

/** The small line under the names: what this payment means, or where your money goes. */
function transferDetail(direction: 'in' | 'out' | 'between', toName: string, toUpi: string | null): string {
  if (direction === 'in') return t('kit.transfer.owesYou')
  if (direction === 'between') return t('kit.transfer.owes', { name: toName })
  return toUpi ? t('kit.transfer.toUpi', { upi: toUpi }) : t('kit.transfer.noUpi')
}

/**
 * One settle-up payment: "Riya → You ₹540" with both faces, the amount (green when it's coming
 * to you, red when it's yours to pay) and the actions that fit — each shown only when its
 * handler is given.
 */
export function TransferRow({ transfer, currency, onPay, onRecord, onRemind, className }: TransferRowProps) {
  useT()
  const sentenceId = useId()
  const friendsById = useFriendsById()
  const { fromId, toId, amount } = transfer
  const from = friendsById[fromId] ?? null
  const to = friendsById[toId] ?? null
  const fromName = friendLabel(fromId, from)
  const toName = friendLabel(toId, to)
  const amountText = formatMoney(amount, currency, { trimZeros: true })
  const sentence = transferSentence(fromName, toName, fromId, toId)
  const direction = toId === ME_ID ? 'in' : fromId === ME_ID ? 'out' : 'between'
  const detail = transferDetail(direction, toName, to?.upiId ?? null)
  const hasActions = onPay !== undefined || onRecord !== undefined || onRemind !== undefined

  return (
    <div role="group" aria-labelledby={sentenceId} className={cx(styles.row, className)} data-direction={direction}>
      <p id={sentenceId} className="visually-hidden">
        {direction === 'out' && to?.upiId
          ? t('kit.transfer.spoken.upi', { sentence, amount: amountText, upi: to.upiId })
          : t('kit.transfer.spoken', { sentence, amount: amountText })}
      </p>
      <div className={styles.main} aria-hidden="true">
        <span className={styles.faces}>
          <FriendAvatar friend={from} friendId={fromId} size="md" />
          <FriendAvatar friend={to} friendId={toId} size="md" className={styles.toFace} />
        </span>
        <span className={styles.text}>
          <span className={styles.names}>
            <span className={styles.name}>{fromName}</span>
            <ArrowRight className={styles.inlineArrow} strokeWidth={2.5} />
            <span className={styles.name}>{toName}</span>
          </span>
          <span className={cx(styles.detail, direction === 'out' && to?.upiId && styles.upi)}>{detail}</span>
        </span>
        <Money
          value={amount}
          currency={currency}
          size="lg"
          trimZeros
          strong
          tone={direction === 'in' ? 'positive' : direction === 'out' ? 'negative' : 'default'}
          className={styles.amount}
        />
      </div>

      {hasActions && (
        <div className={styles.actions}>
          {onPay && (
            <Button
              size="sm"
              variant="accent"
              iconStart={<QrCode />}
              onClick={onPay}
              aria-label={t('kit.transfer.pay.aria', { name: friendObjectLabel(toId, to), amount: amountText })}
            >
              {t('kit.transfer.pay.cta')}
            </Button>
          )}
          {onRemind && (
            <Button
              size="sm"
              variant="tonal"
              iconStart={<BellRing />}
              onClick={onRemind}
              aria-label={t('kit.transfer.remind.aria', { name: friendObjectLabel(fromId, from), amount: amountText })}
            >
              {t('kit.transfer.remind.cta')}
            </Button>
          )}
          {onRecord && (
            <Button
              size="sm"
              variant={onPay || onRemind ? 'secondary' : 'tonal'}
              // No icon: the label has to fit half a 360px row.
              iconStart={onPay || onRemind ? undefined : <Check />}
              onClick={onRecord}
              aria-label={t('kit.transfer.record.aria', { amount: amountText, from: friendObjectLabel(fromId, from), to: friendObjectLabel(toId, to) })}
            >
              {t('kit.transfer.record.cta')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
