/** Marathi copy for "Just say it" voice input (mic, listening panel, language sheet, errors). Keys: `voice.<part>.<element>`. */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'बोलून वाटणी करा',
  'voice.mic.sheet.aria': 'बोलून लिहा',
  'voice.mic.offline': 'व्हॉइससाठी इंटरनेट लागते',

  // The listening panel inside "Just say it".
  'voice.listen.title': 'ऐकत आहे…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': '{language} मध्ये ऐकत आहे',
  'voice.listen.language.aria': '{native}, {language} मध्ये बोलत आहात. भाषा बदला',
  'voice.listen.stop.cta': 'थांबा',
  'voice.listen.tip': 'काय होते, किती रक्कम आणि कोण होते ते सांगा — उदाहरणार्थ',
  'voice.listen.heard.aria': 'ऐकले: {text}',

  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': '“{phrase}” ऐकले → {amount}',
  'voice.heard.label': 'ऐकलेले आकडे',

  // When the transcript is longer than the AI can read.
  'voice.long.title': 'खूप मोठे आहे — थोडक्यात सांगा',
  'voice.long.body': 'फक्त पहिली {max} अक्षरे बसतात. छाटा, किंवा एका वाक्यात पुन्हा सांगा.',

  // The split screen's banner after "Looks right".
  'voice.banner.title': 'तुम्ही सांगितलेल्यावरून भरले',
  'voice.banner.body': 'रक्कम आणि कोण आहेत ते तपासा, मग सेव्ह करा.',

  // The language sheet.
  'voice.lang.title': 'कोणत्या भाषेत बोलायचे',
  'voice.lang.note': 'तुमचा ब्राउझर आवाजाचे मजकुरात रूपांतर करतो — Chrome यासाठी Google ची स्पीच सेवा वापरते. Settle कधीही ऑडिओ रेकॉर्ड किंवा जतन करत नाही.',
  'voice.lang.en.english': 'इंग्रजी (भारत)',
  'voice.lang.hi.english': 'हिंदी · हिंग्लिशसाठीही',
  'voice.lang.bn.english': 'बंगाली',
  'voice.lang.mr.english': 'मराठी',
  'voice.lang.ta.english': 'तमिळ',
  'voice.lang.te.english': 'तेलुगू',
  'voice.lang.kn.english': 'कन्नड',
  'voice.lang.gu.english': 'गुजराती',

  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'मायक्रोफोन बंद आहे',
  'voice.error.blocked.body': 'तुमच्या ब्राउझरच्या साइट सेटिंग्जमध्ये Settle ला मायक्रोफोनची परवानगी द्या — किंवा फक्त टाइप करा.',
  'voice.error.noSpeech.title': 'ऐकू आले नाही',
  'voice.error.noSpeech.body': 'माइकवर टॅप करून पुन्हा प्रयत्न करा — बीपनंतर बोला.',
  'voice.error.noMic.title': 'मायक्रोफोन सापडला नाही',
  'voice.error.noMic.body': 'एक जोडा, किंवा त्याऐवजी टाइप करा.',
  'voice.error.network.title': 'व्हॉइससाठी इंटरनेट लागते',
  'voice.error.network.body': 'तुमचा ब्राउझर बोलण्याचे मजकुरात रूपांतर ऑनलाइन करतो. ऑफलाइन असताना टाइप करा.',
  'voice.error.language.title': '{language} या ब्राउझरमध्ये उपलब्ध नाही',
  'voice.error.language.body': 'इंग्रजी किंवा हिंदी वापरून पहा, किंवा टाइप करा.',
  'voice.error.other.title': 'या वेळी व्हॉइस चालले नाही',
  'voice.error.other.body': 'पुन्हा प्रयत्न करा, किंवा टाइप करा.',
} as const satisfies Messages
