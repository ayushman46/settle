/** Marathi copy for "Install Settle" (the Home card, the You row and the iPhone steps). Keys: `install.<part>.<element>`. */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Settle इंस्टॉल करा',
  'install.card.body': 'अॅपसारखे उघडते, ऑफलाइनही चालते.',
  'install.card.install': 'इंस्टॉल करा',
  'install.card.howto': 'इंस्टॉल कसे करायचे',
  'install.card.later': 'आत्ता नको',
  // The You → Shortcuts row.
  'install.row.title': 'अॅप इंस्टॉल करा',
  'install.row.subtitle': 'होम स्क्रीनवरून उघडते, ऑफलाइनही चालते',
  // The iPhone steps.
  'install.sheet.title': 'Settle तुमच्या होम स्क्रीनवर जोडा',
  'install.sheet.description': 'सुमारे दहा सेकंद लागतात. iPhone वरील Safari मध्ये चालते.',
  'install.sheet.step1.title': 'शेअरवर टॅप करा',
  'install.sheet.step1.body': 'Safari च्या अगदी खाली, बाण असलेला चौकोन.',
  'install.sheet.step2.title': 'होम स्क्रीनवर जोडा वर टॅप करा',
  'install.sheet.step2.body': 'मग वरच्या उजव्या कोपऱ्यातील जोडा वर टॅप करा.',
  'install.sheet.done': 'समजले',
} as const satisfies Messages
