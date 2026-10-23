/** How categories read on things that leave the app (pay links, cards, summaries) — same labels as in the app. */
import type { CategoryId } from '../domain/types'
import { t, type MessageKey } from '../i18n'

const KEYS: Readonly<Record<CategoryId, MessageKey>> = {
  food: 'share.category.food',
  groceries: 'share.category.groceries',
  rent: 'share.category.rent',
  utilities: 'share.category.utilities',
  travel: 'share.category.travel',
  transport: 'share.category.transport',
  shopping: 'share.category.shopping',
  entertainment: 'share.category.entertainment',
  subscription: 'share.category.subscription',
  gift: 'share.category.gift',
  health: 'share.category.health',
  other: 'share.category.other',
}

/** The category's name in the UI language ("Food & drinks"); anything unknown reads as "Other". */
export function categoryLabel(category: CategoryId): string {
  return t(Object.hasOwn(KEYS, category) ? KEYS[category] : KEYS.other)
}
