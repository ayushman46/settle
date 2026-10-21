import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './ActionBar.module.css'

export interface ActionBarProps {
  /** The buttons (primary first). */
  children: ReactNode
  /** Short helper shown above the buttons, e.g. why the primary action is disabled. Announced politely. */
  hint?: ReactNode
  /** Stack buttons vertically (default) or place them side by side with equal widths. */
  direction?: 'column' | 'row'
  className?: string
}

/** The sticky bottom action area of a screen (pass it to `Screen`'s `footer`). */
export function ActionBar({ children, hint, direction = 'column', className }: ActionBarProps) {
  return (
    <div className={cx(styles.bar, className)}>
      {/* Always rendered so screen readers pick up hint changes as a live region. */}
      <p className={styles.hint} aria-live="polite">
        {hint}
      </p>
      <div className={cx(styles.actions, direction === 'row' && styles.row)}>{children}</div>
    </div>
  )
}
