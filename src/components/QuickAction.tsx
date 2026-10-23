import { Children, type ReactNode } from 'react'
import { t, useT } from '../i18n'
import { cx } from '../lib/cx'
import type { CategoryId } from '../domain/types'
import { safeCategory } from './categories'
import styles from './QuickAction.module.css'

export type QuickActionTone = CategoryId | 'accent' | 'ink'

export interface QuickActionProps {
  icon: ReactNode
  /** Short label under the tile (1–2 words); also the button's name. */
  label: string
  /** A category's tint, the theme `accent`, or `ink` (dark tile, accent glyph — the signature action). */
  tone?: QuickActionTone
  onClick: () => void
  /** A count bubble (number), a dot (`true`) or a tiny tag ("New", "Pro"). */
  badge?: number | boolean | string
  disabled?: boolean
  className?: string
}

function badgeLabel(badge: QuickActionProps['badge']): string | null {
  if (badge === true) return t('ui.badge.new')
  if (typeof badge === 'number') return Number.isFinite(badge) && badge > 0 ? t('ui.badge.count', { count: Math.floor(badge) }) : null
  if (typeof badge === 'string' && badge.trim() !== '') return badge.trim()
  return null
}

/** A colourful round-cornered action tile with its label underneath (payments-app quick actions). */
export function QuickAction({ icon, label, tone = 'ink', onClick, badge, disabled = false, className }: QuickActionProps) {
  const toneClass = tone === 'accent' || tone === 'ink' ? styles[tone] : styles[safeCategory(tone)]
  useT()
  const extra = badgeLabel(badge)
  return (
    <button type="button" className={cx(styles.action, className)} disabled={disabled} onClick={onClick}>
      <span className={cx(styles.tile, toneClass)} aria-hidden="true">
        <span className={styles.icon}>{icon}</span>
        {extra !== null && (
          <span className={cx(styles.badge, typeof badge === 'string' ? styles.tag : badge === true && styles.dot)}>
            {typeof badge === 'string' ? extra : typeof badge === 'number' ? (badge > 9 ? '9+' : Math.floor(badge)) : null}
          </span>
        )}
      </span>
      <span className={styles.label}>
        {label}
        {extra !== null && <span className="visually-hidden">, {extra}</span>}
      </span>
    </button>
  )
}

export interface QuickActionGridProps {
  /** `QuickAction`s (each becomes a list item). */
  children: ReactNode
  /** Accessible name for the group, e.g. "Quick actions". */
  label?: string
  /** Columns on a phone. Default 4. */
  columns?: 3 | 4
  className?: string
}

/** Four-up grid of quick actions that wraps onto more rows. */
export function QuickActionGrid({ children, label, columns = 4, className }: QuickActionGridProps) {
  return (
    <ul role="list" aria-label={label} className={cx(styles.grid, columns === 3 && styles.three, className)}>
      {Children.toArray(children).map((child, i) => (
        <li key={i} className={styles.cell}>
          {child}
        </li>
      ))}
    </ul>
  )
}
