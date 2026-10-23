import type { ReactNode } from 'react'
import { ArrowRight, Link2Off } from 'lucide-react'
import { Link } from '../../app/router'
import { BRAND } from '../../domain/types'
import { useT } from '../../i18n'
import { BrandMark } from '../landing/BrandMark'
import { CtaLink } from '../landing/CtaLink'
import styles from './PublicShell.module.css'

export interface PublicShellProps {
  children: ReactNode
  /** The gentle "Splitting the bill next time?" pitch under the content (default on). */
  pitch?: boolean
}

/**
 * The frame of every page a friend opens from a link (`/pay`, `/claim`, `/pool`): the brand and
 * "What's Settle?" on top, the page's own content, the pitch, then Privacy · Terms. These pages
 * never read or write the app's data, and onboarding never runs on them.
 */
export function PublicShell({ children, pitch = true }: PublicShellProps) {
  const t = useT()
  const brand = BRAND.name
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link to="/" className={styles.brand} aria-label={t('pay.shell.home.aria', { brand })}>
            <BrandMark size="sm" />
          </Link>
          <Link to="/" className={styles.what}>
            {t('pay.shell.what', { brand })}
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        {children}

        {pitch && (
          <aside className={styles.pitch} aria-labelledby="public-pitch-title">
            <p id="public-pitch-title" className={styles.pitchTitle}>
              {t('pay.shell.pitch.title')}
            </p>
            <p className={styles.pitchText}>{t('pay.shell.pitch.body')}</p>
            <CtaLink to="/" variant="accent" size="md" block iconEnd={<ArrowRight strokeWidth={2.25} />}>
              {t('pay.shell.pitch.cta', { brand })}
            </CtaLink>
          </aside>
        )}
      </main>

      <footer className={styles.footer}>
        <Link to="/privacy" className={styles.footerLink}>
          {t('pay.shell.privacy')}
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className={styles.footerLink}>
          {t('pay.shell.terms')}
        </Link>
      </footer>
    </div>
  )
}

export interface PublicProblemProps {
  title: string
  text: string
  /** Defaults to a broken link. */
  icon?: ReactNode
}

/** A link that can't be shown (missing, cut short, or not ours): what happened and what to do. */
export function PublicProblem({ title, text, icon = <Link2Off strokeWidth={2} /> }: PublicProblemProps) {
  return (
    <section className={styles.problem} aria-labelledby="public-problem-title">
      <span className={styles.problemIcon} aria-hidden="true">
        {icon}
      </span>
      <h1 id="public-problem-title" className={styles.problemTitle}>
        {title}
      </h1>
      <p className={styles.problemText}>{text}</p>
    </section>
  )
}
