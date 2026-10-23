/**
 * The eight languages "Speak to split" listens in (spec 03 §2.4): each one's name in its own
 * script, in English, and an example sentence in it — plus which one to start with on this device.
 */
import { VOICE_LANGS, type VoiceLang } from '../../../shared/api'
import type { LanguageCode } from '../../domain/types'
import { LANGUAGES, t, type MessageKey } from '../../i18n'

export { VOICE_LANGS, type VoiceLang }

/** This device's last-used voice language (a convenience; never synced). */
export const VOICE_LANG_KEY = 'settle.v4.voice-lang'

export interface VoiceLanguage {
  code: VoiceLang
  /** The name in its own script, shown big ("हिन्दी"). */
  native: string
  /** Shown small under it ("Hindi · also for Hinglish"). */
  english: string
  /** The plain English name, for sentences ("Listening in Hindi"). */
  name: string
  /** A sentence to say, in that language — also the example while listening. */
  example: string
}

const ENGLISH_KEYS = {
  'en-IN': 'voice.lang.en.english',
  'hi-IN': 'voice.lang.hi.english',
  'bn-IN': 'voice.lang.bn.english',
  'mr-IN': 'voice.lang.mr.english',
  'ta-IN': 'voice.lang.ta.english',
  'te-IN': 'voice.lang.te.english',
  'kn-IN': 'voice.lang.kn.english',
  'gu-IN': 'voice.lang.gu.english',
} as const satisfies Record<VoiceLang, MessageKey>

/** Names in their own script and the examples are the same in every UI language (they're the point). */
const NATIVE: Readonly<Record<VoiceLang, { native: string; example: string }>> = {
  'en-IN': { native: 'English', example: 'Dinner 2400 with Riya and Sam, I paid' },
  'hi-IN': { native: 'हिन्दी', example: 'ढाई हज़ार का डिनर रिया और सैम के साथ, मैंने दिया' },
  'bn-IN': { native: 'বাংলা', example: 'রিয়া আর স্যামের সাথে ডিনার ২৪০০ টাকা, আমি দিয়েছি' },
  'mr-IN': { native: 'मराठी', example: 'रिया आणि सॅमसोबत जेवण २४०० रुपये, मी दिले' },
  'ta-IN': { native: 'தமிழ்', example: 'ரியா, சாம் உடன் இரவு உணவு 2400 ரூபாய், நான் கொடுத்தேன்' },
  'te-IN': { native: 'తెలుగు', example: 'రియా, సామ్‌తో డిన్నర్ 2400 రూపాయలు, నేను కట్టాను' },
  'kn-IN': { native: 'ಕನ್ನಡ', example: 'ರಿಯಾ ಮತ್ತು ಸ್ಯಾಮ್ ಜೊತೆ ಊಟ 2400 ರೂಪಾಯಿ, ನಾನು ಕೊಟ್ಟೆ' },
  'gu-IN': { native: 'ગુજરાતી', example: 'રિયા અને સેમ સાથે ડિનર 2400 રૂપિયા, મેં આપ્યા' },
}

export function isVoiceLang(value: unknown): value is VoiceLang {
  return typeof value === 'string' && (VOICE_LANGS as readonly string[]).includes(value)
}

/** One language's names and example. */
export function voiceLanguage(code: VoiceLang): VoiceLanguage {
  const own = NATIVE[code]
  const name = LANGUAGES.find((l) => l.voice === code)?.english ?? own.native
  return { code, native: own.native, english: t(ENGLISH_KEYS[code]), name, example: own.example }
}

/** All eight, in the order the picker lists them. */
export function voiceLanguages(): VoiceLanguage[] {
  return VOICE_LANGS.map(voiceLanguage)
}

/** "hi" / "hi-IN" / "HI-in" → "hi-IN" when it's one of the eight; else null. */
export function toVoiceLang(tag: string | null | undefined): VoiceLang | null {
  if (typeof tag !== 'string') return null
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  const match = VOICE_LANGS.find((code) => code.slice(0, 2) === base)
  return match ?? null
}

function readSaved(): VoiceLang | null {
  try {
    const value = window.localStorage.getItem(VOICE_LANG_KEY)
    return isVoiceLang(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the language picked on this device (quietly does nothing without storage). */
export function saveVoiceLang(code: VoiceLang): void {
  try {
    window.localStorage.setItem(VOICE_LANG_KEY, code)
  } catch {
    // Private mode or storage off: next time starts from the app language again.
  }
}

/**
 * The language to listen in first: the last one used on this device, else the app's language,
 * else the first of the browser's languages that is one of the eight, else English (India).
 */
export function defaultVoiceLang(appLanguage: LanguageCode | null | undefined, browserLanguages?: readonly string[]): VoiceLang {
  const saved = readSaved()
  if (saved) return saved
  const fromApp = appLanguage ? toVoiceLang(appLanguage) : null
  if (fromApp) return fromApp
  const list = browserLanguages ?? (typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [])
  for (const tag of list) {
    const code = toVoiceLang(tag)
    if (code) return code
  }
  return 'en-IN'
}
