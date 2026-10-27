/** English copy for Auto-settle (src/features/autosettle): the Android app ticks people off as payments arrive. */
import type { Messages } from '../types'

export const autosettle = {
  'autosettle.ticked.one': '{name} paid {amount} · {title} — ticked off',
  'autosettle.ticked.many': '{count, plural, one {# person} other {# people}} paid you back — ticked off',
  'autosettle.pending': '{count, plural, one {# payment to check} other {# payments to check}}',
  'autosettle.on.title': 'Auto-settle is on',
  'autosettle.on.text': 'When Google Pay, PhonePe, Paytm or BHIM says money arrived, whoever paid is ticked off.',
  'autosettle.manage': 'Manage',
  'autosettle.offer.title': 'Tick people off automatically',
  'autosettle.offer.text': 'When your UPI app says money arrived, Settle ticks off whoever paid — no screenshots, no marking.',
  'autosettle.offer.cta': 'Turn on Auto-settle',
  'autosettle.error': 'Couldn’t open Android’s settings. Try again.',
  'autosettle.sheet.title': 'Auto-settle',
  'autosettle.sheet.description': 'Settle notices payments to you and ticks off whoever paid.',
  'autosettle.sheet.reads': 'It reads only the alerts Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik and CRED show when money arrives.',
  'autosettle.sheet.does': 'A payment it’s sure of ticks that person off, with Undo. One it isn’t sure of waits for you to check.',
  'autosettle.sheet.private': 'It all stays on this phone. Nothing is uploaded, and every other notification is ignored, never kept.',
  'autosettle.sheet.stop': 'Android will ask you to allow notification access for Settle. You can turn it off there any time.',
  'autosettle.sheet.sms.label': 'Bank SMS too',
  'autosettle.sheet.sms.description': 'Many banks only tell you by SMS. Only messages that say money was credited are read.',
  'autosettle.sheet.allow': 'Allow in Android settings',
  'autosettle.sheet.later': 'Not now',
  'autosettle.sheet.done': 'Done',
  'autosettle.sheet.off': 'Turn off in Android settings',
} as const satisfies Messages
