/** Category visuals shared by design-system components (kept apart so component files only export components). */
import {
  Car,
  Clapperboard,
  Gift,
  HeartPulse,
  House,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from '../domain/types'

/** The lucide icon drawn for each category. */
export const CATEGORY_ICONS: Readonly<Record<CategoryId, LucideIcon>> = {
  food: Utensils,
  groceries: ShoppingBasket,
  rent: House,
  utilities: Zap,
  travel: Plane,
  transport: Car,
  shopping: ShoppingBag,
  entertainment: Clapperboard,
  subscription: Repeat,
  gift: Gift,
  health: HeartPulse,
  other: Receipt,
}

/** A known category, or 'other' for anything unexpected (old or hand-edited data). */
export function safeCategory(category: string): CategoryId {
  return Object.hasOwn(CATEGORY_ICONS, category) ? (category as CategoryId) : 'other'
}

/**
 * The category's colour as a CSS value — `ink` (saturated: icons, chart segments, ≥ 3:1 on
 * surfaces) or `bg` (the soft tint behind the ink). Follows the theme.
 */
export function categoryColor(category: string, part: 'ink' | 'bg' = 'ink'): string {
  return `var(--cat-${safeCategory(category)}-${part})`
}
