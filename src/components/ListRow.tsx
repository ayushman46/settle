import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx'
import styles from './ListRow.module.css'

const InList = createContext(false)

export interface ListProps extends Omit<ComponentPropsWithRef<'ul'>, 'role'> {
  children: ReactNode
}

/** Semantic list wrapper for `ListRow`s (each row becomes an `<li>`; hairlines between rows). */
export function List({ children, className, ...rest }: ListProps) {
  return (
    <ul {...rest} role="list" className={cx(styles.list, className)}>
      <InList value={true}>{children}</InList>
    </ul>
  )
}

export interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Visual before the text (Avatar, icon tile...). */
  leading?: ReactNode
  /** Visual after the text (Money, AvatarStack, pill...). */
  trailing?: ReactNode
  /** Makes the whole row a button. */
  onClick?: () => void
  /** Adds a chevron after `trailing` (only for clickable rows). */
  chevron?: boolean
  /** Marks the row as needing attention (subtle dashed marker at the start edge), e.g. unassigned. */
  pending?: boolean
  disabled?: boolean
  /** Accessible name override for clickable rows (defaults to the row's text). */
  'aria-label'?: string
  'aria-describedby'?: string
  id?: string
  className?: string
}

/**
 * One row of a grouped list (inside a `Card padding="none"`, ideally within a `List`). Renders a
 * `<button>` when `onClick` is set, otherwise a plain block.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  chevron = false,
  pending = false,
  disabled = false,
  id,
  className,
  ...aria
}: ListRowProps) {
  const inList = useContext(InList)
  const clickable = onClick !== undefined
  // The {' '} text nodes are invisible between flex items, but keep the parts apart in the
  // accessible name ("Butter Chicken ₹495.00", not "Butter Chicken₹495.00").
  const content = (
    <>
      {leading != null && <span className={styles.leading}>{leading}</span>}{' '}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle != null && (
          <>
            {' '}
            <span className={styles.subtitle}>{subtitle}</span>
          </>
        )}
      </span>
      {trailing != null && (
        <>
          {' '}
          <span className={styles.trailing}>{trailing}</span>
        </>
      )}
      {clickable && chevron && <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />}
    </>
  )
  const rowClass = cx(styles.row, clickable && styles.clickable, pending && styles.pending, className)

  const row = clickable ? (
    <button id={id} type="button" className={rowClass} onClick={onClick} disabled={disabled} {...aria}>
      {content}
    </button>
  ) : (
    <div id={id} className={rowClass} {...aria}>
      {content}
    </div>
  )

  return inList ? <li className={styles.item}>{row}</li> : row
}
