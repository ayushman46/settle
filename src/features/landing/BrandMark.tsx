import { BRAND } from '../../domain/types'
import { cx } from '../../lib/cx'
import styles from './BrandMark.module.css'

export interface BrandMarkProps {
  /** `sm` 24px tile · `md` 32px (default) · `lg` 44px. */
  size?: 'sm' | 'md' | 'lg'
  /** Show the name beside the tile. Default true. */
  wordmark?: boolean
  className?: string
}

/**
 * Settle's mark — the app icon's receipt on a lime squircle — with the name beside it.
 * Decorative: the name is plain text (or the link around it carries the label).
 */
export function BrandMark({ size = 'md', wordmark = true, className }: BrandMarkProps) {
  return (
    <span className={cx(styles.brand, styles[size], className)}>
      <svg className={styles.tile} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
        <rect className={styles.paper} width="512" height="512" rx="128" />
        <g className={styles.glyph}>
          <path d="M168 386V148a20 20 0 0 1 20-20h136a20 20 0 0 1 20 20v238l-22-22-22 22-22-22-22 22-22-22-22 22-22-22z" />
          <path d="M214 202h84M214 258h84M214 314h44" />
        </g>
      </svg>
      {wordmark && <span className={styles.word}>{BRAND.name}</span>}
    </span>
  )
}
