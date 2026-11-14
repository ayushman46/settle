import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUpRight, Check, ChevronDown, Copy, ImageDown, QrCode as QrIcon, ShieldCheck } from 'lucide-react'
import { Avatar, Button, Chip, QrCode, SegmentedControl } from '../components'
import { BRAND, type Minor } from '../domain/types'
import { tx, useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { formatMoney, toInputString } from '../lib/money'
import { canPayInApp, openPayApp, sendQrToApp } from '../lib/nativeApp'
import { canWatchPayments, expectPayment } from '../lib/payWatch'
import {
  ANDROID_PACKAGES,
  directPayHref,
  GALLERY_QR_MAX_PAISE,
  getPayApp,
  launchHref,
  openAppHref,
  PAY_APPS,
  payPlatform,
  setPayApp,
  subscribePayApp,
  type PayApp,
  type PayPlatform,
} from '../lib/paymentApps'
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
/** Where the one-tap "Pay with …" got to: the QR handed to the app, the QR saved, or the UPI ID copied (and the app opened). */
type Quick = 'idle' | 'working' | 'sent' | 'saved' | 'copied' | 'failed' | 'opened'

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
  /**
   * The payee is a business (its own QR was scanned): UPI apps take a payment to a business that
   * starts from a link, whatever the amount, so "Pay" opens the app on the payment itself.
   */
  merchant?: boolean
  /** The business's category code from its QR. */
  mc?: string | null
}

/**
 * Paying one person by UPI. On a phone it leads with one tap, "Pay ₹400 with Google Pay" (the app
 * is picked once and remembered): up to ₹2,000 the payee's QR is handed straight to the app, which
 * opens on the payment with the UPI ID and amount filled in (UPI's "QR share & pay"); above that the
 * UPI ID is copied and the app opened. A direct link is offered as a try: NPCI has payer apps
 * refuse payments to a person that start from a link (OC 76A; Consolidated Circular 7.9), and many
 * do. Under it, the other ways UPI allows:
 * - computer: the QR, to scan with any UPI app — amount and note fill in, any amount;
 * - phone, up to ₹2,000: save the QR, then Scan → Upload it in the UPI app (a QR picture pays a
 *   person up to ₹2,000), or the UPI ID;
 * - phone, more: copy the UPI ID and pay by UPI ID (always works), or scan from another screen.
 * Then the payee (their UPI ID with Copy, and a name check), a "Did you pay?" when they come back,
 * and what to do when a payment doesn't go through.
 */
