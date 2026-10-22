import { ChevronRight } from 'lucide-react'
import { Link } from '../../app/router'
import { cx } from '../../lib/cx'
import type { Perk } from './perks'
import styles from './PerkList.module.css'

export interface PerkListProps {
  perks: readonly Perk[]
  /** Perks with a screen of their own become links to it (once Pro is on). */
  linked?: boolean
  /** Names the list for assistive tech. */
  label?: string
  className?: string
}

/** Pro's perks as icon rows — a gradient-tinted tile, a title and one plain sentence each. */
export function PerkList({ perks, linked = false, label = 'What Pro adds', className }: PerkListProps) {
  return (
    <ul role="list" aria-label={label} className={cx(styles.list, className)}>
      {perks.map((perk) => {
        const Icon = perk.icon
        const body = (
          <>
            <span className={styles.tile} aria-hidden="true">
              <Icon strokeWidth={2.1} />
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{perk.title}</span>
              <span className={styles.description}>{perk.text}</span>
            </span>
          </>
        )
        return (
          <li key={perk.key} className={styles.item}>
            {linked && perk.href ? (
              <Link to={perk.href} className={cx(styles.perk, styles.link)}>
                {body}
                <ChevronRight className={styles.chevron} aria-hidden="true" strokeWidth={2.25} />
              </Link>
            ) : (
              <div className={styles.perk}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
