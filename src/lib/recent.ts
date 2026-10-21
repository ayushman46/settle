import { nameKey, normalizeName } from './people'

/** localStorage key for names used on earlier bills (quick-add chips). */
export const RECENT_NAMES_KEY = 'billsplit.recent.v1'

/** How many recent names we keep. */
export const MAX_RECENT_NAMES = 12

/** Normalises, drops blanks and de-duplicates (case/accent-insensitive), keeping the first of each. */
function tidy(names: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    if (typeof raw !== 'string') continue
    const name = normalizeName(raw)
    const key = nameKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length === MAX_RECENT_NAMES) break
  }
  return out
}

/** Names from earlier bills, most recent first. Never throws. */
export function getRecentNames(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_NAMES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? tidy(parsed) : []
  } catch {
    return []
  }
}

/** Remembers `names` (first = most recent) ahead of older ones. Never throws. */
export function rememberNames(names: readonly string[]): void {
  try {
    const next = tidy([...names, ...getRecentNames()])
    window.localStorage.setItem(RECENT_NAMES_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked (private mode) — recent names are a nicety.
  }
}
