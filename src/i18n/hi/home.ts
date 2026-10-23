/** Hindi copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'झटपट विकल्प',
  'home.quick.scan': 'बिल स्कैन',
  'home.quick.split': 'रकम बाँटें',
  'home.quick.lend': 'उधार दें / लें',
  'home.quick.collect': 'पैसे इकट्ठा करें',
  'home.quick.sms': 'SMS से',
  'home.quick.food': 'फ़ूड ऑर्डर',
  'home.quick.group': 'नया ग्रुप',
  'home.quick.more': 'और भी',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'किराया',
  'home.template.travel': 'ट्रिप',
  'home.template.subscription': 'सब्सक्रिप्शन',
  'home.template.utilities': 'बिजली-पानी',
  'home.template.transport': 'कैब',
  // The sheet behind the More tile.
  'home.more.title': 'बाँटने के और तरीके',
  'home.more.subtitle': 'इनमें से किसी के लिए भी, बस रकम से शुरू करें।',
} as const satisfies Messages
