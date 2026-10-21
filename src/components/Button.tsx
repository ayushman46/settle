import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../lib/cx'
import { Spinner } from './Spinner'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'accent'
export type ButtonSize = 'lg' | 'md' | 'sm'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /**
   * `primary` ink pill (default) · `secondary` outlined · `tonal` soft grey fill · `ghost` text ·
   * `danger` red text · `accent` signature lime.
   */
  variant?: ButtonVariant
  /** Height: `lg` 56px (default), `md` 44px, `sm` 36px (44px touch target). */
  size?: ButtonSize
  /** Stretch to the container width. */
  block?: boolean
  /** Shows a spinner, sets `aria-busy` and disables the button (label keeps its width). */
  loading?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
}

/** Pill button with tactile press feedback. Defaults to `type="button"`. */
export function Button({
  variant = 'primary',
  size = 'lg',
  block = false,
  loading = false,
  iconStart,
  iconEnd,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, loading && styles.loading, className)}
    >
      <span className={styles.content}>
        {iconStart != null && (
          <span className={styles.icon} aria-hidden="true">
            {iconStart}
          </span>
        )}
        {children != null && <span className={styles.label}>{children}</span>}
        {iconEnd != null && (
          <span className={styles.icon} aria-hidden="true">
            {iconEnd}
          </span>
        )}
      </span>
      {loading && (
        <span className={styles.spinner}>
          <Spinner size={size === 'sm' ? 'sm' : 'md'} />
        </span>
      )}
    </button>
  )
}
