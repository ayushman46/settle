import { ArrowRight, BadgeCheck, Ban, Smartphone, UserRoundCheck } from 'lucide-react'
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
  { icon: UserRoundCheck, text: 'No password, no OTP' },
  { icon: Ban, text: 'No ads' },
  { icon: Smartphone, text: 'Stored in India, locked by your passkey' },
  { icon: BadgeCheck, text: 'Works with any UPI app' },
] as const

/** The first screen: what's new, the promise, the two ways in, and the live phone. */
export function Hero() {
  const [lead, rest] = taglineParts(BRAND.tagline)
  const appUrl = `${siteOrigin()}/app`
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          {/* One name, read in one go (pieces of text are read with pauses: "New, colon, Bank charges"). */}
          <SectionLink to="compare" className={styles.announce}>
            <span className={styles.announceTag}>Why us</span> <span>Why not Splitwise? See the difference</span>
            <ArrowRight aria-hidden="true" strokeWidth={2.25} />
          </SectionLink>
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
            Say the bill — “Riya paid 1,800 for the cab, split between everyone” — in English or Hinglish, and{' '}
            {BRAND.name} splits it. Friends open one link and pay you back with any UPI app: no download, no sign-up.
            Free, with no daily limit on adding expenses.
          </p>
          <div className={styles.ctas}>
            <CtaLink to="/app" iconEnd={<ArrowRight strokeWidth={2.25} />}>
              Open {BRAND.name} — free
            </CtaLink>
            <CtaLink to="/get" variant="secondary">
              Get the app: Android &amp; iPhone
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
