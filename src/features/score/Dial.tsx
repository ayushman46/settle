import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { useCountUp } from '../insights/useCountUp'
import { BAND_KEYS } from './bands'
import { MAX_SCORE, MIN_SCORE, type BandId } from './engine'
import styles from './Score.module.css'

// A 240° arc, open at the bottom: from lower left, over the top, to lower right.
const CX = 100
const CY = 100
const R = 80
const point = (deg: number): string => {
  const rad = (deg * Math.PI) / 180
  return `${(CX + R * Math.cos(rad)).toFixed(2)} ${(CY + R * Math.sin(rad)).toFixed(2)}`
}
const ARC = `M ${point(150)} A ${R} ${R} 0 1 1 ${point(30)}`

/** The score on an arc, counting up to it (straight to it with reduced motion). */
export function Dial({ score, band, size = 'lg' }: { score: number; band: BandId; size?: 'sm' | 'lg' }) {
  const t = useT()
  const shown = useCountUp(score, 1)
  const fill = Math.max(0, Math.min(100, ((shown - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100))
  return (
    <div className={cx(styles.dial, size === 'sm' && styles.dialSm)} data-band={band} role="img" aria-label={t('score.dial.aria', { score, band: t(BAND_KEYS[band]) })}>
      <svg viewBox="0 0 200 172" aria-hidden="true" focusable="false">
        <path d={ARC} className={styles.track} pathLength={100} />
        {fill > 0 && <path d={ARC} className={styles.fill} pathLength={100} strokeDasharray={`${fill} 100`} />}
      </svg>
      <span className={styles.dialText} aria-hidden="true">
        <span className={styles.number}>{Math.max(0, shown)}</span>
        {size === 'lg' && <span className={styles.band}>{t(BAND_KEYS[band])}</span>}
      </span>
    </div>
  )
}
