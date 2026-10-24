/** Hindi copy for installing the app (src/features/install). Keys: `install.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Settle इंस्टॉल करें',
  'install.card.body': 'ऐप की तरह खुलेगा, बिना नेट के भी चलेगा।',
  'install.card.install': 'इंस्टॉल करें',
  'install.card.howto': 'इंस्टॉल कैसे करें',
  'install.card.later': 'अभी नहीं',
  // The You → Shortcuts row.
  'install.row.title': 'ऐप इंस्टॉल करें',
  'install.row.subtitle': 'होम स्क्रीन से खुलेगा, बिना नेट के भी चलेगा',
  // The iPhone steps.
  'install.sheet.title': 'होम स्क्रीन पर Settle जोड़ें',
  'install.sheet.description': 'दस सेकंड लगेंगे। iPhone के Safari में काम करता है।',
  'install.sheet.step1.title': 'Share पर टैप करें',
  'install.sheet.step1.body': 'Safari के नीचे वाले तीर वाले चौकोर बटन पर टैप करें।',
  'install.sheet.step2.title': 'Add to Home Screen पर टैप करें',
  'install.sheet.step2.body': 'फिर ऊपर दाईं ओर Add पर टैप करें।',
  'install.sheet.done': 'समझ गया',
} as const satisfies Messages
