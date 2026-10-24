/** Tamil copy for the app shell (src/app). Keys: `app.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const app = {
  // The bottom tabs.
  'app.tab.home': 'முகப்பு',
  'app.tab.groups': 'குழுக்கள்',
  'app.tab.activity': 'வரலாறு',
  'app.tab.you': 'நீங்கள்',
  // The browser tab's title: "{page} · Settle".
  'app.title.format': '{page} · {brand}',
  // Page names for the browser tab (one per screen).
  'app.title.home': 'முகப்பு',
  'app.title.welcome': 'வரவேற்பு',
  'app.title.groups': 'குழுக்கள்',
  'app.title.group': 'குழு',
  'app.title.settleUp': 'கணக்கு தீர்',
  'app.title.activity': 'வரலாறு',
  'app.title.you': 'நீங்கள்',
  'app.title.newSplit': 'புதிய பிரிப்பு',
  'app.title.editSplit': 'பிரிப்பைத் திருத்து',
  'app.title.fromSms': 'SMS இலிருந்து',
  'app.title.lend': 'கடன் கொடு அல்லது வாங்கு',
  'app.title.editLend': 'கடனைத் திருத்து',
  'app.title.expense': 'செலவு',
  'app.title.claims': 'கோரிக்கைகள்',
  'app.title.people': 'நபர்கள்',
  'app.title.person': 'நபர்',
  'app.title.insights': 'விவரங்கள்',
  'app.title.recurring': 'தொடர் பிரிப்புகள்',
  'app.title.newRecurring': 'புதிய தொடர் பிரிப்பு',
  'app.title.recurringOne': 'தொடர் பிரிப்பு',
  'app.title.collections': 'வசூல்கள்',
  'app.title.newCollection': 'புதிய வசூல்',
  'app.title.collection': 'வசூல்',
  'app.title.editCollection': 'வசூலைத் திருத்து',
  'app.title.pro': 'Pro',
  // When the phone won't save (storage full or blocked).
  'app.storage.title': 'இந்த ஃபோன் உங்கள் மாற்றங்களைச் சேமிக்கவில்லை',
  'app.storage.body': 'சேமிப்பு நிரம்பியிருக்கலாம் அல்லது தடுக்கப்பட்டிருக்கலாம். சிறிது இடத்தை விடுவியுங்கள் — {brand} திறந்திருக்கும் வரை எல்லாம் இங்கேயே இருக்கும்.',
  // While a screen's code loads.
  'app.loading.aria': 'ஏற்றுகிறது',
  // A screen that crashed or couldn't load.
  'app.crash.title': 'ஏதோ தவறு நடந்தது',
  'app.crash.body': 'மன்னிக்கவும். மீண்டும் முயற்சி செய்யுங்கள், அல்லது முகப்புக்குத் திரும்புங்கள் — உங்கள் பிரிப்புகள் பாதுகாப்பாக உள்ளன.',
  'app.crash.retry.cta': 'மீண்டும் முயற்சி செய்',
  'app.crash.home.cta': 'முகப்புக்குச் செல்',
  'app.crash.offline.title': 'நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள்',
  'app.crash.offline.body': 'இந்தத் திரை முதல் முறை திறக்கும்போது இணைப்பு தேவை. மீண்டும் இணைத்து முயற்சி செய்யுங்கள்.',
  'app.crash.updated.title': '{brand} புதுப்பிக்கப்பட்டுள்ளது',
  'app.crash.updated.body': 'சமீபத்திய பதிப்பைப் பெற மீண்டும் ஏற்றுங்கள் — உங்கள் பிரிப்புகள் இந்த ஃபோனில் பாதுகாப்பாக உள்ளன.',
  'app.crash.reload.cta': 'மீண்டும் ஏற்று',
} as const satisfies Messages
