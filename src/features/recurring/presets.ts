/** One-tap starting points for a recurring split — the bills flatmates and couples split every month. */
import type { CategoryId } from '../../domain/types'

export interface RecurringPreset {
  id: string
  title: string
  category: CategoryId
  /** A sensible due day; null = the day it's set up. */
  dayOfMonth: number | null
}

export const RECURRING_PRESETS: readonly RecurringPreset[] = [
  { id: 'rent', title: 'Rent', category: 'rent', dayOfMonth: 1 },
  { id: 'wifi', title: 'Wi-Fi', category: 'utilities', dayOfMonth: null },
  { id: 'electricity', title: 'Electricity', category: 'utilities', dayOfMonth: null },
  { id: 'netflix', title: 'Netflix', category: 'subscription', dayOfMonth: null },
  { id: 'help', title: 'House help', category: 'other', dayOfMonth: 1 },
]

export function presetById(id: string | null): RecurringPreset | null {
  return RECURRING_PRESETS.find((p) => p.id === id) ?? null
}
