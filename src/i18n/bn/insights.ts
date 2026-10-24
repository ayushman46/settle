/** Bengali copy for Insights (where the money goes). Keys: `insights.<area>.<element>`. */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'বিশ্লেষণ',
  'insights.subtitle': 'টাকা কোথায় যাচ্ছে',

  // The range chips.
  'insights.range.aria': 'সময়সীমা',
  'insights.range.thisMonth': 'এই মাস',
  'insights.range.last3Months': '3 মাস',
  'insights.range.thisYear': 'এই বছর',
  'insights.range.all': 'সব সময়',

  // Nothing in the range ({range}: this_month, last_3_months, this_year or all).
  'insights.empty.title':
    '{range, select, this_month {এই মাসে এখনও কিছু নেই} last_3_months {গত 3 মাসে এখনও কিছু নেই} this_year {এই বছর এখনও কিছু নেই} other {আপনার শুরু থেকে এখনও কিছু নেই}}',
  'insights.empty.body': 'এই সময়সীমায় আপনি যেসব ভাগে আছেন সেগুলো এখানে দেখাবে। আরও বড় সময়সীমা বেছে নিন।',
  'insights.empty.first.title': 'প্রথম ভাগ দিয়ে আপনার বিশ্লেষণ শুরু হবে',
  'insights.empty.first.body': 'আপনি যেসব ভাগে আছেন সেগুলো এখানে দেখাবে — বিভাগ, মাস আর বন্ধু অনুযায়ী।',
  'insights.empty.cta': 'একটি খরচ ভাগ করুন',
  'insights.otherCurrency':
    '{count, plural, one {অন্য মুদ্রার # টি খরচ এখানে গোনা হয়নি — পরিমাণ কখনও বদলানো হয় না।} other {অন্য মুদ্রার # টি খরচ এখানে গোনা হয়নি — পরিমাণ কখনও বদলানো হয় না।}}',
  'insights.private': 'এই ফোনেই হিসাব হয় — কিছু আপলোড হয় না।',

  // What I spent ({range} as above).
  'insights.spent.title':
    '{range, select, this_month {আপনি এই মাসে খরচ করেছেন} last_3_months {আপনি গত 3 মাসে খরচ করেছেন} this_year {আপনি এই বছর খরচ করেছেন} other {আপনি শুরু থেকে খরচ করেছেন}}',
  'insights.spent.note': '{count, plural, one {#টি খরচ জুড়ে আপনার ভাগ} other {#টি খরচ জুড়ে আপনার ভাগ}}',
  // After the note, following " · ": the biggest category.
  'insights.spent.top': '{category}-এ {percent}%',
  'insights.stat.paid': 'আপনি আগেই দিয়েছেন',
  'insights.stat.perMonth': 'প্রতি মাসে প্রায়',

  'insights.category.title': 'বিভাগ অনুযায়ী',
  'insights.chart.spent': 'খরচ',
  'insights.category.aria': 'বিভাগ অনুযায়ী খরচ',
  'insights.month.title': 'মাস অনুযায়ী',
  'insights.month.last': 'শেষ {count} মাস',
  'insights.month.aria': 'মাস অনুযায়ী খরচ',
  'insights.month.header': 'মাস',
  'insights.people.title': 'যাদের সঙ্গে ভাগ করেন',
  'insights.people.description': 'প্রত্যেকের সঙ্গে ভাগ করা খরচে আপনার অংশ',
  'insights.people.count': '{count, plural, one {# টি ভাগ করা খরচ} other {# টি ভাগ করা খরচ}}',

  // The blurred sketch behind the Pro lock, and the note on it.
  'insights.sample.aria': 'নমুনা',
  'insights.locked.note': '{count, plural, one {এখন পর্যন্ত আপনি # টি খরচ ভাগ করেছেন — সব টাকা কোথায় গেল দেখুন।} other {এখন পর্যন্ত আপনি # টি খরচ ভাগ করেছেন — সব টাকা কোথায় গেল দেখুন।}}',
} as const satisfies Messages
