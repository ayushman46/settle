import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { navigate } from '../../app/router'
import { SectionHeader } from '../../components'
import { useStore } from '../../data'
import { stuckStore } from '../../data/stores'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { STUCK_PATH, stuckPath } from './paths'
import { summarize } from './rules'
import { KindIcon } from './StuckParts'
import { homeLines } from './view'
import styles from './Stuck.module.css'

/**
 * Home's line for stuck money — one payment by name ("Failed payment to Swiggy · ₹649 / 2 days late ·
 * your bank owes you ₹200"), opening it; several as a total ("₹4,700 stuck with banks and shops · 1
 * to act on"), opening the list. Only while something is still owed (the money, or compensation for the wait).
 */
export function StuckCard({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const list = useStore(stuckStore, (all) => all)
  const day = todayIso()
  const summary = useMemo(() => summarize(list, day), [list, day])
  const lines = useMemo(() => homeLines(summary, list, day), [summary, list, day])
  if (!lines) return null
  // One payment named: its own icon (a shop for a refund); several: the feature's.
  const kind = lines.id ? (list.find((s) => s.id === lines.id)?.kind ?? null) : null
  return (
    // At the top of Home (something needs you): one compact row, its heading only for screen readers.
    <section className={styles.homeSection} aria-labelledby="home-stuck">
      {compact ? (
        <h2 id="home-stuck" className="visually-hidden">
          {t('stuck.title')}
        </h2>
      ) : (
        <SectionHeader id="home-stuck" title={t('stuck.title')} />
      )}
      <button type="button" className={styles.homeRow} onClick={() => navigate(lines.id ? stuckPath(lines.id) : STUCK_PATH)}>
        <KindIcon kind={kind} section={summary.act > 0 ? 'needs' : 'onway'} />
        <span className={styles.homeText}>
          <span className={styles.homeTitle}>{lines.title}</span>{' '}
          <span className={cx(styles.homeLine, summary.act > 0 && styles.homeLineAct)}>{lines.line}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.homeChevron} />
      </button>
    </section>
  )
}
