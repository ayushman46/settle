import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Receipt.module.css'

export interface ReceiptProps extends ComponentPropsWithRef<'div'> {
  /** Which edges are torn (zig-zag). Default `bottom`. */
  edge?: 'bottom' | 'both' | 'none'
  /** Inner padding: `md` 20px (default) · `lg` 24px · `sm` 16px (small illustrations). */
  padding?: 'sm' | 'md' | 'lg'
  /** Class for the paper itself (the outer element carries `className` and the shadow). */
  paperClassName?: string
}

/**
 * Paper receipt: white slip with a torn zig-zag edge and a soft lifted shadow.
 * `Receipt.Divider` and `Receipt.Row` are the matching dashed rule and label/amount row.
 */
export function Receipt({ edge = 'bottom', padding = 'md', className, paperClassName, children, ...rest }: ReceiptProps) {
  return (
    <div {...rest} className={cx(styles.receipt, className)}>
      <div className={cx(styles.paper, styles[`pad-${padding}`], styles[`edge-${edge}`], paperClassName)}>{children}</div>
    </div>
  )
}

export interface ReceiptDividerProps {
  /** Spacing around the dashed rule: `md` 16px (default) · `sm` 12px · `lg` 20px. */
  spacing?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Dashed tear-line that runs edge to edge across the paper. */
export function ReceiptDivider({ spacing = 'md', className }: ReceiptDividerProps) {
  return <hr className={cx(styles.divider, styles[`space-${spacing}`], className)} />
}

export interface ReceiptRowProps {
  label: ReactNode
  /** Usually a `Money`. */
  value: ReactNode
  /** `strong` for totals, `muted` for secondary lines. */
  emphasis?: 'normal' | 'strong' | 'muted'
  className?: string
}

/** Label on the left, amount on the right (baseline-aligned, amount never wraps). */
export function ReceiptRow({ label, value, emphasis = 'normal', className }: ReceiptRowProps) {
  return (
    <div className={cx(styles.row, emphasis !== 'normal' && styles[emphasis], className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  )
}

Receipt.Divider = ReceiptDivider
Receipt.Row = ReceiptRow
