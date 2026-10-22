import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, QrCode as QrIcon, ShieldCheck } from 'lucide-react'
import { Avatar, Button, QrCode } from '../../components'
import type { Minor } from '../../domain/types'
import { BRAND } from '../../domain/types'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText } from '../../lib/share'
import { buildUpiLink } from '../../lib/upi'
import { ctaClassName, ctaParts } from '../landing/cta'
import { useTouchFirst } from './useTouchFirst'
import styles from './UpiPayBlock.module.css'

/** How long "Copied" stays up. */
const COPIED_MS = 2400

export interface UpiPayBlockProps {
  /** Who the money goes to, as the UPI app should show it. */
  payeeName: string
  /** Their UPI ID (valid). */
  vpa: string
  /** What to pay, in minor units. */
  amount: Minor
  /** The UPI note ("Friday dinner"). */
  note: string
  /** The amount's currency; UPI is INR only. */
  currency: string
  /** The payee's avatar colour. */
  color: number
}

/**
 * Paying one person by UPI, led by what this device is good at: on a phone, a button that opens
 * any UPI app with everything filled in (and a QR for paying from another phone); on a computer,
 * the QR. Then who the money goes to, their UPI ID with Copy, and the safety line. Shared by the
 * pay, claim and pool pages.
 */
export function UpiPayBlock({ payeeName, vpa, amount, note, currency, color }: UpiPayBlockProps) {
  const touch = useTouchFirst()
  const [qrOnTouch, setQrOnTouch] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const uri = buildUpiLink({ vpa, payeeName, amountMinor: amount, note })
  const money = formatMoney(amount, currency, { trimZeros: true })
  const showQr = !touch || qrOnTouch

  useEffect(() => {
    if (copied === 'idle') return
    const timer = setTimeout(() => setCopied('idle'), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const ok = await copyText(vpa)
    haptic(ok ? 'success' : 'error')
    setCopied(ok ? 'done' : 'failed')
  }

  return (
    <div className={styles.pay}>
      {touch && (
        <>
          <a href={uri} className={ctaClassName({ block: true })} onClick={() => haptic('tap')}>
            <span>Pay {money} with any UPI app</span>
            <span className={ctaParts.iconEnd} aria-hidden="true">
              <ExternalLink strokeWidth={2.25} />
            </span>
          </a>
          <p className={styles.caption}>Opens GPay, PhonePe, Paytm or BHIM with everything filled in.</p>
          <Button variant="ghost" size="md" iconStart={<QrIcon />} aria-expanded={qrOnTouch} onClick={() => setQrOnTouch((open) => !open)}>
            {qrOnTouch ? 'Hide the QR code' : 'Pay from another phone'}
          </Button>
        </>
      )}
      {showQr && (
        <div className={styles.qr}>
          <QrCode value={uri} size={224} label={`UPI QR code to pay ${money} to ${payeeName}`} />
          <p className={styles.caption}>
            {touch ? 'Scan it with the UPI app on the other phone.' : 'Scan with any UPI app on your phone — GPay, PhonePe, Paytm, BHIM.'}
          </p>
        </div>
      )}

      <div className={styles.payee}>
        <p className={styles.payeeLabel}>Paying to</p>
        <div className={styles.payeeRow}>
          <Avatar name={payeeName} color={color} size="md" />
          <div className={styles.payeeText}>
            <span className={styles.payeeName}>{payeeName}</span>
            <span className={styles.vpa}>{vpa}</span>
          </div>
          <Button
            variant="tonal"
            size="sm"
            iconStart={copied === 'done' ? <Check /> : <Copy />}
            aria-label={copied === 'done' ? 'Copied UPI ID' : 'Copy UPI ID'}
            onClick={copy}
          >
            {copied === 'done' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        {copied === 'failed' && <p className={styles.copyFailed}>Couldn’t copy — press and hold the ID to copy it.</p>}
        <p className={styles.safety}>
          <ShieldCheck aria-hidden="true" strokeWidth={2.25} />
          <span>
            Check that your UPI app shows <strong>{payeeName}</strong> before you pay. {BRAND.name} never touches your money.
          </span>
        </p>
      </div>
      <p className="visually-hidden" role="status">
        {copied === 'done' ? 'UPI ID copied' : ''}
      </p>
    </div>
  )
}
