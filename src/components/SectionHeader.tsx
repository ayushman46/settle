import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx'
import { followLink } from './links'
import styles from './SectionHeader.module.css'

export interface SectionHeaderAction {
  label: string
  /** Renders a button; with `href` too, runs instead of the in-app navigation. */
  onClick?: () => void
  /** Renders a real link; plain clicks navigate in-app (see `setLinkNavigator`). */
  href?: string
  /** Fuller accessible name when the label alone is vague ("See all" → "See all activity"). */
  'aria-label'?: string
}

export interface SectionHeaderProps {
  title: ReactNode
  /** Optional line under the title. */
  description?: ReactNode
  /** Trailing text action, e.g. "See all". */
  action?: SectionHeaderAction
  /** Heading level. Default 2. */
  headingLevel?: 2 | 3
  /** Id for the heading (e.g. for a section's `aria-labelledby`). */
  id?: string
  className?: string
}

/** Title row above a section of a screen, with an optional "See all"-style action. */
export function SectionHeader({ title, description, action, headingLevel = 2, id, className }: SectionHeaderProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div className={cx(styles.header, className)}>
      <div className={styles.text}>
        <Heading id={id} className={styles.title}>
          {title}
        </Heading>
        {description != null && <p className={styles.description}>{description}</p>}
      </div>
      {action && <SectionAction action={action} />}
    </div>
  )
}

function SectionAction({ action }: { action: SectionHeaderAction }) {
  const { label, onClick, href } = action
  const content = (
    <>
      <span>{label}</span>
      <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={2.5} />
    </>
  )
  if (href !== undefined) {
    return (
      <a
        href={href}
        className={styles.action}
        aria-label={action['aria-label']}
        onClick={(event) => followLink(event, href, onClick && (() => onClick()))}
      >
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={styles.action} aria-label={action['aria-label']} onClick={onClick}>
      {content}
    </button>
  )
}
