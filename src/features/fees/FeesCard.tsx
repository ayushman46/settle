import { ChevronRight, Landmark } from 'lucide-react'
import { navigate } from '../../app/router'
import { SectionHeader } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { FEES_PATH } from './paths'
import { useFeesLine } from './useFeesLine'
import styles from './Fees.module.css'

/** Home's line for Bank charges, only while the bank owes you something or a charge needs one answer. */
export function FeesCard({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const lines = useFeesLine()
  if (!lines) return null
  return (
    <section className={styles.homeSection} aria-labelledby="home-fees">
      {compact ? (
        <h2 id="home-fees" className="visually-hidden">
          {t('fees.title')}
        </h2>
      ) : (
        <SectionHeader id="home-fees" title={t('fees.title')} />
      )}
      <button type="button" className={styles.homeRow} onClick={() => navigate(FEES_PATH)}>
        <span className={cx(styles.kindIcon, styles['tone-wrong'])} aria-hidden="true">
          <Landmark strokeWidth={2.25} />
        </span>
        <span className={styles.homeText}>
          <span className={styles.homeTitle}>{lines.title}</span>{' '}
          <span className={cx(styles.homeLine, lines.act && styles.homeLineAct)}>{lines.line}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.homeChevron} />
      </button>
    </section>
  )
}
