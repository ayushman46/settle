/** Telugu copy for shared components (src/components). Keys: `ui.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const ui = {
  // Readable lists of names and parts ("Aisha, Ben and Chen"); `{list}` is already joined with ", ".
  'ui.list.none': 'ఎవరూ లేరు',
  'ui.list.last': '{list} మరియు {last}',
  'ui.list.others': '{list} మరియు {count, plural, one {# మరొకరు} other {# మంది ఇతరులు}}',
  // Spoken summary of a chart's biggest parts ("Food 42%, Travel 30% and 2 more").
  'ui.chart.summary.empty': 'డేటా లేదు',
  'ui.chart.summary.more': '{list} మరియు మరో {count}',
  // Bar chart defaults (callers usually pass their own name).
  'ui.chart.bar.aria': 'బార్ చార్ట్',
  'ui.chart.bar.period': 'కాలం',
  'ui.chart.bar.amount': 'మొత్తం',
  'ui.chart.bar.summary.empty': '{label}: డేటా లేదు',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# బార్} other {# బార్‌లు}}, ఎక్కువ {name} దగ్గర {value}',
  // Donut chart default name, and its spoken summary.
  'ui.chart.donut.aria': 'వివరాలు',
  'ui.chart.donut.summary': '{label}: {summary}',
  // The ✕ on an inline banner.
  'ui.banner.dismiss.aria': 'మూసివేయండి',
  // The bottom navigation landmark.
  'ui.tabBar.aria': 'ప్రధానం',
  // Spoken after a tab or quick action that has a badge.
  'ui.badge.new': 'కొత్తది',
  'ui.badge.count': '{count} కొత్తవి',
  // Step progress ("Step 2 of 4").
  'ui.progress.step': 'దశ {current} / {total}',
  // The − and + buttons of a stepper; `{name}` is what's counted, lower-cased ("quantity").
  'ui.stepper.decrease.aria': '{name} తగ్గించండి',
  'ui.stepper.increase.aria': '{name} పెంచండి',
  // The emoji grid's group name.
  'ui.emoji.label': 'ఎమోజీ',
  // The send arrow in the "Just say it" search pill.
  'ui.search.submit.aria': 'పంపండి',
  // A toast's action button, spoken with the message ("Undo: Expense deleted").
  'ui.toast.action.aria': '{action}: {message}',
  // The QR code's stand-in text when the content is too long for one.
  'ui.qr.tooLong': 'ఈ కోడ్ QRగా చూపించేందుకు చాలా పొడవుగా ఉంది.',
  // The hidden example of what to type in the "Just say it" search pill; `{example}` is one of them.
  'ui.search.example': 'ఉదాహరణ: {example}',
} as const satisfies Messages
