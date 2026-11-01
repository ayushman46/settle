import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { navigate } from '../../app/router'
import { SectionHeader } from '../../components'
import { useStore } from '../../data'
import { stuckStore } from '../../data/stores'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { STUCK_PATH } from './paths'
import { summarize } from './rules'
import { KindIcon } from './StuckParts'
import { homeLines } from './view'
import styles from './Stuck.module.css'

/**
 * Home's line for stuck money — "₹4,700 stuck with banks and shops · 1 needs you" — opening the
 * list. Only while something is still owed (the money, or compensation for the wait).
 */
export function StuckCard() {
  const t = useT()
  const list = useStore(stuckStore, (all) => all)
  const day = todayIso()
  const summary = useMemo(() => summarize(list, day), [list, day])
  const lines = homeLines(summary)
  if (!lines) return null
  return (
    <section className={styles.homeSection} aria-labelledby="home-stuck">
      <SectionHeader id="home-stuck" title={t('stuck.title')} />
      <button type="button" className={styles.homeRow} onClick={() => navigate(STUCK_PATH)}>
        <KindIcon kind="failed" section={summary.act > 0 ? 'needs' : 'onway'} />
        <span className={styles.homeText}>
          <span className={styles.homeTitle}>{lines.title}</span>{' '}
          <span className={cx(styles.homeLine, summary.act > 0 && styles.homeLineAct)}>{lines.line}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.homeChevron} />
      </button>
    </section>
  )
}
