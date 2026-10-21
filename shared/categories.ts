/**
 * Expense categories. Shared by the client (`src/domain/types.ts` re-exports them) and the
 * server (scan and describe answers carry one) — keep this file dependency-free.
 */

export type CategoryId =
  | 'food'
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'travel'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'subscription'
  | 'gift'
  | 'health'
  | 'other'

/** Every category, in display order. */
export const CATEGORY_IDS: readonly CategoryId[] = [
  'food',
  'groceries',
  'rent',
  'utilities',
  'travel',
  'transport',
  'shopping',
  'entertainment',
  'subscription',
  'gift',
  'health',
  'other',
]

const KNOWN: ReadonlySet<string> = new Set(CATEGORY_IDS)

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && KNOWN.has(value)
}
