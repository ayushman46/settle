/** Telugu copy for installing the app (src/features/install). Keys: `install.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Settle ఇన్‌స్టాల్ చేయండి',
  'install.card.body': 'యాప్‌లా తెరుచుకుంటుంది, ఆఫ్‌లైన్‌లోనూ పనిచేస్తుంది.',
  'install.card.install': 'ఇన్‌స్టాల్',
  'install.card.howto': 'ఎలా ఇన్‌స్టాల్ చేయాలి',
  'install.card.later': 'ఇప్పుడు వద్దు',
  // The You → Shortcuts row.
  'install.row.title': 'యాప్ ఇన్‌స్టాల్ చేయండి',
  'install.row.subtitle': 'హోమ్ స్క్రీన్ నుంచి తెరుచుకుంటుంది, ఆఫ్‌లైన్‌లోనూ పనిచేస్తుంది',
  // The iPhone steps.
  'install.sheet.title': 'Settle ను మీ హోమ్ స్క్రీన్‌కు జోడించండి',
  'install.sheet.description': 'పది సెకన్లు పడుతుంది. iPhone లోని Safari లో పనిచేస్తుంది.',
  'install.sheet.step1.title': 'Share నొక్కండి',
  'install.sheet.step1.body': 'Safari కింది భాగంలో బాణంతో ఉన్న చతురస్రం.',
  'install.sheet.step2.title': 'Add to Home Screen నొక్కండి',
  'install.sheet.step2.body': 'తర్వాత పైన కుడివైపున Add నొక్కండి.',
  'install.sheet.done': 'సరే',
} as const satisfies Messages
