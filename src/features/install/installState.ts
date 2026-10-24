/**
 * Install prompts, as plain rules: which platform the browser is, whether the app already runs
 * installed, and when the install card may show. No DOM here, so every rule is unit-tested.
 */

export type InstallPlatform = 'android' | 'ios' | 'desktop' | 'other'

/** How long a dismissed card stays away. */
export const DISMISS_MS = 30 * 86_400_000
/** A second visit counts from the first; the card waits for a split or this many visits. */
export const VISITS_BEFORE_CARD = 2

/** iPhone and iPad Safari (iPadOS reports itself as a Mac with touch). */
export function platformFor(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  if (/Windows|Macintosh|CrOS|Linux/.test(userAgent)) return 'desktop'
  return 'other'
}

/** Opened from the home screen (or as an installed window), not in a browser tab. */
export function isStandalone(displayModeStandalone: boolean, navigatorStandalone: boolean | undefined): boolean {
  return displayModeStandalone || navigatorStandalone === true
}

export interface InstallMemory {
  /** Visits counted so far (one per browser session). */
  visits: number
  /** When the card was last dismissed, or null. */
  dismissedAt: number | null
}

export const EMPTY_MEMORY: InstallMemory = { visits: 0, dismissedAt: null }

/** Reads the stored memory; anything unexpected counts as nothing stored. */
export function parseMemory(raw: string | null): InstallMemory {
  if (raw === null) return EMPTY_MEMORY
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY_MEMORY
    const { visits, dismissedAt } = value as Record<string, unknown>
    return {
      visits: typeof visits === 'number' && Number.isInteger(visits) && visits >= 0 ? visits : 0,
      dismissedAt: typeof dismissedAt === 'number' && Number.isFinite(dismissedAt) && dismissedAt >= 0 ? dismissedAt : null,
    }
  } catch {
    return EMPTY_MEMORY
  }
}

export interface CardInput {
  standalone: boolean
  platform: InstallPlatform
  /** The browser offered its install prompt (Chrome/Edge/Samsung on Android and desktop). */
  canPrompt: boolean
  memory: InstallMemory
  /** Splits recorded so far (any expense). */
  splits: number
  now: number
}

/** The Home card: never installed already, never dismissed in the last 30 days, and only once it's earned its place. */
export function showInstallCard(input: CardInput): boolean {
  if (input.standalone) return false
  if (!input.canPrompt && input.platform !== 'ios') return false
  if (input.memory.dismissedAt !== null && input.now - input.memory.dismissedAt < DISMISS_MS) return false
  return input.splits > 0 || input.memory.visits >= VISITS_BEFORE_CARD
}

/** The You row: shown while installing is possible at all (prompt or iPhone steps). */
export function showInstallRow(input: Pick<CardInput, 'standalone' | 'platform' | 'canPrompt'>): boolean {
  if (input.standalone) return false
  return input.canPrompt || input.platform === 'ios'
}

/** Memory after one more visit (a session counts once). */
export function countVisit(memory: InstallMemory): InstallMemory {
  return { ...memory, visits: memory.visits + 1 }
}

export function dismissed(memory: InstallMemory, now: number): InstallMemory {
  return { ...memory, dismissedAt: now }
}
