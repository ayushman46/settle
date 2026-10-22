import { ArrowRight } from 'lucide-react'
import { Link } from '../../app/router'
import { BRAND } from '../../domain/types'
import { useBillingConfig } from '../../pro/config'
import { BrandMark } from './BrandMark'
import { CtaLink, SectionLink } from './CtaLink'
import { Faq } from './Faq'
import { Features } from './Features'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { siteOrigin, usePageMeta } from './pageMeta'
import { Pricing } from './Pricing'
import { PublicFooter } from './PublicFooter'
import { landingStructuredData, LANDING_DESCRIPTION } from './structuredData'
import styles from './LandingPage.module.css'

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const

/**
 * The sales page at `/`: what Settle does, a live split to play with, the ten features, three
 * steps, honest pricing, answers, and the way in (`/app`). No testimonials, user counts or press
 * logos — nothing here is made up.
 */
export function LandingPage() {
  const origin = siteOrigin()
  const config = useBillingConfig()
  usePageMeta({
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: LANDING_DESCRIPTION,
    canonical: origin ? `${origin}/` : undefined,
  })

  return (
    <div className={styles.page}>
      <SectionLink to="main" className={styles.skip}>
        Skip to content
      </SectionLink>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brandLink} aria-label={`${BRAND.name} home`}>
            <BrandMark />
          </Link>
          <nav className={styles.nav} aria-label="Sections">
            {SECTIONS.map((section) => (
              <SectionLink key={section.id} to={section.id} className={styles.navLink}>
                {section.label}
              </SectionLink>
            ))}
          </nav>
          <CtaLink to="/app" size="sm" className={styles.headerCta}>
            Open app
          </CtaLink>
        </div>
      </header>

      <main id="main" className={styles.main}>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />

        <section className={styles.final} aria-labelledby="final-title">
          <div className={styles.finalCard}>
            <h2 id="final-title" className={styles.finalTitle}>
              Split your next bill in seconds
            </h2>
            <p className={styles.finalText}>Free, no sign-up, and your friends don’t need the app.</p>
            <div className={styles.ctas}>
              <CtaLink to="/app" variant="accent" iconEnd={<ArrowRight strokeWidth={2.25} />}>
                Open {BRAND.name} — free
              </CtaLink>
              <CtaLink to="/privacy" variant="onDark">
                Read our privacy promise
              </CtaLink>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: landingStructuredData(origin, config) }} />
    </div>
  )
}
