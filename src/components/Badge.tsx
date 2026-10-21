import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Badge.module.css'

export type BadgeTone = 'pro' | 'positive' | 'negative' | 'neutral' | 'accent' | 'warning'

export interface BadgeProps {
  /** `pro` brand gradient · `positive` · `negative` · `warning` · `neutral` grey · `accent` the theme accent. */
  tone?: BadgeTone
  children: ReactNode
  /** Small leading glyph (e.g. a lucide icon). */
  icon?: ReactNode
  /** `sm` 20px (default) · `md` 24px. */
  size?: 'sm' | 'md'
  className?: string
}

/** Small status pill ("Pro", "Settled", "2 pending"). Text always meets AA on its fill. */
export function Badge({ tone = 'neutral', children, icon, size = 'sm', className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], className)}>
      {icon != null && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
    </span>
  )
}
