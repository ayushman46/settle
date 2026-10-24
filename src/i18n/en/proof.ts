/** English copy for payment screenshots (src/features/proof). Keys: `proof.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'Paid? Drop the screenshot',
  'proof.screen.subtitle': 'Drop a screenshot of the payment from GPay, PhonePe, Paytm or your bank app. Settle checks it and marks who paid you.',
  'proof.drop.choose': 'Choose a screenshot',
  'proof.drop.aria': 'Choose a payment screenshot',
  'proof.drop.hint': 'JPG, PNG or WebP. Read once; nothing is kept.',
  'proof.reading.title': 'Reading the screenshot…',
  'proof.reading.cancel': 'Cancel',
  'proof.again': 'Drop another screenshot',
  // What goes wrong reading the screenshot.
  'proof.error.generic': "Couldn't read the screenshot. Try again, or pick the person yourself.",
  'proof.error.network': "You're offline. Connect and try again.",
  'proof.error.not_a_payment': "That doesn't look like a UPI payment. Try the success screen from your payment app.",
  'proof.error.unsupported_image': 'Please use a JPG, PNG or WebP screenshot.',
  'proof.error.image_too_large': 'That screenshot is too large. Try a smaller one.',
  'proof.error.rate_limited': 'Too many screenshots right now. Try again in a few minutes.',
  'proof.error.timeout': 'Reading the screenshot took too long. Try again.',
  'proof.error.unreadable': "We couldn't read that screenshot. Try the full success screen, in good light.",
  'proof.error.not_configured': "Screenshot reading isn't available right now.",
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'This payment is still pending. Not marking it paid.',
  'proof.verdict.pending.body': 'Drop the screenshot again once it says Paid.',
  'proof.verdict.failed.title': 'This payment failed. Not marking it paid.',
  'proof.verdict.failed.body': 'Nothing was paid. Ask them to try again.',
  'proof.verdict.unreadable.title': "We couldn't tell if this payment went through.",
  'proof.verdict.unreadable.body': 'Drop a screenshot of the success screen.',
  'proof.verdict.wrongPayee.title': "This money didn't go to you. Not marking it paid.",
  'proof.verdict.wrongPayee.body': 'It went to {payee}.',
  'proof.verdict.payeeUnknown.title': "We can't see who received this payment. Not marking it paid.",
  'proof.verdict.payeeUnknown.body': 'Drop a screenshot that shows the receiver\'s name or UPI ID.',
  'proof.verdict.duplicate.title': 'This payment is already recorded.',
  'proof.verdict.duplicate.body': 'UPI ref {utr} is already marked against {name}.',
  'proof.verdict.duplicate.someone': 'someone in your list',
  // A match: one person owes exactly this.
  'proof.match.title': "Mark {name}'s {amount} as paid?",
  'proof.match.ref': 'UPI ref {utr}',
  'proof.match.noRef': "No UPI ref on this screen. Check it's the right payment.",
  'proof.match.confirm': 'Mark as paid',
  'proof.match.notThis': 'Not this one',
  'proof.match.done': "Marked {name}'s {amount} as paid.",
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': "We couldn't match this to anyone.",
  'proof.nomatch.amount': 'The screen shows {amount}. Pick who paid you, if it was one of them.',
  'proof.nomatch.noAmount': "The screen doesn't show an amount. Pick who paid you, if it was one of them.",
  'proof.nomatch.none': 'Nobody owes you exactly {amount}. Check the amount in Friends.',
  'proof.nomatch.pick': 'Pick {name} ({amount})',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'Shared from another app',
  'proof.more.title': 'Paid? Drop the screenshot',
  'proof.more.subtitle': 'Mark a UPI payment as paid from its screenshot',
  // The link on a friend, a group's settle-up page: a screenshot of a payment to you.
  'proof.entry.cta': 'Got a payment screenshot?',
} as const satisfies Messages
