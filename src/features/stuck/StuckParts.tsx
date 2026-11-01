import { Check, Landmark, Store } from 'lucide-react'
import type { StuckKind } from '../../data/stores'
import { cx } from '../../lib/cx'
import type { StuckSection } from './view'
import styles from './Stuck.module.css'

/**
 * Who owes it, at a glance: a bank (a failed payment) or a shop (a refund), tinted by where it
 * stands — amber when it needs you, green once it's back. Decorative: the row says it in words.
 */
export function KindIcon({ kind, section, size = 'md' }: { kind: StuckKind; section: StuckSection; size?: 'md' | 'lg' }) {
  const Icon = section === 'back' ? Check : kind === 'refund' ? Store : Landmark
  return (
    <span className={cx(styles.kindIcon, styles[`kind-${section}`], size === 'lg' && styles.kindIconLg)} aria-hidden="true">
      <Icon strokeWidth={section === 'back' ? 2.75 : 2.25} />
    </span>
  )
}
