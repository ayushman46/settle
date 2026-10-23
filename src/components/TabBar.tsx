import type { MouseEvent, ReactNode } from 'react'
import { t, useT } from '../i18n'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { isPlainLeftClick } from './links'
import styles from './TabBar.module.css'

export interface TabBarItem {
  key: string
  label: string
  icon: ReactNode
  /** Optional filled/bolder variant shown while the tab is active. */
  activeIcon?: ReactNode
  href: string
  /** A count bubble (numbers; 0 hides it) or a dot (`true`). */
  badge?: number | boolean
}

export interface TabBarProps {
  items: readonly TabBarItem[]
  activeKey: string
  /** In-app navigation to `href` (plain left-clicks; modified clicks open new tabs as usual). */
  onNavigate: (href: string) => void
  /** Landmark name. Default "Main". */
  ariaLabel?: string
  className?: string
}

function badgeText(badge: number | boolean | undefined): string | null {
  if (badge === true) return t('ui.badge.new')
  if (typeof badge === 'number' && Number.isFinite(badge) && badge > 0) return t('ui.badge.count', { count: Math.floor(badge) })
  return null
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The app's bottom navigation: fixed, frosted, safe-area aware, with an ink (light) / lime (dark)
 * pill behind the active icon. Real links in a `nav` landmark; the current tab has
 * `aria-current="page"`, and tapping it again scrolls back to the top. Renders an in-flow spacer
 * so content never ends up underneath it. Hides while typing on touch screens.
 */
export function TabBar({ items, activeKey, onNavigate, ariaLabel, className }: TabBarProps) {
  useT()
  const onClick = (event: MouseEvent<HTMLAnchorElement>, item: TabBarItem): void => {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    if (item.key === activeKey) {
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      return
    }
    haptic('select')
    onNavigate(item.href)
  }

  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav aria-label={ariaLabel ?? t('ui.tabBar.aria')} className={cx(styles.bar, className)} data-tabbar="" data-toast-anchor="">
        <ul role="list" className={styles.list}>
          {items.map((item) => {
            const active = item.key === activeKey
            const extra = badgeText(item.badge)
            const count = typeof item.badge === 'number' ? Math.floor(item.badge) : 0
            return (
              <li key={item.key} className={styles.item}>
                <a
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(styles.tab, active && styles.active)}
                  onClick={(event) => onClick(event, item)}
                >
                  <span className={styles.pill} aria-hidden="true">
                    <span className={styles.icon}>{active && item.activeIcon != null ? item.activeIcon : item.icon}</span>
                    {extra !== null && (
                      <span className={cx(styles.badge, count <= 0 && styles.dot)}>
                        {count > 0 ? (count > 9 ? '9+' : count) : null}
                      </span>
                    )}
                  </span>
                  <span className={styles.label}>
                    {item.label}
                    {extra !== null && <span className="visually-hidden">, {extra}</span>}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
