/**
 * The i18n runtime: the current language, its loaded messages, and `t` / `tx`. English is bundled
 * (no fetch, nothing added to the first paint); other languages arrive in Phase 3 as lazily loaded
 * chunks through `setLanguage` — until then it only accepts English.
 *
 * Helpers outside React (labels, share text) call `t` at call time; components call `useT()` so
 * they re-render when the language changes.
 */
import { createElement, Fragment, type ReactNode } from 'react'
import type { LanguageCode } from '../domain/types'
import { EN, type MessageKey } from './en'
import { devWarn, formatMessage, formatRich } from './format'
import { intlLocale } from './languages'
import type { Messages, Vars } from './types'

let language: LanguageCode = 'en'
const catalogs: Partial<Record<LanguageCode, Messages>> = { en: EN }
const listeners = new Set<() => void>()

/** The language the UI is in. */
export function getLanguage(): LanguageCode {
  return language
}

/** Called whenever the language changes; returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The message for `key` in the current language, falling back to English, then to the key itself. */
function messageFor(key: string): string {
  const own = catalogs[language]?.[key]
  if (own !== undefined) return own
  const english = (EN as Messages)[key]
  if (english !== undefined) {
    if (language !== 'en') devWarn(`"${key}" is not translated to ${language} yet`)
    return english
  }
  devWarn(`unknown message key "${key}"`)
  return key
}

/** The message for `key` in the current language, formatted with `vars`. Falls back to English, then to the key. */
export function t(key: MessageKey, vars?: Vars): string {
  return formatMessage(messageFor(key), vars, intlLocale(language))
}

/**
 * Rich text: tags in the message (`<b>…</b>`, `<link>…</link>`) render through `tags`; an unknown
 * tag renders its text.
 */
export function tx(key: MessageKey, vars: Vars, tags: Readonly<Record<string, (chunk: ReactNode) => ReactNode>>): ReactNode {
  const pieces = formatRich<ReactNode>(messageFor(key), vars, intlLocale(language), Object.fromEntries(
    Object.entries(tags).map(([name, render]) => [name, (chunk: ReactNode[]) => render(createElement(Fragment, null, ...chunk))]),
  ))
  return createElement(Fragment, null, ...pieces)
}

/** True when the key exists in English (for code that builds keys, e.g. examples `home.say.example.0…`). */
export function hasMessage(key: string): boolean {
  return Object.hasOwn(EN, key)
}

/**
 * Switches the UI language. Phase 2 ships English only: other languages resolve to false and
 * leave everything as it is (Phase 3 loads their catalogs here). Never blanks the UI.
 */
export async function setLanguage(next: LanguageCode): Promise<boolean> {
  if (!catalogs[next]) return false
  if (next !== language) {
    language = next
    for (const listener of [...listeners]) listener()
  }
  return true
}

/** Back to English with only the bundled catalog (tests). */
export function resetI18nForTests(): void {
  language = 'en'
  for (const code of Object.keys(catalogs) as LanguageCode[]) if (code !== 'en') delete catalogs[code]
}

/** Adds a language's messages (tests, and the Phase 3 loader). */
export function registerCatalog(code: LanguageCode, messages: Messages): void {
  catalogs[code] = code === 'en' ? { ...EN, ...messages } : messages
}
