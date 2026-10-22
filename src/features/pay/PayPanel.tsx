import { useId, useState, type Ref } from 'react'
import { ArrowRight, ChevronLeft, Send } from 'lucide-react'
import {
  Avatar,
  Banner,
  Button,
  Money,
  Receipt,
  ReceiptDivider,
  ReceiptRow,
  SuccessCheck,
} from '../../components'
import { amountInWords } from '../../kit/amountWords'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import type { PayLinkPayload, PayLinkUpiRequest } from '../../share/payLink'
import { firstName } from '../../share/text'
import { extrasLabel, itemBreakdown, paidMessage, payeeColor, payOption, type PayPerson } from './payView'
import { UpiPayBlock } from './UpiPayBlock'
import styles from './PayPanel.module.css'

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
                label={extrasLabel(breakdown.extras)}
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

/** The ways to pay this request by UPI (see `UpiPayBlock`). */
function UpiPay({ payload, request }: { payload: PayLinkPayload; request: PayLinkUpiRequest }) {
  return <UpiPayBlock payeeName={payload.to.n} vpa={request.vpa} amount={request.amount} note={payload.t} currency={payload.c} color={payeeColor(payload)} />
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
