import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Screen.module.css'

/** How the screen was reached: pushed (`forward`), popped (`back`), a tab switch (`fade`) or first paint. */
export type NavDirection = 'forward' | 'back' | 'fade' | 'none'

export interface ScreenProps {
  /** Usually a `TopBar`. Sticks to the top while the content scrolls. */
  header?: ReactNode
  /** Usually an `ActionBar`. Sticks to the bottom (thumb zone) above the safe area. */
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Extra class for the scrolling content column (a 24px-gap flex column by default). */
  contentClassName?: string
  /**
   * On mount, scroll to the top and move focus to the screen's `<h1>` when nothing else
   * holds focus, so screen-reader users hear the new step. Default true.
   */
  autoFocusHeading?: boolean
}

/**
 * Page scaffold: sticky translucent header, scrolling content, sticky footer. The content enters
 * with a direction-aware slide set by the nearest `ScreenTransition` (forward → from the right,
 * back → from the left, fade → a tab cross-fade, none/absent → a gentle rise); crossfade only
 * under reduced motion.
 */
export function Screen({ header, footer, children, className, contentClassName, autoFocusHeading = true }: ScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Mount-time behaviour only: a step change remounts the screen.
  const [focusHeading] = useState(autoFocusHeading)

  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' })
    if (!focusHeading) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    rootRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [focusHeading])

  return (
    <div ref={rootRef} className={cx(styles.screen, className)}>
      {header != null && <div className={styles.header}>{header}</div>}
      <main className={cx(styles.content, header == null && styles.noHeader, contentClassName)}>{children}</main>
      {footer != null && (
        <div className={styles.footer} data-toast-anchor="">
          {footer}
        </div>
      )}
    </div>
  )
}

export interface ScreenTransitionProps {
  /** Direction of the navigation that produced the screen inside. */
  direction: NavDirection
  /** The (keyed) screen. Remounting it replays the entrance in `direction`. */
  children: ReactNode
}

/**
 * Layout-neutral wrapper (`display: contents`) that tells the `Screen` inside which way the
 * person navigated. Use in App: `<ScreenTransition direction={dir}><Step key={step} /></ScreenTransition>`.
 */
export function ScreenTransition({ direction, children }: ScreenTransitionProps) {
  return (
    <div className={styles.transition} data-nav={direction}>
      {children}
    </div>
  )
}
