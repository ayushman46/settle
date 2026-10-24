/** Bengali copy for shared UI pieces (lists, charts, banners, steppers, toasts). Keys: `ui.<part>.<element>`. */
import type { Messages } from '../types'

export const ui = {
  // Readable lists of names and parts ("Aisha, Ben and Chen"); `{list}` is already joined with ", ".
  'ui.list.none': 'কেউ নেই',
  'ui.list.last': '{list} এবং {last}',
  'ui.list.others': '{list} এবং {count, plural, one {আরও #টি} other {আরও #টি}}',
  // Spoken summary of a chart's biggest parts ("Food 42%, Travel 30% and 2 more").
  'ui.chart.summary.empty': 'কোনো তথ্য নেই',
  'ui.chart.summary.more': '{list} এবং আরও {count}টি',
  // Bar chart defaults (callers usually pass their own name).
  'ui.chart.bar.aria': 'বার চার্ট',
  'ui.chart.bar.period': 'সময়কাল',
  'ui.chart.bar.amount': 'পরিমাণ',
  'ui.chart.bar.summary.empty': '{label}: কোনো তথ্য নেই',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# টি বার} other {# টি বার}}, সবচেয়ে বেশি {name}, {value}',
  // Donut chart default name, and its spoken summary.
  'ui.chart.donut.aria': 'ভাগের হিসাব',
  'ui.chart.donut.summary': '{label}: {summary}',
  // The ✕ on an inline banner.
  'ui.banner.dismiss.aria': 'বন্ধ করুন',
  // The bottom navigation landmark.
  'ui.tabBar.aria': 'মূল মেনু',
  // Spoken after a tab or quick action that has a badge.
  'ui.badge.new': 'নতুন',
  'ui.badge.count': '{count}টি নতুন',
  // Step progress ("Step 2 of 4").
  'ui.progress.step': 'ধাপ {current} / {total}',
  // The − and + buttons of a stepper; `{name}` is what's counted, lower-cased ("quantity").
  'ui.stepper.decrease.aria': '{name} কমান',
  'ui.stepper.increase.aria': '{name} বাড়ান',
  // The emoji grid's group name.
  'ui.emoji.label': 'ইমোজি',
  // The send arrow in the "Just say it" search pill.
  'ui.search.submit.aria': 'যান',
  // A toast's action button, spoken with the message ("Undo: Expense deleted").
  'ui.toast.action.aria': '{action}: {message}',
  // The QR code's stand-in text when the content is too long for one.
  'ui.qr.tooLong': 'এই কোডটি QR হিসেবে দেখানোর জন্য খুব বড়।',
  // The hidden example of what to type in the "Just say it" search pill; `{example}` is one of them.
  'ui.search.example': 'উদাহরণ: {example}',
} as const satisfies Messages
