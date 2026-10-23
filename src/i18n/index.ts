/**
 * Settle's i18n: `t(key, vars)` with ICU-style plural/select on `Intl.PluralRules`, English
 * bundled, money and counts always in Indian format with Latin digits. See i18n-plan.md §2.
 */
export { t, tx, getLanguage, subscribe, setLanguage, hasMessage, registerCatalog, resetI18nForTests } from './runtime'
export { useLang, useT } from './react'
export { formatCount, formatMessage, formatRich, parseMessage } from './format'
export { LANGUAGES, intlLocale, isLanguageCode, languageInfo, type LanguageInfo } from './languages'
export { EN, type MessageKey } from './en'
export type { Chunk, LanguageCode, Messages, Vars } from './types'
