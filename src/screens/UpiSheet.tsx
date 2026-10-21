import { useRef } from 'react'
import { ArrowRight, Copy, ExternalLink, Share2 } from 'lucide-react'
import { ActionBar, Avatar, BottomSheet, Button, IconButton, Money, QrCode, useToast } from '../components'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { copyText, shareResult } from '../lib/share'
import { buildUpiLink, buildUpiRequestText } from '../lib/upi'
import type { Minor, Person } from '../types'
import styles from './UpiSheet.module.css'

/** One person paying the payer back over UPI. */
export interface UpiRequest {
  /** Who pays. */
  debtor: Person
  /** Who receives (paid the bill). */
  payer: Person
  /** Amount in paise. */
  amount: Minor
  /** The payer's UPI ID (already validated). */
  vpa: string
  /** Shown as the transaction note. */
  merchant: string | null
}

export interface UpiSheetProps {
  /** The request on show; null closes the sheet. */
  request: UpiRequest | null
  onClose: () => void
}

/**
 * "Pay Aisha ₹530.10": a QR code any UPI app can scan (GPay, PhonePe, Paytm, BHIM…), a button
 * that opens the UPI app on this phone, and a ready-to-send request message.
 */
export function UpiSheet({ request, onClose }: UpiSheetProps) {
  const toast = useToast()
  const busy = useRef(false)

  const link = request
    ? buildUpiLink({
        vpa: request.vpa,
        payeeName: request.payer.name,
        amountMinor: request.amount,
        note: request.merchant,
      })
    : ''
  const amountText = request ? formatMoney(request.amount, 'INR') : ''

  const share = async () => {
    if (!request || busy.current) return
    busy.current = true
    try {
      const text = buildUpiRequestText({
        debtorName: request.debtor.name,
        payerName: request.payer.name,
        vpa: request.vpa,
        amountMinor: request.amount,
        merchant: request.merchant,
        link,
      })
      const outcome = await shareResult(text, { title: `Pay ${request.payer.name}` })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast('Payment request copied', { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast("Couldn't share the request. Try again.", { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const copyId = async () => {
    if (!request) return
    if (await copyText(request.vpa)) {
      haptic('success')
      toast('UPI ID copied', { tone: 'success' })
    } else {
      haptic('error')
      toast("Couldn't copy. Long-press the ID instead.", { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={request !== null}
      onClose={onClose}
      eyebrow={request ? `${request.debtor.name}'s share` : undefined}
      title={request ? `Pay ${request.payer.name}` : ''}
      description="Scan with any UPI app"
      footer={
        // Always present: the sheet keeps showing the last footer while it slides away.
        <ActionBar>
          <Button block iconStart={<Share2 />} onClick={share}>
            Share request
          </Button>
          {link !== '' && (
            <a className={styles.openApp} href={link}>
              <ExternalLink aria-hidden="true" strokeWidth={2.25} />
              Open UPI app
            </a>
          )}
        </ActionBar>
      }
    >
      {request && (
        <div className={styles.body}>
          {/* Who pays whom, at a glance (the title already says it in words). */}
          <div className={styles.parties} aria-hidden="true">
            <Avatar name={request.debtor.name} color={request.debtor.color} size="md" />
            <ArrowRight className={styles.partiesArrow} strokeWidth={2.25} />
            <Avatar name={request.payer.name} color={request.payer.color} size="md" />
          </div>
          <Money value={request.amount} currency="INR" size="xl" className={styles.amount} />
          <QrCode
            value={link}
            size={216}
            label={`UPI QR code to pay ${amountText} to ${request.payer.name}`}
            className={styles.qr}
          />
          <p className={styles.caption}>Works with GPay, PhonePe, Paytm, BHIM and every UPI app.</p>
          <div className={styles.vpa}>
            <span className={styles.vpaLabel}>To</span>
            <span className={styles.vpaId}>{request.vpa}</span>
            <IconButton label="Copy UPI ID" size="sm" onClick={copyId}>
              <Copy />
            </IconButton>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
