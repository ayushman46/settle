/** Telugu copy for insights (src/features/insights). Keys: `insights.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'ఇన్‌సైట్‌లు',
  'insights.subtitle': 'మీ డబ్బు ఎక్కడికి పోతోంది',
  // The range chips.
  'insights.range.aria': 'సమయ పరిధి',
  'insights.range.thisMonth': 'ఈ నెల',
  'insights.range.last3Months': '3 నెలలు',
  'insights.range.thisYear': 'ఈ సంవత్సరం',
  'insights.range.all': 'అన్ని సమయం',
  // Nothing in the range ({range}: this_month, last_3_months, this_year or all).
  'insights.empty.title':
    '{range, select, this_month {ఈ నెల ఇంకా ఏమీ లేదు} last_3_months {గత 3 నెలల్లో ఇంకా ఏమీ లేదు} this_year {ఈ సంవత్సరం ఇంకా ఏమీ లేదు} other {మీరు మొదలుపెట్టినప్పటి నుంచి ఇంకా ఏమీ లేదు}}',
  'insights.empty.body': 'ఈ పరిధిలో మీరు పాలుపంచుకున్న స్ప్లిట్‌లు ఇక్కడ కనిపిస్తాయి. ఎక్కువ కాలం పరిధిని ప్రయత్నించండి.',
  'insights.empty.first.title': 'మీ మొదటి స్ప్లిట్‌తో ఇన్‌సైట్‌లు మొదలవుతాయి',
  'insights.empty.first.body': 'మీరు పాల్గొన్న ప్రతి స్ప్లిట్ ఇక్కడ వర్గం, నెల, స్నేహితుడి వారీగా కనిపిస్తుంది.',
  'insights.empty.cta': 'ఒక ఖర్చును పంచండి',
  'insights.otherCurrency':
    '{count, plural, one {వేరే కరెన్సీలో ఉన్న # ఖర్చు ఇక్కడ లెక్కించబడదు — మొత్తాలను ఎప్పుడూ మార్చరు.} other {వేరే కరెన్సీల్లో ఉన్న # ఖర్చులు ఇక్కడ లెక్కించబడవు — మొత్తాలను ఎప్పుడూ మార్చరు.}}',
  'insights.private': 'ఈ ఫోన్‌లోనే లెక్కించబడుతుంది — ఏదీ అప్‌లోడ్ కాదు.',
  // What I spent ({range} as above).
  'insights.spent.title':
    '{range, select, this_month {ఈ నెల మీరు ఖర్చు చేసింది} last_3_months {గత 3 నెలల్లో మీరు ఖర్చు చేసింది} this_year {ఈ సంవత్సరం మీరు ఖర్చు చేసింది} other {మీరు మొదలుపెట్టినప్పటి నుంచి ఖర్చు చేసింది}}',
  'insights.spent.note': '{count, plural, one {# ఖర్చులో} other {# ఖర్చుల్లో}} మీ వాటా',
  // After the note, following " · ": the biggest category.
  'insights.spent.top': '{category} లో {percent}%',
  'insights.stat.paid': 'మీరు ముందుగా చెల్లించింది',
  'insights.stat.perMonth': 'సుమారు ఒక నెల',
  'insights.category.title': 'వర్గం వారీగా',
  'insights.chart.spent': 'ఖర్చు',
  'insights.category.aria': 'వర్గం వారీగా ఖర్చు',
  'insights.month.title': 'నెల వారీగా',
  'insights.month.last': 'గత {count} నెలలు',
  'insights.month.aria': 'నెల వారీగా ఖర్చు',
  'insights.month.header': 'నెల',
  'insights.people.title': 'మీరు ఎవరితో పంచారు',
  'insights.people.description': 'ప్రతి ఒక్కరితో పంచిన దానిలో మీ వాటా',
  'insights.people.count': '{count, plural, one {# షేర్ ఖర్చు} other {# షేర్ ఖర్చులు}}',
  // The blurred sketch behind the Pro lock, and the note on it.
  'insights.sample.aria': 'నమూనా',
  'insights.locked.note': '{count, plural, one {ఇప్పటివరకు # ఖర్చు పంచారు — అంతా ఎక్కడికి పోయిందో చూడండి.} other {ఇప్పటివరకు # ఖర్చులు పంచారు — అంతా ఎక్కడికి పోయిందో చూడండి.}}',
} as const satisfies Messages
