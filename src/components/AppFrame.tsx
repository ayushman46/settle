import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './AppFrame.module.css'

export interface AppFrameProps {
  children: ReactNode
  className?: string
}

/**
 * The app's column: full-bleed on phones; on larger screens a phone-width card that rises from
 * the bottom of a quiet desk, so the tab bar, sticky actions and toasts stay bottom-anchored the
 * way they are on a phone. Public pages (landing, pay link, legal) render outside it.
 */
export function AppFrame({ children, className }: AppFrameProps) {
  return (
    <div className={cx(styles.frame, className)} data-app-frame="">
      {children}
    </div>
  )
}
