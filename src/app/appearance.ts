/**
 * The person's appearance on the page: theme → `data-theme` on <html>, accent → `data-accent`
 * (tokens.css reads both), and the browser's `theme-color` (status bar / tab strip) to match the
 * canvas. `ThemeSync` keeps it in step with the profile; `applyStoredAppearance` runs once before
 * the first render so a dark-theme person never sees a flash of light.
 */
import type { AccentId, ThemePref } from '../domain/types'
import { profileStore } from '../data/stores'
import { hasFeature } from '../pro/store'

export interface Appearance {
  theme: ThemePref
  /** The accent to show (already checked against Pro — see `effectiveAccent`). */
  accent: AccentId
}

/** The app canvas (`--bg`) per theme — what the browser chrome blends into. Mirrors tokens.css. */
export const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#F5F6F8',
  dark: '#0B0C0E',
}

const DEFAULT_ACCENT: AccentId = 'lime'

/** Accents are Pro: a saved choice shows while Pro is on and comes back when it's renewed. */
export function effectiveAccent(saved: AccentId, themesUnlocked: boolean): AccentId {
  return themesUnlocked ? saved : DEFAULT_ACCENT
}

/**
 * The `theme-color` tags in index.html carry a `media` query each (light / dark system). A chosen
 * theme paints both with its own colour; "system" gives each one back its own.
 */
function syncThemeColor(doc: Document, theme: ThemePref): void {
  for (const meta of doc.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media') ?? ''
    const systemDark = /prefers-color-scheme:\s*dark/.test(media)
    const scheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
    meta.setAttribute('content', THEME_COLORS[scheme])
  }
}

/** Writes `appearance` onto the document. Never throws. */
export function applyAppearance({ theme, accent }: Appearance, doc: Document = document): void {
  try {
    const root = doc.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    if (accent === DEFAULT_ACCENT) root.removeAttribute('data-accent')
    else root.setAttribute('data-accent', accent)
    syncThemeColor(doc, theme)
  } catch {
    // A detached or unusual document: the default look still works.
  }
}

/** Back to the defaults (system theme, lime) — what a page sees with no profile. */
export function clearAppearance(doc: Document = document): void {
  applyAppearance({ theme: 'system', accent: DEFAULT_ACCENT }, doc)
}

/** Applies the saved appearance straight away (call before the first render). Never throws. */
export function applyStoredAppearance(doc: Document = document): void {
  try {
    const { theme, accent } = profileStore.get()
    applyAppearance({ theme, accent: effectiveAccent(accent, hasFeature('themes')) }, doc)
  } catch {
    // Unreadable profile: the system theme is a fine start.
  }
}
