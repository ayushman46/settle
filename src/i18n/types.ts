/** Shapes shared by the i18n runtime and its catalogs. */
export type { LanguageCode } from '../domain/types'

/** One namespace's (or a whole language's) messages: key → ICU-style message. */
export type Messages = Readonly<Record<string, string>>

/** Values for a message's `{placeholders}`. Amounts and dates arrive pre-formatted as strings. */
export type Vars = Readonly<Record<string, string | number>>

/** The lazily loaded parts of a language (Phase 3): public pages, the app, the landing page. */
export type Chunk = 'public' | 'app' | 'landing'
