/** English copy for Auto-settle (src/features/autosettle): the Android app ticks people off as payments arrive. */
import type { Messages } from '../types'

export const autosettle = {
  'autosettle.ticked.one': '{name} paid {amount} · {title} — ticked off',
  'autosettle.ticked.many': '{count, plural, one {# person} other {# people}} paid you back — ticked off',
  'autosettle.pending': '{count, plural, one {# payment to check} other {# payments to check}}',
  'autosettle.on.title': 'Auto-settle is on',
  'autosettle.on.text': 'When Google Pay, PhonePe, Paytm or BHIM says money arrived, whoever paid is ticked off. Failed payments and refunds go to Stuck money.',
  'autosettle.on.text.noSms': 'When Google Pay, PhonePe, Paytm or BHIM says money arrived, whoever paid is ticked off. Turn on Bank SMS in Manage to catch most failed payments and money coming back too.',
  'autosettle.manage': 'Manage',
  'autosettle.offer.title': 'Tick people off automatically',
  'autosettle.offer.text': 'When your UPI app says money arrived, Settle ticks off whoever paid. A payment that failed but took your money, or a refund on its way, goes to Stuck money by itself.',
  'autosettle.offer.cta': 'Turn on Auto-settle',
  'autosettle.error': 'Couldn’t open Android’s settings. Try again.',
  'autosettle.sheet.title': 'Auto-settle',
  'autosettle.sheet.description': 'Settle notices payments to you and ticks off whoever paid. It also notices payments that failed and refunds, and keeps track of them in Stuck money.',
  'autosettle.sheet.reads': 'It reads only payment alerts: from Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik and CRED when money arrives, a payment fails, is pending or goes through, or money comes back — and refund alerts from a few shopping, food and travel apps.',
  'autosettle.sheet.does': 'A payment it’s sure of ticks that person off, with Undo. One it isn’t sure of waits for you to check.',
  'autosettle.sheet.private': 'It all stays on this phone. Nothing is uploaded, and every other notification is ignored, never kept.',
  'autosettle.sheet.stop': 'Settle reads these through Android’s notification access, which you can turn off in Android’s settings any time.',
  'autosettle.sheet.sms.label': 'Bank SMS too',
  'autosettle.sheet.sms.description': 'Needed for most failed payments and money coming back: many banks only tell you by SMS. Only messages about money credited, failed payments and refunds are read — plus debits, just to check a failed payment really took your money.',
  'autosettle.sheet.allow': 'Allow in Android settings',
  'autosettle.sheet.later': 'Not now',
  'autosettle.sheet.done': 'Done',
  'autosettle.sheet.off': 'Turn off in Android settings',
} as const satisfies Messages
