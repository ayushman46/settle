import { Link } from '../../app/router'
import { BRAND } from '../../domain/types'
import { SUPPORT_EMAIL } from '../legal/contact'
import { BrandMark } from './BrandMark'
import styles from './PublicFooter.module.css'

/** The public pages' footer: the brand, the legal pages, a way to reach us. */
export function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <BrandMark size="sm" />
          <p className={styles.tagline}>{BRAND.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.links} role="list">
            <li>
              <Link to="/app" className={styles.link}>
                Open the app
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={styles.link}>
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className={styles.link}>
                Terms
              </Link>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.link}>
                Contact
              </a>
            </li>
          </ul>
        </nav>
        <p className={styles.legal}>
          © {year} {BRAND.name} · No ads, no tracking
        </p>
      </div>
    </footer>
  )
}
