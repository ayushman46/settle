import { AVATAR_COLORS, type Person } from '../types'

/** Most people one bill can be split between. */
export const MAX_PEOPLE = 20

/** Longest name we keep, in user-perceived characters. */
export const MAX_NAME_LENGTH = 24

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/** Splits text into user-perceived characters (emoji, flags and accents stay whole). */
export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment)
  return Array.from(text)
}

const MEANINGFUL = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u

/** First grapheme of a word that is a letter, digit, emoji or flag ("(Bob)" → "B"). */
function leadingGrapheme(word: string): string | null {
  for (const g of graphemes(word)) {
    if (MEANINGFUL.test(g)) return g
  }
  return null
}

/**
 * Avatar initials: one character for a single name, first + last for several words.
 * Emoji-safe and upper-cased. Returns "?" when the name has nothing to show.
 */
export function initials(name: string): string {
  const leads = name
    .trim()
    .split(/\s+/)
    .map(leadingGrapheme)
    .filter((g): g is string => g !== null)
  const first = leads[0]
  if (first === undefined) return '?'
  const last = leads.length > 1 ? leads[leads.length - 1] : undefined
  return (last === undefined ? first : first + last).toLocaleUpperCase()
}

/** Least-used avatar colour among `people` (ties → lowest index), so colours stay varied. */
export function nextColor(people: readonly Person[]): number {
  const counts = new Array<number>(AVATAR_COLORS).fill(0)
  for (const p of people) {
    if (Number.isInteger(p.color) && p.color >= 0 && p.color < AVATAR_COLORS) {
      counts[p.color] = (counts[p.color] ?? 0) + 1
    }
  }
  let best = 0
  for (let i = 1; i < AVATAR_COLORS; i++) {
    if ((counts[i] ?? 0) < (counts[best] ?? 0)) best = i
  }
  return best
}

/** Zero-width joiner: glues emoji sequences (👩‍💻), so it must survive the clean-up below. */
const ZWJ = '‍'

/** Trims, collapses whitespace, drops control characters and caps the length at 24 characters. */
export function normalizeName(name: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    // Invisible/control characters, except the zero-width joiner that glues emoji sequences.
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === ZWJ ? c : ''))
    .trim()
  // Never more characters than UTF-16 units, so short names skip segmenting.
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned
  const chars = graphemes(cleaned)
  if (chars.length <= MAX_NAME_LENGTH) return cleaned
  return chars.slice(0, MAX_NAME_LENGTH).join('').trim()
}

/** Comparison key for names: case- and accent-insensitive ("José" ≡ "jose"). */
export function nameKey(name: string): string {
  return normalizeName(name).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

/** True when `name` matches someone in `people` ignoring case and accents. `exceptId` skips one person (for renames). */
export function isDuplicateName(name: string, people: readonly Person[], exceptId?: string): boolean {
  const key = nameKey(name)
  if (!key) return false
  return people.some((p) => p.id !== exceptId && nameKey(p.name) === key)
}
