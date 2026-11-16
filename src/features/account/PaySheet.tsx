import { useEffect, useRef, useState } from 'react'
import { Banner, BottomSheet, Button, Chip, Spinner, TextField, useToast } from '../../components'
import { useT } from '../../i18n'
import { UpiPayBlock } from '../pay/UpiPayBlock'
import { cloud, idempotencyKey, type PayTicket } from './api'
import { inr } from './settlementText'
import styles from './Account.module.css'

interface Destination {
  id: string
  upiId: string
  displayName: string | null
  isDefault: boolean
}

export interface PaySheetProps {
  /** The settlement being paid; null closes the sheet. */
  settlementId: string | null
  payeeName: string
  amountPaise: number
  onClose: () => void
  /** Something changed on the server: reload the group. */
  onChanged: () => void
}

/**
 * Paying one settlement: records an attempt (one per opening of this sheet, so a retried request
 * can't make two), hands over to the person's UPI app the ways UPI allows, then asks what
 * happened. Opening the UPI app never counts as paid — only "I've paid", then the receiver's
 * own confirmation, moves the balance.
 */
export function PaySheet({ settlementId, payeeName, amountPaise, onClose, onChanged }: PaySheetProps) {
  const t = useT()
  const toast = useToast()
  const [ticket, setTicket] = useState<PayTicket | null>(null)
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [utr, setUtr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const started = useRef<string | null>(null)

  const prepare = async (id: string, paymentMethodId?: string) => {
    setTicket(null)
    setProblem(null)
    const res = await cloud<PayTicket>('POST', `/settlements/${id}/pay`, { idempotencyKey: idempotencyKey(), paymentMethodId })
    if (res.ok) {
      setTicket(res.data)
      onChanged()
    } else {
      setProblem({ code: res.code, message: res.message })
    }
  }

  useEffect(() => {
    if (settlementId === null || started.current === settlementId) return
    started.current = settlementId
    setUtr('')
    void prepare(settlementId)
    void cloud<{ destinations: Destination[] }>('GET', `/settlements/${settlementId}/destinations`).then((res) => {
      if (res.ok) setDestinations(res.data.destinations)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per settlement opened
  }, [settlementId])

  const close = () => {
    started.current = null
    setTicket(null)
    setProblem(null)
    setDestinations([])
    onClose()
  }

  const act = async (action: 'sent' | 'failed' | 'cancel') => {
    if (settlementId === null || busy) return
    setBusy(action)
    const res = await cloud<{ status: string }>('POST', `/settlements/${settlementId}/${action}`, action === 'sent' && utr.trim() ? { transactionReference: utr.trim() } : {})
    setBusy(null)
    if (!res.ok) {
      toast(res.message, { tone: 'error' })
      return
    }
    toast(action === 'sent' ? t('account.cloud.pay.sent.done', { name: payeeName }) : action === 'failed' ? t('account.cloud.pay.failed.done') : t('account.cloud.pay.cancelled'), {
      tone: action === 'sent' ? 'success' : 'neutral',
    })
    onChanged()
    close()
  }

  return (
    <BottomSheet open={settlementId !== null} onClose={close} title={t('account.cloud.pay.title', { name: payeeName, amount: inr(amountPaise) })} size="tall">
      <div className={styles.stack}>
        {!ticket && !problem && (
          <div className={styles.stack} role="status">
            <Spinner />
            <p className={styles.footnote}>{t('account.cloud.pay.preparing', { name: payeeName })}</p>
          </div>
        )}
        {problem && <Banner tone={problem.code === 'no_destination' ? 'warning' : 'error'}>{problem.message}</Banner>}
        {ticket && (
          <>
            <p className={styles.footnote}>{t('account.cloud.pay.to', { upi: ticket.upiId })}</p>
            {destinations.length > 1 && (
              <div className={styles.chips} role="group" aria-label={t('account.cloud.pay.otherDestination')}>
                {destinations.map((d) => (
                  <Chip key={d.id} selected={d.upiId === ticket.upiId} onClick={() => settlementId && d.upiId !== ticket.upiId && void prepare(settlementId, d.id)}>
                    {d.displayName ?? d.upiId}
                  </Chip>
                ))}
              </div>
            )}
            <UpiPayBlock payeeName={ticket.payeeName} vpa={ticket.upiId} amount={ticket.amountPaise} note={ticket.note} currency="INR" color={0} onPaid={() => void act('sent')} />
          </>
        )}
        <p className={styles.warning}>{t('account.cloud.pay.warning')}</p>
        <p className={styles.footnote}>{t('account.cloud.pay.noPin')}</p>
        <TextField
          label={t('account.cloud.pay.utr')}
          hint={t('account.cloud.pay.utr.hint', { name: payeeName })}
          value={utr}
          inputMode="numeric"
          maxLength={32}
          onChange={(e) => setUtr(e.currentTarget.value)}
        />
        <Button block loading={busy === 'sent'} onClick={() => void act('sent')}>
          {ticket ? t('account.cloud.pay.sent') : t('account.cloud.pay.outside')}
        </Button>
        {ticket && (
          <Button block variant="secondary" loading={busy === 'failed'} onClick={() => void act('failed')}>
            {t('account.cloud.pay.failed')}
          </Button>
        )}
        <Button block variant="ghost" loading={busy === 'cancel'} onClick={() => void act('cancel')}>
          {t('account.cloud.pay.cancel')}
        </Button>
      </div>
    </BottomSheet>
  )
}
