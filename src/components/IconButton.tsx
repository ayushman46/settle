import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label' | 'children'> {
  /** Accessible name — required because the button only shows an icon. */
  label: string
  /** The icon (e.g. a lucide-react component); sized by the button. */
  children: ReactNode
  variant?: 'ghost' | 'secondary' | 'primary'
  /** `md` 44px (default) · `sm` 36px visual with a 44px touch target. */
  size?: 'md' | 'sm'
}

/** Round icon-only button with a guaranteed 44×44 touch target. */
export function IconButton({
  label,
  children,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      className={cx(styles.iconButton, styles[variant], styles[size], className)}
    >
      <span className={styles.glyph} aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
