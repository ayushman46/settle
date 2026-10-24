/** Bengali copy for the split editor (new split, edit, outcomes, origins, placeholders). Keys: `split.<part>.<element>`. */
import type { Messages } from '../types'

export const split = {
  // `/app/split/:id/edit` when the expense no longer exists.
  'split.gone.title': 'এই খরচটি আর নেই',
  'split.gone.subtitle': 'হয়তো মুছে ফেলা হয়েছে — এই ফোনে বা অন্য ট্যাবে।',
  'split.gone.cta': 'লেনদেন দেখুন',

  // The screen's title, heading and tab title.
  'split.screen.new.title': 'নতুন ভাগ',
  'split.screen.edit.title': 'ভাগ বদলান',
  'split.screen.edit.heading': '{title} বদলান',
  // The browser tab while editing: "Edit Dinner at Toit · Settle".
  'split.screen.edit.docTitle': '{title} বদলান · {brand}',
  'split.save.new.cta': 'ভাগ সেভ করুন',
  'split.save.cta': 'বদল সেভ করুন',
  'split.currency.toast': 'এখন {code}-তে',
  'split.undo.cta': 'ফিরিয়ে নিন',
  'split.saved.title': 'ভাগ সেভ হয়েছে',

  // The amount and the details.
  'split.amount.label': 'পরিমাণ',
  'split.amount.itemized.label': 'মোট দেওয়া',
  'split.amount.itemized.hint': 'ট্যাক্স, টিপস ও ছাড় আবার আইটেমগুলোর মধ্যে ভাগ হয়ে যাবে।',
  'split.title.label': 'এটি কীসের জন্য?',
  // Under the details when the group keeps balances in another currency.
  'split.groupCurrency.note': '{currency}-তে, তাই এটি ব্যক্তি থেকে ব্যক্তিতে মেটানো হবে — {group}-এর {groupCurrency} হিসাবে নয়।',

  // The trip tip (travel without a group).
  'split.tip.trip.title': 'পুরো ট্রিপের খরচ ভাগ করবেন?',
  'split.tip.trip.body': 'একটি গ্রুপে রাখুন: প্রতিটি খরচ যোগ হবে, আর {brand} শেষে সবচেয়ে কম সংখ্যক পেমেন্ট হিসাব করে দেবে।',
  'split.tip.trip.cta': 'ট্রিপের গ্রুপ শুরু করুন',
  'split.tip.trip.dismiss': 'শুধু এইবার',
  // The rent tip.
  'split.tip.rent.cta': 'শতাংশে ভাগ করুন',
  'split.tip.rent.body': 'ঘরের আকার আলাদা? ভাড়া প্রায়ই শতাংশ হিসাবে ভাগ করলে ন্যায্য হয়।',

  // Sections.
  'split.section.items.title': 'আইটেম ধরে ধরে ভাগ করুন',
  'split.section.people.title': 'যাদের সঙ্গে ভাগ করবেন',
  'split.section.how.title': 'কীভাবে ভাগ হবে',

  // An itemized bill being edited or copied.
  'split.bill.line': '{items, plural, one {# টি আইটেম} other {# টি আইটেম}} · {people, plural, one {# জন} other {# জন}}',
  'split.bill.editing.body': 'কে কী নিয়েছিল তা যেমন আছে তেমনই থাকবে। বদলাতে বিলটি খুলুন।',
  'split.bill.copy.body': 'মূল বিলের মতোই একই আইটেম ও মানুষজন — সেভ করার পর কে কী নিয়েছিল তা বদলান।',
  'split.bill.change.cta': 'কে কী নিয়েছিল তা বদলান',

  // Discard confirm.
  'split.discard.new.title': 'এই ভাগ বাতিল করবেন?',
  'split.discard.title': 'বদলগুলো বাতিল করবেন?',
  'split.discard.new.description': 'আপনি যা লিখেছেন তা সেভ হবে না।',
  'split.discard.description': '{title}-এ আপনার বদলগুলো সেভ হবে না।',
  'split.discard.cta': 'বাতিল করুন',
  'split.keep.cta': 'এডিট চালিয়ে যান',

  // Where a prefilled split came from.
  'split.origin.describe.title': 'আপনার লেখা থেকে ভরা হয়েছে',
  'split.origin.scan.title': 'আপনার বিল থেকে ভরা হয়েছে',
  'split.origin.scan.body': 'পরিমাণ দেখে নিন — AI ঝাপসা ছবি ভুল পড়তে পারে।',
  'split.origin.recurring.title': 'এই মাসের {title}',
  'split.origin.recurring.untitled': 'নিয়মিত ভাগ থেকে',
  'split.origin.recurring.body': 'দেখে নিন, তারপর সেভ করুন — টাকা তুলতে শুরু করতে।',
  'split.origin.duplicate.title': '{title}-এর একটি কপি',
  'split.origin.duplicate.untitled': 'একটি কপি',
  'split.origin.duplicate.body': 'আজকের তারিখে, আর এখনও কেউ দেওয়া হয়েছে বলে চিহ্নিত নন।',
  'split.origin.sms.title': 'আপনার SMS থেকে ভরা হয়েছে',
  'split.origin.sms.body': 'কারা আছে যোগ করুন, দেখে নিন, তারপর সেভ করুন।',
  'split.origin.voice.title': 'আপনার বলা কথা থেকে ভরা হয়েছে',
  'split.origin.rotation.title': 'পরের পালা',
  // Body for "what you typed", "what you said" and the next round.
  'split.origin.check.body': 'পরিমাণ ও কারা আছে দেখে নিন, তারপর সেভ করুন।',

  // The note field.
  'split.note.label': 'নোট',
  'split.note.placeholder': 'মনে রাখার কিছু — ঐচ্ছিক',
  'split.note.full': 'এটাই সীমা',
  'split.note.left': 'আর {count} অক্ষর',

  // What saving means (Save's hint) and what it means once saved (the success moment).
  'split.outcome.nothingToCollect': 'তোলার কিছু নেই — সবটাই আপনার উপর।',
  'split.outcome.one.future': '{name} আপনাকে {amount} দেবেন',
  'split.outcome.one.now': '{name}-এর কাছ থেকে আপনার {amount} পাওনা',
  // {names}: "Riya and Sam", "Riya, Sam and Ali".
  'split.outcome.each.future': '{names} প্রত্যেকে আপনাকে {amount} করে দেবেন',
  'split.outcome.each.now': '{names}-এর কাছে প্রত্যেকের {amount} করে পাওনা',
  'split.outcome.inAll.future': '{names}-এর কাছ থেকে মোট {amount} ফেরত পাবেন',
  'split.outcome.inAll.now': '{names}-এর কাছে মোট {amount} পাওনা',
  'split.outcome.many.future': '{count} জনের কাছ থেকে মোট {amount} ফেরত পাবেন',
  'split.outcome.many.now': '{count} জনের কাছে আপনার {amount} পাওনা',
  'split.outcome.owe.future': 'আপনি {name}-কে {amount} দেবেন',
  'split.outcome.owe.now': 'আপনার {name}-কে {amount} দেওয়া বাকি',
  'split.outcome.nothingToPay': 'ফেরত দেওয়ার কিছু নেই।',
  'split.outcome.getsBack.future': '{name} ফেরত পাবেন {amount}',
  'split.outcome.getsBack.now': '{name} ফেরত পাচ্ছেন {amount}',

  // After saving an edit.
  'split.changes.toast': 'বদল সেভ হয়েছে',
  'split.changes.meAgain.toast': 'বদল সেভ হয়েছে। আপনার দেনা এখন বেশি, তাই আপনাকে এখনও দেওয়া হয়নি বলে চিহ্নিত করা হয়েছে।',
  'split.changes.othersAgain.toast':
    '{count, plural, one {বদল সেভ হয়েছে। {names} এখন বেশি দেবেন, তাই তাঁকে এখনও দেওয়া হয়নি বলে চিহ্নিত করা হয়েছে।} other {বদল সেভ হয়েছে। {names} এখন বেশি দেবেন, তাই তাঁদের এখনও দেওয়া হয়নি বলে চিহ্নিত করা হয়েছে।}}',

  // Quick starts: the title field's examples per category (and the title a rent split starts with).
  'split.placeholder.food': 'Toit-এ ডিনার, Swiggy অর্ডার…',
  'split.placeholder.groceries': 'Blinkit, DMart, সপ্তাহের সবজি…',
  'split.placeholder.rent': 'ভাড়া, রক্ষণাবেক্ষণ, ডিপোজিট…',
  'split.placeholder.utilities': 'বিদ্যুৎ, Wi-Fi, গ্যাস সিলিন্ডার…',
  'split.placeholder.travel': 'ফ্লাইট, হোটেল, গোয়া ট্রিপ…',
  'split.placeholder.transport': 'এয়ারপোর্টে Uber, জ্বালানি…',
  'split.placeholder.shopping': 'Amazon অর্ডার, নতুন পর্দা…',
  'split.placeholder.entertainment': 'সিনেমার টিকিট, কনসার্ট…',
  'split.placeholder.subscription': 'Netflix, Spotify, YouTube Premium…',
  'split.placeholder.gift': 'নেহার জন্মদিনের উপহার…',
  'split.placeholder.health': 'ফার্মেসি, ডাক্তার দেখানো…',
  'split.placeholder.other': 'ডিনার, ভাড়া, ক্যাব, Netflix…',
  'split.template.rent.title': 'ভাড়া',
} as const satisfies Messages
