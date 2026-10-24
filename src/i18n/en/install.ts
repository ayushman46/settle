/** English copy for installing the app (src/features/install). Keys: `install.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Install Settle',
  'install.card.body': 'Opens like an app, works offline.',
  'install.card.install': 'Install',
  'install.card.howto': 'How to install',
  'install.card.later': 'Not now',
  // The You → Shortcuts row.
  'install.row.title': 'Install the app',
  'install.row.subtitle': 'Opens from your home screen, works offline',
  // The iPhone steps.
  'install.sheet.title': 'Add Settle to your Home Screen',
  'install.sheet.description': 'Takes about ten seconds. Works in Safari on iPhone.',
  'install.sheet.step1.title': 'Tap Share',
  'install.sheet.step1.body': 'The square with an arrow, at the bottom of Safari.',
  'install.sheet.step2.title': 'Tap Add to Home Screen',
  'install.sheet.step2.body': 'Then tap Add in the top right.',
  'install.sheet.done': 'Got it',
} as const satisfies Messages
