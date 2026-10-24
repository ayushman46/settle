/** Bengali copy for Activity (the list of every split, search and filters). Keys: `activity.<part>.<element>`. */
import type { Messages } from '../types'

export const activity = {
  // The screen.
  'activity.title': 'লেনদেন',
  'activity.newSplit.cta': 'নতুন ভাগ',

  // Nothing split yet (first run).
  'activity.firstRun.title': 'আপনার ভাগগুলো এখানে থাকবে',
  'activity.firstRun.body': 'আপনি যে খরচই ভাগ করুন, সব এখানে দেখাবে — সবচেয়ে নতুনটি আগে। কে টাকা ফেরত দিয়েছেন আর কে দেননি, সেটিও।',
  'activity.firstRun.split.cta': 'টাকা ভাগ করুন',
  'activity.firstRun.scan.cta': 'বিল স্ক্যান করুন',

  // A filter with nothing in it.
  'activity.empty.all.title': 'এখনও কোনো খরচ নেই',
  'activity.empty.all.body': 'কিছু ভাগ করুন, এখানে দেখতে পাবেন।',
  'activity.empty.collect.title': 'তোলার কিছু নেই',
  'activity.empty.collect.body': 'সবাই টাকা ফেরত দিয়েছেন। দারুণ।',
  'activity.empty.pay.title': 'আপনার হিসাব মিটে গেছে',
  'activity.empty.pay.body': 'এই মুহূর্তে আপনি কারও কাছে দেনা রাখেননি।',
  'activity.empty.bills.title': 'এখনও কোনো বিল নেই',
  // {brand} is the app's name (Settle).
  'activity.empty.bills.body': 'একটি রেস্টুরেন্টের বিলের ছবি তুলুন, {brand} সেটি আইটেম ধরে ধরে ভাগ করে দেবে।',
  'activity.empty.groups.title': 'এখনও গ্রুপের কোনো খরচ নেই',
  'activity.empty.groups.body': 'ট্রিপ, ফ্ল্যাট, বন্ধুদের দল — যৌথ খরচগুলো একটি গ্রুপে রাখুন।',
  'activity.empty.settled.title': 'এখনও কিছু মেটেনি',
  'activity.empty.settled.body': 'সবাই হিসাব মিটিয়ে নিলে ভাগগুলো এখানে আসবে।',
  'activity.empty.scan.cta': 'বিল স্ক্যান করুন',
  'activity.empty.groups.cta': 'গ্রুপে যান',

  // A search that finds nothing ({query} is what was typed).
  'activity.noMatches.title': '“{query}”-এর জন্য কিছু মেলেনি',
  'activity.noMatches.body': 'একটি নাম, জায়গা বা পরিমাণ লিখে দেখুন।',
  'activity.noMatches.cta': 'সব লেনদেন দেখান',

  // Groups that aren't square, listed above the splits under "To collect" / "To pay".
  'activity.groups.owed.title': 'গ্রুপে আপনার পাওনা',
  'activity.groups.owe.title': 'গ্রুপে আপনার দেনা',
  'activity.groups.description': 'গ্রুপের খরচ একসঙ্গে মেটানো হয়।',
  'activity.groups.row.subtitle': 'হিসাব মেটান',
  // Spoken name of a group's row: {group} its name, {amount} formatted money.
  'activity.groups.row.owed.aria': '{group}: আপনার {amount} পাওনা। হিসাব মেটান',
  'activity.groups.row.owe.aria': '{group}: আপনার {amount} দেনা। হিসাব মেটান',

  // The filter chips.
  'activity.filters.aria': 'দেখান',
  'activity.filter.all.chip': 'সব',
  'activity.filter.collect.chip': 'তুলতে হবে',
  'activity.filter.pay.chip': 'দিতে হবে',
  'activity.filter.bills.chip': 'বিল',
  'activity.filter.groups.chip': 'গ্রুপ',
  'activity.filter.settled.chip': 'মেটানো',
  // Spoken name of a chip with a count bubble: "To collect, 3".
  'activity.filter.counted.aria': '{label}, {count}',

  // The search pill.
  'activity.search.label': 'লেনদেন খুঁজুন',
  'activity.search.placeholder': 'নাম, জায়গা বা পরিমাণ খুঁজুন',
  'activity.search.clear.aria': 'খোঁজা মুছুন',

  // The line under the chips, summing up what's listed (also read out as the list changes).
  'activity.results.noMatches': '“{query}”-এর জন্য কিছু মেলেনি',
  'activity.results.matches': '{count, plural, one {“{query}”-এর জন্য # টি মিল} other {“{query}”-এর জন্য # টি মিল}}',
  'activity.results.nothing.all': 'এখনও কোনো খরচ নেই',
  'activity.results.nothing.collect': 'তোলার কিছু নেই',
  'activity.results.nothing.pay': 'দেওয়ার কিছু নেই',
  'activity.results.nothing.bills': 'এখনও কোনো বিল নেই',
  'activity.results.nothing.groups': 'এখনও গ্রুপের কোনো খরচ নেই',
  'activity.results.nothing.settled': 'এখনও কিছু মেটেনি',
  'activity.results.all': '{count, plural, one {# টি খরচ} other {# টি খরচ}}',
  // {sum}: formatted money, several currencies joined with " + ".
  'activity.results.collect': '{sum} তুলতে হবে, {count, plural, one {# টি ভাগে} other {# টি ভাগে}}',
  'activity.results.pay': '{count, plural, one {# টি ভাগে} other {# টি ভাগে}} আপনার দেনা {sum}',
  'activity.results.bills': '{count, plural, one {# টি বিল} other {# টি বিল}}',
  'activity.results.groups': '{count, plural, one {# টি গ্রুপ খরচ} other {# টি গ্রুপ খরচ}}',
  'activity.results.settled': '{count, plural, one {# টি খরচ} other {# টি খরচ}} মেটানো হয়েছে',
  // Only groups listed (read by screen readers only).
  'activity.results.owedInGroups': '{count, plural, one {# টি গ্রুপে} other {# টি গ্রুপে}} আপনার পাওনা',
  'activity.results.oweInGroups': '{count, plural, one {# টি গ্রুপে} other {# টি গ্রুপে}} আপনার দেনা',

  // Month sections.
  'activity.month.undated': 'তারিখবিহীন',
} as const satisfies Messages
