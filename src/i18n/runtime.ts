/**
 * The i18n runtime: the current language, its loaded messages, and `t` / `tx`.
 *
 * English is always there: each English namespace registers itself here (`registerEnglish`) when
 * the code that uses it loads — with the build plugin (`vite-plugin.ts`) that is the screen's own
 * chunk, without it everything comes at once (`en/eager.ts`). Every other language is one lazily
 * loaded chunk (`load.ts`); `setLanguage` resolves only once it is in, so the UI never flashes
 * keys or half a language. A key the chosen language lacks falls back to English silently.
 *
 * Helpers outside React (labels, share text) call `t` at call time; components call `useT()` so
 * they re-render when the language changes.
 */
import { createElement, Fragment, type ReactNode } from 'react'
import type { LanguageCode } from '../domain/types'
import { EAGER } from './en/eager'
import type { MessageKey } from './en'
import { devWarn, formatMessage, formatRich } from './format'
import { intlLocale } from './languages'
import { catalogLoader } from './load'
import type { Messages, Vars } from './types'

let language: LanguageCode = 'en'
/** English, namespace by namespace as their code loads. */
const english: Record<string, string> = { ...EAGER }
/** Tests may lay their own English over the real one (`registerCatalog('en', …)`). */
let englishOverride: Messages = {}
/** Loaded catalogs of the other languages. */
const catalogs: Partial<Record<LanguageCode, Messages>> = {}
/** In-flight loads, so two quick taps fetch a chunk once. */
const loading = new Map<LanguageCode, Promise<Messages | null>>()
const listeners = new Set<() => void>()
/** Bumped on every switch: the latest `setLanguage` call wins. */
let ticket = 0

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

function notify(): void {
  for (const listener of [...listeners]) listener()
}

/** Adds an English namespace (called by the namespace's own module as it loads). */
export function registerEnglish(messages: Messages): void {
  Object.assign(english, messages)
}

/** The message for `key` in the current language, falling back to English, then to the key itself. */
function messageFor(key: string): string {
  if (language !== 'en') {
    const own = catalogs[language]?.[key]
    if (own !== undefined) return own
  }
  const english_ = englishOverride[key] ?? english[key]
  if (english_ !== undefined) return english_
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

/** True when the key exists in (loaded) English — for code that builds keys, e.g. `home.say.example.0…`. */
export function hasMessage(key: string): boolean {
  return Object.hasOwn(englishOverride, key) || Object.hasOwn(english, key)
}

/**
 * How many numbered variants `prefix.0`, `prefix.1`, … the current language has (English when it
 * has none) — for copy with several wordings, e.g. nudges. Translators may give more or fewer.
 */
export function countVariants(prefix: string): number {
  const own = language === 'en' ? undefined : catalogs[language]
  const count = (messages: Messages): number => {
    let n = 0
    while (messages[`${prefix}.${n}`] !== undefined) n++
    return n
  }
  return (own && count(own)) || count({ ...english, ...englishOverride })
}

/**
 * Fetches a language's chunk without switching to it (an idle prefetch, or the first half of
 * `setLanguage`). Resolves to false when the language has no catalog or the chunk can't load.
 */
export async function loadLanguage(code: LanguageCode): Promise<boolean> {
  if (code === 'en' || catalogs[code]) return true
  let pending = loading.get(code)
  if (!pending) {
    const load = catalogLoader(code)
    if (!load) return false
    pending = load().then(
      (messages) => messages,
      () => null,
    )
    loading.set(code, pending)
  }
  const messages = await pending
  loading.delete(code)
  if (!messages) return false
  catalogs[code] = messages
  return true
}

/** Puts `<html lang>` in step, so CSS (`:lang(hi)` fonts) and screen readers follow. */
function syncDocumentLang(code: LanguageCode): void {
  if (typeof document === 'undefined') return
  try {
    document.documentElement.lang = code
  } catch {
    // A detached document (tests): nothing to update.
  }
}

/**
 * Switches the UI language once its chunk is in (no flash of keys or of half a language). Resolves
 * to false — leaving everything as it is — when the language has no catalog, the chunk fails to
 * load, or another `setLanguage` call came after this one. Never blanks the UI.
 */
export async function setLanguage(next: LanguageCode): Promise<boolean> {
  const mine = ++ticket
  if (!(await loadLanguage(next))) return false
  if (mine !== ticket) return false
  if (next !== language) {
    language = next
    syncDocumentLang(next)
    notify()
  }
  return true
}

/** Back to English with only the bundled catalog (tests). */
export function resetI18nForTests(): void {
  ticket++
  const changed = language !== 'en'
  language = 'en'
  englishOverride = {}
  loading.clear()
  for (const code of Object.keys(catalogs) as LanguageCode[]) delete catalogs[code]
  if (changed) {
    syncDocumentLang('en')
    notify()
  }
}

/**
 * Adds a language's messages (tests, and anything that already has them). For English it lays the
 * messages over the real catalog (`{}` takes them off again).
 */
export function registerCatalog(code: LanguageCode, messages: Messages): void {
  if (code === 'en') englishOverride = messages
  else catalogs[code] = messages
}
