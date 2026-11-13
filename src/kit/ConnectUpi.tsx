import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Check, QrCode as QrIcon } from 'lucide-react'
import { Button } from '../components'
import { useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { canReadQr, readUpiQr, type UpiQr } from '../lib/upiQr'
import styles from './ConnectUpi.module.css'

export interface ConnectUpiProps {
  /** Called with the UPI ID (and the bank's name for it) read from the QR. */
  onConnect: (qr: UpiQr) => void
  /** The ID already connected, shown as done. */
  connected?: string | null
}

type Status = { kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; qr: UpiQr } | { kind: 'problem'; text: string }

/**
 * "Connect Google Pay" — your UPI ID with no typing: pick a picture of your own QR code from your
 * UPI app (a screenshot is fine) and the ID is read from it, on the phone, with the name on the
 * bank account to check. Shown only where the browser can read a QR; elsewhere the typed field
 * next to it is the way.
 */
export function ConnectUpi({ onConnect, connected = null }: ConnectUpiProps) {
  const t = useT()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  if (!canReadQr()) return null

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setStatus({ kind: 'reading' })
    const result = await readUpiQr(file)
    if (result.kind === 'ok') {
      haptic('success')
      setStatus({ kind: 'done', qr: result.qr })
      onConnect(result.qr)
      return
    }
    haptic('error')
    setStatus({ kind: 'problem', text: result.kind === 'other' ? t('kit.connect.other') : t('kit.connect.none') })
  }

  const done = status.kind === 'done' ? status.qr : null
  return (
    <div className={styles.connect}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e)} aria-label={t('kit.connect.cta')} />
      <Button type="button" variant="secondary" block iconStart={done || connected ? <Check /> : <QrIcon />} loading={status.kind === 'reading'} onClick={() => input.current?.click()} aria-describedby={`${id}-how`}>
        {done || connected ? t('kit.connect.again') : t('kit.connect.cta')}
      </Button>
      <p id={`${id}-how`} className={styles.how}>
        {t('kit.connect.how')}
      </p>
      <p className={status.kind === 'problem' ? styles.problem : styles.found} role="status">
        {done ? (done.name ? t('kit.connect.found', { upi: done.vpa, name: done.name }) : t('kit.connect.found.noName', { upi: done.vpa })) : status.kind === 'problem' ? status.text : ''}
      </p>
    </div>
  )
}
