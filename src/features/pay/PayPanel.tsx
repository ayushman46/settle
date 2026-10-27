import { useEffect, useId, useMemo, useRef, useState, type Ref, type RefObject } from 'react'
import { ArrowRight, ChevronLeft, MessageCircle, Send } from 'lucide-react'
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Money,
  Receipt,
  ReceiptDivider,
  ReceiptRow,
  SuccessCheck,
  TextField,
} from '../../components'
import { useLang, useT } from '../../i18n'
import { amountInWords } from '../../kit/amountWords'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { whatsappUrl } from '../../share/links'
import { cleanUtr, encodePaidReply, paidReplyFor, type PaidHow } from '../../share/paidReply'
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
  const t = useT()
  const lang = useLang()
  const headingId = useId()
  const [reveal, setReveal] = useState(false)
  const option = payOption(payload, person.index)
  const breakdown = itemBreakdown(payload, person.index)
  // The amount in English words reads as noise in any other language (i18n-plan §7).
  const words = lang === 'en' ? amountInWords(person.amount, payload.c) : null
  const showPayment = !person.paid || reveal
  const tellRef = useRef<HTMLParagraphElement>(null)

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      {onChangePerson && (
        <button type="button" className={styles.change} onClick={onChangePerson}>
          <ChevronLeft aria-hidden="true" strokeWidth={2.5} />
          {t('pay.panel.notYou.cta', { name: person.name })}
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
          {t('pay.panel.share.title', { name: person.name })}
        </h2>
        <Money value={person.amount} currency={payload.c} size="xl" trimZeros className={styles.amount} />
        {words && <p className={styles.words}>{words}</p>}
      </div>

      {person.paid && !reveal && (
        <div className={styles.paid}>
          <SuccessCheck size="md" />
          <div>
            <p className={styles.paidTitle}>{t('pay.panel.paid.title')}</p>
            <p className={styles.paidText}>{t('pay.panel.paid.body', { name: payload.to.n })}</p>
          </div>
          {option.kind === 'upi' && (
            <Button variant="ghost" size="md" onClick={() => setReveal(true)} className={styles.reveal}>
              {t('pay.panel.reveal.cta')}
            </Button>
          )}
        </div>
      )}

      {showPayment && option.kind === 'upi' && (
        <UpiPay
          payload={payload}
          request={option.request}
          onPaid={() => {
            // "Yes, I paid": on to telling them.
            const title = tellRef.current
            if (title && typeof title.scrollIntoView === 'function') title.scrollIntoView({ block: 'center' })
            title?.focus({ preventScroll: true })
          }}
        />
      )}
      {showPayment && option.kind === 'nothing' && (
        <Banner tone="success" title={t('pay.panel.nothing.title')}>
          {t('pay.panel.nothing.body', { amount: formatMoney(0, payload.c, { trimZeros: true }) })}
        </Banner>
      )}
      {showPayment && option.kind === 'no_upi' && (
        <Banner tone="info" title={t('pay.panel.noUpi.title', { name: payload.to.n })}>
          {t('pay.panel.noUpi.body')}
        </Banner>
      )}
      {showPayment && option.kind === 'not_inr' && (
        <Banner tone="info" title={t('pay.panel.notInr.title')}>
          {t('pay.panel.notInr.body', { name: payload.to.n })}
        </Banner>
      )}

      {!person.paid && option.kind !== 'nothing' && <TellThem payload={payload} person={person} titleRef={tellRef} />}

      {breakdown && (
        <section className={styles.breakdown} aria-labelledby={`${headingId}-items`}>
          <h3 id={`${headingId}-items`} className={styles.breakdownTitle}>
            {t('pay.panel.breakdown.title')}
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
              label={t('pay.panel.breakdown.share')}
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
function UpiPay({ payload, request, onPaid }: { payload: PayLinkPayload; request: PayLinkUpiRequest; onPaid: () => void }) {
  return (
    <UpiPayBlock
      payeeName={payload.to.n}
      vpa={request.vpa}
      amount={request.amount}
      note={payload.t}
      currency={payload.c}
      color={payeeColor(payload)}
      onPaid={onPaid}
    />
  )
}

/** The "I've paid" reply link for these answers, packed ahead of the tap (a share sheet needs a fresh tap). */
function useReplyLink(payload: PayLinkPayload, index: number, how: PaidHow, utr: string | null): { key: string; link: string | null } {
  const reply = useMemo(() => paidReplyFor(payload, index, how, utr), [payload, index, how, utr])
  const key = reply ? JSON.stringify(reply) : ''
  const [packed, setPacked] = useState<{ key: string; link: string } | null>(null)
  const ready = packed !== null && packed.key === key ? packed.link : null
  useEffect(() => {
    if (reply === null || ready !== null) return
    let live = true
    void encodePaidReply(reply).then((link) => {
      if (live) setPacked({ key, link })
    })
    return () => {
      live = false
    }
  }, [reply, key, ready])
  return { key, link: ready }
}

/**
 * "Paid? Tell them" — how they paid (UPI, with the reference if they have it, or cash) and a
 * ready message with a link that ticks them off in the payee's Settle: straight to the payee's
 * WhatsApp when the link carries their number, else the share sheet (clipboard on computers).
 */
function TellThem({ payload, person, titleRef }: { payload: PayLinkPayload; person: PayPerson; titleRef: RefObject<HTMLParagraphElement | null> }) {
  const t = useT()
  const groupId = useId()
  const [how, setHow] = useState<PaidHow>('upi')
  const [utrText, setUtrText] = useState('')
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed' | 'opened'>('idle')
  const utr = how === 'upi' ? cleanUtr(utrText) : null
  const utrBad = how === 'upi' && utrText.trim() !== '' && utr === null
  const reply = useReplyLink(payload, person.index, how, utr)
  // Links without an expense id (older ones) still get the plain message.
  const ready = reply.key === '' || reply.link !== null
  const name = firstName(payload.to.n)
  const phone = payload.to.ph ?? null

  const send = async () => {
    const message = paidMessage(payload, person, { how, utr, link: reply.link })
    if (phone) {
      const win = window.open(whatsappUrl(message, phone), '_blank')
      if (win) {
        win.opener = null
        haptic('success')
        setStatus('opened')
        return
      }
    }
    const outcome = await shareResult(message, { title: payload.t })
    if (outcome === 'cancelled') return
    haptic(outcome === 'failed' ? 'error' : 'success')
    setStatus(outcome)
  }

  return (
    <div className={styles.tell}>
      <p className={styles.tellTitle} id={groupId} ref={titleRef} tabIndex={-1}>
        {t('pay.tell.title')}
      </p>
      <div role="radiogroup" aria-labelledby={groupId} className={styles.tellHow}>
        {(['upi', 'cash'] as const).map((value) => (
          <Chip key={value} role="radio" selected={how === value} onClick={() => setHow(value)}>
            {value === 'upi' ? t('pay.tell.how.upi') : t('pay.tell.how.cash')}
          </Chip>
        ))}
      </div>
      {how === 'upi' && (
        <TextField
          label={t('pay.tell.utr.label')}
          hint={t('pay.tell.utr.hint')}
          error={utrBad ? t('pay.tell.utr.error') : undefined}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={20}
          value={utrText}
          onChange={(event) => setUtrText(event.target.value)}
        />
      )}
      <Button variant="secondary" size="md" iconStart={phone ? <MessageCircle /> : <Send />} onClick={send} disabled={!ready || utrBad} block>
        {t('pay.tell.cta', { name })}
      </Button>
      <p className={styles.tellStatus} role="status">
        {status === 'opened' && t('pay.tell.opened.status', { name })}
        {status === 'copied' && t('pay.tell.copied.status')}
        {status === 'shared' && t('pay.tell.shared.status')}
        {status === 'failed' && t('pay.tell.failed.status')}
      </p>
    </div>
  )
}
