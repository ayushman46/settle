/** English copy for Pay it forward (src/features/swap): one payment instead of two. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const swap = {
  'swap.card.eyebrow': 'One payment instead of two',
  'swap.card.aria': 'Pay it forward',
  'swap.card.body': 'Ask {from} to pay {to} {amount} directly. Both are cleared with you.',
  'swap.card.why': '{from} owes you {owed}, and you owe {to} {owe}.',
  'swap.card.skips': 'skips you',
  'swap.card.diagram.aria': '{from} pays {to} {amount}, skipping you',
  'swap.card.noUpi': '{to} has no UPI ID saved, so the message can’t include one. {from} can ask {to} for it.',
  'swap.card.ask': 'Ask {from}',
  'swap.card.paid': '{from} paid {to}',
  'swap.card.paid.aria': 'Mark that {from} paid {to} {amount}',
  'swap.card.dismiss': 'Not now',
  'swap.card.dismiss.aria': 'Put away the suggestion that {from} pays {to}',
  'swap.card.more': '{count} more',
  'swap.card.fewer': 'Show fewer',
  'swap.card.saved': '{count, plural, one {Saves # payment in all} other {Saves # payments in all}}',

  'swap.message': 'Hi {from}, instead of paying me {amount}, please pay {to} {amount} directly: I owe {to} the same. That clears both of us.',
  'swap.message.upi': '{to}’s UPI ID: {upi}',
  'swap.message.link': 'Pay {to} here: {link}',
  'swap.message.title': 'Pay {to} instead of me',

  'swap.toast.copied': 'Message copied. Paste it to {from}.',
  'swap.toast.failed': 'Couldn’t share the message. Try again.',
  'swap.toast.recorded': '{from} paid {to} {amount}. Both are cleared with you.',
  'swap.toast.dismissed': 'Suggestion put away',
} satisfies Messages
