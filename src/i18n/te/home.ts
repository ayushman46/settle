/** Telugu copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'త్వరిత చర్యలు',
  'home.quick.scan': 'బిల్లు స్కాన్',
  'home.quick.split': 'మొత్తం పంచండి',
  'home.quick.lend': 'అప్పు ఇవ్వండి / తీసుకోండి',
  'home.quick.collect': 'డబ్బు వసూలు చేయండి',
  'home.quick.sms': 'SMS నుంచి',
  'home.quick.food': 'ఫుడ్ ఆర్డర్',
  'home.quick.group': 'కొత్త గ్రూప్',
  'home.quick.more': 'ఇంకా',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'అద్దె',
  'home.template.travel': 'ట్రిప్',
  'home.template.subscription': 'సబ్‌స్క్రిప్షన్',
  'home.template.utilities': 'కరెంట్-నీళ్లు',
  'home.template.transport': 'క్యాబ్',
  // The sheet behind the More tile.
  'home.more.title': 'పంచుకునే ఇతర మార్గాలు',
  'home.more.subtitle': 'వీటిలో దేనికైనా, మొత్తంతో మొదలుపెట్టండి.',
} as const satisfies Messages
