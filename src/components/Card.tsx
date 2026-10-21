import type { ComponentPropsWithRef } from 'react'
import { cx } from '../lib/cx'
import styles from './Card.module.css'

export interface CardProps extends ComponentPropsWithRef<'div'> {
  /** `md` 16px (default) · `lg` 24px · `none` for edge-to-edge lists. */
  padding?: 'none' | 'md' | 'lg'
  /** `surface` white card with a soft shadow (default) · `sunken` soft fill, no shadow. */
  tone?: 'surface' | 'sunken'
}

/** White surface with a soft lift and a 24px radius. Clips its children to the rounded corners. */
export function Card({ padding = 'md', tone = 'surface', className, ...rest }: CardProps) {
  return <div {...rest} className={cx(styles.card, styles[`pad-${padding}`], styles[tone], className)} />
}
