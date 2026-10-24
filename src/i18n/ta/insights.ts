/** Tamil copy for insights (src/features/insights). Keys: `insights.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'விவரங்கள்',
  'insights.subtitle': 'உங்கள் பணம் எங்கே போகிறது',
  // The range chips.
  'insights.range.aria': 'காலம்',
  'insights.range.thisMonth': 'இந்த மாதம்',
  'insights.range.last3Months': '3 மாதங்கள்',
  'insights.range.thisYear': 'இந்த ஆண்டு',
  'insights.range.all': 'எல்லா காலமும்',
  // Nothing in the range ({range}: this_month, last_3_months, this_year or all).
  'insights.empty.title':
    '{range, select, this_month {இந்த மாதம் இன்னும் எதுவும் இல்லை} last_3_months {கடந்த 3 மாதங்களில் இன்னும் எதுவும் இல்லை} this_year {இந்த ஆண்டு இன்னும் எதுவும் இல்லை} other {நீங்கள் தொடங்கியதிலிருந்து இன்னும் எதுவும் இல்லை}}',
  'insights.empty.body': 'இந்தக் காலத்தில் நீங்கள் பங்கேற்ற பிரிப்புகள் இங்கே தோன்றும். நீண்ட காலத்தை முயற்சி செய்யுங்கள்.',
  'insights.empty.first.title': 'உங்கள் முதல் பிரிப்புடன் விவரங்கள் தொடங்கும்',
  'insights.empty.first.body': 'நீங்கள் பங்கேற்கும் ஒவ்வொரு பிரிப்பும் இங்கே வகை, மாதம், நண்பர் வாரியாகத் தோன்றும்.',
  'insights.empty.cta': 'ஒரு செலவைப் பிரி',
  'insights.otherCurrency':
    '{count, plural, one {வேறு நாணயத்தில் உள்ள # செலவு இங்கே எண்ணப்படாது — தொகைகள் ஒருபோதும் மாற்றப்படுவதில்லை.} other {வேறு நாணயங்களில் உள்ள # செலவுகள் இங்கே எண்ணப்படாது — தொகைகள் ஒருபோதும் மாற்றப்படுவதில்லை.}}',
  'insights.private': 'இந்த ஃபோனிலேயே கணக்கிடப்படுகிறது — எதுவும் பதிவேற்றப்படுவதில்லை.',
  // What I spent ({range} as above).
  'insights.spent.title':
    '{range, select, this_month {இந்த மாதம் நீங்கள் செலவு செய்தது} last_3_months {கடந்த 3 மாதங்களில் நீங்கள் செலவு செய்தது} this_year {இந்த ஆண்டு நீங்கள் செலவு செய்தது} other {நீங்கள் தொடங்கியதிலிருந்து செலவு செய்தது}}',
  'insights.spent.note': '{count, plural, one {# செலவில்} other {# செலவுகளில்}} உங்கள் பங்கு',
  // After the note, following " · ": the biggest category.
  'insights.spent.top': '{category} இல் {percent}%',
  'insights.stat.paid': 'நீங்கள் முன்பணமாகச் செலுத்தியது',
  'insights.stat.perMonth': 'சுமார் ஒரு மாதம்',
  'insights.category.title': 'வகை வாரியாக',
  'insights.chart.spent': 'செலவு',
  'insights.category.aria': 'வகை வாரியான செலவு',
  'insights.month.title': 'மாத வாரியாக',
  'insights.month.last': 'கடந்த {count} மாதங்கள்',
  'insights.month.aria': 'மாத வாரியான செலவு',
  'insights.month.header': 'மாதம்',
  'insights.people.title': 'நீங்கள் யாருடன் பிரித்தீர்கள்',
  'insights.people.description': 'ஒவ்வொருவருடனும் பிரித்ததில் உங்கள் பங்கு',
  'insights.people.count': '{count, plural, one {# பகிர்ந்த செலவு} other {# பகிர்ந்த செலவுகள்}}',
  // The blurred sketch behind the Pro lock, and the note on it.
  'insights.sample.aria': 'மாதிரி',
  'insights.locked.note': '{count, plural, one {இதுவரை # செலவைப் பிரித்துள்ளீர்கள் — எல்லாம் எங்கே போனது என்று பாருங்கள்.} other {இதுவரை # செலவுகளைப் பிரித்துள்ளீர்கள் — எல்லாம் எங்கே போனது என்று பாருங்கள்.}}',
} as const satisfies Messages
