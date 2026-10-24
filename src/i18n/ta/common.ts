/** Tamil words used all over the app. Keys: `common.<group>.<word>`. */
import type { Messages } from '../types'

export const common = {
  'common.action.save': 'சேமி',
  'common.action.cancel': 'ரத்து செய்',
  'common.action.done': 'முடிந்தது',
  'common.action.undo': 'செயல்தவிர்',
  'common.action.delete': 'நீக்கு',
  'common.action.edit': 'மாற்று',
  'common.action.close': 'மூடு',
  'common.action.back': 'பின்செல்',
  'common.action.next': 'அடுத்து',
  'common.action.continue': 'தொடரவும்',
  'common.action.retry': 'மீண்டும் முயற்சி செய்',
  'common.action.skip': 'தவிர்',
  'common.action.share': 'பகிர்',
  'common.action.copy': 'நகலெடு',
  'common.action.copied': 'நகலெடுக்கப்பட்டது',
  'common.action.add': 'சேர்',
  'common.action.remove': 'அகற்று',
  'common.action.seeAll': 'அனைத்தையும் பார்',
  'common.action.more': 'மேலும்',
  'common.date.today': 'இன்று',
  'common.date.yesterday': 'நேற்று',
  'common.people.you': 'நீங்கள்',
  'common.people.someone': 'யாரோ ஒருவர்',
  'common.count.people': '{count, plural, one {# நபர்} other {# நபர்கள்}}',
  'common.count.items': '{count, plural, one {# பொருள்} other {# பொருட்கள்}}',
  // The language pickers (onboarding, You → Language) and the switcher on public pages.
  'common.language.label': 'மொழி',
  'common.language.title': 'மொழியைத் தேர்ந்தெடுங்கள்',
  'common.language.automatic': 'தானாக',
  // Under "Automatic": which language the phone gives ({language} is its own name, e.g. हिन्दी).
  'common.language.automatic.hint': 'ஃபோன் மொழி · {language}',
  // On a language that isn't translated yet ({language} = its English name).
  'common.language.soon': '{language} · விரைவில் வரும்',
  'common.language.failed': 'அந்த மொழியை ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சி செய்யுங்கள்.',
} as const satisfies Messages
