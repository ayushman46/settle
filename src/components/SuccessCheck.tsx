import { cx } from '../lib/cx'
import styles from './SuccessCheck.module.css'

export interface SuccessCheckProps {
  /** `md` 48px · `lg` 72px (default). */
  size?: 'md' | 'lg'
  /** Accessible name; omit when nearby text already says it (then it's decorative). */
  label?: string
  className?: string
}

/**
 * Celebration badge: a highlighter disc pops in, the check draws itself, and a soft ring
 * ripples out (~600ms). Plays once when mounted — re-renders don't replay it; remount (new
 * `key`) to play again. Static under reduced motion.
 */
export function SuccessCheck({ size = 'lg', label, className }: SuccessCheckProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <span {...a11y} className={cx(styles.root, styles[size], className)}>
      <svg viewBox="0 0 64 64" className={styles.svg} focusable="false" aria-hidden="true">
        <circle className={styles.ring} cx="32" cy="32" r="29" />
        <circle className={styles.disc} cx="32" cy="32" r="29" />
        <path className={styles.check} d="M20.5 33.5 29 41.5 44 25" pathLength={1} />
      </svg>
    </span>
  )
}
