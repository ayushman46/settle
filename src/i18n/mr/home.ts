/** Marathi copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'झटपट पर्याय',
  'home.quick.scan': 'बिल स्कॅन करा',
  'home.quick.split': 'रक्कम वाटा',
  'home.quick.lend': 'उधार द्या / घ्या',
  'home.quick.collect': 'पैसे गोळा करा',
  'home.quick.sms': 'SMS वरून',
  'home.quick.food': 'फूड ऑर्डर',
  'home.quick.group': 'नवीन ग्रुप',
  'home.quick.more': 'आणखी',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'भाडे',
  'home.template.travel': 'ट्रिप',
  'home.template.subscription': 'सबस्क्रिप्शन',
  'home.template.utilities': 'वीज-पाणी',
  'home.template.transport': 'कॅब',
  // The sheet behind the More tile.
  'home.more.title': 'वाटणीचे आणखी मार्ग',
  'home.more.subtitle': 'यापैकी कशासाठीही, फक्त रकमेपासून सुरुवात करा.',
} as const satisfies Messages
