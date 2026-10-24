/** Marathi copy for Insights (where the money goes). Keys: `insights.<area>.<element>`. */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'विश्लेषण',
  'insights.subtitle': 'पैसे कुठे जातात',

  // The range chips.
  'insights.range.aria': 'कालावधी',
  'insights.range.thisMonth': 'हा महिना',
  'insights.range.last3Months': '3 महिने',
  'insights.range.thisYear': 'हे वर्ष',
  'insights.range.all': 'सर्व वेळ',

  // Nothing in the range ({range}: this_month, last_3_months, this_year or all).
  'insights.empty.title':
    '{range, select, this_month {या महिन्यात अजून काही नाही} last_3_months {गेल्या 3 महिन्यांत अजून काही नाही} this_year {या वर्षी अजून काही नाही} other {तुम्ही सुरुवात केल्यापासून अजून काही नाही}}',
  'insights.empty.body': 'या कालावधीत तुम्ही असलेल्या वाटण्या इथे दिसतील. मोठा कालावधी निवडून पहा.',
  'insights.empty.first.title': 'तुमची पहिली वाटणी झाल्यावर विश्लेषण सुरू होईल',
  'insights.empty.first.body': 'तुम्ही असलेली प्रत्येक वाटणी इथे दिसेल — वर्ग, महिना आणि मित्रानुसार.',
  'insights.empty.cta': 'एक खर्च वाटा',
  'insights.otherCurrency':
    '{count, plural, one {दुसऱ्या चलनातील # खर्च इथे मोजलेला नाही — रक्कम कधीही बदलली जात नाही.} other {दुसऱ्या चलनांतील # खर्च इथे मोजलेले नाहीत — रक्कम कधीही बदलली जात नाही.}}',
  'insights.private': 'हे या फोनवरच मोजले जाते — काहीही अपलोड होत नाही.',

  // What I spent ({range} as above).
  'insights.spent.title':
    '{range, select, this_month {या महिन्यात तुम्ही खर्च केले} last_3_months {गेल्या 3 महिन्यांत तुम्ही खर्च केले} this_year {या वर्षी तुम्ही खर्च केले} other {तुम्ही सुरुवात केल्यापासून खर्च केले}}',
  'insights.spent.note': '{count, plural, one {# खर्चातील तुमचा हिस्सा} other {# खर्चांतील तुमचा हिस्सा}}',
  // After the note, following " · ": the biggest category.
  'insights.spent.top': '{percent}% {category} वर',
  'insights.stat.paid': 'तुम्ही आधीच दिले',
  'insights.stat.perMonth': 'दर महिन्याला सुमारे',

  'insights.category.title': 'वर्गानुसार',
  'insights.chart.spent': 'खर्च',
  'insights.category.aria': 'वर्गानुसार खर्च',
  'insights.month.title': 'महिन्यानुसार',
  'insights.month.last': 'गेले {count} महिने',
  'insights.month.aria': 'महिन्यानुसार खर्च',
  'insights.month.header': 'महिना',
  'insights.people.title': 'ज्यांच्यासोबत वाटता',
  'insights.people.description': 'प्रत्येकासोबत वाटलेल्या खर्चातील तुमचा हिस्सा',
  'insights.people.count': '{count, plural, one {# सामायिक खर्च} other {# सामायिक खर्च}}',

  // The blurred sketch behind the Pro lock, and the note on it.
  'insights.sample.aria': 'नमुना',
  'insights.locked.note': '{count, plural, one {तुम्ही आतापर्यंत # खर्च वाटला आहे — सगळे पैसे कुठे गेले ते पहा.} other {तुम्ही आतापर्यंत # खर्च वाटले आहेत — सगळे पैसे कुठे गेले ते पहा.}}',
} as const satisfies Messages
