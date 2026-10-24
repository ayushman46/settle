/** Bengali copy for the public pay page (opened from a friend's link). Keys: `pay.<area>.<element>`. */
import type { Messages } from '../types'

export const pay = {
  // The frame of every public page a friend opens from a link (/pay, /claim, /pool).
  'pay.shell.home.aria': '{brand}-এর হোম',
  'pay.shell.what': '{brand} কী?',
  'pay.shell.pitch.title': 'পরের বার বিল ভাগ করবেন?',
  'pay.shell.pitch.body': 'বিলের ছবি তুলুন, এই রকম একটি লিংক শেয়ার করুন, আর UPI দিয়ে টাকা ফেরত নিন। সাইন-আপ নেই, বিজ্ঞাপন নেই।',
  'pay.shell.pitch.cta': '{brand} দিয়ে নিজের বিল ভাগ করুন — বিনামূল্যে',
  'pay.shell.privacy': 'গোপনীয়তা',
  'pay.shell.terms': 'শর্তাবলি',

  // The request card, the page's h1. <by> is the small line, <what> the big title (user content).
  'pay.request.title': '<by>{name} টাকা চেয়েছেন</by> <what>{title}</what>',
  // In the line under the title: "21 Oct · Food · Total ₹2,766".
  'pay.request.total': 'মোট {amount}',
  'pay.request.collected': '{collected} উঠেছে, {owed}-এর মধ্যে',
  'pay.request.paidCount': '{count}টির মধ্যে {paid}টি দেওয়া',

  // "Which one are you?" — the list of everyone on the link.
  'pay.who.title': 'আপনি কে?',
  'pay.who.empty': 'এই লিংকে কারও কোনো টাকা বাকি নেই।',
  'pay.who.hint': 'আপনার ভাগ দেখতে ও পে করতে নিজের নামে ট্যাপ করুন।',
  // Badge next to someone the payee has marked as paid.
  'pay.who.paid': 'দেওয়া হয়েছে',

  // Paying by UPI (also used on the claim and pool pages).
  'pay.upi.cta': 'যেকোনো UPI অ্যাপে {amount} পে করুন',
  'pay.upi.cta.caption': 'GPay, PhonePe, Paytm বা BHIM সব ভরা অবস্থায় খুলবে।',
  'pay.upi.qr.show.cta': 'অন্য ফোন থেকে পে করুন',
  'pay.upi.qr.hide.cta': 'QR কোড লুকান',
  'pay.upi.qr.aria': '{name}-কে {amount} পে করতে UPI QR কোড',
  'pay.upi.qr.caption.touch': 'অন্য ফোনের UPI অ্যাপ দিয়ে এটি স্ক্যান করুন।',
  'pay.upi.qr.caption.desktop': 'আপনার ফোনের যেকোনো UPI অ্যাপ দিয়ে স্ক্যান করুন — GPay, PhonePe, Paytm, BHIM।',
  // Label above the payee's name and UPI ID.
  'pay.upi.payee.label': 'পে করা হচ্ছে',
  'pay.upi.copy.cta': 'কপি করুন',
  'pay.upi.copied.cta': 'কপি হয়েছে',
  'pay.upi.copy.aria': 'UPI ID কপি করুন',
  'pay.upi.copied.aria': 'UPI ID কপি হয়েছে',
  'pay.upi.copy.error': 'কপি করা যায়নি — ID-টি কপি করতে চেপে ধরে রাখুন।',
  'pay.upi.copied.status': 'UPI ID কপি হয়েছে',
  'pay.upi.safety': 'পে করার আগে আপনার UPI অ্যাপে <b>{name}</b> দেখাচ্ছে কি না মিলিয়ে নিন। {brand} কখনও আপনার টাকায় হাত দেয় না।',

  // One person's share.
  'pay.panel.notYou.cta': '{name} নন? আপনার নাম বেছে নিন',
  'pay.panel.share.title': '{name}-এর ভাগ',
  'pay.panel.paid.title': 'আপনার হিসাব মিটে গেছে',
  'pay.panel.paid.body': '{name} আপনার ভাগ দেওয়া হয়েছে বলে চিহ্নিত করেছেন।',
  'pay.panel.reveal.cta': 'তবু পেমেন্টের বিবরণ দেখান',
  'pay.panel.nothing.title': 'পে করার কিছু নেই',
  'pay.panel.nothing.body': 'এটিতে আপনার ভাগ {amount}।',
  'pay.panel.noUpi.title': '{name} UPI ID যোগ করেননি',
  'pay.panel.noUpi.body': 'সাধারণত যেভাবে দেন সেভাবে দিন — অথবা তাঁর UPI ID চেয়ে নিয়ে যেকোনো UPI অ্যাপ থেকে পে করুন।',
  'pay.panel.notInr.title': 'সাধারণ উপায়ে পে করুন',
  'pay.panel.notInr.body': 'UPI শুধু রুপিতে কাজ করে, তাই {name}-কে সাধারণত যেভাবে দেন সেভাবে দিন।',
  'pay.panel.breakdown.title': 'আপনার ভাগে কী আছে',
  'pay.panel.breakdown.share': 'আপনার ভাগ',
  // Under an item someone shared: "Shared 3 ways", or "2 of 3 shares" for unequal shares.
  'pay.breakdown.sharedWays': '{count} জনে ভাগ করা',
  'pay.breakdown.shares': '{total}টির মধ্যে {shares}টি ভাগ',
  'pay.breakdown.extras.added': 'ট্যাক্স, ফি ও রাউন্ড-অফ',
  'pay.breakdown.extras.taken': 'ছাড় ও রাউন্ড-অফ',

  // "Paid? Tell them" — a ready message the payer sends to the payee's chat.
  'pay.tell.title': 'পেমেন্ট হয়ে গেছে?',
  'pay.tell.cta': '{name}-কে জানান যে আপনি পে করেছেন',
  'pay.tell.copied.status': 'মেসেজ কপি হয়েছে — আপনার চ্যাটে পেস্ট করুন।',
  'pay.tell.shared.status': 'পাঠানো হয়েছে। হিসাব মেটানোর জন্য ধন্যবাদ!',
  'pay.tell.failed.status': 'মেসেজটি শেয়ার করা যায়নি। আবার চেষ্টা করুন।',
  // The message itself ({title} is what the bill was for).
  'pay.tell.message': 'নমস্কার {name}! {title}-এর জন্য এইমাত্র {amount} পাঠিয়েছি ✓',
  'pay.tell.message.noName': 'নমস্কার! {title}-এর জন্য এইমাত্র {amount} পাঠিয়েছি ✓',

  // A link that can't be shown.
  'pay.problem.invalid.title': 'এই পে লিংকটি কাজ করছে না',
  'pay.problem.invalid.body': 'কপি করার সময় হয়তো লিংকটি কেটে গেছে। যিনি পাঠিয়েছেন তাঁকে আবার শেয়ার করতে বলুন।',
  'pay.problem.empty.title': 'এখানে কোনো পে লিংক নেই',
  'pay.problem.empty.body': 'বন্ধুর শেয়ার করা লিংকটি খুলুন — তাঁকে পে করার সব তথ্য তাতে আছে।',
  'pay.loading.status': 'পে লিংক খোলা হচ্ছে…',

  // The browser tab title and the link preview.
  'pay.meta.title': '{name}-কে পে করুন · {title} · {brand}',
  'pay.meta.title.empty': 'পে লিংক · {brand}',
  'pay.meta.description': 'যেকোনো UPI অ্যাপ দিয়ে এক ট্যাপে আপনার ভাগ পে করুন। {brand} দিয়ে পাঠানো।',
} as const satisfies Messages
