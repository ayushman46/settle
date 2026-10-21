import { useEffect, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Fab.module.css'

export interface FabProps {
  icon: ReactNode
  /** Accessible name; also the visible text when `extended`. */
  label: string
  onClick: () => void
  /** Show the label next to the icon ("New split"). It tucks away while scrolling down. */
  extended?: boolean
  /** `ink` (default) or the theme `accent`. */
  tone?: 'ink' | 'accent'
  className?: string
}

/** Scroll distance (px) in one direction before the extended label folds or unfolds. */
const SCROLL_SLOP = 12

/**
 * Floating action button, bottom-right — above the tab bar when there is one, above the safe area
 * otherwise. An extended FAB folds to its icon while scrolling down and unfolds on the way back
 * up (its accessible name never changes).
 */
export function Fab({ icon, label, onClick, extended = false, tone = 'ink', className }: FabProps) {
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    if (!extended) return
    let last = window.scrollY
    let frame = 0
    const update = (): void => {
      frame = 0
      const y = window.scrollY
      if (y <= SCROLL_SLOP) setFolded(false)
      else if (y - last > SCROLL_SLOP) setFolded(true)
      else if (last - y > SCROLL_SLOP) setFolded(false)
      else return
      last = y
    }
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [extended])

  const showLabel = extended && !folded
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(styles.fab, styles[tone], extended && styles.extended, showLabel && styles.open, className)}
      data-toast-anchor=""
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      {extended && (
        <span className={styles.label} aria-hidden="true">
          <span className={styles.labelText}>{label}</span>
        </span>
      )}
    </button>
  )
}
