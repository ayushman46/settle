/** Bengali copy for people (the people list, one person, settling up with them, removing someone). Keys: `friends.<screen>.<element>`. */
import type { Messages } from '../types'

export const friends = {
  // The people list (`/app/friends`).
  'friends.list.title': 'লোকজন',
  'friends.list.subtitle': 'যাঁদের সঙ্গে ভাগ করেন — তাঁদের অ্যাপ লাগে না।',
  'friends.list.empty.title': 'এখনও কোনো মানুষ নেই',
  'friends.list.empty.body': 'যে বন্ধুদের সঙ্গে ভাগ করেন তাঁদের যোগ করুন। শুধু নাম যথেষ্ট — UPI ID থাকলে এক ট্যাপে পে করা যায়।',
  'friends.list.empty.cta': 'একজনকে যোগ করুন',
  'friends.list.search.label': 'মানুষ খুঁজুন',
  'friends.list.search.placeholder': 'নাম দিয়ে খুঁজুন',
  'friends.list.search.clear.aria': 'খোঁজা মুছুন',
  'friends.list.results.aria': 'খোঁজার ফল',
  'friends.list.all.aria': 'আপনার লোকজন',
  // A row that adds what was searched for as a new person.
  'friends.list.add.title': '“{name}” যোগ করুন',
  'friends.list.add.subtitle': 'আপনার লোকজনের মধ্যে নতুন',
  'friends.list.none': '“{query}” নামে কেউ নেই।',
  'friends.list.count': '{count, plural, one {# জন} other {# জন}}',
  'friends.list.add.cta': 'একজনকে যোগ করুন',
  // Under each name: where you stand (or their UPI ID when square).
  'friends.line.owesYou': 'আপনাকে {amount} দেবেন',
  'friends.line.youOwe': 'আপনি {amount} দেবেন',
  'friends.line.settled': 'হিসাব মিটে গেছে',

  // Add or edit a person.
  'friends.form.add.title': 'একজনকে যোগ করুন',
  'friends.form.edit.title': '{name}-কে বদলান',
  'friends.form.add.description': 'তাঁদের অ্যাপ লাগবে না — ভাগ করার জন্য শুধু একটি নাম।',
  'friends.form.add.cta': 'একজনকে যোগ করুন',
  'friends.form.saved.toast': 'সেভ হয়েছে',
  'friends.form.added.toast': '{name} যোগ হয়েছে',
  'friends.form.name.label': 'নাম',
  // An example name in the empty name field.
  'friends.form.name.placeholder': 'Riya',
  'friends.form.name.taken': '{name} আগে থেকেই আপনার লোকজনের মধ্যে আছেন।',
  'friends.form.upi.label': 'UPI ID',
  'friends.form.upi.hint': 'ঐচ্ছিক — যাতে এক ট্যাপে পে করা যায়।',
  'friends.form.upi.error': 'এটি UPI ID বলে মনে হচ্ছে না। name@bank-এর মতো হওয়া দরকার।',
  'friends.form.phone.label': 'ফোন',
  'friends.form.phone.hint': 'ঐচ্ছিক — WhatsApp ও SMS-এর রিমাইন্ডারের জন্য।',
  'friends.form.phone.error': 'এটি ফোন নম্বর বলে মনে হচ্ছে না। 7 থেকে 15টি সংখ্যা ব্যবহার করুন, যেমন 98765 43210।',
  'friends.form.color.label': 'অবতারের রং',
  'friends.color.peach': 'পীচ',
  'friends.color.mint': 'মিন্ট',
  'friends.color.sky': 'স্কাই',
  'friends.color.lilac': 'লিলাক',
  'friends.color.lemon': 'লেমন',
  'friends.color.rose': 'গোলাপি',
  'friends.color.teal': 'টিল',
  'friends.color.sand': 'বালুরং',

  // One person (`/app/friends/:id`).
  'friends.gone.title': 'এই ব্যক্তি এখানে নেই',
  'friends.gone.subtitle': 'হয়তো সরিয়ে ফেলা হয়েছে — এই ফোনে বা অন্য ট্যাবে।',
  'friends.gone.cta': 'আপনার লোকজন দেখুন',
  'friends.detail.edit.aria': '{name}-কে বদলান',
  'friends.detail.split.cta': '{name}-এর সঙ্গে ভাগ করুন',
  'friends.detail.upi.aria': 'UPI ID {upi}। কপি করুন',
  'friends.detail.upi.add': 'UPI ID যোগ করুন',
  'friends.detail.upi.copied.toast': 'UPI ID কপি হয়েছে',
  'friends.detail.upi.copy.error': 'কপি করা যায়নি। কপি করতে UPI ID-টি চেপে ধরে রাখুন।',
  'friends.detail.call.aria': '{phone}-এ {name}-কে কল করুন',
  'friends.detail.groups.title': 'একসঙ্গে যে গ্রুপগুলোতে আছেন',
  'friends.detail.expenses.title': '{name}-এর সঙ্গে খরচ',
  'friends.detail.expenses.empty.title': 'এখনও কিছু ভাগ হয়নি',
  'friends.detail.expenses.empty.body': '{name}-এর সঙ্গে একটি বিল, ক্যাব বা ভাড়া ভাগ করুন — এখানে দেখাবে।',
  'friends.detail.expenses.fewer.cta': 'কম দেখান',
  'friends.detail.expenses.all.cta': 'সব {count}টি দেখান',
  'friends.detail.remove.cta': 'লোকজনের তালিকা থেকে সরান',
  'friends.detail.removed.toast': '{name} লোকজনের তালিকা থেকে সরানো হয়েছে',
  // "Someone" is what past splits call a removed person.
  'friends.remove.title': '{name}-কে সরাবেন?',
  'friends.remove.body': '{name} আপনার লোকজন ও যেকোনো গ্রুপ থেকে বাদ যাবেন। আগের ভাগগুলো থাকবে, সেখানে তাঁকে “কেউ একজন” হিসেবে দেখানো হবে।',
  'friends.remove.cta': '{name}-কে সরান',
  'friends.remove.keep.cta': '{name}-কে রাখুন',
  'friends.blocked.title': '{name}-কে এখনই সরানো যাবে না',
  'friends.blocked.ok.cta': 'ঠিক আছে',

  // Where I stand with them.
  'friends.standing.square': 'আপনার ও {name}-এর হিসাব সমান',
  'friends.standing.owesYou': '{name} আপনাকে দেবেন',
  'friends.standing.youOwe': 'আপনি {name}-কে দেবেন',
  // Other currencies under the amount: "Also owes you $20 · you owe €5".
  'friends.standing.also': 'আরও {list}',
  'friends.standing.nothing': 'মেটানোর কিছু নেই — চমৎকার।',
  'friends.standing.remind.cta': 'মনে করান',
  'friends.standing.pay.cta': 'UPI-তে পে করুন',
  'friends.settle.cta': 'হিসাব মেটান',
  'friends.allSquare': '{name}-এর সঙ্গে সব সমান',
  'friends.allSquare.subtitle': 'মেটানোর আর কিছু নেই।',

  // Where the money comes from: each shared group, and splits outside groups.
  'friends.sources.title': 'কোথা থেকে এসেছে',
  'friends.sources.splits': 'গ্রুপের বাইরে {count, plural, one {# টি ভাগ} other {# টি ভাগ}}',
  'friends.sources.paysYou': '{name} আপনাকে দেবেন',
  'friends.sources.youPay': 'আপনি {name}-কে দেবেন',
  'friends.sources.even': 'সমান হয়ে গেছে',
  // What a reminder is for when it covers several splits ("for our splits").
  'friends.sources.ourSplits': 'আমাদের ভাগগুলো',

  // Settle up with one person.
  'friends.settle.title': '{name}-এর সঙ্গে হিসাব মেটান',
  'friends.settle.owesYou': '{name} আপনাকে মোট {amount} দেবেন।',
  'friends.settle.youOwe': 'আপনি {name}-কে মোট {amount} দেবেন।',
  'friends.settle.square': 'আপনার ও {name}-এর হিসাব সমান।',
  'friends.settle.all.cta': 'সব মিটিয়ে নিন',
  'friends.settle.inGroup.aria': '{name}-এর সঙ্গে গ্রুপে হিসাব মেটান',
  'friends.settle.inGroup.cta': 'গ্রুপে মেটান',
  'friends.settle.mark.cta': 'মিটে গেছে বলে চিহ্নিত করুন',
  'friends.settle.marked.toast': '{count, plural, one {# টি ভাগ মিটে গেছে বলে চিহ্নিত} other {# টি ভাগ মিটে গেছে বলে চিহ্নিত}}',

  // Why someone can't be removed yet. {groups} is a list of group names.
  'friends.blocked.money': '{name}-এর এখনও মেটানোর টাকা বাকি আছে।',
  'friends.blocked.money.groups': '{name}-এর এখনও {groups}-এ মেটানোর টাকা বাকি আছে।',
  'friends.blocked.money.splits': 'গ্রুপের বাইরের {count, plural, one {# টি ভাগে} other {# টি ভাগে}} {name}-এর এখনও মেটানোর টাকা বাকি আছে।',
  'friends.blocked.money.both': '{groups}-এ এবং গ্রুপের বাইরের {count, plural, one {# টি ভাগে} other {# টি ভাগে}} {name}-এর এখনও মেটানোর টাকা বাকি আছে।',
  // {titles}: the recurring splits' names, in quotes.
  'friends.blocked.recurring': '{name} আপনার নিয়মিত {count, plural, one {ভাগে} other {ভাগগুলোতে}} আছেন: {titles}।',
  'friends.blocked.settleFirst': 'আগে হিসাব মেটান, তারপর তাঁরা যেতে পারবেন।',
  'friends.blocked.takeOut': 'আগে তাঁদের এখান থেকে বের করুন, তারপর তাঁরা যেতে পারবেন।',
} as const satisfies Messages
