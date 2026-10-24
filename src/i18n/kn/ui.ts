/** Kannada copy for shared components (src/components). Keys: `ui.<screen>.<element>`. */
import type { Messages } from '../types'

export const ui = {
  'ui.list.none': 'ಯಾರೂ ಇಲ್ಲ',
  'ui.list.last': '{list} ಮತ್ತು {last}',
  'ui.list.others': '{list} ಮತ್ತು {count, plural, one {# ಇನ್ನೊಬ್ಬರು} other {# ಇತರರು}}',
  'ui.chart.summary.empty': 'ಯಾವುದೇ ಡೇಟಾ ಇಲ್ಲ',
  'ui.chart.summary.more': '{list} ಮತ್ತು {count} ಇನ್ನಷ್ಟು',
  'ui.chart.bar.aria': 'ಬಾರ್ ಚಾರ್ಟ್',
  'ui.chart.bar.period': 'ಅವಧಿ',
  'ui.chart.bar.amount': 'ಮೊತ್ತ',
  'ui.chart.bar.summary.empty': '{label}: ಯಾವುದೇ ಡೇಟಾ ಇಲ್ಲ',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# ಬಾರ್} other {# ಬಾರ್‌ಗಳು}}, ಅತಿ ಹೆಚ್ಚು {name} ನಲ್ಲಿ {value}',
  'ui.chart.donut.aria': 'ವಿವರ',
  'ui.chart.donut.summary': '{label}: {summary}',
  'ui.banner.dismiss.aria': 'ಮುಚ್ಚಿ',
  'ui.tabBar.aria': 'ಮುಖ್ಯ',
  'ui.badge.new': 'ಹೊಸ',
  'ui.badge.count': '{count} ಹೊಸವು',
  'ui.progress.step': 'ಹಂತ {current} / {total}',
  'ui.stepper.decrease.aria': '{name} ಕಡಿಮೆ ಮಾಡಿ',
  'ui.stepper.increase.aria': '{name} ಹೆಚ್ಚಿಸಿ',
  'ui.emoji.label': 'ಎಮೋಜಿ',
  'ui.search.submit.aria': 'ಹೋಗಿ',
  'ui.toast.action.aria': '{action}: {message}',
  'ui.qr.tooLong': 'ಈ ಕೋಡ್ QR ಆಗಿ ತೋರಿಸಲು ತುಂಬಾ ಉದ್ದವಾಗಿದೆ.',
  'ui.search.example': 'ಉದಾಹರಣೆಗೆ: {example}',
} as const satisfies Messages
