import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, ImageDown, QrCode as QrIcon, ShieldCheck } from 'lucide-react'
import { Avatar, Button, QrCode, SegmentedControl } from '../components'
import { BRAND, type Minor } from '../domain/types'
import { tx, useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { formatMoney, toInputString } from '../lib/money'
import { GALLERY_QR_MAX_PAISE, openAppHref, PAY_APPS, payPlatform, type PayApp, type PayPlatform } from '../lib/paymentApps'
import { qrPicture } from '../lib/qrPicture'
import { copyText } from '../lib/share'
import { buildUpiLink } from '../lib/upi'
import { shareFile } from '../share/shareFile'
import styles from './UpiRoutes.module.css'

/** How long "Copied" stays up. */
const COPIED_MS = 2400
/**
 * How long after an iPhone "Open GPay" tap the page may still be showing before we say the app may
 * not be installed. Opening an app hides the page well within this.
 */
export const NOT_OPENED_MS = 2500

type Route = 'gallery' | 'id'
type Copied = 'id' | 'amount' | 'failed' | null

export interface UpiRoutesProps {
  /** Who the money goes to (as their UPI app will show it, roughly: apps show the bank's name). */
  payeeName: string
  /** Their UPI ID (valid). */
  vpa: string
  /** In paise; 0 leaves the amount for the payer to type. */
  amount: Minor
  /** The UPI note ("Friday dinner"). */
  note: string | null
  /** The payee's avatar colour. */
  color: number
  /** A phone (touch first) rather than a computer. */
  phone: boolean
  /** Overrides the device check (tests). */
  platform?: PayPlatform
  /** The payer started paying: saved the QR, copied the UPI ID, or opened an app. */
  onStarted?: () => void
  /** "Yes, I paid" when they come back from their UPI app. Without it, no question is asked. */
  onPaid?: () => void
}

/**
 * Paying one person by UPI, the ways UPI allows. NPCI has payer apps refuse payments to a person
 * that start from a link (OC 76C; Consolidated Circular 7.9), so there's no "Pay" link here:
 * - computer: the QR, to scan with any UPI app — amount and note fill in, any amount;
 * - phone, up to ₹2,000: save the QR, then Scan → Upload it in the UPI app (a QR picture pays a
 *   person up to ₹2,000), or the UPI ID;
 * - phone, more: copy the UPI ID and pay by UPI ID (always works), or scan from another screen.
 * Then the payee (their UPI ID with Copy, and a name check), a "Did you pay?" when they come back,
 * and what to do when a payment doesn't go through.
 */
export function UpiRoutes({ payeeName, vpa, amount, note, color, phone, platform = payPlatform(), onStarted, onPaid }: UpiRoutesProps) {
  const t = useT()
  const helpId = useId()
  const small = amount > 0 && amount <= GALLERY_QR_MAX_PAISE
  const [picked, setPicked] = useState<Route | null>(null)
  const route: Route = small ? (picked ?? 'gallery') : 'id'
  const [screenQr, setScreenQr] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [copied, setCopied] = useState<Copied>(null)
  const [asking, setAsking] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notOpened, setNotOpened] = useState<string | null>(null)
  const left = useRef(false)
  const watch = useRef<number | undefined>(undefined)
  const uri = buildUpiLink({ vpa, payeeName, amountMinor: amount, note })
  const money = formatMoney(amount, 'INR', { trimZeros: true })
  const hasAmount = amount > 0
  const qrLabel = hasAmount ? t('kit.upiPay.qr.aria', { amount: money, name: payeeName }) : t('kit.upiPay.qr.aria.noAmount', { name: payeeName })

  useEffect(() => {
    if (copied === null) return
    const timer = setTimeout(() => setCopied(null), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  // Off to the UPI app (the page hid after they started): ask, for when they're back, whether it went through.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || !left.current) return
      left.current = false
      window.clearTimeout(watch.current)
      setNotOpened(null)
      if (onPaid) setAsking(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(watch.current)
    }
  }, [onPaid])

  const started = (): void => {
    left.current = true
    onStarted?.()
  }

  const copy = async (what: 'id' | 'amount'): Promise<void> => {
    const ok = await copyText(what === 'id' ? vpa : toInputString(amount, 'INR', { trimZeros: true }).replace(/,/g, ''))
    haptic(ok ? 'success' : 'error')
    setCopied(ok ? what : 'failed')
    if (ok) started()
  }

  const save = async (): Promise<void> => {
    if (saved === 'saving') return
    setSaved('saving')
    const picture = await qrPicture(uri, [
      { text: t('kit.upiPay.picture.pay', { name: payeeName }), size: 34, bold: true },
      ...(hasAmount ? [{ text: money, size: 52, bold: true }] : []),
      ...(note ? [{ text: note, size: 26 }] : []),
      { text: t('kit.upiPay.picture.scan'), size: 24 },
    ])
    const outcome = picture
      ? await shareFile(picture, `${BRAND.name} QR ${payeeName} ${toInputString(amount, 'INR', { trimZeros: true })}.png`, undefined, {
          // iPhone: the share sheet's "Save Image" puts it in Photos; elsewhere a download lands in the gallery.
          prefer: platform === 'ios' ? 'share' : 'download',
        })
      : 'failed'
    if (outcome === 'cancelled') {
      setSaved('idle')
      return
    }
    const ok = outcome !== 'failed'
    haptic(ok ? 'success' : 'error')
    setSaved(ok ? 'saved' : 'failed')
    if (ok) started()
  }

  const openApp = (app: PayApp): void => {
    haptic('tap')
    started()
    setNotOpened(null)
    window.clearTimeout(watch.current)
    watch.current = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setNotOpened(app.name)
    }, NOT_OPENED_MS)
  }

  const answer = (paid: boolean): void => {
    setAsking(false)
    if (paid) {
      haptic('success')
      onPaid?.()
    } else setHelpOpen(true)
  }

  const appLinks = PAY_APPS.flatMap((app) => {
    const href = openAppHref(app, platform)
    return href ? [{ app, href }] : []
  })

  const steps = (keys: readonly string[]) => (
    <ol className={styles.steps}>
      {keys.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ol>
  )

  const copyAmount = hasAmount && (
    <Button size="sm" variant="tonal" iconStart={copied === 'amount' ? <Check /> : <Copy />} onClick={() => void copy('amount')} aria-label={t('kit.upiPay.amount.copy.aria', { amount: money })}>
      {copied === 'amount' ? t('kit.upiPay.amount.copied') : t('kit.upiPay.amount.copy')}
    </Button>
  )

  return (
    <div className={styles.routes}>
      {!phone ? (
        <div className={styles.card}>
          <QrCode value={uri} size={224} label={qrLabel} className={styles.qr} />
          <p className={styles.caption}>{hasAmount ? t('kit.upiPay.desktop.caption', { amount: money }) : t('kit.upiPay.desktop.caption.noAmount')}</p>
          <p className={styles.caption}>{t('kit.upiPay.desktop.id', { name: payeeName })}</p>
        </div>
      ) : (
        <>
          {small && (
            <SegmentedControl
              ariaLabel={t('kit.upiPay.route.aria')}
              value={route}
              onChange={(next) => setPicked(next)}
              options={[
                { value: 'gallery', label: t('kit.upiPay.route.gallery') },
                { value: 'id', label: t('kit.upiPay.route.id') },
              ]}
              className={styles.switch}
            />
          )}

          {route === 'gallery' ? (
            <div className={styles.card}>
              <Button block iconStart={saved === 'saved' ? <Check /> : <ImageDown />} loading={saved === 'saving'} onClick={() => void save()}>
                {saved === 'saved' ? t('kit.upiPay.saved.cta') : platform === 'ios' ? t('kit.upiPay.save.cta.ios') : t('kit.upiPay.save.cta')}
              </Button>
              {saved === 'failed' && <p className={styles.problem}>{t('kit.upiPay.saveFailed')}</p>}
              <p className={styles.lead}>{t('kit.upiPay.gallery.lead', { amount: money })}</p>
              {steps([t('kit.upiPay.gallery.step1'), t('kit.upiPay.gallery.step2'), t('kit.upiPay.gallery.step3', { amount: money }), t('kit.upiPay.step.check')])}
              <p className={styles.fine}>{t('kit.upiPay.gallery.cap')}</p>
            </div>
          ) : (
            <div className={styles.card}>
              <Button block iconStart={copied === 'id' ? <Check /> : <Copy />} onClick={() => void copy('id')}>
                {copied === 'id' ? t('kit.upiPay.id.copied') : t('kit.upiPay.id.copy')}
              </Button>
              <ol className={styles.steps}>
                <li>{t('kit.upiPay.id.step1')}</li>
                <li>{t('kit.upiPay.id.step2')}</li>
                <li>
                  <span>{hasAmount ? t('kit.upiPay.id.step3', { amount: money }) : t('kit.upiPay.id.step3.noAmount')}</span>
                  {copyAmount}
                </li>
                <li>{t('kit.upiPay.step.check')}</li>
              </ol>
              {amount > GALLERY_QR_MAX_PAISE && <p className={styles.fine}>{t('kit.upiPay.id.why')}</p>}
            </div>
          )}

          {appLinks.length > 0 && (
            <div className={styles.open}>
              <p className={styles.openLabel}>{t('kit.upiPay.open.label')}</p>
              <ul role="list" className={styles.openApps}>
                {appLinks.map(({ app, href }) => (
                  <li key={app.id}>
                    <a className={styles.openApp} href={href} onClick={() => openApp(app)} aria-label={t('kit.upiPay.open.app', { app: app.name })}>
                      {app.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p role="status" className={notOpened ? styles.problem : 'visually-hidden'}>
                {notOpened ? t('kit.upiPay.notOpened', { app: notOpened }) : ''}
              </p>
            </div>
          )}

          <Button variant="ghost" size="md" iconStart={<QrIcon />} aria-expanded={screenQr} onClick={() => setScreenQr((open) => !open)}>
            {screenQr ? t('kit.upiPay.screen.hide') : t('kit.upiPay.screen.show')}
          </Button>
          {screenQr && (
            <div className={styles.card}>
              <QrCode value={uri} size={224} label={qrLabel} className={styles.qr} />
              <p className={styles.caption}>{t('kit.upiPay.screen.caption')}</p>
            </div>
          )}
        </>
      )}

      <div className={styles.payee}>
        <p className={styles.payeeLabel}>{t('kit.upiPay.payee.label')}</p>
        <div className={styles.payeeRow}>
          <Avatar name={payeeName} color={color} size="md" />
          <div className={styles.payeeText}>
            <span className={styles.payeeName}>{payeeName}</span>
            <span className={styles.vpa}>{vpa}</span>
          </div>
          <Button
            variant="tonal"
            size="sm"
            iconStart={copied === 'id' ? <Check /> : <Copy />}
            aria-label={copied === 'id' ? t('kit.upiPay.id.copied') : t('kit.upiPay.id.copy')}
            onClick={() => void copy('id')}
          >
            {copied === 'id' ? t('kit.upiPay.copied.short') : t('kit.upiPay.copy.short')}
          </Button>
        </div>
        {!phone && hasAmount && (
          <div className={styles.amountRow}>
            <span>{t('kit.upiPay.id.step3', { amount: money })}</span>
            {copyAmount}
          </div>
        )}
        {copied === 'failed' && <p className={styles.problem}>{t('kit.upiPay.copyFailed')}</p>}
        <p className={styles.safety}>
          <ShieldCheck aria-hidden="true" strokeWidth={2.25} />
          <span>{tx('kit.upiPay.safety', { name: payeeName, brand: BRAND.name }, { b: (chunk) => <strong>{chunk}</strong> })}</span>
        </p>
      </div>

      {asking && (
        <div className={styles.ask} role="group" aria-labelledby={`${helpId}-ask`}>
          <p id={`${helpId}-ask`} className={styles.askTitle}>
            {hasAmount ? t('kit.upiPay.ask.title', { name: payeeName, amount: money }) : t('kit.upiPay.ask.title.noAmount', { name: payeeName })}
          </p>
          <div className={styles.askActions}>
            <Button size="md" onClick={() => answer(true)}>
              {t('kit.upiPay.ask.yes')}
            </Button>
            <Button size="md" variant="secondary" onClick={() => answer(false)}>
              {t('kit.upiPay.ask.no')}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.help}>
        <button type="button" className={styles.helpToggle} aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen((open) => !open)}>
          <span>{t('kit.upiPay.help.title')}</span>
          <ChevronDown aria-hidden="true" className={helpOpen ? styles.chevronOpen : styles.chevron} />
        </button>
        <dl id={helpId} className={styles.helpBody} hidden={!helpOpen}>
          {(['limit', 'risky', 'daily', 'failed'] as const).map((key) => (
            <div key={key} className={styles.helpItem}>
              <dt>{t(`kit.upiPay.help.${key}.q`)}</dt>
              <dd>{t(`kit.upiPay.help.${key}.a`, { name: payeeName })}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="visually-hidden" role="status">
        {copied === 'id' ? t('kit.upiPay.id.copied') : copied === 'amount' ? t('kit.upiPay.amount.copied') : saved === 'saved' ? t('kit.upiPay.saved.status') : ''}
      </p>
    </div>
  )
}
