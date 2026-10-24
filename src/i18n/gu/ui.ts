/** Gujarati copy for shared components (src/components). Keys: `ui.<screen>.<element>`. */
import type { Messages } from '../types'

export const ui = {
  'ui.list.none': 'કોઈ નહીં',
  'ui.list.last': '{list} અને {last}',
  'ui.list.others': '{list} અને {count, plural, one {# બીજું} other {# બીજા}}',
  'ui.chart.summary.empty': 'કોઈ ડેટા નથી',
  'ui.chart.summary.more': '{list} અને {count} વધુ',
  'ui.chart.bar.aria': 'બાર ચાર્ટ',
  'ui.chart.bar.period': 'સમયગાળો',
  'ui.chart.bar.amount': 'રકમ',
  'ui.chart.bar.summary.empty': '{label}: કોઈ ડેટા નથી',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# બાર} other {# બાર}}, સૌથી વધુ {name} માં {value}',
  'ui.chart.donut.aria': 'વિગત',
  'ui.chart.donut.summary': '{label}: {summary}',
  'ui.banner.dismiss.aria': 'બંધ કરો',
  'ui.tabBar.aria': 'મુખ્ય',
  'ui.badge.new': 'નવું',
  'ui.badge.count': '{count} નવા',
  'ui.progress.step': 'પગલું {current} / {total}',
  'ui.stepper.decrease.aria': '{name} ઘટાડો',
  'ui.stepper.increase.aria': '{name} વધારો',
  'ui.emoji.label': 'ઇમોજી',
  'ui.search.submit.aria': 'જાઓ',
  'ui.toast.action.aria': '{action}: {message}',
  'ui.qr.tooLong': 'આ કોડ QR તરીકે બતાવવા માટે બહુ લાંબો છે.',
  'ui.search.example': 'દાખલા તરીકે: {example}',
} as const satisfies Messages
