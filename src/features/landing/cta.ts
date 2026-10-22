/** Class names for link-shaped calls to action (kept apart so component files only export components). */
import { cx } from '../../lib/cx'
import styles from './cta.module.css'

export type CtaVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'onDark'
export type CtaSize = 'lg' | 'md' | 'sm'

export interface CtaStyle {
  /** `primary` ink pill (default) · `accent` lime · `secondary` outlined · `ghost` text · `onDark` outlined on a dark panel. */
  variant?: CtaVariant
  /** `lg` 56px (default) · `md` 44px · `sm` 36px (44px touch target). */
  size?: CtaSize
  /** Stretch to the container width. */
  block?: boolean
}

export function ctaClassName({ variant = 'primary', size = 'lg', block = false }: CtaStyle, extra?: string): string {
  return cx(styles.cta, styles[variant], styles[size], block && styles.block, extra)
}

export const ctaParts = {
  icon: styles.icon,
  iconEnd: cx(styles.icon, styles.iconEnd),
} as const
