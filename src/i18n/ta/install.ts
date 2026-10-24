/** Tamil copy for installing the app (src/features/install). Keys: `install.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Settle-ஐ நிறுவு',
  'install.card.body': 'ஒரு ஆப் போலத் திறக்கும், ஆஃப்லைனிலும் வேலை செய்யும்.',
  'install.card.install': 'நிறுவு',
  'install.card.howto': 'எப்படி நிறுவுவது',
  'install.card.later': 'இப்போது வேண்டாம்',
  // The You → Shortcuts row.
  'install.row.title': 'ஆப்பை நிறுவு',
  'install.row.subtitle': 'முகப்புத் திரையிலிருந்து திறக்கும், ஆஃப்லைனிலும் வேலை செய்யும்',
  // The iPhone steps.
  'install.sheet.title': 'Settle-ஐ உங்கள் முகப்புத் திரையில் சேருங்கள்',
  'install.sheet.description': 'பத்து நொடிகள் ஆகும். iPhone-இல் Safari-யில் வேலை செய்யும்.',
  'install.sheet.step1.title': 'Share-ஐத் தட்டுங்கள்',
  'install.sheet.step1.body': 'Safari-யின் அடியில் அம்புக்குறியுடன் இருக்கும் சதுரம்.',
  'install.sheet.step2.title': 'முகப்புத் திரையில் சேர் என்பதைத் தட்டுங்கள்',
  'install.sheet.step2.body': 'பிறகு மேல் வலதுபுறத்தில் Add என்பதைத் தட்டுங்கள்.',
  'install.sheet.done': 'சரி',
} as const satisfies Messages
