/** Bengali copy for what leaves the app: category names, reminder texts, pay requests, summaries, share messages and cards. Keys: `share.<area>.<element>`. */
import type { Messages } from '../types'

export const share = {
  // Category names, in the app and on everything that leaves it (pay links, cards, summaries).
  'share.category.food': 'খাবার ও পানীয়',
  'share.category.groceries': 'বাজার',
  'share.category.rent': 'ভাড়া',
  'share.category.utilities': 'বিল ও ইউটিলিটি',
  'share.category.travel': 'ভ্রমণ ও থাকা',
  'share.category.transport': 'যাতায়াত',
  'share.category.shopping': 'কেনাকাটা',
  'share.category.entertainment': 'বিনোদন',
  'share.category.subscription': 'সাবস্ক্রিপশন',
  'share.category.gift': 'উপহার',
  'share.category.health': 'স্বাস্থ্য',
  'share.category.other': 'অন্যান্য',

  // Reminder ("nudge") tones.
  'share.nudge.tone.friendly': 'বন্ধুত্বপূর্ণ',
  'share.nudge.tone.funny': 'মজার',
  'share.nudge.tone.firm': 'কড়া',
  // Reminder wordings, sent to the friend in the sender's language. `{to}` is their first name,
  // `{amount}` the money, `{what}` what it was for. Keep the same number of wordings per tone.
  'share.nudge.friendly.0': 'ওহে {to}! 👋 একটু মনে করিয়ে দিচ্ছি: {what}-এর জন্য আপনার ভাগ {amount}। তাড়াহুড়োর কিছু নেই!',
  'share.nudge.friendly.1': 'নমস্কার {to} 🙂 {what}-এর জন্য আপনার ভাগ {amount} হচ্ছে। সুবিধামতো সময়ে মিটিয়ে দেবেন!',
  'share.nudge.friendly.2': 'ওহে {to}, আশা করি ভালো আছেন! এক লাইনে: {what}-এর জন্য {amount}। অনেক ধন্যবাদ 🙏',
  'share.nudge.friendly.3': '{to}! {what}-এর জন্য ছোট্ট একটি মনে করানো: আপনার অংশ {amount}। ধন্যবাদ 😊',
  'share.nudge.funny.0': 'টক টক, {to} 🚪 কে এসেছে? {amount}। {amount} কে? {what}-এর জন্য {amount} 😄',
  'share.nudge.funny.1': 'ব্রেকিং নিউজ 📰 {what}-এর {amount} শেষবার আপনার দিকেই যেতে দেখা গেছে, {to}। ওকে বাড়ির পথ খুঁজে পেতে সাহায্য করুন 🏠',
  'share.nudge.funny.2': '{to}, আমার ওয়ালেট আপনার কথা জিজ্ঞেস করছে 👀 {what}-এর {amount}, আপনি তৈরি হলেই!',
  'share.nudge.funny.3': 'প্লট টুইস্ট, {to}: {what} বিনামূল্যে ছিল না 🍿 আপনার অংশ {amount} 😅',
  'share.nudge.firm.0': 'নমস্কার {to}, {what}-এর {amount} এখনও বাকি রয়েছে বলে মনে করিয়ে দিচ্ছি। আজই মিটিয়ে দিন।',
  'share.nudge.firm.1': 'নমস্কার {to}, {what}-এর জন্য আপনার {amount} অংশ দেওয়ার সময় হয়েছে। দয়া করে যত তাড়াতাড়ি সম্ভব পে করুন।',
  'share.nudge.firm.2': '{to}, {what}-এর {amount} নিয়ে জানতে চাইছি। দয়া করে আজই মিটিয়ে দেবেন?',
  // The words before the pay link at the end of a reminder ("Tap to pay: https://…").
  'share.nudge.link.friendly': 'পে করতে ট্যাপ করুন',
  'share.nudge.link.funny': 'এক ট্যাপেই হিসাব সমান',
  'share.nudge.link.firm': 'এখানে পে করুন',
  // The UPI line of a reminder.
  'share.nudge.upi.mine': 'আমার UPI: {upi}',
  'share.nudge.upi': 'UPI-তে {name}-কে পে করুন: {upi}',
  // Greeting when there's no name ("Hey there!"), and what it was for when there's no title.
  'share.nudge.there': 'বন্ধু',
  'share.nudge.ourSplit': 'আমাদের ভাগ',

  // A UPI payment request sent from the pay sheet (then "Pay Riya on UPI: …" and the link).
  'share.upiRequest.for': 'নমস্কার {name}, {merchant}-এর জন্য আপনার ভাগ {amount}।',
  'share.upiRequest.bill': 'নমস্কার {name}, বিলে আপনার ভাগ {amount}।',
  'share.upiRequest.tap': 'অথবা পে করতে ট্যাপ করুন: {link}',

  // The full text summary of a split ("Copy text").
  'share.summary.total': 'মোট {amount}',
  'share.summary.totalSplit': 'মোট {amount} · {count, plural, one {# জনে ভাগ} other {# জনে ভাগ}}',
  // After the payer's amount: "Ayush   ₹691.50 · paid the bill".
  'share.summary.paidTheBill': 'বিল দিয়েছেন',
  'share.summary.payUpi': 'UPI-তে {name}-কে পে করুন: {upi}',
  'share.summary.payTap': 'এক ট্যাপে পে করুন: {link}',
  'share.summary.footer': '— {brand} দিয়ে ভাগ করা',

  // The short message that carries a pay link into the group chat. 🧾 starts the first line.
  'share.message.settled': '🧾 {title} · সব মিটে গেছে ✓',
  'share.message.total': '🧾 {title} · {amount}',
  'share.message.split': '🧾 {title} · {amount}, {count} জনে ভাগ',
  'share.message.see': 'ভাগের হিসাব দেখুন 👇',
  'share.message.payMe': 'যেকোনো UPI অ্যাপে আমাকে পে করতে আপনার নামে ট্যাপ করুন 👇',
  'share.message.pay': 'যেকোনো UPI অ্যাপে {name}-কে পে করতে আপনার নামে ট্যাপ করুন 👇',
  'share.message.seeShare': 'আপনার অংশ দেখতে আপনার নামে ট্যাপ করুন 👇',
  'share.message.yourShare': 'হাই {name}! {title}-এ আপনার অংশ {amount} 🧾',
  'share.message.oneTapMe': 'এক ট্যাপে আমাকে পাঠান — যেকোনো UPI অ্যাপ, টাকা আগে থেকেই ভরা 👇',
  'share.message.oneTap': 'এক ট্যাপে {name}-কে পাঠান — যেকোনো UPI অ্যাপ, টাকা আগে থেকেই ভরা 👇',
  'share.message.seeYours': 'আপনার অংশ দেখুন 👇',

  // The share card image of a split (drawn in the sender's language).
  'share.card.morePeople': '{count, plural, one {আরও # জন} other {আরও # জন}}',
  'share.card.paidBy': '{name} দিয়েছেন',
  'share.card.splitWays': '{count, plural, one {# জনে ভাগ} other {# জনে ভাগ}}',
  'share.card.status.payer': 'বিল দিয়েছেন',
  'share.card.status.paid': 'ফেরত দেওয়া হয়েছে',
  'share.card.status.owes': 'এখনও দেওয়া বাকি',
  'share.card.status.zero': 'দেওয়ার কিছু নেই',
  'share.card.paidCount': '{count}জনের মধ্যে {paid}জন দিয়েছেন',
  'share.card.allSettled': 'সব মিটে গেছে',
  'share.card.collected': '{owed}-এর মধ্যে {collected} উঠেছে',
  'share.card.madeWith': '{brand} দিয়ে বানানো',
  // Names when there's nothing better to show (the owner, a removed friend).
  'share.card.me': 'আমি',
  'share.card.friend': 'বন্ধু',
  // The group summary card.
  'share.card.kind.trip': 'ট্রিপ',
  'share.card.kind.home': 'বাড়ি',
  'share.card.kind.couple': 'দম্পতি',
  'share.card.kind.event': 'অনুষ্ঠান',
  'share.card.kind.other': 'গ্রুপ',
  'share.card.someone': 'কেউ একজন',
  'share.card.someone.object': 'কাউকে',
  'share.card.pays': '{from} দেবেন {to}-কে',
  'share.card.people': '{count, plural, one {# জন} other {# জন}}',
  'share.card.expenses': '{count, plural, one {# টি খরচ} other {# টি খরচ}}',
  'share.card.totalSpent': 'মোট খরচ',
  'share.card.settled': 'সবার হিসাব মিটে গেছে',
  'share.card.settled.body': 'কোনো পেমেন্টের দরকার নেই',
  'share.card.empty': 'মেটানোর কিছু নেই',
  'share.card.empty.body': 'এখনও কোনো খরচ নেই',
  'share.card.payments': '{count, plural, one {# টি পেমেন্ট} other {# টি পেমেন্ট}}',
  'share.card.toSettle': 'হিসাব মেটাতে',
  'share.card.morePayments': '{count, plural, one {আরও # টি পেমেন্ট} other {আরও # টি পেমেন্ট}}',

  // Names used when a person never gave one (share/fallbacks.ts): the organiser or payee, a numbered person, anyone unnamed.
  'share.fallback.friend': 'আপনার বন্ধু',
  'share.fallback.person': 'ব্যক্তি {n}',
  'share.fallback.someone': 'কেউ একজন',
  // The note on a UPI payment that has no title (it shows in the payer's UPI app).
  'share.upi.note': 'বিল ভাগ',
  // Why a share card image couldn't be made.
  'share.card.error.canvas': 'এই ব্রাউজার ছবি আঁকতে পারে না',
  'share.card.error.render': 'ছবিটি তৈরি করা যায়নি',
} as const satisfies Messages
