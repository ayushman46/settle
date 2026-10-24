/**
 * Which language to show, and getting there before the first paint.
 *
 *   app (`/app/**`):    ?lang= (QA) → the saved choice (`profile.language`) → the phone's languages → English
 *   public (the rest):  ?lang= (QA) → the viewer's own pick on a public page → a saved app choice on
 *                       this phone → the phone's languages → English
 *
 * Public pages (`/pay`, `/claim`, `/pool`, landing, legal) are opened by friends who have no
 * profile: they get their phone's language and a small switcher, whose pick is remembered on
 * that phone only (never written into app data).
 */
import type { LanguageCode } from '../domain/types'
import { isLanguageCode } from './languages'
import { hasCatalog } from './load'
import { getLanguage, setLanguage } from './runtime'

export type LangContext = 'app' | 'public'

/** The viewer's pick on public pages (this phone only). */
export const PUBLIC_LANG_KEY = 'settle.v4.public-lang'
/** `?lang=xx` for translation QA and tests: this tab only. */
export const LANG_OVERRIDE_KEY = 'settle.v4.lang-override'

/** `/app` and everything under it is the app; every other page is public. */
export function contextFor(pathname: string): LangContext {
  return pathname === '/app' || pathname.startsWith('/app/') ? 'app' : 'public'
}

/** The phone's languages, most preferred first. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) return navigator.languages
  return typeof navigator.language === 'string' ? [navigator.language] : []
}

/**
 * The first of `languages` Settle can show (`hi-IN` → hi, `bn-BD` → bn, `en-US` → en), else
 * English. A language without a catalog yet is skipped for the next one the phone lists.
 */
export function detectLanguage(languages: readonly string[], available: (code: LanguageCode) => boolean = hasCatalog): LanguageCode {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split(/[-_]/)[0]
    if (isLanguageCode(primary) && available(primary)) return primary
  }
  return 'en'
}

function read(storage: () => Storage, key: string): LanguageCode | null {
  try {
    const value = storage().getItem(key)
    return isLanguageCode(value) ? value : null
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: LanguageCode | null): void {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}

const local = (): Storage => window.localStorage
const session = (): Storage => window.sessionStorage

/** `?lang=xx` in the address: remembered for this tab (QA, E2E). `?lang=` with nothing clears it. */
export function readLanguageOverride(search: string): LanguageCode | null {
  const params = new URLSearchParams(search)
  if (params.has('lang')) {
    const asked = params.get('lang')?.toLowerCase() ?? ''
    write(session, LANG_OVERRIDE_KEY, isLanguageCode(asked) ? asked : null)
  }
  return read(session, LANG_OVERRIDE_KEY)
}

/** The viewer's pick on public pages, if any. */
export function publicLanguage(): LanguageCode | null {
  return read(local, PUBLIC_LANG_KEY)
}

/** Remembers (or with null forgets) the viewer's pick on public pages. */
export function savePublicLanguage(code: LanguageCode | null): void {
  write(local, PUBLIC_LANG_KEY, code)
}

export interface ResolveInput {
  context: LangContext
  /** The app's saved choice (`profile.language`; null = automatic). */
  saved?: LanguageCode | null
  /** `location.search`, for `?lang=`. */
  search?: string
  /** The phone's languages (defaults to the browser's). */
  languages?: readonly string[]
}

/** The language a page should open in (see the module comment for the order). */
export function resolveLanguage({ context, saved = null, search = '', languages = browserLanguages() }: ResolveInput): LanguageCode {
  const forced = readLanguageOverride(search)
  if (forced) return forced
  if (context === 'public') {
    const picked = publicLanguage()
    if (picked) return picked
  }
  if (saved && isLanguageCode(saved)) return saved
  return detectLanguage(languages)
}

/**
 * Switches to `code` before the first paint, giving up after `timeoutMs` (a slow network shows
 * English rather than a blank screen; the language follows when its chunk arrives). Null when
 * there is nothing to wait for (English, or already there).
 */
export function startLanguage(code: LanguageCode, timeoutMs = 2500): Promise<void> | null {
  if (typeof document !== 'undefined') document.documentElement.lang = getLanguage()
  if (code === getLanguage()) return null
  const switching = setLanguage(code).then(() => undefined)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  return Promise.race([switching, timeout])
}
