/** Bengali copy for recurring splits (the list, the editor, the day picker). Keys: `recurring.<screen>.<element>`. */
import type { Messages } from '../types'

export const recurring = {
  // A day of the month as people say it (picked by code; {n} is the day).
  'recurring.ordinal.st': '{n}',
  'recurring.ordinal.nd': '{n}',
  'recurring.ordinal.rd': '{n}',
  'recurring.ordinal.th': '{n}',
  // The day picker's chip; {day} is an ordinal above ("1").
  'recurring.repeats': 'প্রতি মাসের {day} তারিখে',
  // When it's due ({date} = "1 Oct").
  'recurring.due.overdue': '{date} থেকে বাকি',
  'recurring.due.today': 'আজ দেওয়ার দিন',
  'recurring.due.tomorrow': 'আগামীকাল দেওয়ার দিন',
  'recurring.due.inDays': '{count, plural, one {# দিন পরে দেওয়ার দিন} other {# দিন পরে দেওয়ার দিন}}',
  // Short badge on a list row.
  'recurring.due.badge.overdue': 'বাকি',
  'recurring.next': 'পরের: {date}',
  // What it means for me each month.
  'recurring.standing.owed.future': 'আপনার {amount} পাওনা হবে',
  'recurring.standing.owed.now': 'আপনার {amount} পাওনা',
  'recurring.standing.owe.future': 'আপনি {name}-কে {amount} দেবেন',
  'recurring.standing.owe.now': '{name}-কে আপনার {amount} দেওয়া বাকি',
  // "For November" — which month a split is for.
  'recurring.forMonth': '{month}-এর জন্য',

  // Quick-start presets (also the title they start with).
  'recurring.preset.rent': 'ভাড়া',
  'recurring.preset.wifi': 'Wi-Fi',
  'recurring.preset.electricity': 'বিদ্যুৎ',
  'recurring.preset.netflix': 'Netflix',
  'recurring.preset.help': 'গৃহসহায়িকা',

  // "Split now" (list, editor).
  'recurring.splitNow.cta': 'এখনই ভাগ করুন',
  'recurring.splitNow.error.toast': '{title} ভাগ করা যায়নি। {reason}',
  'recurring.splitNow.edit.cta': 'এডিট করুন',
  // The success moment's title: "Rent split".
  'recurring.splitNow.done.title': '{title} ভাগ হয়েছে',

  // Pro banners (list and editor).
  'recurring.pro.ended.title': 'আপনার Pro পাসের মেয়াদ শেষ হয়েছে',
  'recurring.pro.locked.title': 'নিয়মিত ভাগ Pro-এর অংশ',
  'recurring.pro.renew.cta': 'Pro নবায়ন করুন',
  'recurring.pro.see.cta': 'Pro দেখুন',

  // The list (`/app/recurring`).
  'recurring.list.title': 'নিয়মিত ভাগ',
  'recurring.list.subtitle': 'ভাড়া, Wi-Fi, সাবস্ক্রিপশন — একবার সেট করুন, প্রতি মাসে ভাগ করুন।',
  'recurring.list.paused.body': 'এগুলো এখন বন্ধ আছে — সব এখানেই আছে, কিছু মোছা হয়নি। যেকোনো সময় বদলাতে পারবেন; ভাগ করতে Pro লাগবে।',
  'recurring.list.due.title': 'এখন দেওয়ার দিন',
  'recurring.list.all.title': 'সব নিয়মিত ভাগ',
  'recurring.list.yours.title': 'আপনার নিয়মিত ভাগ',
  'recurring.list.paused.title': 'বন্ধ আছে',
  'recurring.list.paused.description': 'আবার চালু না করা পর্যন্ত কোনো রিমাইন্ডার আসবে না।',
  'recurring.list.new.cta': 'নতুন নিয়মিত ভাগ',
  'recurring.list.due.split.aria': '{month}-এর জন্য {title} এখনই ভাগ করুন',
  'recurring.list.edit.aria': '{title} এডিট করুন',
  'recurring.list.edit.cta': 'এডিট করুন',
  'recurring.list.paused.badge': 'বন্ধ',
  // A row's subtitle: "₹32,000 · on the 1st · 3 people".
  'recurring.list.row.subtitle': '{amount} · প্রতি মাসের {day} তারিখে · {count, plural, one {# জন} other {# জন}}',
  'recurring.list.empty.title': 'একবার সেট করুন, প্রতি মাসে ভাগ করুন',
  'recurring.list.empty.body': 'প্রতিটি কবে দিতে হবে Settle মনে করিয়ে দেবে, আর এক ট্যাপে ভাগ করে দেবে।',
  'recurring.list.presets.aria': 'দ্রুত শুরু',

  // The editor (`/app/recurring/new`, `/app/recurring/:id`).
  'recurring.editor.new.title': 'নতুন নিয়মিত ভাগ',
  'recurring.editor.title': 'নিয়মিত ভাগ',
  'recurring.editor.edit.title': '{title} এডিট করুন',
  'recurring.editor.gone.title': 'এই নিয়মিত ভাগটি আর নেই',
  'recurring.editor.gone.subtitle': 'হয়তো মুছে ফেলা হয়েছে — এই ফোনে বা অন্য ট্যাবে।',
  'recurring.editor.gone.cta': 'নিয়মিত ভাগ দেখুন',
  'recurring.editor.saved.toast': 'নিয়মিত ভাগ সেভ হয়েছে',
  'recurring.editor.changesSaved.toast': 'বদল সেভ হয়েছে',
  'recurring.editor.deleted.toast': '{title} মুছে ফেলা হয়েছে',
  'recurring.editor.undo.cta': 'ফিরিয়ে নিন',
  'recurring.editor.delete.aria': '{title} মুছুন',
  'recurring.editor.save.new.cta': 'নিয়মিত ভাগ সেভ করুন',
  'recurring.editor.save.cta': 'বদল সেভ করুন',
  'recurring.editor.paused.body': 'এটি এখন বন্ধ আছে। এখনও এডিট বা মোছা যাবে; ভাগ করতে Pro লাগবে।',
  'recurring.editor.nextSplit': 'পরের ভাগ: {date}',
  'recurring.editor.saveFirst.hint': 'বদলগুলো নিয়ে ভাগ করতে আগে সেভ করুন।',
  'recurring.editor.amount.label': 'প্রতি মাসের পরিমাণ',
  'recurring.editor.what.label': 'এটি কীসের জন্য?',
  'recurring.editor.what.placeholder': 'ভাড়া, Wi-Fi, Netflix…',
  'recurring.editor.repeats.title': 'পুনরাবৃত্তি',
  'recurring.editor.firstReminder': 'প্রথম রিমাইন্ডার {date}, তারপর প্রতি মাসে।',
  'recurring.editor.nextDue': 'পরের দেওয়ার দিন {date}।',
  'recurring.editor.people.title': 'যাদের সঙ্গে ভাগ করবেন',
  'recurring.editor.how.title': 'কীভাবে ভাগ হবে',
  'recurring.editor.remind.label': 'প্রতি মাসে আমাকে মনে করিয়ে দিন',
  'recurring.editor.remind.description': 'দেওয়ার দিন এলে হোমে দেখাবে। বন্ধ করলে থেমে যাবে — কিছু মোছা হবে না।',
  'recurring.editor.discard.title': 'বদলগুলো বাতিল করবেন?',
  'recurring.editor.discard.new.description': 'এই নিয়মিত ভাগটি সেভ হবে না।',
  'recurring.editor.discard.description': 'এই নিয়মিত ভাগে আপনার বদলগুলো সেভ হবে না।',
  'recurring.editor.discard.cta': 'বাতিল করুন',
  'recurring.editor.keep.cta': 'এডিট চালিয়ে যান',

  // The day-of-month picker.
  'recurring.day.sheet.title': 'প্রতি মাসের কোন তারিখে?',
  'recurring.day.sheet.description': 'প্রতি মাসে কমপক্ষে 28 দিন থাকে, তাই 28 তারিখই সর্বশেষ।',
  'recurring.day.grid.aria': 'মাসের তারিখ',
  // One day's button: "The 1st".
  'recurring.day.option.aria': '{day} তারিখ',
} as const satisfies Messages
