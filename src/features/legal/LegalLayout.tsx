import { useId, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { goBack, Link } from '../../app/router'
import { IconButton } from '../../components'
import { BRAND } from '../../domain/types'
import { formatBillDate } from '../../lib/format'
import { BrandMark } from '../landing/BrandMark'
import { usePageMeta } from '../landing/pageMeta'
import { PublicFooter } from '../landing/PublicFooter'
import { POLICIES_UPDATED } from './contact'
import styles from './LegalLayout.module.css'

export interface LegalLayoutProps {
  /** Page heading ("Privacy policy"). */
  title: string
  /** For search results. */
  description: string
  /** "The short version" — a few plain sentences before the detail. */
  summary: readonly string[]
  children: ReactNode
}

/**
 * The shared frame of the policy pages: a slim bar with Back (to wherever the reader came from —
 * the app or the landing page — or home), the title, the short version, the sections, the footer.
 */
export function LegalLayout({ title, description, summary, children }: LegalLayoutProps) {
  const summaryId = useId()
  usePageMeta({ title: `${title} · ${BRAND.name}`, description })
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <IconButton label="Back" onClick={() => goBack('/')}>
            <ChevronLeft strokeWidth={2.25} />
          </IconButton>
          <Link to="/" className={styles.brand} aria-label={`${BRAND.name} home`}>
            <BrandMark size="sm" />
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>
            Last updated <time dateTime={POLICIES_UPDATED}>{formatBillDate(POLICIES_UPDATED)}</time>
          </p>
          <section className={styles.summary} aria-labelledby={summaryId}>
            <h2 id={summaryId} className={styles.summaryTitle}>
              The short version
            </h2>
            <ul className={styles.summaryList}>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          {children}
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}

/** One titled part of a policy. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
