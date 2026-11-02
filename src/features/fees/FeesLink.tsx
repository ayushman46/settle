import { ChevronRight, Landmark } from 'lucide-react'
import { navigate } from '../../app/router'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { FEES_PATH } from './paths'
import styles from './Fees.module.css'

/** On Stuck money: the other money a bank can owe you — charges it shouldn't have taken. */
export function FeesLink() {
  const t = useT()
  return (
    <button type="button" className={styles.homeRow} onClick={() => navigate(FEES_PATH)}>
      <span className={cx(styles.kindIcon, styles['tone-wrong'])} aria-hidden="true">
        <Landmark strokeWidth={2.25} />
      </span>
      <span className={styles.homeText}>
        <span className={styles.homeTitle}>{t('fees.fromStuck.title')}</span> <span className={styles.homeLine}>{t('fees.fromStuck.text')}</span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.homeChevron} />
    </button>
  )
}
