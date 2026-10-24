/** Marathi copy for shared UI pieces (lists, charts, banners, steppers, toasts). Keys: `ui.<part>.<element>`. */
import type { Messages } from '../types'

export const ui = {
  // Readable lists of names and parts ("Aisha, Ben and Chen"); `{list}` is already joined with ", ".
  'ui.list.none': 'कोणीच नाही',
  'ui.list.last': '{list} आणि {last}',
  'ui.list.others': '{list} आणि {count, plural, one {आणखी #} other {आणखी #}}',
  // Spoken summary of a chart's biggest parts ("Food 42%, Travel 30% and 2 more").
  'ui.chart.summary.empty': 'माहिती नाही',
  'ui.chart.summary.more': '{list} आणि आणखी {count}',
  // Bar chart defaults (callers usually pass their own name).
  'ui.chart.bar.aria': 'बार चार्ट',
  'ui.chart.bar.period': 'कालावधी',
  'ui.chart.bar.amount': 'रक्कम',
  'ui.chart.bar.summary.empty': '{label}: माहिती नाही',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# बार} other {# बार}}, सर्वात जास्त {name}, {value}',
  // Donut chart default name, and its spoken summary.
  'ui.chart.donut.aria': 'विभागणी',
  'ui.chart.donut.summary': '{label}: {summary}',
  // The ✕ on an inline banner.
  'ui.banner.dismiss.aria': 'बंद करा',
  // The bottom navigation landmark.
  'ui.tabBar.aria': 'मुख्य',
  // Spoken after a tab or quick action that has a badge.
  'ui.badge.new': 'नवीन',
  'ui.badge.count': '{count} नवीन',
  // Step progress ("Step 2 of 4").
  'ui.progress.step': 'पायरी {current} / {total}',
  // The − and + buttons of a stepper; `{name}` is what's counted, lower-cased ("quantity").
  'ui.stepper.decrease.aria': '{name} कमी करा',
  'ui.stepper.increase.aria': '{name} वाढवा',
  // The emoji grid's group name.
  'ui.emoji.label': 'इमोजी',
  // The send arrow in the "Just say it" search pill.
  'ui.search.submit.aria': 'जा',
  // A toast's action button, spoken with the message ("Undo: Expense deleted").
  'ui.toast.action.aria': '{action}: {message}',
  // The QR code's stand-in text when the content is too long for one.
  'ui.qr.tooLong': 'हा कोड QR म्हणून दाखवण्यासाठी खूप मोठा आहे.',
  // The hidden example of what to type in the "Just say it" search pill; `{example}` is one of them.
  'ui.search.example': 'उदाहरणार्थ: {example}',
} as const satisfies Messages
