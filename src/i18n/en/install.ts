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

  'install.get.meta': 'Get {brand} on Android and iPhone',
  'install.get.title': 'Get {brand} on your phone',
  'install.get.lead': 'On Android and iPhone. It installs straight from your browser in about ten seconds: no store, and it works offline.',
  'install.get.phone.aria': 'Your phone',
  'install.get.android.cta': 'Install {brand}',
  'install.get.android.steps': 'Install on Android',
  'install.get.android.step1.title': 'Open the browser menu',
  'install.get.android.step1.body': 'The three dots at the top right of Chrome.',
  'install.get.android.step2.title': 'Tap Install app',
  'install.get.android.step2.body': 'Or “Add to Home screen”. {brand} then opens from its own icon.',
  'install.get.ios.step1.body': 'The square with an arrow: at the bottom in Safari, at the top right in Chrome.',
  'install.get.inApp.android': 'You’re inside another app’s browser, which can’t install anything. Tap the three dots and choose “Open in Chrome”, then install from there.',
  'install.get.inApp.ios': 'You’re inside another app’s browser, which can’t install anything. Tap the menu and choose “Open in Safari”, then add it from there.',
  'install.get.apk.title': 'Or the Android app',
  'install.get.apk.body': 'The same {brand}, plus what a browser can’t do: it reads your phone’s payment alerts (only if you allow it), so payments tick themselves off and what you spend is ready to split.',
  'install.get.apk.cta': 'Download the Android app',
  'install.get.apk.note': 'It isn’t on the Play Store yet, so Android asks you to allow the install from your browser. It updates itself; your data stays on the phone.',
  'install.get.ios.note': 'On iPhone, {brand} installs from Safari this way. There is no App Store app yet.',
  'install.get.qr': 'On a computer? Scan this with your phone’s camera to open this page there.',
  'install.get.qr.aria': 'QR code to open {brand}’s install page on your phone',
  'install.get.why': '{brand} is a web app: once added it has its own icon, opens full screen, keeps your groups on the phone and updates itself.',
  'install.get.installed': '{brand} is installed on this phone.',
  'install.get.open': 'Open {brand}',
} as const satisfies Messages
