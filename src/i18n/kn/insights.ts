/** Kannada copy for insights (src/features/insights). Keys: `insights.<screen>.<element>`. */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'ಇನ್‌ಸೈಟ್‌ಗಳು',
  'insights.subtitle': 'ನಿಮ್ಮ ಹಣ ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದೆ',

  'insights.range.aria': 'ಸಮಯದ ವ್ಯಾಪ್ತಿ',
  'insights.range.thisMonth': 'ಈ ತಿಂಗಳು',
  'insights.range.last3Months': '3 ತಿಂಗಳು',
  'insights.range.thisYear': 'ಈ ವರ್ಷ',
  'insights.range.all': 'ಎಲ್ಲ ಸಮಯ',

  'insights.empty.title':
    '{range, select, this_month {ಈ ತಿಂಗಳು ಇನ್ನೂ ಏನೂ ಇಲ್ಲ} last_3_months {ಕಳೆದ 3 ತಿಂಗಳಲ್ಲಿ ಇನ್ನೂ ಏನೂ ಇಲ್ಲ} this_year {ಈ ವರ್ಷ ಇನ್ನೂ ಏನೂ ಇಲ್ಲ} other {ನೀವು ಶುರು ಮಾಡಿದಾಗಿನಿಂದ ಇನ್ನೂ ಏನೂ ಇಲ್ಲ}}',
  'insights.empty.body': 'ಈ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ನೀವಿರುವ ಸ್ಪ್ಲಿಟ್‌ಗಳು ಇಲ್ಲಿ ತೋರಿಸುತ್ತವೆ. ಇನ್ನೂ ದೀರ್ಘ ವ್ಯಾಪ್ತಿ ಪ್ರಯತ್ನಿಸಿ.',
  'insights.empty.first.title': 'ನಿಮ್ಮ ಇನ್‌ಸೈಟ್‌ಗಳು ನಿಮ್ಮ ಮೊದಲ ಸ್ಪ್ಲಿಟ್‌ನಿಂದ ಶುರುವಾಗುತ್ತವೆ',
  'insights.empty.first.body': 'ನೀವಿರುವ ಪ್ರತಿ ಸ್ಪ್ಲಿಟ್ ಇಲ್ಲಿ ತೋರಿಸುತ್ತದೆ — ವರ್ಗ, ತಿಂಗಳು ಮತ್ತು ಸ್ನೇಹಿತರ ಪ್ರಕಾರ.',
  'insights.empty.cta': 'ಒಂದು ಖರ್ಚನ್ನು ಹಂಚಿ',
  'insights.otherCurrency':
    '{count, plural, one {ಬೇರೆ ಕರೆನ್ಸಿಯಲ್ಲಿರುವ # ಖರ್ಚನ್ನು ಇಲ್ಲಿ ಎಣಿಸಲಾಗಿಲ್ಲ — ಮೊತ್ತಗಳನ್ನು ಎಂದಿಗೂ ಪರಿವರ್ತಿಸುವುದಿಲ್ಲ.} other {ಬೇರೆ ಕರೆನ್ಸಿಗಳಲ್ಲಿರುವ # ಖರ್ಚುಗಳನ್ನು ಇಲ್ಲಿ ಎಣಿಸಲಾಗಿಲ್ಲ — ಮೊತ್ತಗಳನ್ನು ಎಂದಿಗೂ ಪರಿವರ್ತಿಸುವುದಿಲ್ಲ.}}',
  'insights.private': 'ಈ ಫೋನ್‌ನಲ್ಲೇ ಲೆಕ್ಕ ಹಾಕಲಾಗುತ್ತದೆ — ಏನನ್ನೂ ಅಪ್‌ಲೋಡ್ ಮಾಡಲಾಗುವುದಿಲ್ಲ.',

  'insights.spent.title':
    '{range, select, this_month {ಈ ತಿಂಗಳು ನೀವು ಖರ್ಚು ಮಾಡಿದ್ದು} last_3_months {ಕಳೆದ 3 ತಿಂಗಳಲ್ಲಿ ನೀವು ಖರ್ಚು ಮಾಡಿದ್ದು} this_year {ಈ ವರ್ಷ ನೀವು ಖರ್ಚು ಮಾಡಿದ್ದು} other {ನೀವು ಶುರು ಮಾಡಿದಾಗಿನಿಂದ ನೀವು ಖರ್ಚು ಮಾಡಿದ್ದು}}',
  'insights.spent.note': '{count, plural, one {# ಖರ್ಚಿನಲ್ಲಿ} other {# ಖರ್ಚುಗಳಲ್ಲಿ}} ನಿಮ್ಮ ಪಾಲು',
  'insights.spent.top': '{category} ಮೇಲೆ {percent}%',
  'insights.stat.paid': 'ನೀವು ಮುಂಗಡವಾಗಿ ಕೊಟ್ಟದ್ದು',
  'insights.stat.perMonth': 'ತಿಂಗಳಿಗೆ ಸುಮಾರು',

  'insights.category.title': 'ವರ್ಗದ ಪ್ರಕಾರ',
  'insights.chart.spent': 'ಖರ್ಚು',
  'insights.category.aria': 'ವರ್ಗದ ಪ್ರಕಾರ ಖರ್ಚು',
  'insights.month.title': 'ತಿಂಗಳ ಪ್ರಕಾರ',
  'insights.month.last': 'ಕಳೆದ {count} ತಿಂಗಳುಗಳು',
  'insights.month.aria': 'ತಿಂಗಳ ಪ್ರಕಾರ ಖರ್ಚು',
  'insights.month.header': 'ತಿಂಗಳು',
  'insights.people.title': 'ಯಾರೊಂದಿಗೆ ಹಂಚಿದ್ದೀರಿ',
  'insights.people.description': 'ಪ್ರತಿ ವ್ಯಕ್ತಿಯೊಂದಿಗೆ ಹಂಚಿದ್ದರಲ್ಲಿ ನಿಮ್ಮ ಪಾಲು',
  'insights.people.count': '{count, plural, one {# ಹಂಚಿದ ಖರ್ಚು} other {# ಹಂಚಿದ ಖರ್ಚುಗಳು}}',

  'insights.sample.aria': 'ಮಾದರಿ',
  'insights.locked.note':
    "{count, plural, one {ನೀವು ಇದುವರೆಗೆ # ಖರ್ಚನ್ನು ಹಂಚಿದ್ದೀರಿ — ಎಲ್ಲಿ ಎಷ್ಟು ಹೋಯಿತು ನೋಡಿ.} other {ನೀವು ಇದುವರೆಗೆ # ಖರ್ಚುಗಳನ್ನು ಹಂಚಿದ್ದೀರಿ — ಎಲ್ಲಿ ಎಷ್ಟು ಹೋಯಿತು ನೋಡಿ.}}",
} as const satisfies Messages