export function UpiRoutes({ payeeName, vpa, amount, note, color, phone, platform = payPlatform(), onStarted, onPaid, merchant = false, mc = null }: UpiRoutesProps) {
  const t = useT()
  const helpId = useId()
  const small = amount > 0 && (merchant || amount <= GALLERY_QR_MAX_PAISE)
  const [picked, setPicked] = useState<Route | null>(null)
  const route: Route = small ? (picked ?? 'gallery') : 'id'
  const [screenQr, setScreenQr] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [copied, setCopied] = useState<Copied>(null)
  const [asking, setAsking] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notOpened, setNotOpened] = useState<string | null>(null)
  const payAppId = useSyncExternalStore(subscribePayApp, getPayApp, () => null)
  const app = PAY_APPS.find((a) => a.id === payAppId) ?? (PAY_APPS[0] as PayApp)
  const [quick, setQuick] = useState<Quick>('idle')
  const left = useRef(false)
  const [auto, setAuto] = useState(false)
  const stopWatch = useRef<(() => void) | null>(null)
  const paid = useRef(onPaid)
  useEffect(() => {
    paid.current = onPaid
  }, [onPaid])
  useEffect(() => () => stopWatch.current?.(), [])
  const watch = useRef<number | undefined>(undefined)
  // Back from the UPI app: "Did you pay?" comes into view (on a small phone it sat far below the Pay button).
  const askRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = asking ? askRef.current : null
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [asking])
  const uri = buildUpiLink({ vpa, payeeName, amountMinor: amount, note, mc: merchant ? mc : null })
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
    // In the Android app the phone's own payment alert says when this went through: recorded with no tap.
    if (!paid.current || amount <= 0 || !canWatchPayments()) return
    stopWatch.current?.()
    stopWatch.current = expectPayment(amount, () => {
      stopWatch.current = null
      left.current = false
      setAsking(false)
      setAuto(true)
      haptic('success')
      paid.current?.()
    })
  }

  const copy = async (what: 'id' | 'amount'): Promise<void> => {
    const ok = await copyText(what === 'id' ? vpa : toInputString(amount, 'INR', { trimZeros: true }).replace(/,/g, ''))
    haptic(ok ? 'success' : 'error')
    setCopied(ok ? what : 'failed')
    if (ok) started()
  }

  const picture = (): Promise<Blob | null> =>
    qrPicture(uri, [
      { text: t('kit.upiPay.picture.pay', { name: payeeName }), size: 34, bold: true },
      ...(hasAmount ? [{ text: money, size: 52, bold: true }] : []),
      ...(note ? [{ text: note, size: 26 }] : []),
      { text: t('kit.upiPay.picture.scan'), size: 24 },
    ])
  const pictureName = `${BRAND.name} QR ${payeeName} ${toInputString(amount, 'INR', { trimZeros: true })}.png`

  /**
   * One tap: up to ₹2,000 the QR goes straight to the UPI app (in the Android app, to that app
   * itself; in a browser, through the share sheet), which opens on the payment. Otherwise — or
   * when the QR can't be handed over — the UPI ID is copied and the app opened.
   */
  const quickPay = async (): Promise<void> => {
    if (quick === 'working') return
    setPayApp(app.id)
    const native = canPayInApp()
    // A shop: straight to the UPI app, on the payment, the shop and the amount filled in.
    const shopHref = merchant && !native ? directPayHref(app, platform, uri) : null
    if (shopHref) {
      openApp(app)
      setQuick('opened')
      window.location.assign(shopHref)
      return
    }
    setQuick('working')
    if (small) {
      const qr = await picture()
      if (qr && native && (await sendQrToApp(qr, pictureName, ANDROID_PACKAGES[app.id]))) {
        haptic('success')
        started()
        setQuick('sent')
        return
      }
      if (qr && !native) {
        const outcome = await shareFile(qr, pictureName, undefined, { prefer: 'share' })
        if (outcome === 'cancelled') {
          setQuick('idle')
          return
        }
        if (outcome !== 'failed') {
          haptic('success')
          started()
          if (outcome === 'downloaded') setSaved('saved')
          setQuick(outcome === 'shared' ? 'sent' : 'saved')
          return
        }
      }
    }
    const ok = await copyText(vpa)
    haptic(ok ? 'success' : 'error')
    setQuick(ok ? 'copied' : 'failed')
    if (!ok) return
    started()
    if (native) {
      void openPayApp(ANDROID_PACKAGES[app.id])
      return
    }
    const href = launchHref(app, platform)
    if (href) {
      openApp(app)
      window.location.assign(href)
    }
  }

  const save = async (): Promise<void> => {
    if (saved === 'saving') return
    setSaved('saving')
    const qr = await picture()
    const outcome = qr
      ? await shareFile(qr, pictureName, undefined, {
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

  function openApp(opened: PayApp): void {
    haptic('tap')
    started()
    setNotOpened(null)
    window.clearTimeout(watch.current)
    watch.current = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setNotOpened(opened.name)
    }, NOT_OPENED_MS)
  }

  const direct = directPayHref(app, platform, uri)
  const quickStatus =
    quick === 'opened'
      ? t('kit.upiPay.quick.opened', { app: app.name })
      : merchant && quick === 'idle' && direct && !canPayInApp()
        ? hasAmount
          ? t('kit.upiPay.quick.lead.shop', { app: app.name, name: payeeName, amount: money })
          : t('kit.upiPay.quick.lead.shop.noAmount', { app: app.name, name: payeeName })
        : quick === 'sent'
      ? canPayInApp()
        ? t('kit.upiPay.quick.sent.app', { app: app.name, name: payeeName })
        : t('kit.upiPay.quick.sent', { app: app.name, name: payeeName })
      : quick === 'saved'
        ? t('kit.upiPay.quick.saved', { app: app.name })
        : quick === 'copied'
          ? hasAmount
            ? t('kit.upiPay.quick.copied', { app: app.name, amount: money })
            : t('kit.upiPay.quick.copied.noAmount', { app: app.name })
          : quick === 'failed'
            ? t('kit.upiPay.copyFailed')
            : small
              ? t('kit.upiPay.quick.lead.small', { app: app.name, name: payeeName, amount: money })
              : t('kit.upiPay.quick.lead.large', { app: app.name, name: payeeName })

  const answer = (paid: boolean): void => {
    setAsking(false)
    stopWatch.current?.()
    stopWatch.current = null
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
          <div className={styles.quick}>
            <div role="radiogroup" aria-label={t('kit.upiPay.quick.app.aria')} className={styles.quickApps}>
              {PAY_APPS.map((a) => (
                <Chip key={a.id} role="radio" selected={a.id === app.id} onClick={() => setPayApp(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </div>
            <Button block iconStart={quick === 'sent' || quick === 'copied' ? <Check /> : <ArrowUpRight />} loading={quick === 'working'} onClick={() => void quickPay()}>
              {hasAmount ? t('kit.upiPay.quick.cta', { amount: money, app: app.name }) : t('kit.upiPay.quick.cta.noAmount', { app: app.name })}
            </Button>
            <p className={quick === 'failed' ? styles.problem : styles.lead} role="status">
              {quickStatus}
            </p>
            {direct && !merchant && (
              <p className={styles.fine}>
                <a className={styles.direct} data-direct="" href={direct} onClick={() => openApp(app)}>
                  {t('kit.upiPay.quick.direct', { app: app.name })}
                </a>{' '}
                {t('kit.upiPay.quick.direct.note')}
              </p>
            )}
          </div>
          <p className={styles.otherWays}>{t('kit.upiPay.quick.other')}</p>

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
              {!merchant && <p className={styles.fine}>{t('kit.upiPay.gallery.cap')}</p>}
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

      {auto && (
        <p className={styles.askTitle} role="status">
          {t('kit.upiPay.auto.paid', { amount: money, name: payeeName })}
        </p>
      )}
      {asking && (
        <div ref={askRef} className={styles.ask} role="group" aria-labelledby={`${helpId}-ask`}>
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
