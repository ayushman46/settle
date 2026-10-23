/** English copy for Activity (src/features/activity). Keys: `activity.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const activity = {
  // The screen.
  'activity.title': 'Activity',
  'activity.newSplit.cta': 'New split',

  // Nothing split yet (first run).
  'activity.firstRun.title': 'Your splits will live here',
  'activity.firstRun.body': "Every expense you split shows up here, newest first — with who's paid you back and who hasn't.",
  'activity.firstRun.split.cta': 'Split an amount',
  'activity.firstRun.scan.cta': 'Scan a bill',

  // A filter with nothing in it.
  'activity.empty.all.title': 'No expenses yet',
  'activity.empty.all.body': 'Split something and it shows up here.',
  'activity.empty.collect.title': 'Nothing to collect',
  'activity.empty.collect.body': "Everyone's paid you back. Nice.",
  'activity.empty.pay.title': "You're all square",
  'activity.empty.pay.body': "You don't owe anyone right now.",
  'activity.empty.bills.title': 'No bills yet',
  // {brand} is the app's name (Settle).
  'activity.empty.bills.body': 'Snap a restaurant bill and {brand} splits it item by item.',
  'activity.empty.groups.title': 'No group expenses yet',
  'activity.empty.groups.body': 'Trips, flats, couples — keep shared costs together in a group.',
  'activity.empty.settled.title': 'Nothing settled yet',
  'activity.empty.settled.body': "Splits land here once everyone's squared up.",
  'activity.empty.scan.cta': 'Scan a bill',
  'activity.empty.groups.cta': 'Go to groups',

  // A search that finds nothing ({query} is what was typed).
  'activity.noMatches.title': 'No matches for “{query}”',
  'activity.noMatches.body': 'Try a name, a place or an amount.',
  'activity.noMatches.cta': 'Show all activity',

  // Groups that aren't square, listed above the splits under "To collect" / "To pay".
  'activity.groups.owed.title': 'Owed to you in groups',
  'activity.groups.owe.title': 'You owe in groups',
  'activity.groups.description': 'Group costs settle up together.',
  'activity.groups.row.subtitle': 'Settle up',
  // Spoken name of a group's row: {group} its name, {amount} formatted money.
  'activity.groups.row.owed.aria': "{group}: You're owed {amount}. Settle up",
  'activity.groups.row.owe.aria': '{group}: You owe {amount}. Settle up',

  // The filter chips.
  'activity.filters.aria': 'Show',
  'activity.filter.all.chip': 'All',
  'activity.filter.collect.chip': 'To collect',
  'activity.filter.pay.chip': 'To pay',
  'activity.filter.bills.chip': 'Bills',
  'activity.filter.groups.chip': 'Groups',
  'activity.filter.settled.chip': 'Settled',
  // Spoken name of a chip with a count bubble: "To collect, 3".
  'activity.filter.counted.aria': '{label}, {count}',

  // The search pill.
  'activity.search.label': 'Search activity',
  'activity.search.placeholder': 'Search names, places or amounts',
  'activity.search.clear.aria': 'Clear search',

  // The line under the chips, summing up what's listed (also read out as the list changes).
  'activity.results.noMatches': 'No matches for “{query}”',
  'activity.results.matches': '{count, plural, one {# match} other {# matches}} for “{query}”',
  'activity.results.nothing.all': 'No expenses yet',
  'activity.results.nothing.collect': 'Nothing to collect',
  'activity.results.nothing.pay': 'Nothing to pay',
  'activity.results.nothing.bills': 'No bills yet',
  'activity.results.nothing.groups': 'No group expenses yet',
  'activity.results.nothing.settled': 'Nothing settled yet',
  'activity.results.all': '{count, plural, one {# expense} other {# expenses}}',
  // {sum}: formatted money, several currencies joined with " + ".
  'activity.results.collect': '{sum} to collect on {count, plural, one {# split} other {# splits}}',
  'activity.results.pay': 'You owe {sum} on {count, plural, one {# split} other {# splits}}',
  'activity.results.bills': '{count, plural, one {# bill} other {# bills}}',
  'activity.results.groups': '{count, plural, one {# group expense} other {# group expenses}}',
  'activity.results.settled': '{count, plural, one {# expense} other {# expenses}} settled',
  // Only groups listed (read by screen readers only).
  'activity.results.owedInGroups': 'Owed to you in {count, plural, one {# group} other {# groups}}',
  'activity.results.oweInGroups': 'You owe in {count, plural, one {# group} other {# groups}}',

  // Month sections.
  'activity.month.undated': 'Undated',
} as const satisfies Messages
