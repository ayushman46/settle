/** Tamil copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'விரைவுச் செயல்கள்',
  'home.quick.scan': 'பில் ஸ்கேன்',
  'home.quick.split': 'தொகையைப் பிரி',
  'home.quick.lend': 'கடன் கொடு / வாங்கு',
  'home.quick.collect': 'பணம் வசூலி',
  'home.quick.sms': 'SMS மூலம்',
  'home.quick.food': 'உணவு ஆர்டர்',
  'home.quick.group': 'புதிய குழு',
  'home.quick.more': 'மேலும்',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'வாடகை',
  'home.template.travel': 'பயணம்',
  'home.template.subscription': 'சந்தா',
  'home.template.utilities': 'மின்சாரம்-தண்ணீர்',
  'home.template.transport': 'கேப்',
  // The sheet behind the More tile.
  'home.more.title': 'பிரிப்பதற்கான மற்ற வழிகள்',
  'home.more.subtitle': 'இவற்றில் எதற்கும், தொகையிலிருந்து தொடங்குங்கள்.',
} as const satisfies Messages
