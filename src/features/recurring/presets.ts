/** One-tap starting points for a recurring split — the bills flatmates and couples split every month. */
import type { CategoryId } from '../../domain/types'
import { t, type MessageKey } from '../../i18n'

export interface RecurringPreset {
  id: string
  /** In the UI language, read when shown (it also becomes the new split's title). */
  readonly title: string
  category: CategoryId
  /** A sensible due day; null = the day it's set up. */
  dayOfMonth: number | null
}

function preset(id: string, titleKey: MessageKey, category: CategoryId, dayOfMonth: number | null): RecurringPreset {
  return {
    id,
    get title() {
      return t(titleKey)
    },
    category,
    dayOfMonth,
  }
}

export const RECURRING_PRESETS: readonly RecurringPreset[] = [
  preset('rent', 'recurring.preset.rent', 'rent', 1),
  preset('wifi', 'recurring.preset.wifi', 'utilities', null),
  preset('electricity', 'recurring.preset.electricity', 'utilities', null),
  preset('netflix', 'recurring.preset.netflix', 'subscription', null),
  preset('help', 'recurring.preset.help', 'other', 1),
]

export function presetById(id: string | null): RecurringPreset | null {
  return RECURRING_PRESETS.find((p) => p.id === id) ?? null
}
