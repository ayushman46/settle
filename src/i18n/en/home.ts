/** English copy for Home (foundations' quick actions; the rest is extracted in Phase 3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header.
  'home.quick.label': 'Quick actions',
  'home.quick.scan': 'Scan bill',
  'home.quick.split': 'Split amount',
  'home.quick.lend': 'Lend / borrow',
  'home.quick.collect': 'Collect money',
  'home.quick.sms': 'From SMS',
  'home.quick.food': 'Food order',
  'home.quick.group': 'New group',
  'home.quick.more': 'More',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'Rent',
  'home.template.travel': 'Trip',
  'home.template.subscription': 'Subscription',
  'home.template.utilities': 'Utilities',
  'home.template.transport': 'Cab',
  // The sheet behind the More tile.
  'home.more.title': 'More ways to split',
  'home.more.subtitle': 'Start with the amount for any of these.',
} as const satisfies Messages
