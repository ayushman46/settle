import { cx } from '../lib/cx'
import styles from './Progress.module.css'

export interface ProgressProps {
  /** 1-based current step. Steps before it are filled; the current one animates in. */
  current: number
  total: number
  /** Accessible label; defaults to "Step {current} of {total}". */
  label?: string
  /**
   * `bar` (default): thin full-width segments. `dots`: tiny inline dots with the current one
   * stretched into a pill (falls back to `bar` past 12 steps, where dots get too small).
   */
  variant?: 'bar' | 'dots'
  className?: string
}

const MAX_DOTS = 12

/** Segmented step progress (`role="progressbar"`). */
export function Progress({ current, total, label, variant = 'bar', className }: ProgressProps) {
  const count = Math.max(1, Math.floor(Number.isFinite(total) ? total : 1))
  const now = Math.min(count, Math.max(0, Math.round(Number.isFinite(current) ? current : 0)))
  const text = label ?? `Step ${now} of ${count}`
  const dots = variant === 'dots' && count <= MAX_DOTS
  return (
    <div
      role="progressbar"
      aria-label={text}
      aria-valuetext={text}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={now}
      className={cx(dots ? styles.dots : styles.progress, className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(
            dots ? styles.dot : styles.segment,
            i < now - 1 && styles.done,
            i === now - 1 && styles.current,
          )}
        />
      ))}
    </div>
  )
}
