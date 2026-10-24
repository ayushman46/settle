import { useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Copy, Share2 } from 'lucide-react'
import { ActionBar, Avatar, Banner, BottomSheet, Button, IconButton, Money, QrCode, useToast } from '../components'
import { updateFriend, useFriend, useFriendsById, useProfile } from '../data'
import { ME_ID, type Minor } from '../domain/types'
import { useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { copyText, shareResult } from '../lib/share'
import { buildUpiLink, buildUpiRequestText, isValidUpiId, normalizeUpiId } from '../lib/upi'
import { outsideName } from '../share/names'
import { FINE_POINTER, useMediaQuery } from './media'
import { PayAppChooser } from './PayAppChooser'
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
  const t = useT()
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
      ? {
          eyebrow: note ?? t('kit.upi.paying.eyebrow'),
          title: t('kit.upi.paying.title', { name: payee.name }),
          description: t('kit.upi.paying.description'),
        }
      : perspective === 'collecting'
        ? {
            eyebrow: t('kit.upi.collecting.eyebrow', { name: payer.name }),
            title: t('kit.upi.collecting.title', { name: payer.name }),
            description: t('kit.upi.collecting.description'),
          }
        : {
            eyebrow: t('kit.upi.between.eyebrow', { from: payer.name, to: payee.name }),
            title: t('kit.upi.between.title', { from: payer.name, to: payee.name }),
            description: t('kit.upi.between.description'),
          }

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
    toast(saved ? t('kit.upi.saved.toast') : t('kit.upi.added.toast'), { tone: 'success' })
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
      const outcome = await shareResult(text, { title: t('kit.upi.share.title', { name: payeeOutside }) })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast(t('kit.upi.requestCopied.toast'), { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('kit.upi.shareFailed.toast'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const copyId = async (): Promise<void> => {
    if (!vpa) return
    if (await copyText(vpa)) {
      haptic('success')
      toast(t('kit.upi.idCopied.toast'), { tone: 'success' })
    } else {
      haptic('error')
      toast(t('kit.upi.copyFailed.toast'), { tone: 'error' })
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
  if (sendRequest || onMarkPaid) {
    footer = (
      <ActionBar>
        {sendRequest && (
          <Button block iconStart={<Share2 />} onClick={share}>
            {t('kit.upi.sendRequest.cta')}
          </Button>
        )}
        {onMarkPaid && (
          <Button block variant={openApp || sendRequest ? 'secondary' : 'primary'} iconStart={<Check />} onClick={markPaid}>
            {perspective === 'paying' ? t('kit.upi.paid.cta') : t('kit.upi.markPaid.cta')}
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
          <Banner tone="info" className={styles.notice} title={t('kit.upi.rupeesOnly.title')}>
            {t('kit.upi.rupeesOnly.body')}
          </Banner>
        ) : vpa === null ? (
          <div className={styles.missing}>
            <UpiIdForm
              key={payeeKey}
              ownerId={canSave ? (payee.id ?? null) : null}
              ownerName={payee.name}
              onSave={saveUpi}
              submitLabel={canSave ? t('kit.upiForm.save.cta') : t('kit.upi.useId.cta')}
              lead={
                payee.id === ME_ID
                  ? t('kit.upi.missing.mine')
                  : t('kit.upi.missing.theirs', { name: payee.name })
              }
            />
          </div>
        ) : (
          <>
            {openApp && (
              <div className={styles.apps}>
                <PayAppChooser input={{ vpa, payeeName: payeeOutside, amountMinor: amount, note }} />
              </div>
            )}
            <QrCode
              value={link}
              size={216}
              label={amount > 0 ? t('kit.upi.qr.aria', { amount: amountText, name: payeeOutside }) : t('kit.upi.qr.aria.noAmount', { name: payeeOutside })}
              className={styles.qr}
            />
            <p className={styles.caption}>
              {perspective === 'paying' && computer
                ? t('kit.upi.qr.computer')
                : t('kit.upi.qr.apps')}
            </p>
            <div className={styles.vpa}>
              <span className={styles.vpaLabel}>{t('kit.upi.to')}</span>
              <span className={styles.vpaId}>{vpa}</span>
              <IconButton label={t('kit.upi.copy.aria')} size="sm" onClick={copyId}>
                <Copy />
              </IconButton>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
