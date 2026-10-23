/** Hindi copy for insights (src/features/insights). Keys: `insights.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'इनसाइट्स',
  'insights.subtitle': 'आपका पैसा कहाँ जाता है',

  'insights.range.aria': 'समय',
  'insights.range.thisMonth': 'इस महीने',
  'insights.range.last3Months': '3 महीने',
  'insights.range.thisYear': 'इस साल',
  'insights.range.all': 'अब तक',

  'insights.empty.title':
    '{range, select, this_month {इस महीने अभी कुछ नहीं} last_3_months {पिछले 3 महीनों में अभी कुछ नहीं} this_year {इस साल अभी कुछ नहीं} other {अभी तक कुछ नहीं}}',
  'insights.empty.body': 'इस समय में जिन खर्चों में आप शामिल हैं, वे यहाँ दिखेंगे। लंबा समय चुनकर देखें।',
  'insights.empty.first.title': 'आपकी इनसाइट्स पहले खर्च से शुरू होंगी',
  'insights.empty.first.body': 'जिस भी खर्च में आप शामिल हैं, वह यहाँ दिखेगा — कैटेगरी, महीने और दोस्त के हिसाब से।',
  'insights.empty.cta': 'खर्च बाँटें',
  'insights.otherCurrency':
    '{count, plural, one {दूसरी करेंसी का # खर्च यहाँ नहीं गिना गया — रकम कभी बदली नहीं जाती।} other {दूसरी करेंसी के # खर्चे यहाँ नहीं गिने गए — रकम कभी बदली नहीं जाती।}}',
  'insights.private': 'सब इसी फ़ोन पर निकाला गया — कुछ भी अपलोड नहीं होता।',

  'insights.spent.title':
    '{range, select, this_month {इस महीने आपका खर्च} last_3_months {पिछले 3 महीनों में आपका खर्च} this_year {इस साल आपका खर्च} other {अब तक आपका खर्च}}',
  'insights.spent.note': '{count, plural, one {# खर्च में आपका हिस्सा} other {# खर्चों में आपका हिस्सा}}',
  'insights.spent.top': '{category} पर {percent}%',
  'insights.stat.paid': 'आपने पहले चुकाए',
  'insights.stat.perMonth': 'हर महीने करीब',

  'insights.category.title': 'कैटेगरी के हिसाब से',
  'insights.chart.spent': 'खर्च',
  'insights.category.aria': 'कैटेगरी के हिसाब से खर्च',
  'insights.month.title': 'महीने के हिसाब से',
  'insights.month.last': 'पिछले {count} महीने',
  'insights.month.aria': 'महीने के हिसाब से खर्च',
  'insights.month.header': 'महीना',
  'insights.people.title': 'किनके साथ बाँटा',
  'insights.people.description': 'हर व्यक्ति के साथ बाँटे गए खर्च में आपका हिस्सा',
  'insights.people.count': '{count, plural, one {# साझा खर्च} other {# साझा खर्चे}}',

  'insights.sample.aria': 'नमूना',
  'insights.locked.note': '{count, plural, one {आप अब तक # खर्च बाँट चुके हैं — देखें पैसा कहाँ गया।} other {आप अब तक # खर्चे बाँट चुके हैं — देखें पैसा कहाँ गया।}}',
} as const satisfies Messages
