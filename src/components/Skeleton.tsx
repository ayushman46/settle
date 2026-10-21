import type { CSSProperties } from 'react'
import { cx } from '../lib/cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  /** CSS width (number = px). Default 100%. */
  width?: number | string
  /** CSS height (number = px). Default 14px (one line of text). */
  height?: number | string
  /** `sm` text bar (default) · `md` block · `pill` · `circle`. */
  shape?: 'sm' | 'md' | 'pill' | 'circle'
  className?: string
}

/** Shimmering placeholder block. Decorative (`aria-hidden`) — pair it with a live status text. */
export function Skeleton({ width, height, shape = 'sm', className }: SkeletonProps) {
  const style: CSSProperties = {}
  if (width !== undefined) style.width = width
  if (height !== undefined) style.height = height
  return <span aria-hidden="true" className={cx(styles.skeleton, styles[shape], className)} style={style} />
}

export interface SkeletonRowsProps {
  /** Number of bill-like lines. Default 4. */
  count?: number
  className?: string
}

/** Item name widths cycle through these so the lines look like a real bill. */
const NAME_WIDTHS = ['64%', '48%', '72%', '40%', '56%', '68%']
const AMOUNT_WIDTHS = ['18%', '14%', '20%', '16%']

/** Placeholder bill lines (name … amount) shown while a bill is being read. */
export function SkeletonRows({ count = 4, className }: SkeletonRowsProps) {
  const rows = Math.max(0, Math.floor(count))
  return (
    <div aria-hidden="true" className={cx(styles.rows, className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row} style={{ '--row-index': i } as CSSProperties}>
          <Skeleton width={NAME_WIDTHS[i % NAME_WIDTHS.length]} />
          <Skeleton width={AMOUNT_WIDTHS[i % AMOUNT_WIDTHS.length]} />
        </div>
      ))}
    </div>
  )
}
