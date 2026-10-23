/**
 * Quick starts for the new-split screen (`/app/split/new?category=rent`): what the title field
 * suggests for each kind of expense, a title worth filling in, and the one tip that helps most —
 * rent between rooms of different sizes is fairer by percentage; a trip is better as a group.
 */
import type { CategoryId } from '../../domain/types'
import { isCategoryId } from '../../engine/categories'
import { t, type MessageKey } from '../../i18n'
import { split as SPLIT_EN } from '../../i18n/en/split'

/** A nudge shown in context: split rent by %, or keep a trip's expenses together in a group. */
export type SplitTip = 'percent' | 'group'

export interface SplitTemplate {
  /** Filled into the title field (empty when there's no one obvious name). */
  title: string
  /** The title field's placeholder — examples of this kind of expense. */
  placeholder: string
  tip: SplitTip | null
}

/** The generic placeholder, in English (the screen shows `titlePlaceholder('other')` in the UI language). */
export const DEFAULT_PLACEHOLDER: string = SPLIT_EN['split.placeholder.other']

interface TemplateKeys {
  /** The title it starts with (null: none). */
  title: MessageKey | null
  placeholder: MessageKey
  tip: SplitTip | null
}

const TEMPLATES: Readonly<Record<CategoryId, TemplateKeys>> = {
  food: { title: null, placeholder: 'split.placeholder.food', tip: null },
  groceries: { title: null, placeholder: 'split.placeholder.groceries', tip: null },
  rent: { title: 'split.template.rent.title', placeholder: 'split.placeholder.rent', tip: 'percent' },
  utilities: { title: null, placeholder: 'split.placeholder.utilities', tip: null },
  travel: { title: null, placeholder: 'split.placeholder.travel', tip: 'group' },
  transport: { title: null, placeholder: 'split.placeholder.transport', tip: null },
  shopping: { title: null, placeholder: 'split.placeholder.shopping', tip: null },
  entertainment: { title: null, placeholder: 'split.placeholder.entertainment', tip: null },
  subscription: { title: null, placeholder: 'split.placeholder.subscription', tip: null },
  gift: { title: null, placeholder: 'split.placeholder.gift', tip: null },
  health: { title: null, placeholder: 'split.placeholder.health', tip: null },
  other: { title: null, placeholder: 'split.placeholder.other', tip: null },
}

/** Words Home's quick actions may use for a category ("Trip", "Cab"). */
const ALIASES: Readonly<Record<string, CategoryId>> = { trip: 'travel', cab: 'transport' }

/** The quick start for a `?category=` value (a category id, "trip" or "cab"); null for anything else. */
export function splitTemplate(value: string | null | undefined): (SplitTemplate & { category: CategoryId }) | null {
  const key = value?.toLowerCase() ?? ''
  const category = isCategoryId(value) ? value : Object.hasOwn(ALIASES, key) ? ALIASES[key] : undefined
  if (!category) return null
  const keys = TEMPLATES[category]
  return { category, title: keys.title ? t(keys.title) : '', placeholder: t(keys.placeholder), tip: keys.tip }
}

/** The title placeholder for a category (the generic one for "other"). */
export function titlePlaceholder(category: CategoryId): string {
  return t(TEMPLATES[category].placeholder)
}
