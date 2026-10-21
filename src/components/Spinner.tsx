import { cx } from '../lib/cx'
import styles from './Spinner.module.css'

export interface SpinnerProps {
  /** Diameter: `sm` 16px, `md` 20px (default), `lg` 28px. */
  size?: 'sm' | 'md' | 'lg'
  /** When set, the spinner is announced (`role="status"`); otherwise it is decorative. */
  label?: string
  className?: string
}

/** A tapered ring that inherits `currentColor`. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const a11y = label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true }
  return <span className={cx(styles.spinner, styles[size], className)} {...a11y} />
}
