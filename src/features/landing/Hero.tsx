import { ArrowRight, BadgeCheck, Ban, Smartphone, Sparkles, UserRoundCheck } from 'lucide-react'
import { QrCode } from '../../components'
import { BRAND } from '../../domain/types'
import { ctaClassName } from './cta'
import { CtaLink, SectionLink } from './CtaLink'
import { HeroDemo } from './HeroDemo'
import { siteOrigin } from './pageMeta'
import styles from './LandingPage.module.css'

/** "Split anything." / "Settle in a tap." — the tagline's first sentence, then the rest. */
function taglineParts(tagline: string): [string, string] {
  const at = tagline.indexOf('. ')
  return at === -1 ? [tagline, ''] : [tagline.slice(0, at + 1), tagline.slice(at + 2)]
}

const TRUST = [
  { icon: UserRoundCheck, text: 'No sign-up' },
  { icon: Ban, text: 'No ads' },
  { icon: Smartphone, text: 'Your data stays on your phone' },
  { icon: BadgeCheck, text: 'Works with any UPI app' },
] as const

/** The first screen: the promise, the two ways in, and the live phone. */
export function Hero() {
  const [lead, rest] = taglineParts(BRAND.tagline)
  const appUrl = `${siteOrigin()}/app`
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            <Sparkles aria-hidden="true" strokeWidth={2.25} />
            AI bill splitting, made for UPI
          </p>
          <h1 id="hero-title" className={styles.h1}>
            {lead}
            {rest && (
              <>
                {' '}
                <span className={styles.highlight}>{rest}</span>
              </>
            )}
          </h1>
          <p className={styles.sub}>
            Dinners, rent, trips, flatmates, subscriptions — {BRAND.name} works out who owes what, then sends one link
            so everyone pays you back by UPI in a tap.
          </p>
          <div className={styles.ctas}>
            <CtaLink to="/app" iconEnd={<ArrowRight strokeWidth={2.25} />}>
              Open {BRAND.name} — free
            </CtaLink>
            <SectionLink to="how" className={ctaClassName({ variant: 'secondary' })}>
              See how it works
            </SectionLink>
          </div>
          <div className={styles.qrCard}>
            <QrCode value={appUrl} size={84} label={`QR code that opens ${BRAND.name} on your phone`} />
            <p className={styles.qrText}>
              <strong>On a computer?</strong> Scan with your phone’s camera to open {BRAND.name} there.
            </p>
          </div>
        </div>
        <HeroDemo />
      </div>

      <ul className={styles.trust} role="list" aria-label={`Why people trust ${BRAND.name}`}>
        {TRUST.map(({ icon: Icon, text }) => (
          <li key={text} className={styles.trustItem}>
            <Icon aria-hidden="true" strokeWidth={2.25} />
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}
