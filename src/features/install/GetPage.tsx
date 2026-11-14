import { useState } from 'react'
import { ArrowRight, Check, Download, EllipsisVertical, Plus, Share, Smartphone } from 'lucide-react'
import { Button, QrCode, SegmentedControl } from '../../components'
import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { CtaLink } from '../landing/CtaLink'
import { siteOrigin, usePageMeta } from '../landing/pageMeta'
import { PublicShell } from '../pay/PublicShell'
import { useInstall } from './useInstall'
import styles from './Install.module.css'

type Phone = 'android' | 'ios'

/** The Android app, built by GitHub Actions (.github/workflows/android.yml) and kept as a release download. */
export const ANDROID_APK_URL = 'https://github.com/ayushman46/settle/releases/download/android-latest/settle-android.apk'

/** A browser inside another app (WhatsApp, Instagram, Facebook…): it can't install anything. */
function inAppBrowser(userAgent: string): boolean {
  return /\bFBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|Twitter|LinkedInApp|; wv\)/i.test(userAgent)
}

/**
 * `/get` — Settle on your phone, Android or iPhone. It installs straight from the browser (no
 * store): on Android the browser's own Install, on iPhone Share → Add to Home Screen. On a
 * computer, a QR to open this page on the phone. Says so when the page is open inside another app
 * (a link tapped in WhatsApp), where installing isn't possible until it's opened in the browser.
 */
export function GetPage() {
  const t = useT()
  const brand = BRAND.name
  const { platform, standalone, canPrompt, install } = useInstall()
  const [phone, setPhone] = useState<Phone>(platform === 'ios' ? 'ios' : 'android')
  const [done, setDone] = useState(false)
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const inApp = inAppBrowser(agent)
  const onPhone = platform === 'android' || platform === 'ios'
  usePageMeta({ title: t('install.get.meta', { brand }), description: t('install.get.lead', { brand }), canonical: `${siteOrigin()}/get` })

  const prompt = async (): Promise<void> => {
    const outcome = await install()
    haptic(outcome === 'accepted' ? 'success' : 'tap')
    if (outcome === 'accepted') setDone(true)
  }

  const step = (icon: React.ReactNode, title: string, body: string) => (
    <li className={styles.step}>
      <span className={styles.stepIcon} aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong className={styles.stepTitle}>{title}</strong>
        <span className={styles.stepBody}>{body}</span>
      </span>
    </li>
  )

  return (
    <PublicShell pitch={false}>
      <section className={styles.get}>
        <span className={styles.getIcon} aria-hidden="true">
          <Smartphone strokeWidth={2} />
        </span>
        <h1 className={styles.getTitle}>{t('install.get.title', { brand })}</h1>
        <p className={styles.getLead}>{t('install.get.lead', { brand })}</p>

        {standalone || done ? (
          <p className={styles.getDone} role="status">
            <Check aria-hidden="true" /> {t('install.get.installed', { brand })}
          </p>
        ) : (
          <>
            {!onPhone && (
              <div className={styles.getQr}>
                <QrCode value={`${siteOrigin()}/get`} size={196} label={t('install.get.qr.aria', { brand })} />
                <p className={styles.getNote}>{t('install.get.qr')}</p>
              </div>
            )}
            {inApp && (
              <p className={styles.getWarn} role="status">
                {phone === 'ios' ? t('install.get.inApp.ios') : t('install.get.inApp.android')}
              </p>
            )}
            <SegmentedControl
              ariaLabel={t('install.get.phone.aria')}
              value={phone}
              onChange={setPhone}
              options={[
                { value: 'android', label: 'Android' },
                { value: 'ios', label: 'iPhone' },
              ]}
            />
            {phone === 'android' ? (
              <div className={styles.getPanel}>
                {canPrompt && (
                  <Button block iconStart={<Download />} onClick={() => void prompt()}>
                    {t('install.get.android.cta', { brand })}
                  </Button>
                )}
                <ol className={styles.steps} aria-label={t('install.get.android.steps')}>
                  {step(<EllipsisVertical strokeWidth={2.25} />, t('install.get.android.step1.title'), t('install.get.android.step1.body'))}
                  {step(<Download strokeWidth={2.25} />, t('install.get.android.step2.title'), t('install.get.android.step2.body', { brand }))}
                </ol>
                <div className={styles.getApk}>
                  <strong className={styles.stepTitle}>{t('install.get.apk.title', { brand })}</strong>
                  <span className={styles.stepBody}>{t('install.get.apk.body', { brand })}</span>
                  <a className={styles.getApkLink} href={ANDROID_APK_URL} download rel="noopener">
                    <Download aria-hidden="true" /> {t('install.get.apk.cta')}
                  </a>
                  <span className={styles.stepBody}>{t('install.get.apk.note')}</span>
                </div>
              </div>
            ) : (
              <div className={styles.getPanel}>
                <ol className={styles.steps} aria-label={t('install.sheet.title')}>
                  {step(<Share strokeWidth={2.25} />, t('install.sheet.step1.title'), t('install.get.ios.step1.body'))}
                  {step(<Plus strokeWidth={2.25} />, t('install.sheet.step2.title'), t('install.sheet.step2.body'))}
                </ol>
                <p className={styles.getNote}>{t('install.get.ios.note', { brand })}</p>
              </div>
            )}
            <p className={styles.getNote}>{t('install.get.why', { brand })}</p>
          </>
        )}

        <CtaLink to="/app" variant={standalone || done ? 'accent' : 'secondary'} size="md" block iconEnd={<ArrowRight strokeWidth={2.25} />}>
          {t('install.get.open', { brand })}
        </CtaLink>
      </section>
    </PublicShell>
  )
}
