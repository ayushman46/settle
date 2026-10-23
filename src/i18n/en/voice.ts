/** English copy for S3 · speak to split. Keys: `voice.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'Speak to split',
  'voice.mic.sheet.aria': 'Speak instead',
  'voice.mic.offline': 'Voice needs the internet',

  // The listening panel inside "Just say it".
  'voice.listen.title': 'Listening…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': 'Listening in {language}',
  'voice.listen.language.aria': '{native}, speaking in {language}. Change language',
  'voice.listen.stop.cta': 'Stop',
  'voice.listen.tip': 'Say what it was, how much and who was there — like',
  'voice.listen.heard.aria': 'Heard: {text}',

  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': 'Heard “{phrase}” → {amount}',
  'voice.heard.label': 'Numbers we heard',

  // When the transcript is longer than the AI can read.
  'voice.long.title': "That's a lot — keep it short",
  'voice.long.body': 'Only the first {max} characters fit. Trim it, or say it again in one sentence.',

  // The split screen's banner after "Looks right".
  'voice.banner.title': 'Filled in from what you said',
  'voice.banner.body': "Check the amount and who's in, then save.",

  // The language sheet.
  'voice.lang.title': 'Speak in',
  'voice.lang.note': "Your browser turns your voice into text — Chrome uses Google's speech service for this. Settle never records or keeps audio.",
  'voice.lang.en.english': 'English (India)',
  'voice.lang.hi.english': 'Hindi · also for Hinglish',
  'voice.lang.bn.english': 'Bengali',
  'voice.lang.mr.english': 'Marathi',
  'voice.lang.ta.english': 'Tamil',
  'voice.lang.te.english': 'Telugu',
  'voice.lang.kn.english': 'Kannada',
  'voice.lang.gu.english': 'Gujarati',

  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'Mic blocked',
  'voice.error.blocked.body': "Allow the microphone for Settle in your browser's site settings — or just type it.",
  'voice.error.noSpeech.title': "Didn't catch that",
  'voice.error.noSpeech.body': 'Tap the mic and try again — speak after the beep.',
  'voice.error.noMic.title': 'No microphone found',
  'voice.error.noMic.body': 'Plug one in, or type it instead.',
  'voice.error.network.title': 'Voice needs the internet',
  'voice.error.network.body': 'Your browser turns speech into text online. Type it instead while offline.',
  'voice.error.language.title': "{language} isn't available in this browser",
  'voice.error.language.body': 'Try English or हिन्दी, or type it.',
  'voice.error.other.title': "Voice didn't work this time",
  'voice.error.other.body': 'Try again, or type it.',
} as const satisfies Messages
