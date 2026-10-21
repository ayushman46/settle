import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './ProgressRing.module.css'

export interface ProgressRingProps {
  /** 0..1 (clamped). */
  value: number
  /** Diameter in px. Default 56. */
  size?: number
  /** Ring thickness in px. Default 6. */
  stroke?: number
  /** Announces the ring as a progress bar with this name ("Collected"); omit when nearby text says it. */
  label?: string
  /** `accent` (default), `positive` or `ink`. A full ring turns `positive`. */
  tone?: 'accent' | 'positive' | 'ink'
  /** Centre content (e.g. a percentage or a check). */
  children?: ReactNode
  className?: string
}

/** Arc length is measured in hundredths (pathLength=100), so the dash maths is just the percentage. */
const LENGTH = 100

/** Circular progress (SVG). Sweeps in on mount, then glides between values. */
export function ProgressRing({ value, size = 56, stroke = 6, label, tone = 'accent', children, className }: ProgressRingProps) {
  const fraction = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const percent = Math.round(fraction * 100)
  const complete = fraction >= 1
  const r = (size - stroke) / 2
  const a11y = label
    ? {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent,
        'aria-valuetext': `${percent}%`,
      }
    : { 'aria-hidden': true }
  const style = { width: size, height: size, '--ring-offset': String(LENGTH - fraction * LENGTH) } as CSSProperties

  return (
    <span {...a11y} className={cx(styles.ring, styles[complete ? 'positive' : tone], className)} style={style}>
      <svg viewBox={`0 0 ${size} ${size}`} className={styles.svg} aria-hidden="true" focusable="false">
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={cx(styles.arc, fraction === 0 && styles.empty)}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          pathLength={LENGTH}
          strokeDasharray={LENGTH}
        />
      </svg>
      {children != null && <span className={styles.center}>{children}</span>}
    </span>
  )
}
