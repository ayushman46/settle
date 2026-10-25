import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { payAppLink, payAppsFor, payPlatform, type PayApp, type PayPlatform } from '../lib/paymentApps'
import type { UpiLinkInput } from '../lib/upi'
import styles from './PayAppChooser.module.css'

/**
 * How long after an iPhone tap the page may still be showing before we say the app may not be
 * installed. Opening an app hides the page well within this; Safari's "Open in …?" confirmation
 * can take longer, which is why the line is worded "If … didn't open".
 */
export const NOT_OPENED_MS = 2500

export interface PayAppChooserProps {
  /** The payment: payee, amount in paise (0 leaves the amount to the app) and note. */
  input: UpiLinkInput
  /** Overrides the device check (tests, and callers that already know). */
  platform?: PayPlatform
}

/**
 * "Pay with" — one row per UPI app on Android and iPhone. Each row is a real link that opens
 * that app with the payee, amount and note already filled in, so the only thing left is the UPI
 * PIN. On other devices the one row is the generic link. iPhones can't tell a page whether an app
 * is installed, so if the page is still showing a moment after the tap we say so and suggest
 * another app.
 */
export function PayAppChooser({ input, platform = payPlatform() }: PayAppChooserProps) {
  const t = useT()
  const [notOpened, setNotOpened] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const stopWatching = useRef<(() => void) | null>(null)
  const amount = input.amountMinor > 0 ? formatMoney(input.amountMinor, 'INR', { trimZeros: true }) : null
  const sub = amount ? t('kit.payApp.sub', { amount }) : t('kit.payApp.sub.noAmount')

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      stopWatching.current?.()
    },
    [],
  )

  /** On iPhone, watches whether the tap took us to the app (the page hides) or not. */
  const watch = (app: PayApp): void => {
    setNotOpened(null)
    if (platform !== 'ios' || app.iosScheme === null) return
    window.clearTimeout(timer.current)
    stopWatching.current?.()
    const left = (): void => {
      if (document.visibilityState !== 'hidden') return
      window.clearTimeout(timer.current)
      stopWatching.current?.()
    }
    document.addEventListener('visibilitychange', left)
    stopWatching.current = () => {
      document.removeEventListener('visibilitychange', left)
      stopWatching.current = null
    }
    timer.current = window.setTimeout(() => {
      stopWatching.current?.()
      if (document.visibilityState === 'visible') setNotOpened(app.name)
    }, NOT_OPENED_MS)
  }

  return (
    <div className={styles.chooser}>
      <ul role="list" className={styles.list} aria-label={t('kit.payApp.list.label')}>
        {payAppsFor(platform).map((app) => (
          <li key={app.id}>
            <a
              className={styles.row}
              href={payAppLink(app, input, platform)}
              onClick={() => {
                haptic('tap')
                watch(app)
              }}
            >
              <span className={styles.badge} data-app={app.id} aria-hidden="true">
                {app.id === 'any' ? '↗' : app.name.charAt(0)}
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{app.id === 'any' ? t('kit.payApp.any') : app.name}</span>
                <span className={styles.sub}>{sub}</span>
              </span>
              <ArrowRight className={styles.arrow} aria-hidden="true" strokeWidth={2.25} />
            </a>
          </li>
        ))}
      </ul>
      <p role="status" className={notOpened ? styles.hint : 'visually-hidden'}>
        {notOpened ? t('kit.payApp.notOpened', { app: notOpened }) : ''}
      </p>
    </div>
  )
}
