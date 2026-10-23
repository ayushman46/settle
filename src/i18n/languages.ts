/** The eight languages Settle speaks, in display order, with what each needs from the platform. */
import type { VoiceLang } from '../../shared/api'
import { LANGUAGE_CODES, type LanguageCode } from '../domain/types'

export interface LanguageInfo {
  code: LanguageCode
  /** The name in its own script ("हिन्दी"). */
  native: string
  /** The name in English ("Hindi"). */
  english: string
  /** Locale for `Intl` (plural rules, dates); numbers always use Latin digits. */
  intl: string
  /** Speech recognition language for "Speak to split". */
  voice: VoiceLang
  /** ISO 15924 script. */
  script: 'Latn' | 'Deva' | 'Beng' | 'Taml' | 'Telu' | 'Knda' | 'Gujr'
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: 'en', native: 'English', english: 'English', intl: 'en-IN', voice: 'en-IN', script: 'Latn' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', intl: 'hi-IN', voice: 'hi-IN', script: 'Deva' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', intl: 'bn-IN', voice: 'bn-IN', script: 'Beng' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', intl: 'mr-IN', voice: 'mr-IN', script: 'Deva' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', intl: 'ta-IN', voice: 'ta-IN', script: 'Taml' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', intl: 'te-IN', voice: 'te-IN', script: 'Telu' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', intl: 'kn-IN', voice: 'kn-IN', script: 'Knda' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', intl: 'gu-IN', voice: 'gu-IN', script: 'Gujr' },
]

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value)
}

/** The language's details (English for anything unknown). */
export function languageInfo(code: LanguageCode): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? (LANGUAGES[0] as LanguageInfo)
}

/** The `Intl` locale for a language ("hi" → "hi-IN"). */
export function intlLocale(code: LanguageCode): string {
  return languageInfo(code).intl
}
