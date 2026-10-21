/** How categories read on things that leave the app (pay links, cards, summaries). */
import { CATEGORY_IDS, type CategoryId } from '../domain/types'

const LABELS: Readonly<Record<CategoryId, string>> = {
  food: 'Food & drinks',
  groceries: 'Groceries',
  rent: 'Rent',
  utilities: 'Utilities',
  travel: 'Travel',
  transport: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  subscription: 'Subscription',
  gift: 'Gift',
  health: 'Health',
  other: 'Other',
}

export function categoryLabel(category: CategoryId): string {
  return LABELS[category] ?? LABELS.other
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}
