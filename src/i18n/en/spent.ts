/** English copy for Split this? (src/features/spent): payments the phone saw, ready to split. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const spent = {
  'spent.aria': 'Payments to split',
  'spent.eyebrow': 'Split this?',
  'spent.line': 'You paid {amount} to {name}',
  'spent.line.noName': 'You paid {amount}',
  'spent.when': '{date} · from your phone’s payment alert',
  'spent.split': 'Split it',
  'spent.split.group': 'Split with {group}',
  'spent.split.other': 'With someone else',
  'spent.mine': 'Just mine',
  'spent.mine.toast': 'Left as yours alone',
  'spent.more': '{count, plural, one {# more payment} other {# more payments}}',
  'spent.title.fallback': 'UPI payment',
  'spent.banner.title': 'Filled in from your payment alert',
  'spent.banner.body': 'The amount, who it went to and the day are from the alert. Pick who shares it.',
} satisfies Messages
