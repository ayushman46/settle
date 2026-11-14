/** English copy for Clear everything (src/features/queue): pay everyone you owe, one after another. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const queue = {
  'queue.card.title': 'You owe {count, plural, one {# person} other {# people}} {amount}',
  'queue.card.body': 'Clear it in one go: one person after another, no hunting through screens.',
  'queue.card.cta': 'Clear it in one go',

  'queue.title': 'Clear everything',
  'queue.subtitle': 'You owe {count, plural, one {# person} other {# people}} {amount}',
  'queue.progress': '{current} of {total}',
  'queue.now.aria': 'Paying now',
  'queue.for.group': 'In the group {group}. Paying here updates the group too.',
  'queue.for.split': 'For the split “{title}”',
  'queue.for.several': 'For more than one split or group',
  'queue.subtitle.skipped': 'Only the {count, plural, one {person} other {# people}} you skipped {count, plural, one {is} other {are}} left: {amount}',
  'queue.noUpi': 'No UPI ID saved for {name}. You can add it when you pay.',
  'queue.upi': 'Pays to {upi}',
  'queue.pay': 'Pay {amount}',
  'queue.cash': 'Paid in cash',
  'queue.cash.aria': 'Mark {amount} to {name} as paid in cash',
  'queue.skip': 'Skip',
  'queue.skip.aria': 'Skip {name} for now',
  'queue.next.title': 'Up next',
  'queue.done.title': 'Done',
  'queue.done.aria': 'Paid so far',
  'queue.done.upi': 'Paid by UPI',
  'queue.done.cash': 'Paid in cash',
  'queue.burst': 'Paid {name}',
  'queue.burst.next': 'Next: {name}',
  'queue.burst.last': 'That’s everyone',
  'queue.toast.paid': 'Paid {name} {amount}',
  'queue.toast.cash': '{amount} to {name} marked paid in cash',

  'queue.skipped.title': 'That’s everyone, apart from {count, plural, one {# person} other {# people}} you skipped',
  'queue.skipped.body': '{names}. You still owe them {amount}.',
  'queue.skipped.again': '{count, plural, one {Pay the one you skipped} other {Pay the # you skipped}}',

  'queue.empty.title': 'You owe nobody',
  'queue.empty.body': 'Nothing to pay. When you owe someone, it shows up here.',
  'queue.empty.home': 'Back to Home',
} satisfies Messages
