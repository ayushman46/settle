/** English copy for insights (src/features/insights). Keys: `insights.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'Insights',
  'insights.subtitle': 'Where your money goes',

  // The range chips.
  'insights.range.aria': 'Time range',
  'insights.range.thisMonth': 'This month',
  'insights.range.last3Months': '3 months',
  'insights.range.thisYear': 'This year',
  'insights.range.all': 'All time',

  // Nothing in the range ({range}: this_month, last_3_months, this_year or all).
  'insights.empty.title':
    '{range, select, this_month {Nothing this month yet} last_3_months {Nothing in the last 3 months yet} this_year {Nothing this year yet} other {Nothing since you started yet}}',
  'insights.empty.body': 'Splits you’re part of in this range will show up here. Try a longer range.',
  'insights.empty.first.title': 'Your insights start with your first split',
  'insights.empty.first.body': 'Every split you’re part of shows up here — by category, month and friend.',
  'insights.empty.cta': 'Split an expense',
  'insights.otherCurrency':
    "{count, plural, one {# expense in another currency isn't counted here — amounts are never converted.} other {# expenses in other currencies aren't counted here — amounts are never converted.}}",
  'insights.private': 'Worked out on this phone — nothing is uploaded.',

  // What I spent ({range} as above).
  'insights.spent.title':
    '{range, select, this_month {You spent this month} last_3_months {You spent in the last 3 months} this_year {You spent this year} other {You spent since you started}}',
  'insights.spent.note': 'Your share across {count, plural, one {# expense} other {# expenses}}',
  // After the note, following " · ": the biggest category.
  'insights.spent.top': '{percent}% on {category}',
  'insights.stat.paid': 'You paid up front',
  'insights.stat.perMonth': 'About a month',

  'insights.category.title': 'By category',
  'insights.chart.spent': 'Spent',
  'insights.category.aria': 'Spending by category',
  'insights.month.title': 'By month',
  'insights.month.last': 'The last {count} months',
  'insights.month.aria': 'Spending by month',
  'insights.month.header': 'Month',
  'insights.people.title': 'Who you split with',
  'insights.people.description': 'Your share of what you split with each person',
  'insights.people.count': '{count, plural, one {# shared expense} other {# shared expenses}}',

  // The blurred sketch behind the Pro lock, and the note on it.
  'insights.sample.aria': 'Sample',
  'insights.locked.note': "{count, plural, one {You've split # expense so far — see where it all went.} other {You've split # expenses so far — see where it all went.}}",
} as const satisfies Messages
