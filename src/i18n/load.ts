/**
 * Where each language's messages come from. English is bundled (see `en/eager.ts`); every other
 * language is one lazily loaded chunk, `src/i18n/<lang>/index.ts` (default export: the merged
 * catalog), fetched only when someone picks it and cached by the service worker like any asset.
 *
 * A translator adds a language by creating `src/i18n/<lang>/` mirroring `src/i18n/hi/` — nothing
 * to register here: the glob below finds it at build time.
 */
import type { LanguageCode } from '../domain/types'
import type { Messages } from './types'

interface CatalogModule {
  default: Messages
}

const modules = import.meta.glob<CatalogModule>('./{hi,bn,mr,ta,te,kn,gu}/index.ts')

/** The loader for a language's catalog, or null when there is none (English, or not translated yet). */
export function catalogLoader(code: LanguageCode): (() => Promise<Messages>) | null {
  if (code === 'en') return null
  const load = modules[`./${code}/index.ts`]
  return load ? () => load().then((mod) => mod.default) : null
}

/** True when `code` can be chosen: English, or a language with a catalog. */
export function hasCatalog(code: LanguageCode): boolean {
  return code === 'en' || catalogLoader(code) !== null
}
