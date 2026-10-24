/** Hindi copy for S3 · speak to split. Keys: `voice.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'बोलकर बाँटें',
  'voice.mic.sheet.aria': 'टाइप की जगह बोलें',
  'voice.mic.offline': 'आवाज़ के लिए इंटरनेट चाहिए',

  // The listening panel inside "Just say it".
  'voice.listen.title': 'सुन रहे हैं…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': '{language} में सुन रहे हैं',
  'voice.listen.language.aria': '{native}, {language} में बोल रहे हैं। भाषा बदलें',
  'voice.listen.stop.cta': 'रोकें',
  'voice.listen.tip': 'बताइए क्या था, कितने का था और कौन-कौन था — जैसे',
  'voice.listen.heard.aria': 'सुना: {text}',

  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': '“{phrase}” सुना → {amount}',
  'voice.heard.label': 'सुनी गई रकम',

  // When the transcript is longer than the AI can read.
  'voice.long.title': 'बहुत लंबा हो गया — छोटा रखें',
  'voice.long.body': 'सिर्फ़ पहले {max} अक्षर ही आ पाते हैं। इसे छोटा करें, या एक वाक्य में फिर से बोलें।',

  // The split screen's banner after "Looks right".
  'voice.banner.title': 'आपकी बात से भरा गया',
  'voice.banner.body': 'रकम और कौन-कौन शामिल है, जाँच लें, फिर सेव करें।',

  // The language sheet.
  'voice.lang.title': 'किस भाषा में बोलेंगे',
  'voice.lang.note':
    'आपका ब्राउज़र आपकी आवाज़ को टेक्स्ट में बदलता है — Chrome इसके लिए Google की स्पीच सर्विस इस्तेमाल करता है। Settle कभी ऑडियो रिकॉर्ड या सेव नहीं करता।',
  'voice.lang.en.english': 'अंग्रेज़ी (भारत)',
  'voice.lang.hi.english': 'हिन्दी · हिंग्लिश के लिए भी',
  'voice.lang.bn.english': 'बांग्ला',
  'voice.lang.mr.english': 'मराठी',
  'voice.lang.ta.english': 'तमिल',
  'voice.lang.te.english': 'तेलुगु',
  'voice.lang.kn.english': 'कन्नड़',
  'voice.lang.gu.english': 'गुजराती',

  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'माइक बंद है',
  'voice.error.blocked.body': 'ब्राउज़र की साइट सेटिंग में Settle के लिए माइक्रोफ़ोन चालू करें — या बस टाइप कर दें।',
  'voice.error.noSpeech.title': 'सुनाई नहीं दिया',
  'voice.error.noSpeech.body': 'माइक पर टैप करें और फिर से बोलें — बीप के बाद।',
  'voice.error.noMic.title': 'कोई माइक्रोफ़ोन नहीं मिला',
  'voice.error.noMic.body': 'माइक लगाएँ, या टाइप कर दें।',
  'voice.error.network.title': 'आवाज़ के लिए इंटरनेट चाहिए',
  'voice.error.network.body': 'आपका ब्राउज़र ऑनलाइन ही आवाज़ को टेक्स्ट में बदलता है। ऑफ़लाइन हैं तो टाइप कर दें।',
  'voice.error.language.title': '{language} इस ब्राउज़र में उपलब्ध नहीं है',
  'voice.error.language.body': 'English या हिन्दी आज़माएँ, या टाइप कर दें।',
  'voice.error.other.title': 'इस बार आवाज़ से नहीं हो पाया',
  'voice.error.other.body': 'फिर से कोशिश करें, या टाइप कर दें।',
} as const satisfies Messages
