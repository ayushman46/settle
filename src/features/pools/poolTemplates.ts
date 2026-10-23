/** The ten occasions a collection starts from: emoji, label, title template, how people pay, amount chips. */
import { POOL_OCCASION_DEFAULTS } from '../../data/schemas'
import { POOL_OCCASIONS, type Minor, type PoolMode, type PoolOccasion } from '../../domain/types'
import { t, type MessageKey } from '../../i18n'
import { toMinor } from '../../lib/money'

export interface PoolTemplate {
  id: PoolOccasion
  emoji: string
  mode: PoolMode
  /** Amount chips in major units (₹). */
  chips: readonly number[]
  /** A line under the amount, when the occasion has a custom. */
  hint: MessageKey | null
}

export const POOL_TEMPLATES: Readonly<Record<PoolOccasion, PoolTemplate>> = {
  birthday: { id: 'birthday', emoji: '🎂', mode: 'fixed', chips: [200, 300, 500], hint: null },
  farewell: { id: 'farewell', emoji: '👋', mode: 'fixed', chips: [300, 500, 1000], hint: null },
  diwali: { id: 'diwali', emoji: '🪔', mode: 'fixed', chips: [500, 1000, 2000], hint: null },
  shagun: { id: 'shagun', emoji: '💍', mode: 'fixed', chips: [501, 1101, 2101, 5101], hint: 'pools.editor.hint.shagun' },
  office: { id: 'office', emoji: '🏢', mode: 'target', chips: [100, 200, 500], hint: null },
  puja: { id: 'puja', emoji: '🙏', mode: 'target', chips: [101, 251, 501], hint: 'pools.editor.hint.puja' },
  trip: { id: 'trip', emoji: '✈️', mode: 'fixed', chips: [2000, 5000, 10000], hint: null },
  party: { id: 'party', emoji: '🎉', mode: 'fixed', chips: [500, 1000, 1500], hint: null },
  sports: { id: 'sports', emoji: '🏏', mode: 'fixed', chips: [100, 150, 200], hint: null },
  other: { id: 'other', emoji: '✨', mode: 'fixed', chips: [], hint: null },
}

export const OCCASION_ORDER: readonly PoolOccasion[] = POOL_OCCASIONS

export function occasionLabel(id: PoolOccasion): string {
  return t(`pools.occasion.${id}` as MessageKey)
}

function template(id: PoolOccasion): string {
  return t(`pools.template.${id}` as MessageKey)
}

/** The occasion's chips in minor units of `currency`. */
export function occasionChips(id: PoolOccasion, currency: string): Minor[] {
  return POOL_TEMPLATES[id].chips.map((major) => toMinor(major, currency))
}

/**
 * The title an occasion suggests for "For whom or what?" ("Riya" → "Riya's farewell"). A template
 * that needs a name falls back to the occasion's plain title until one is typed.
 */
export function titleFor(id: PoolOccasion, name: string): string {
  const pattern = template(id)
  const who = name.trim().replace(/\s+/g, ' ')
  if (!pattern.includes('{name}')) return pattern
  if (!who) return POOL_OCCASION_DEFAULTS[id].title
  return pattern.replace('{name}', who)
}

/** True when the occasion's title has a name in it ("{name}'s farewell"). */
export function occasionTakesName(id: PoolOccasion): boolean {
  return template(id).includes('{name}')
}

const GIFT_OCCASIONS: ReadonlySet<PoolOccasion> = new Set(['birthday', 'farewell', 'shagun'])

/** Who a gift is for, read back from a title made by the template ("Riya's farewell" → "Riya"); else null. */
export function giftRecipient(id: PoolOccasion, title: string): string | null {
  if (!GIFT_OCCASIONS.has(id)) return null
  const pattern = template(id)
  const at = pattern.indexOf('{name}')
  if (at === -1) return null
  const prefix = pattern.slice(0, at)
  const suffix = pattern.slice(at + '{name}'.length)
  const clean = title.trim()
  if (!clean.toLowerCase().startsWith(prefix.toLowerCase()) || !clean.toLowerCase().endsWith(suffix.toLowerCase())) return null
  const name = clean.slice(prefix.length, clean.length - suffix.length).trim()
  return name.length > 0 && name.length <= 40 ? name : null
}
