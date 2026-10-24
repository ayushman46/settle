/** Bengali copy for "Just say it" voice input (mic, listening panel, language sheet, errors). Keys: `voice.<part>.<element>`. */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'বলে ভাগ করুন',
  'voice.mic.sheet.aria': 'বলে লিখুন',
  'voice.mic.offline': 'ভয়েসের জন্য ইন্টারনেট লাগে',

  // The listening panel inside "Just say it".
  'voice.listen.title': 'শোনা হচ্ছে…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': '{language}-এ শোনা হচ্ছে',
  'voice.listen.language.aria': '{native}, {language}-এ বলছেন। ভাষা বদলান',
  'voice.listen.stop.cta': 'থামুন',
  'voice.listen.tip': 'কীসের খরচ, কত, আর কারা ছিল বলুন — যেমন',
  'voice.listen.heard.aria': 'শোনা গেছে: {text}',

  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': 'শুনেছি “{phrase}” → {amount}',
  'voice.heard.label': 'যে সংখ্যাগুলো শুনেছি',

  // When the transcript is longer than the AI can read.
  'voice.long.title': 'অনেক বেশি — ছোট করে বলুন',
  'voice.long.body': 'প্রথম {max} অক্ষর শুধু ধরা যায়। ছোট করুন, অথবা এক বাক্যে আবার বলুন।',

  // The split screen's banner after "Looks right".
  'voice.banner.title': 'আপনার বলা কথা থেকে ভরা হয়েছে',
  'voice.banner.body': 'পরিমাণ ও কারা আছে দেখে নিন, তারপর সেভ করুন।',

  // The language sheet.
  'voice.lang.title': 'যে ভাষায় বলবেন',
  'voice.lang.note': 'আপনার ব্রাউজার কণ্ঠস্বরকে লেখায় বদলায় — Chrome এর জন্য Google-এর স্পিচ সার্ভিস ব্যবহার করে। Settle কখনও অডিও রেকর্ড বা জমা রাখে না।',
  'voice.lang.en.english': 'ইংরেজি (ভারত)',
  'voice.lang.hi.english': 'হিন্দি · হিংলিশের জন্যও',
  'voice.lang.bn.english': 'বাংলা',
  'voice.lang.mr.english': 'মারাঠি',
  'voice.lang.ta.english': 'তামিল',
  'voice.lang.te.english': 'তেলুগু',
  'voice.lang.kn.english': 'কন্নড়',
  'voice.lang.gu.english': 'গুজরাটি',

  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'মাইক্রোফোন বন্ধ আছে',
  'voice.error.blocked.body': 'আপনার ব্রাউজারের সাইট সেটিংসে Settle-কে মাইক্রোফোন ব্যবহারের অনুমতি দিন — অথবা টাইপ করুন।',
  'voice.error.noSpeech.title': 'শোনা গেল না',
  'voice.error.noSpeech.body': 'মাইকে ট্যাপ করে আবার চেষ্টা করুন — বিপ-এর পরে বলুন।',
  'voice.error.noMic.title': 'কোনো মাইক্রোফোন পাওয়া যায়নি',
  'voice.error.noMic.body': 'একটি যুক্ত করুন, অথবা টাইপ করুন।',
  'voice.error.network.title': 'ভয়েসের জন্য ইন্টারনেট লাগে',
  'voice.error.network.body': 'আপনার ব্রাউজার অনলাইনে কথা লেখায় বদলায়। অফলাইনে থাকলে টাইপ করুন।',
  'voice.error.language.title': '{language} এই ব্রাউজারে পাওয়া যাচ্ছে না',
  'voice.error.language.body': 'ইংরেজি বা হিন্দি চেষ্টা করুন, অথবা টাইপ করুন।',
  'voice.error.other.title': 'এবার ভয়েস কাজ করেনি',
  'voice.error.other.body': 'আবার চেষ্টা করুন, অথবা টাইপ করুন।',
} as const satisfies Messages
