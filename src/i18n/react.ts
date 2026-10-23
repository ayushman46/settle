/** React bindings: components that show copy call `useT()` so a language change re-renders them. */
import { useSyncExternalStore } from 'react'
import type { LanguageCode } from '../domain/types'
import { getLanguage, subscribe, t } from './runtime'

/** The current language, re-rendering the caller when it changes. */
export function useLang(): LanguageCode {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}

/** `t`, re-rendering the caller when the language changes. */
export function useT(): typeof t {
  useLang()
  return t
}
