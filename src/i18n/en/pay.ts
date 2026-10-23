/** English copy for the /pay page (src/features/pay). Keys: `pay.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const pay = {
  // The frame of every public page a friend opens from a link (/pay, /claim, /pool).
  'pay.shell.home.aria': '{brand} home',
  'pay.shell.what': 'What’s {brand}?',
  'pay.shell.pitch.title': 'Splitting the bill next time?',
  'pay.shell.pitch.body': 'Snap the bill, share one link like this, and get paid back by UPI. No sign-up, no ads.',
  'pay.shell.pitch.cta': 'Split your own bills with {brand} — free',
  'pay.shell.privacy': 'Privacy',
  'pay.shell.terms': 'Terms',

  // The request card, the page's h1. <by> is the small line, <what> the big title (user content).
  'pay.request.title': '<by>{name} requested money for</by> <what>{title}</what>',
  // In the line under the title: "21 Oct · Food · Total ₹2,766".
  'pay.request.total': 'Total {amount}',
  'pay.request.collected': '{collected} of {owed} collected',
  'pay.request.paidCount': '{paid} of {count} paid',

  // "Which one are you?" — the list of everyone on the link.
  'pay.who.title': 'Which one are you?',
  'pay.who.empty': 'Nobody owes anything on this link.',
  'pay.who.hint': 'Tap your name to see your share and pay.',
  // Badge next to someone the payee has marked as paid.
  'pay.who.paid': 'Paid',

  // Paying by UPI (also used on the claim and pool pages).
  'pay.upi.cta': 'Pay {amount} with any UPI app',
  'pay.upi.cta.caption': 'Opens GPay, PhonePe, Paytm or BHIM with everything filled in.',
  'pay.upi.qr.show.cta': 'Pay from another phone',
  'pay.upi.qr.hide.cta': 'Hide the QR code',
  'pay.upi.qr.aria': 'UPI QR code to pay {amount} to {name}',
  'pay.upi.qr.caption.touch': 'Scan it with the UPI app on the other phone.',
  'pay.upi.qr.caption.desktop': 'Scan with any UPI app on your phone — GPay, PhonePe, Paytm, BHIM.',
  // Label above the payee's name and UPI ID.
  'pay.upi.payee.label': 'Paying to',
  'pay.upi.copy.cta': 'Copy',
  'pay.upi.copied.cta': 'Copied',
  'pay.upi.copy.aria': 'Copy UPI ID',
  'pay.upi.copied.aria': 'Copied UPI ID',
  'pay.upi.copy.error': 'Couldn’t copy — press and hold the ID to copy it.',
  'pay.upi.copied.status': 'UPI ID copied',
  'pay.upi.safety': 'Check that your UPI app shows <b>{name}</b> before you pay. {brand} never touches your money.',

  // One person's share.
  'pay.panel.notYou.cta': 'Not {name}? Pick your name',
  'pay.panel.share.title': '{name}’s share',
  'pay.panel.paid.title': 'You’re all square',
  'pay.panel.paid.body': '{name} has marked your share as paid.',
  'pay.panel.reveal.cta': 'Show payment details anyway',
  'pay.panel.nothing.title': 'Nothing to pay',
  'pay.panel.nothing.body': 'Your share of this one is {amount}.',
  'pay.panel.noUpi.title': '{name} didn’t add a UPI ID',
  'pay.panel.noUpi.body': 'Pay them the way you usually do — or ask for their UPI ID and pay from any UPI app.',
  'pay.panel.notInr.title': 'Pay the usual way',
  'pay.panel.notInr.body': 'UPI only works in rupees, so pay {name} the way you usually do.',
  'pay.panel.breakdown.title': 'What’s in your share',
  'pay.panel.breakdown.share': 'Your share',
  // Under an item someone shared: "Shared 3 ways", or "2 of 3 shares" for unequal shares.
  'pay.breakdown.sharedWays': 'Shared {count} ways',
  'pay.breakdown.shares': '{shares} of {total} shares',
  'pay.breakdown.extras.added': 'Tax, fees & round-off',
  'pay.breakdown.extras.taken': 'Discounts and round-off',

  // "Paid? Tell them" — a ready message the payer sends to the payee's chat.
  'pay.tell.title': 'Paid?',
  'pay.tell.cta': 'Tell {name} you’ve paid',
  'pay.tell.copied.status': 'Message copied — paste it in your chat.',
  'pay.tell.shared.status': 'Sent. Thanks for settling up!',
  'pay.tell.failed.status': 'Couldn’t share the message. Try again.',
  // The message itself ({title} is what the bill was for).
  'pay.tell.message': 'Hi {name}! Just paid you {amount} for {title} ✓',
  'pay.tell.message.noName': 'Hi! Just paid you {amount} for {title} ✓',

  // A link that can't be shown.
  'pay.problem.invalid.title': 'This pay link doesn’t work',
  'pay.problem.invalid.body': 'It may have been cut short when it was copied. Ask whoever sent it to share it again.',
  'pay.problem.empty.title': 'No pay link here',
  'pay.problem.empty.body': 'Open the link your friend shared — it has everything you need to pay them.',
  'pay.loading.status': 'Opening the pay link…',

  // The browser tab title and the link preview.
  'pay.meta.title': 'Pay {name} · {title} · {brand}',
  'pay.meta.title.empty': 'Pay link · {brand}',
  'pay.meta.description': 'Pay your share in a tap with any UPI app. Sent with {brand}.',
} as const satisfies Messages
