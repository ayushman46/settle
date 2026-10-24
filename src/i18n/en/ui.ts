/** English copy for shared components (src/components). Keys: `ui.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const ui = {
  // Readable lists of names and parts ("Aisha, Ben and Chen"); `{list}` is already joined with ", ".
  'ui.list.none': 'Nobody',
  'ui.list.last': '{list} and {last}',
  'ui.list.others': '{list} and {count, plural, one {# other} other {# others}}',
  // Spoken summary of a chart's biggest parts ("Food 42%, Travel 30% and 2 more").
  'ui.chart.summary.empty': 'No data',
  'ui.chart.summary.more': '{list} and {count} more',
  // Bar chart defaults (callers usually pass their own name).
  'ui.chart.bar.aria': 'Bar chart',
  'ui.chart.bar.period': 'Period',
  'ui.chart.bar.amount': 'Amount',
  'ui.chart.bar.summary.empty': '{label}: no data',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# bar} other {# bars}}, highest {name} at {value}',
  // Donut chart default name, and its spoken summary.
  'ui.chart.donut.aria': 'Breakdown',
  'ui.chart.donut.summary': '{label}: {summary}',
  // The ✕ on an inline banner.
  'ui.banner.dismiss.aria': 'Dismiss',
  // The bottom navigation landmark.
  'ui.tabBar.aria': 'Main',
  // Spoken after a tab or quick action that has a badge.
  'ui.badge.new': 'new',
  'ui.badge.count': '{count} new',
  // Step progress ("Step 2 of 4").
  'ui.progress.step': 'Step {current} of {total}',
  // The − and + buttons of a stepper; `{name}` is what's counted, lower-cased ("quantity").
  'ui.stepper.decrease.aria': 'Decrease {name}',
  'ui.stepper.increase.aria': 'Increase {name}',
  // The emoji grid's group name.
  'ui.emoji.label': 'Emoji',
  // The send arrow in the "Just say it" search pill.
  'ui.search.submit.aria': 'Go',
  // A toast's action button, spoken with the message ("Undo: Expense deleted").
  'ui.toast.action.aria': '{action}: {message}',
  // The QR code's stand-in text when the content is too long for one.
  'ui.qr.tooLong': 'This code is too long to show as a QR.',
  // The hidden example of what to type in the "Just say it" search pill; `{example}` is one of them.
  'ui.search.example': 'For example: {example}',
} as const satisfies Messages
