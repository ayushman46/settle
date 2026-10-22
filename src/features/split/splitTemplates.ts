/**
 * Quick starts for the new-split screen (`/app/split/new?category=rent`): what the title field
 * suggests for each kind of expense, a title worth filling in, and the one tip that helps most —
 * rent between rooms of different sizes is fairer by percentage; a trip is better as a group.
 */
import type { CategoryId } from '../../domain/types'
import { isCategoryId } from '../../engine/categories'

/** A nudge shown in context: split rent by %, or keep a trip's expenses together in a group. */
export type SplitTip = 'percent' | 'group'

export interface SplitTemplate {
  /** Filled into the title field (empty when there's no one obvious name). */
  title: string
  /** The title field's placeholder — examples of this kind of expense. */
  placeholder: string
  tip: SplitTip | null
}

export const DEFAULT_PLACEHOLDER = 'Dinner, rent, cab, Netflix…'

const TEMPLATES: Readonly<Record<CategoryId, SplitTemplate>> = {
  food: { title: '', placeholder: 'Dinner at Toit, Swiggy order…', tip: null },
  groceries: { title: '', placeholder: 'Blinkit, DMart, weekly veggies…', tip: null },
  rent: { title: 'Rent', placeholder: 'Rent, maintenance, deposit…', tip: 'percent' },
  utilities: { title: '', placeholder: 'Electricity, Wi-Fi, gas cylinder…', tip: null },
  travel: { title: '', placeholder: 'Flights, hotel, Goa trip…', tip: 'group' },
  transport: { title: '', placeholder: 'Uber to the airport, fuel…', tip: null },
  shopping: { title: '', placeholder: 'Amazon order, new curtains…', tip: null },
  entertainment: { title: '', placeholder: 'Movie tickets, concert…', tip: null },
  subscription: { title: '', placeholder: 'Netflix, Spotify, YouTube Premium…', tip: null },
  gift: { title: '', placeholder: 'Birthday gift for Neha…', tip: null },
  health: { title: '', placeholder: 'Pharmacy, doctor’s visit…', tip: null },
  other: { title: '', placeholder: DEFAULT_PLACEHOLDER, tip: null },
}

/** Words Home's quick actions may use for a category ("Trip", "Cab"). */
const ALIASES: Readonly<Record<string, CategoryId>> = { trip: 'travel', cab: 'transport' }

/** The quick start for a `?category=` value (a category id, "trip" or "cab"); null for anything else. */
export function splitTemplate(value: string | null | undefined): (SplitTemplate & { category: CategoryId }) | null {
  const key = value?.toLowerCase() ?? ''
  const category = isCategoryId(value) ? value : Object.hasOwn(ALIASES, key) ? ALIASES[key] : undefined
  if (!category) return null
  return { category, ...TEMPLATES[category] }
}

/** The title placeholder for a category (the generic one for "other"). */
export function titlePlaceholder(category: CategoryId): string {
  return TEMPLATES[category].placeholder
}
