/** Where Home's tiles, rows and cards lead, and the small labels they share. */
import { t } from '../../i18n'
import type { CategoryId } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import type { BillDraftSummary } from '../bill/launch'

export const NEW_SPLIT_PATH = '/app/split/new'
export const NEW_GROUP_PATH = '/app/groups?new=1'
export const FRIENDS_PATH = '/app/friends'
export const ADD_FRIEND_PATH = '/app/friends?new=1'
export const ACTIVITY_PATH = '/app/activity'
export const RECURRING_PATH = '/app/recurring'

/** Faces in the people grid before "See all" takes over (with "Add", two rows of four). */
export const PEOPLE_SHOWN = 7
/** Expenses shown on Home; the rest are a tap away in Activity. */
export const RECENT_SHOWN = 3
/** Due recurring splits shown on Home; more are a tap away in Recurring. */
export const DUE_SHOWN = 2

/** One-tap starts for the expenses people split most, each opening the split screen set up for it. */
export const SPLIT_TEMPLATES: ReadonlyArray<{ category: CategoryId; label: string }> = [
  { category: 'rent', label: 'Rent' },
  { category: 'travel', label: 'Trip' },
  { category: 'subscription', label: 'Subscription' },
  { category: 'utilities', label: 'Utilities' },
  { category: 'transport', label: 'Cab' },
]

/** The new-split screen started from a category template. */
export function templatePath(category: CategoryId): string {
  return `${NEW_SPLIT_PATH}?category=${encodeURIComponent(category)}`
}

export function friendPath(id: string): string {
  return `${FRIENDS_PATH}/${encodeURIComponent(id)}`
}

export function expensePath(id: string): string {
  return `/app/expense/${encodeURIComponent(id)}`
}

/** Today's AI allowance, beside "Just say it": "3 free splits today", or unlimited with Pro. */
export function allowanceLabel(remaining: number): string {
  if (!Number.isFinite(remaining)) return t('home.allowance.unlimited')
  if (remaining <= 0) return t('home.allowance.used')
  return t('home.allowance.left', { count: remaining })
}

/** "Taj Café · 6 items · ₹2,340" — what's in the bill being split. */
export function draftLine(draft: BillDraftSummary): string {
  const parts = [draft.title?.trim() || (draft.editing ? t('home.draft.saved') : t('home.draft.inProgress'))]
  if (draft.items > 0) parts.push(t('home.draft.items', { count: draft.items }))
  if (draft.total > 0) parts.push(formatMoney(draft.total, draft.currency, { trimZeros: true }))
  return parts.join(' · ')
}
