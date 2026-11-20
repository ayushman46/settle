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

  // The live check while speaking: what Settle has understood so far.
  'voice.live.title': 'What I’m hearing',
  'voice.live.note': 'A quick check as you speak — the full read happens when you stop.',
  'voice.live.waiting': 'Start speaking — the words show up here as you say them.',
  'voice.live.total': 'Total',
  'voice.live.totalMissing': 'Say the amount',
  'voice.live.amounts': '{count, plural, one {# amount} other {# amounts}}',
  'voice.live.bills': '{count, plural, one {# bill} other {# bills}}',
  'voice.live.paidBy': 'Paid by',
  'voice.live.paidByMissing': 'You, unless you say',
  'voice.live.people': 'Who’s in',
  'voice.live.peopleMissing': 'Say who was there',
  'voice.live.split': 'Split',
  'voice.live.mode.equal': 'Equally',
  'voice.live.mode.exact': 'Exact amounts',
  'voice.live.mode.percent': 'By percentage',
  'voice.live.mode.shares': 'By shares',
  'voice.live.person.maybe': '{name}? — check after',
  'voice.live.person.new': '{name} (new)',
  'voice.live.unsure': 'Not sure about the underlined words — say them again or fix them after.',
  'voice.live.done': 'Done',
  'voice.live.legend.amount': 'amount',
  'voice.live.legend.person': 'your people',
  'voice.live.legend.maybe': 'check',

  // After speaking: other ways the recogniser heard it.
  'voice.alt.title': 'Not what you said? It also heard:',
  'voice.alt.aria': 'Use “{text}” instead',

  // "Who's that?": each name in a split checked against your people.
  'voice.who.title': 'Who’s who',
  'voice.who.toCheck': '{count, plural, one {# name to check} other {# names to check}}',
  'voice.who.allSure': 'Everyone matched — tap to change',
  'voice.who.said': 'You said “{said}”',
  'voice.who.paid': 'paid',
  'voice.who.new': 'Someone new',
  'voice.who.pick': '{count, plural, one {Is it this person?} other {# people with a name like that — pick one}}',
  'voice.who.guess': 'best guess',
  'voice.who.onSettle': 'On Settle',
  'voice.who.listAria': 'Who is “{said}”?',
  'voice.who.addNew': 'Someone new called “{said}”',
  'voice.who.addNewWhy': 'Added to your people when you save',
  'voice.who.search': 'Search your people',
  'voice.who.phone': 'ends {digits}',
  'voice.who.settleAs': 'on Settle as {name}',
  'voice.who.why.nickname': 'You call them this',
  'voice.who.why.exact': 'Same name',
  'voice.who.why.first': 'Same first name',
  'voice.who.why.word': 'Same surname',
  'voice.who.why.short': 'Short for it',
  'voice.who.why.spelling': 'Same name, other spelling',
  'voice.who.why.sound': 'Sounds the same',
  'voice.who.why.close': 'Sounds close',
  'voice.who.why.search': 'From your people',
  'voice.who.remembered': 'Got it — “{said}” is {name} from now on',

  // The allowance line in "Just say it" when the mic is there.
  'voice.free.line': 'Speaking a split is free and unlimited',
  'voice.free.typed': '{count, plural, one {# typed AI split left today} other {# typed AI splits left today}}',
  'voice.free.typedUsed': 'typed AI splits used today',
} as const satisfies Messages
