/** How categories read on things that leave the app (pay links, cards, summaries) — same labels as in the app. */
import type { CategoryId } from '../domain/types'
import { CATEGORY_META } from '../engine/categories'

export function categoryLabel(category: CategoryId): string {
  return (CATEGORY_META[category] ?? CATEGORY_META.other).label
}
