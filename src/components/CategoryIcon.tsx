import { cx } from '../lib/cx'
import type { CategoryId } from '../domain/types'
import { CATEGORY_ICONS, safeCategory } from './categories'
import styles from './CategoryIcon.module.css'

export interface CategoryIconProps {
  category: CategoryId
  /** `sm` 32px · `md` 44px (default) · `lg` 56px · `xl` 72px (hero headers). */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Accessible name (e.g. "Food"). Omit when the category is written next to it — then it's decorative. */
  label?: string
  className?: string
}

/** The category's icon on its soft tinted squircle (both colours follow the theme). */
export function CategoryIcon({ category, size = 'md', label, className }: CategoryIconProps) {
  const id = safeCategory(category)
  const Icon = CATEGORY_ICONS[id]
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <span {...a11y} data-category={id} className={cx(styles.tile, styles[size], styles[id], className)}>
      <Icon aria-hidden="true" focusable="false" className={styles.icon} strokeWidth={size === 'sm' ? 2.25 : 2} />
    </span>
  )
}
