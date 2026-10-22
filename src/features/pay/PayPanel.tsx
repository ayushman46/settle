import { useEffect, useId, useState, type Ref } from 'react'
import { ArrowRight, Check, ChevronLeft, Copy, ExternalLink, QrCode as QrIcon, Send, ShieldCheck } from 'lucide-react'
import {
  Avatar,
  Banner,
  Button,
  Money,
  QrCode,
  Receipt,
  ReceiptDivider,
  ReceiptRow,
  SuccessCheck,
} from '../../components'
import { BRAND } from '../../domain/types'
import { amountInWords } from '../../kit/amountWords'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText, shareResult } from '../../lib/share'
import type { PayLinkPayload, PayLinkUpiRequest } from '../../share/payLink'
import { firstName } from '../../share/text'
import { ctaClassName, ctaParts } from '../landing/cta'
import { itemBreakdown, paidMessage, payeeColor, payOption, type PayPerson } from './payView'
import { useTouchFirst } from './useTouchFirst'
import styles from './PayPanel.module.css'

/** How long "Copied" / "Message copied" stay up. */
const FEEDBACK_MS = 2400

type Feedback = 'idle' | 'done' | 'failed'

/** A status that falls back to idle after FEEDBACK_MS. */
function useFeedback(): [Feedback, (next: Feedback) => void] {
  const [state, setState] = useState<{ value: Feedback; at: number }>({ value: 'idle', at: 0 })
  useEffect(() => {
    if (state.value === 'idle') return
    const timer = setTimeout(() => setState({ value: 'idle', at: Date.now() }), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [state])
  return [state.value, (value) => setState({ value, at: Date.now() })]
}

export interface PayPanelProps {
  payload: PayLinkPayload
  person: PayPerson
  /** "Not you?" — back to the list. Omitted when there's only one person to be. */
  onChangePerson?: () => void
  /** The panel's heading (focused when the panel opens). */
  headingRef?: Ref<HTMLHeadingElement>
}

/**
 * One person's view of the request: their share, big; how to pay it (a UPI app on this phone,
 * a QR code from a computer, or the payee's UPI ID); who the money goes to; and what's in it.
 */
export function PayPanel({ payload, person, onChangePerson, headingRef }: PayPanelProps) {
  const headingId = useId()
  const [reveal, setReveal] = useState(false)
  const option = payOption(payload, person.index)
  const breakdown = itemBreakdown(payload, person.index)
  const words = amountInWords(person.amount, payload.c)
  const showPayment = !person.paid || reveal

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      {onChangePerson && (
        <button type="button" className={styles.change} onClick={onChangePerson}>
          <ChevronLeft aria-hidden="true" strokeWidth={2.5} />
          Not {person.name}? Pick your name
        </button>
      )}

      <div className={styles.hero}>
        <div className={styles.parties} aria-hidden="true">
          <Avatar name={person.name} color={person.color} size="lg" />
          <span className={styles.arrow}>
            <ArrowRight strokeWidth={2.5} />
          </span>
          <Avatar name={payload.to.n} color={payeeColor(payload)} size="lg" />
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {person.name}’s share
        </h2>
        <Money value={person.amount} currency={payload.c} size="xl" trimZeros className={styles.amount} />
        {words && <p className={styles.words}>{words}</p>}
      </div>

      {person.paid && !reveal && (
        <div className={styles.paid}>
          <SuccessCheck size="md" />
          <div>
            <p className={styles.paidTitle}>You’re all square</p>
            <p className={styles.paidText}>{payload.to.n} has marked your share as paid.</p>
          </div>
          {option.kind === 'upi' && (
            <Button variant="ghost" size="md" onClick={() => setReveal(true)} className={styles.reveal}>
              Show payment details anyway
            </Button>
          )}
        </div>
      )}

      {showPayment && option.kind === 'upi' && <UpiPay payload={payload} request={option.request} />}
      {showPayment && option.kind === 'nothing' && (
        <Banner tone="success" title="Nothing to pay">
          Your share of this one is {formatMoney(0, payload.c, { trimZeros: true })}.
        </Banner>
      )}
      {showPayment && option.kind === 'no_upi' && (
        <Banner tone="info" title={`${payload.to.n} didn’t add a UPI ID`}>
          Pay them the way you usually do — or ask for their UPI ID and pay from any UPI app.
        </Banner>
      )}
      {showPayment && option.kind === 'not_inr' && (
        <Banner tone="info" title="Pay the usual way">
          UPI only works in rupees, so pay {payload.to.n} the way you usually do.
        </Banner>
      )}

      {!person.paid && option.kind !== 'nothing' && <TellThem payload={payload} person={person} />}

      {breakdown && (
        <section className={styles.breakdown} aria-labelledby={`${headingId}-items`}>
          <h3 id={`${headingId}-items`} className={styles.breakdownTitle}>
            What’s in your share
          </h3>
          <Receipt>
            {breakdown.lines.map((line, i) => (
              <ReceiptRow
                key={`${i}-${line.name}`}
                label={
                  <span className={styles.line}>
                    {line.name}
                    {line.detail && <span className={styles.lineDetail}>{line.detail}</span>}
                  </span>
                }
                value={<Money value={line.amount} currency={payload.c} />}
              />
            ))}
            {breakdown.extras !== 0 && (
              <ReceiptRow
                label={breakdown.extras > 0 ? 'Tax, service and round-off' : 'Discounts and round-off'}
                value={<Money value={breakdown.extras} currency={payload.c} />}
                emphasis="muted"
              />
            )}
            <ReceiptDivider />
            <ReceiptRow
              label="Your share"
              value={<Money value={breakdown.share} currency={payload.c} strong />}
              emphasis="strong"
            />
          </Receipt>
        </section>
      )}
    </section>
  )
}

/** The ways to pay by UPI, led by what this device is good at, and who the money goes to. */
function UpiPay({ payload, request }: { payload: PayLinkPayload; request: PayLinkUpiRequest }) {
  const touch = useTouchFirst()
  const [qrOnTouch, setQrOnTouch] = useState(false)
  const [copied, setCopied] = useFeedback()
  const amount = formatMoney(request.amount, payload.c, { trimZeros: true })
  const showQr = !touch || qrOnTouch

  const copy = async () => {
    const ok = await copyText(request.vpa)
    haptic(ok ? 'success' : 'error')
    setCopied(ok ? 'done' : 'failed')
  }

  return (
    <div className={styles.pay}>
      {touch && (
        <>
          <a href={request.uri} className={ctaClassName({ block: true })} onClick={() => haptic('tap')}>
            <span>Pay {amount} with any UPI app</span>
            <span className={ctaParts.iconEnd} aria-hidden="true">
              <ExternalLink strokeWidth={2.25} />
            </span>
          </a>
          <p className={styles.caption}>Opens GPay, PhonePe, Paytm or BHIM with everything filled in.</p>
          <Button
            variant="ghost"
            size="md"
            iconStart={<QrIcon />}
            aria-expanded={qrOnTouch}
            onClick={() => setQrOnTouch((open) => !open)}
          >
            {qrOnTouch ? 'Hide the QR code' : 'Pay from another phone'}
          </Button>
        </>
      )}
      {showQr && (
        <div className={styles.qr}>
          <QrCode value={request.uri} size={224} label={`UPI QR code to pay ${amount} to ${payload.to.n}`} />
          <p className={styles.caption}>
            {touch
              ? 'Scan it with the UPI app on the other phone.'
              : 'Scan with any UPI app on your phone — GPay, PhonePe, Paytm, BHIM.'}
          </p>
        </div>
      )}

      <div className={styles.payee}>
        <p className={styles.payeeLabel}>Paying to</p>
        <div className={styles.payeeRow}>
          <Avatar name={payload.to.n} color={payeeColor(payload)} size="md" />
          <div className={styles.payeeText}>
            <span className={styles.payeeName}>{payload.to.n}</span>
            <span className={styles.vpa}>{request.vpa}</span>
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
            Check that your UPI app shows <strong>{payload.to.n}</strong> before you pay. {BRAND.name} never touches
            your money.
          </span>
        </p>
      </div>
      <p className="visually-hidden" role="status">
        {copied === 'done' ? 'UPI ID copied' : ''}
      </p>
    </div>
  )
}

/** "Paid? Let them know" — a ready message for the group chat (share sheet on phones, clipboard elsewhere). */
function TellThem({ payload, person }: { payload: PayLinkPayload; person: PayPerson }) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')
  const send = async () => {
    const outcome = await shareResult(paidMessage(payload, person), { title: payload.t })
    if (outcome === 'cancelled') return
    haptic(outcome === 'failed' ? 'error' : 'success')
    setStatus(outcome)
  }
  return (
    <div className={styles.tell}>
      <p className={styles.tellTitle}>Paid?</p>
      <Button variant="secondary" size="md" iconStart={<Send />} onClick={send} block>
        Tell {firstName(payload.to.n)} you’ve paid
      </Button>
      <p className={styles.tellStatus} role="status">
        {status === 'copied' && 'Message copied — paste it in your chat.'}
        {status === 'shared' && 'Sent. Thanks for settling up!'}
        {status === 'failed' && 'Couldn’t share the message. Try again.'}
      </p>
    </div>
  )
}
