import { useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { ActionBar, Avatar, Banner, BottomSheet, Button, IconButton, Money, QrCode, useToast } from '../components'
import { updateFriend, useFriend, useFriendsById, useProfile } from '../data'
import { ME_ID, type Minor } from '../domain/types'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { copyText, shareResult } from '../lib/share'
import { buildUpiLink, buildUpiRequestText, isValidUpiId, normalizeUpiId } from '../lib/upi'
import { outsideName } from '../share/names'
import { FINE_POINTER, useMediaQuery } from './media'
import { UpiIdForm } from './UpiIdForm'
import styles from './UpiPaySheet.module.css'

export interface UpiPayee {
  /** Their friend id (`ME_ID` for you). With it, a missing UPI ID can be added and saved to them. */
  id?: string
  name: string
  upiId: string | null
  /** Avatar colour; looked up from `id` when left out. */
  color?: number
}

export interface UpiPayer {
  /** Their friend id (`ME_ID` when you're the one paying). */
  id?: string
  name: string
  color: number
}

export interface UpiPaySheetProps {
  open: boolean
  onClose: () => void
  /** Who receives the money. */
  payee: UpiPayee
  /** Who pays. */
  payer: UpiPayer
  /** Minor units. Zero or less leaves the amount for the UPI app to ask. */
  amount: Minor
  currency: string
  /** Transaction note, e.g. the expense title. */
  note: string | null
  /**
   * Offers "I’ve paid" (you paying) or "Mark as paid" under the payment, for once the money has
   * moved — in the UPI app, by bank transfer or in cash. Called, then the sheet closes.
   */
  onMarkPaid?: () => void
}

type Perspective = 'paying' | 'collecting' | 'between'

/** The first of `ids` that is a valid UPI ID, normalized. */
function firstValidUpi(ids: ReadonlyArray<string | null | undefined>): string | null {
  for (const id of ids) if (id && isValidUpiId(id)) return normalizeUpiId(id)
  return null
}

/**
 * One UPI payment, from any side: "Pay Riya" (opens your UPI app), "Collect from Sam" (a QR to
 * show them, or a request to send) or "Sam pays Riya". A QR any UPI app can scan, the UPI ID to
 * copy, and — when the payee has no UPI ID yet — a field to add one (saved to them when they're
 * one of your people, or to your profile for you). UPI only moves rupees, so other currencies
 * get an honest note instead of a code.
 */
export function UpiPaySheet({ open, onClose, payee, payer, amount, currency, note, onMarkPaid }: UpiPaySheetProps) {
  const toast = useToast()
  const busy = useRef(false)
  const computer = useMediaQuery(FINE_POINTER)
  const profile = useProfile()
  const friendsById = useFriendsById()
  const stored = useFriend(payee.id ?? null)
  const canSave = payee.id === ME_ID || stored !== null
  // Typed here for someone it can't be saved to. Kept for that payee only: the same sheet
  // reopened for someone else must never offer the old ID.
  const payeeKey = `${payee.id ?? ''}\u0000${payee.name}`
  const [typed, setTyped] = useState<{ payeeKey: string; upiId: string } | null>(null)
  const typedUpi = typed !== null && typed.payeeKey === payeeKey ? typed.upiId : null

  const perspective: Perspective = payer.id === ME_ID ? 'paying' : payee.id === ME_ID ? 'collecting' : 'between'
  const live = payee.id === ME_ID ? profile.upiId : (stored?.upiId ?? null)
  const vpa = firstValidUpi([live, payee.upiId, typedUpi])
  const rupees = currency === 'INR'

  // Names other people see (never "You"): in the UPI app and in the request message.
  const payeeOutside = payee.id ? outsideName(payee.id, friendsById, profile, payee.name) : payee.name
  const payerOutside = payer.id ? outsideName(payer.id, friendsById, profile, payer.name) : payer.name
  const link = vpa && rupees ? buildUpiLink({ vpa, payeeName: payeeOutside, amountMinor: amount, note }) : ''
  const amountText = formatMoney(amount, currency, { trimZeros: true })

  const heading =
    perspective === 'paying'
      ? { eyebrow: note ?? 'Your share', title: `Pay ${payee.name}`, description: 'Opens your UPI app with the amount filled in.' }
      : perspective === 'collecting'
        ? { eyebrow: `${payer.name} owes you`, title: `Collect from ${payer.name}`, description: 'Show them this code, or send the request.' }
        : { eyebrow: `${payer.name} owes ${payee.name}`, title: `${payer.name} pays ${payee.name}`, description: 'Scan with any UPI app, or send the request.' }

  const saveUpi = (upiId: string): void => {
    let saved = false
    if (canSave && payee.id) {
      try {
        updateFriend(payee.id, { upiId })
        saved = true
      } catch {
        // Removed a moment ago: use the ID for this payment anyway.
      }
    }
    if (!saved) setTyped({ payeeKey, upiId })
    haptic('success')
    toast(saved ? 'UPI ID saved' : 'UPI ID added', { tone: 'success' })
  }

  const share = async (): Promise<void> => {
    if (!vpa || busy.current) return
    busy.current = true
    try {
      const text = buildUpiRequestText({
        debtorName: payerOutside,
        payerName: payeeOutside,
        vpa,
        amountMinor: amount,
        merchant: note,
        link,
      })
      const outcome = await shareResult(text, { title: `Pay ${payeeOutside}` })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast('Payment request copied', { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast('Couldn’t share the request. Try again.', { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const copyId = async (): Promise<void> => {
    if (!vpa) return
    if (await copyText(vpa)) {
      haptic('success')
      toast('UPI ID copied', { tone: 'success' })
    } else {
      haptic('error')
      toast('Couldn’t copy. Long-press the ID instead.', { tone: 'error' })
    }
  }

  const markPaid = (): void => {
    haptic('success')
    onMarkPaid?.()
    onClose()
  }

  const ready = vpa !== null && rupees
  // Computers can't open UPI apps: there, the QR is the way (scan it with your phone).
  const openApp = ready && perspective === 'paying' && !computer
  const sendRequest = ready && perspective !== 'paying'
  let footer: ReactNode = null
  if (openApp || sendRequest || onMarkPaid) {
    footer = (
      <ActionBar>
        {openApp && (
          <a className={styles.openApp} href={link}>
            <ExternalLink aria-hidden="true" strokeWidth={2.25} />
            Pay {amount > 0 ? amountText : payee.name} in your UPI app
          </a>
        )}
        {sendRequest && (
          <Button block iconStart={<Share2 />} onClick={share}>
            Send request
          </Button>
        )}
        {onMarkPaid && (
          <Button block variant={openApp || sendRequest ? 'secondary' : 'primary'} iconStart={<Check />} onClick={markPaid}>
            {perspective === 'paying' ? 'I’ve paid' : 'Mark as paid'}
          </Button>
        )}
      </ActionBar>
    )
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={heading.eyebrow}
      title={heading.title}
      description={ready ? heading.description : undefined}
      footer={footer}
    >
      <div className={styles.body}>
        <div className={styles.parties} aria-hidden="true">
          <Avatar name={payerOutside} color={payer.color} size="md" />
          <ArrowRight className={styles.partiesArrow} strokeWidth={2.25} />
          <Avatar name={payeeOutside} color={payee.color ?? stored?.color ?? 0} size="md" />
        </div>
        <Money value={amount} currency={currency} size="xl" trimZeros className={styles.amount} />

        {!rupees ? (
          <Banner tone="info" className={styles.notice} title="UPI works in rupees only">
            Settle this one by bank transfer or cash, then mark it paid.
          </Banner>
        ) : vpa === null ? (
          <div className={styles.missing}>
            <UpiIdForm
              key={payeeKey}
              ownerId={canSave ? (payee.id ?? null) : null}
              ownerName={payee.name}
              onSave={saveUpi}
              submitLabel={canSave ? 'Save UPI ID' : 'Use this UPI ID'}
              lead={
                payee.id === ME_ID
                  ? 'Add your UPI ID to get paid in a tap.'
                  : `${payee.name} hasn’t added a UPI ID yet. Add it to get a QR code.`
              }
            />
          </div>
        ) : (
          <>
            <QrCode
              value={link}
              size={216}
              label={`UPI QR code to pay ${amount > 0 ? `${amountText} ` : ''}to ${payeeOutside}`}
              className={styles.qr}
            />
            <p className={styles.caption}>
              {perspective === 'paying' && computer
                ? 'Scan this with the UPI app on your phone.'
                : 'Works with GPay, PhonePe, Paytm, BHIM and every UPI app.'}
            </p>
            <div className={styles.vpa}>
              <span className={styles.vpaLabel}>To</span>
              <span className={styles.vpaId}>{vpa}</span>
              <IconButton label="Copy UPI ID" size="sm" onClick={copyId}>
                <Copy />
              </IconButton>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
