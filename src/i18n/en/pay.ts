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

  // One person's share.
  'pay.panel.notYou.cta': 'Not {name}? Pick your name',
  'pay.panel.share.title': '{name}’s share',
  'pay.panel.partPaid': '{paid} of {share} already paid — this is the rest',
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
  'pay.tell.message.cash': 'Hi {name}! Paid you {amount} in cash for {title} ✓',
  'pay.tell.message.cash.noName': 'Hi! Paid you {amount} in cash for {title} ✓',
  'pay.tell.message.ref': 'UPI ref: {ref}',
  'pay.tell.message.link': 'Tap to mark me as paid 👇',
  'pay.tell.how.upi': 'By UPI',
  'pay.tell.how.cash': 'In cash',
  'pay.tell.utr.label': 'UPI reference (optional)',
  'pay.tell.utr.hint': '12 digits, in your UPI app’s payment details',
  'pay.tell.utr.error': 'A UPI reference has 12 digits.',
  'pay.tell.opened.status': 'WhatsApp is open — send it to {name}.',

  // A link that can't be shown.
  'pay.problem.invalid.title': 'This pay link doesn’t work',
  'pay.problem.invalid.body': 'It may have been cut short when it was copied. Ask whoever sent it to share it again.',
  'pay.problem.empty.title': 'No pay link here',
  'pay.problem.empty.body': 'Open the link your friend shared — it has everything you need to pay them.',
  'pay.loading.status': 'Opening the pay link…',

  // The browser tab title and the link preview.
  'pay.meta.title': 'Pay {name} · {title} · {brand}',
  'pay.meta.title.empty': 'Pay link · {brand}',
  'pay.meta.description': 'See your exact share and pay it with any UPI app. Sent with {brand}.',
} as const satisfies Messages
