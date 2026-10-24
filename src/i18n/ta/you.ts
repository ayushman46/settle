/** Tamil copy for the You tab. Keys: `you.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const you = {
  'you.shortcuts.label': 'குறுக்குவழிகள்',
  'you.shortcuts.people.title': 'நபர்கள்',
  'you.shortcuts.recurring.title': 'தொடர் பிரிப்புகள்',
  'you.shortcuts.insights.title': 'விவரங்கள்',
  'you.shortcuts.insights.subtitle': 'உங்கள் பணம் எதற்கு, எந்த வகை, எந்த மாதம் போகிறது',
  'you.shortcuts.collections.title': 'வசூல்கள்',
  'you.shortcuts.collections.subtitle.open': '{count, plural, one {# திறந்தது} other {# திறந்தவை}}',
  'you.shortcuts.collections.subtitle.none': 'பரிசுகள், விருந்துகள், பயணங்கள்',
  'you.celebrate.title': 'Pro திறக்கப்பட்டது',
  'you.pref.title': 'விருப்பங்கள்',
  // Under the language tiles in You → Language.
  'you.language.description': 'உங்கள் தேர்வு உங்கள் தரவுடன் சேமிக்கப்படும், காப்புப் பிரதியிலும் சேரும்.',
  'you.pref.currency.title': 'இயல்புநிலை நாணயம்',
  'you.pref.currency.description': 'புதிய பிரிப்புகள் இந்த நாணயத்தில் தொடங்கும். ஏற்கனவே உள்ளவை அவற்றின் நாணயத்திலேயே இருக்கும்.',
  // Toast after changing the default currency ({currency} = its name, e.g. Indian Rupee).
  'you.pref.currency.toast': 'புதிய பிரிப்புகளின் நாணயம்: {currency}',
  'you.pref.haptics.title': 'அதிர்வு',
  'you.pref.haptics.description': 'தட்டும்போதும் வேலைகளை முடிக்கும்போதும் லேசான அதிர்வு, அதை ஆதரிக்கும் ஃபோன்களில்.',
  'you.about.title': 'பற்றி',
  'you.about.redeem.title': 'குறியீட்டைப் பயன்படுத்து',
  'you.about.redeem.subtitle': 'ஒரு ப்ரோமோ குறியீடு, அல்லது பழைய ஃபோனிலிருந்து Pro',
  'you.about.privacy.title': 'தனியுரிமை',
  'you.about.privacy.subtitle': 'கணக்கு இல்லை, கண்காணிப்பு இல்லை — உங்கள் தரவு இங்கேயே இருக்கும்',
  'you.about.terms.title': 'விதிமுறைகள்',
  'you.about.terms.subtitle': 'எளிய மொழியில் விதிகள்',
  'you.footer.small': 'அக்கறையுடன் உருவாக்கப்பட்டது · விளம்பரங்கள் இல்லை · கண்காணிப்பு இல்லை',
} as const satisfies Messages
