import { ArrowRight } from 'lucide-react'
import { useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { isAndroid, payAppLink, payAppsFor, type PayApp } from '../lib/paymentApps'
import type { UpiLinkInput } from '../lib/upi'
import styles from './PayAppChooser.module.css'

export interface PayAppChooserProps {
  /** The payment: payee, amount in paise (0 leaves the amount to the app) and note. */
  input: UpiLinkInput
  /** Overrides the device check (tests, and callers that already know). */
  android?: boolean
}

/**
 * "Pay with" — one row per UPI app on Android. Each row is a real link that opens that app with
 * the payee, amount and note already filled in, so the only thing left is to confirm there. On
 * other devices, the one row is the generic link: the phone's own UPI app opens as before.
 */
export function PayAppChooser({ input, android = isAndroid() }: PayAppChooserProps) {
  const t = useT()
  const amount = input.amountMinor > 0 ? formatMoney(input.amountMinor, 'INR', { trimZeros: true }) : null
  const sub = amount ? t('kit.payApp.sub', { amount }) : t('kit.payApp.sub.noAmount')

  return (
    <ul role="list" className={styles.list} aria-label={t('kit.payApp.list.label')}>
      {payAppsFor(android).map((app: PayApp) => (
        <li key={app.id}>
          <a className={styles.row} href={payAppLink(app, input, android)} onClick={() => haptic('tap')}>
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
  )
}
