/** Tamil copy for shared components (src/components). Keys: `ui.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const ui = {
  // Readable lists of names and parts ("Aisha, Ben and Chen"); `{list}` is already joined with ", ".
  'ui.list.none': 'யாருமில்லை',
  'ui.list.last': '{list} மற்றும் {last}',
  'ui.list.others': '{list} மற்றும் {count, plural, one {# மற்றவர்} other {# மற்றவர்கள்}}',
  // Spoken summary of a chart's biggest parts ("Food 42%, Travel 30% and 2 more").
  'ui.chart.summary.empty': 'தரவு இல்லை',
  'ui.chart.summary.more': '{list} மற்றும் மேலும் {count}',
  // Bar chart defaults (callers usually pass their own name).
  'ui.chart.bar.aria': 'பார் வரைபடம்',
  'ui.chart.bar.period': 'காலம்',
  'ui.chart.bar.amount': 'தொகை',
  'ui.chart.bar.summary.empty': '{label}: தரவு இல்லை',
  'ui.chart.bar.summary': '{label}: {count, plural, one {# பார்} other {# பார்கள்}}, அதிகபட்சம் {name}: {value}',
  // Donut chart default name, and its spoken summary.
  'ui.chart.donut.aria': 'விவரம்',
  'ui.chart.donut.summary': '{label}: {summary}',
  // The ✕ on an inline banner.
  'ui.banner.dismiss.aria': 'மூடு',
  // The bottom navigation landmark.
  'ui.tabBar.aria': 'முக்கிய',
  // Spoken after a tab or quick action that has a badge.
  'ui.badge.new': 'புதியது',
  'ui.badge.count': '{count} புதியவை',
  // Step progress ("Step 2 of 4").
  'ui.progress.step': 'படி {current} / {total}',
  // The − and + buttons of a stepper; `{name}` is what's counted, lower-cased ("quantity").
  'ui.stepper.decrease.aria': '{name} குறை',
  'ui.stepper.increase.aria': '{name} கூட்டு',
  // The emoji grid's group name.
  'ui.emoji.label': 'எமோஜி',
  // The send arrow in the "Just say it" search pill.
  'ui.search.submit.aria': 'அனுப்பு',
  // A toast's action button, spoken with the message ("Undo: Expense deleted").
  'ui.toast.action.aria': '{action}: {message}',
  // The QR code's stand-in text when the content is too long for one.
  'ui.qr.tooLong': 'இந்தக் குறியீடு QR ஆகக் காட்டுவதற்கு மிக நீளமானது.',
  // The hidden example of what to type in the "Just say it" search pill; `{example}` is one of them.
  'ui.search.example': 'உதாரணம்: {example}',
} as const satisfies Messages
