/** Kannada copy for "Just say it" voice entry (speak to split). Keys: `voice.<screen>.<element>`. */
import type { Messages } from '../types'

export const voice = {
  'voice.mic.home.aria': 'ಮಾತನಾಡಿ ಹಂಚಿ',
  'voice.mic.sheet.aria': 'ಬದಲಿಗೆ ಮಾತನಾಡಿ',
  'voice.mic.offline': 'ಧ್ವನಿಗೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು',

  'voice.listen.title': 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ…',
  'voice.listen.aria': '{language} ನಲ್ಲಿ ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ',
  'voice.listen.language.aria': '{native}, {language} ನಲ್ಲಿ ಮಾತನಾಡುತ್ತಿದ್ದೀರಿ. ಭಾಷೆ ಬದಲಿಸಿ',
  'voice.listen.stop.cta': 'ನಿಲ್ಲಿಸಿ',
  'voice.listen.tip': 'ಏನದು, ಎಷ್ಟು ಮತ್ತು ಯಾರಿದ್ದರು ಎಂದು ಹೇಳಿ — ಹೀಗೆ',
  'voice.listen.heard.aria': 'ಕೇಳಿಸಿದ್ದು: {text}',

  'voice.heard.chip': '“{phrase}” ಕೇಳಿಸಿತು → {amount}',
  'voice.heard.label': 'ನಾವು ಕೇಳಿದ ಸಂಖ್ಯೆಗಳು',

  'voice.long.title': 'ಇದು ತುಂಬಾ ಉದ್ದ — ಚಿಕ್ಕದಾಗಿ ಇರಲಿ',
  'voice.long.body': 'ಮೊದಲ {max} ಅಕ್ಷರಗಳು ಮಾತ್ರ ಹಿಡಿಸುತ್ತವೆ. ಕತ್ತರಿಸಿ, ಅಥವಾ ಒಂದೇ ವಾಕ್ಯದಲ್ಲಿ ಮತ್ತೆ ಹೇಳಿ.',

  'voice.banner.title': 'ನೀವು ಹೇಳಿದ್ದರಿಂದ ತುಂಬಿಸಲಾಗಿದೆ',
  'voice.banner.body': 'ಮೊತ್ತ ಮತ್ತು ಯಾರಿದ್ದಾರೆ ಎಂದು ಪರಿಶೀಲಿಸಿ, ನಂತರ ಉಳಿಸಿ.',

  'voice.lang.title': 'ಇದರಲ್ಲಿ ಮಾತನಾಡಿ',
  'voice.lang.note': 'ನಿಮ್ಮ ಬ್ರೌಸರ್ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಪಠ್ಯವಾಗಿ ಬದಲಿಸುತ್ತದೆ — ಇದಕ್ಕಾಗಿ Chrome, Google ನ ಭಾಷಣ ಸೇವೆಯನ್ನು ಬಳಸುತ್ತದೆ. Settle ಎಂದಿಗೂ ಆಡಿಯೊ ದಾಖಲಿಸುವುದಿಲ್ಲ ಅಥವಾ ಉಳಿಸುವುದಿಲ್ಲ.',
  'voice.lang.en.english': 'ಇಂಗ್ಲಿಷ್ (ಭಾರತ)',
  'voice.lang.hi.english': 'ಹಿಂದಿ · ಹಿಂಗ್ಲಿಷ್‌ಗೂ',
  'voice.lang.bn.english': 'ಬೆಂಗಾಲಿ',
  'voice.lang.mr.english': 'ಮರಾಠಿ',
  'voice.lang.ta.english': 'ತಮಿಳು',
  'voice.lang.te.english': 'ತೆಲುಗು',
  'voice.lang.kn.english': 'ಕನ್ನಡ',
  'voice.lang.gu.english': 'ಗುಜರಾತಿ',

  'voice.error.blocked.title': 'ಮೈಕ್ ತಡೆಹಿಡಿಯಲಾಗಿದೆ',
  'voice.error.blocked.body': 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಸೈಟ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ Settle ಗೆ ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿಸಿ — ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
  'voice.error.noSpeech.title': 'ಕೇಳಿಸಲಿಲ್ಲ',
  'voice.error.noSpeech.body': 'ಮೈಕ್ ಒತ್ತಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ — ಬೀಪ್ ನಂತರ ಮಾತನಾಡಿ.',
  'voice.error.noMic.title': 'ಮೈಕ್ರೋಫೋನ್ ಸಿಗಲಿಲ್ಲ',
  'voice.error.noMic.body': 'ಒಂದನ್ನು ಸಿಕ್ಕಿಸಿ, ಅಥವಾ ಬದಲಿಗೆ ಟೈಪ್ ಮಾಡಿ.',
  'voice.error.network.title': 'ಧ್ವನಿಗೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು',
  'voice.error.network.body': 'ನಿಮ್ಮ ಬ್ರೌಸರ್ ಮಾತನ್ನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಪಠ್ಯವಾಗಿ ಬದಲಿಸುತ್ತದೆ. ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದಾಗ ಟೈಪ್ ಮಾಡಿ.',
  'voice.error.language.title': '{language} ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ',
  'voice.error.language.body': 'ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಹಿಂದಿ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
  'voice.error.other.title': 'ಈ ಬಾರಿ ಧ್ವನಿ ಕೆಲಸ ಮಾಡಲಿಲ್ಲ',
  'voice.error.other.body': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
} as const satisfies Messages
