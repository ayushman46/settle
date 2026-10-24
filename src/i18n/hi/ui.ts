/** Hindi copy for shared components (src/components). Keys: `ui.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const ui = {
  'ui.list.none': 'कोई नहीं',
  'ui.list.last': '{list} और {last}',
  'ui.list.others': '{list} और {count, plural, one {# अन्य} other {# अन्य}}',
  'ui.chart.summary.empty': 'कोई डेटा नहीं',
  'ui.chart.summary.more': '{list} और {count} अन्य',
  'ui.chart.bar.aria': 'बार चार्ट',
  'ui.chart.bar.period': 'समय',
  'ui.chart.bar.amount': 'रकम',
  'ui.chart.bar.summary.empty': '{label}: कोई डेटा नहीं',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# बार} other {# बार}}, सबसे ज़्यादा {name} में {value}',
  'ui.chart.donut.aria': 'ब्योरा',
  'ui.chart.donut.summary': '{label}: {summary}',
  'ui.banner.dismiss.aria': 'हटाएँ',
  'ui.tabBar.aria': 'मुख्य',
  'ui.badge.new': 'नया',
  'ui.badge.count': '{count} नए',
  'ui.progress.step': 'चरण {current} / {total}',
  'ui.stepper.decrease.aria': '{name} घटाएँ',
  'ui.stepper.increase.aria': '{name} बढ़ाएँ',
  'ui.emoji.label': 'इमोजी',
  'ui.search.submit.aria': 'भेजें',
  'ui.toast.action.aria': '{action}: {message}',
  'ui.qr.tooLong': 'यह कोड QR में दिखाने के लिए बहुत लंबा है।',
  'ui.search.example': 'जैसे: {example}',
} as const satisfies Messages
