import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './SettingIcon.module.css'

export interface SettingIconProps {
  children: ReactNode
  /** `danger` tints it red (Clear all data); `accent` the theme accent. */
  tone?: 'default' | 'accent' | 'danger'
}

/** The small squircle icon at the start of a settings row. Decorative. */
export function SettingIcon({ children, tone = 'default' }: SettingIconProps) {
  return (
    <span aria-hidden="true" className={cx(styles.icon, tone !== 'default' && styles[tone])}>
      {children}
    </span>
  )
}
