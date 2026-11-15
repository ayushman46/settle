import { Check } from 'lucide-react'
import { ActionBar, BottomSheet, Button, Money, QrCode } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import type { Group } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { buildUpiLink } from '../../lib/upi'
import { friendFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import { receiverUpi } from './upi'
import styles from './Checkout.module.css'

export interface QrSheetProps {
  open: boolean
  onClose: () => void
  /** The payment the QR is for. */
  payment: Transfer
  group: Pick<Group, 'name' | 'currency'>
  /** Ticks the payment (the sheet then closes). */
  onPaid: () => void
}

/**
 * The receiver's UPI QR, as large as the phone allows, with the amount in it: the payer scans it
 * off this phone with any UPI app. Settle can't see the payment, so the tick is the person's.
 */
export function QrSheet({ open, onClose, payment, group, onPaid }: QrSheetProps) {
  const t = useT()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const vpa = receiverUpi(payment.toId, friendsById, profile)
  // The name the payer's UPI app shows: never "You".
  const payee = outsideName(payment.toId, friendsById, profile, friendFallback())
  const payer = friendLabel(payment.fromId, friendsById[payment.fromId] ?? null)
  const amount = formatMoney(payment.amount, group.currency, { trimZeros: true })

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="tall"
      eyebrow={t('checkout.qr.eyebrow', { name: payer })}
      title={t('checkout.qr.title', { name: payee })}
      footer={
        <ActionBar>
          <Button
            block
            iconStart={<Check />}
            onClick={() => {
              onPaid()
              onClose()
            }}
          >
            {t('checkout.qr.paid', { name: payer })}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.qr}>
        <Money value={payment.amount} currency={group.currency} size="xl" trimZeros className={styles.qrAmount} />
        {vpa && (
          <QrCode
            value={buildUpiLink({ vpa, payeeName: payee, amountMinor: payment.amount, note: group.name })}
            size={320}
            label={t('checkout.qr.aria', { name: payee, amount })}
          />
        )}
        <p className={styles.qrBody}>{t('checkout.qr.body', { amount })}</p>
        {vpa && <p className={styles.fine}>{t('checkout.qr.to', { upi: vpa })}</p>}
        <p className={styles.fine}>{t('checkout.qr.honest', { name: payer })}</p>
      </div>
    </BottomSheet>
  )
}
