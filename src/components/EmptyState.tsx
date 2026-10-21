import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** Icon, shown in a soft accent disc. */
  icon?: ReactNode
  /** A spot illustration (e.g. `<Illustration name="empty-groups" />`), shown instead of the icon disc. */
  illustration?: ReactNode
  title: ReactNode
  /** One or two short sentences. */
  text?: ReactNode
  /** The next step, usually a `Button`. */
  action?: ReactNode
  /** `md` (default) for page sections, `sm` for inside cards/sheets. */
  size?: 'sm' | 'md'
  /** Heading level for the title. Default 2. */
  headingLevel?: 2 | 3
  className?: string
}

/** Friendly "nothing here yet" block with a clear next step. */
export function EmptyState({
  icon,
  illustration,
  title,
  text,
  action,
  size = 'md',
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div className={cx(styles.empty, styles[size], className)}>
      {illustration != null ? (
        <div className={styles.illustration} aria-hidden="true">
          {illustration}
        </div>
      ) : (
        icon != null && (
          <div className={styles.icon} aria-hidden="true">
            {icon}
          </div>
        )
      )}
      <Heading className={styles.title}>{title}</Heading>
      {text != null && <p className={styles.text}>{text}</p>}
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  )
}
