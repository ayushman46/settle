import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './PageTitle.module.css'

export interface PageTitleProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Small label above the title (e.g. merchant · date). */
  eyebrow?: ReactNode
  /** Visual above everything (e.g. a `SuccessCheck`). */
  leading?: ReactNode
  align?: 'start' | 'center'
  /** Id for the `<h1>` (e.g. for `aria-labelledby`). */
  id?: string
  className?: string
}

/**
 * The screen's `<h1>` block. The heading is programmatically focusable (`tabIndex=-1`)
 * so `Screen` can move focus to it when a new step appears.
 */
export function PageTitle({ title, subtitle, eyebrow, leading, align = 'start', id, className }: PageTitleProps) {
  return (
    <div className={cx(styles.root, align === 'center' && styles.center, className)}>
      {leading != null && <div className={styles.leading}>{leading}</div>}
      {eyebrow != null && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 id={id} className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      {subtitle != null && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  )
}
