/** Tamil copy for S3 · speak to split. Keys: `voice.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'பிரிக்கப் பேசுங்கள்',
  'voice.mic.sheet.aria': 'பதிலாகப் பேசுங்கள்',
  'voice.mic.offline': 'குரல் வசதிக்கு இணையம் தேவை',
  // The listening panel inside "Just say it".
  'voice.listen.title': 'கேட்டுக்கொண்டிருக்கிறது…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': '{language} இல் கேட்கிறது',
  'voice.listen.language.aria': '{native}, {language} இல் பேசுங்கள். மொழியை மாற்று',
  'voice.listen.stop.cta': 'நிறுத்து',
  'voice.listen.tip': 'அது என்னவாக இருந்தது, எவ்வளவு, யார் இருந்தார்கள் என்று சொல்லுங்கள் — உதாரணம்',
  'voice.listen.heard.aria': 'கேட்டது: {text}',
  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': '“{phrase}” கேட்டது → {amount}',
  'voice.heard.label': 'நாங்கள் கேட்ட எண்கள்',
  // When the transcript is longer than the AI can read.
  'voice.long.title': 'இது நீளமானது — சுருக்கமாகச் சொல்லுங்கள்',
  'voice.long.body': 'முதல் {max} எழுத்துகள் மட்டுமே பொருந்தும். சுருக்குங்கள், அல்லது ஒரு வாக்கியத்தில் மீண்டும் சொல்லுங்கள்.',
  // The split screen's banner after "Looks right".
  'voice.banner.title': 'நீங்கள் சொன்னதிலிருந்து நிரப்பப்பட்டது',
  'voice.banner.body': 'தொகையையும் யார் இருக்கிறார்கள் என்பதையும் சரிபார்த்து, சேமியுங்கள்.',
  // The language sheet.
  'voice.lang.title': 'இந்த மொழியில் பேசுங்கள்',
  'voice.lang.note': 'உங்கள் உலாவி உங்கள் குரலை உரையாக மாற்றுகிறது — இதற்கு Chrome, Google பேச்சுச் சேவையைப் பயன்படுத்துகிறது. Settle ஒருபோதும் ஒலியைப் பதிவு செய்வதோ வைத்திருப்பதோ இல்லை.',
  'voice.lang.en.english': 'ஆங்கிலம் (இந்தியா)',
  'voice.lang.hi.english': 'இந்தி · Hinglish-க்கும்',
  'voice.lang.bn.english': 'வங்காளம்',
  'voice.lang.mr.english': 'மராத்தி',
  'voice.lang.ta.english': 'தமிழ்',
  'voice.lang.te.english': 'தெலுங்கு',
  'voice.lang.kn.english': 'கன்னடம்',
  'voice.lang.gu.english': 'குஜராத்தி',
  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'மைக் தடுக்கப்பட்டது',
  'voice.error.blocked.body': 'உங்கள் உலாவியின் தள அமைப்புகளில் Settle-க்கு மைக்ரோஃபோனை அனுமதியுங்கள் — அல்லது தட்டச்சு செய்யுங்கள்.',
  'voice.error.noSpeech.title': 'கேட்கவில்லை',
  'voice.error.noSpeech.body': 'மைக்கைத் தட்டி மீண்டும் முயற்சி செய்யுங்கள் — பீப் ஒலிக்குப் பிறகு பேசுங்கள்.',
  'voice.error.noMic.title': 'மைக்ரோஃபோன் கிடைக்கவில்லை',
  'voice.error.noMic.body': 'ஒன்றை இணையுங்கள், அல்லது தட்டச்சு செய்யுங்கள்.',
  'voice.error.network.title': 'குரல் வசதிக்கு இணையம் தேவை',
  'voice.error.network.body': 'உங்கள் உலாவி பேச்சை ஆன்லைனில் உரையாக மாற்றுகிறது. ஆஃப்லைனில் இருக்கும்போது தட்டச்சு செய்யுங்கள்.',
  'voice.error.language.title': '{language} இந்த உலாவியில் கிடைக்கவில்லை',
  'voice.error.language.body': 'ஆங்கிலம் அல்லது हिन्दी முயற்சி செய்யுங்கள், அல்லது தட்டச்சு செய்யுங்கள்.',
  'voice.error.other.title': 'இந்த முறை குரல் வேலை செய்யவில்லை',
  'voice.error.other.body': 'மீண்டும் முயற்சி செய்யுங்கள், அல்லது தட்டச்சு செய்யுங்கள்.',
} as const satisfies Messages
