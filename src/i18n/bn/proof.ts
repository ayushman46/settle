/** Bengali copy for "Paid? Drop the screenshot" (payment screenshots). Keys: `proof.<screen>.<element>`. */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'পৌঁছে গেছে? স্ক্রিনশট দিন',
  'proof.screen.subtitle': 'GPay, PhonePe, Paytm বা আপনার ব্যাংক অ্যাপের পেমেন্টের স্ক্রিনশট দিন। Settle সেটি যাচাই করে বলবে কে আপনাকে টাকা দিয়েছে।',
  'proof.drop.choose': 'একটি স্ক্রিনশট বেছে নিন',
  'proof.drop.aria': 'একটি পেমেন্টের স্ক্রিনশট বেছে নিন',
  'proof.drop.hint': 'JPG, PNG বা WebP। একবার পড়া হয়; কিছু জমা থাকে না।',
  'proof.reading.title': 'স্ক্রিনশট পড়া হচ্ছে…',
  'proof.reading.cancel': 'বাতিল',
  'proof.again': 'আরেকটি স্ক্রিনশট দিন',
  // What goes wrong reading the screenshot.
  'proof.error.generic': 'স্ক্রিনশটটি পড়া যায়নি। আবার চেষ্টা করুন, অথবা নিজেই ব্যক্তিটিকে বেছে নিন।',
  'proof.error.network': 'আপনি অফলাইনে আছেন। সংযোগ দিয়ে আবার চেষ্টা করুন।',
  'proof.error.not_a_payment': 'এটি UPI পেমেন্টের মতো মনে হচ্ছে না। আপনার পেমেন্ট অ্যাপের সফল হওয়ার স্ক্রিনটি দিন।',
  'proof.error.unsupported_image': 'দয়া করে JPG, PNG বা WebP স্ক্রিনশট দিন।',
  'proof.error.image_too_large': 'স্ক্রিনশটটি খুব বড়। একটি ছোট স্ক্রিনশট দিন।',
  'proof.error.rate_limited': 'এখন অনেক স্ক্রিনশট আসছে। কয়েক মিনিট পরে আবার চেষ্টা করুন।',
  'proof.error.timeout': 'স্ক্রিনশট পড়তে অনেক সময় লেগেছে। আবার চেষ্টা করুন।',
  'proof.error.unreadable': 'স্ক্রিনশটটি পড়া যায়নি। ভালো আলোয় পুরো সফল স্ক্রিনটি দিন।',
  'proof.error.not_configured': 'স্ক্রিনশট পড়ার সুবিধা এখন নেই।',
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'এই পেমেন্ট এখনও পেন্ডিং। এটিকে পরিশোধিত বলে চিহ্নিত করা হচ্ছে না।',
  'proof.verdict.pending.body': 'পেমেন্ট “Paid” দেখালে আবার স্ক্রিনশট দিন।',
  'proof.verdict.failed.title': 'এই পেমেন্ট ব্যর্থ হয়েছে। এটিকে পরিশোধিত বলে চিহ্নিত করা হচ্ছে না।',
  'proof.verdict.failed.body': 'কোনো টাকা যায়নি। তাঁকে আবার চেষ্টা করতে বলুন।',
  'proof.verdict.unreadable.title': 'এই পেমেন্ট সফল হয়েছে কি না বোঝা যাচ্ছে না।',
  'proof.verdict.unreadable.body': 'সফল হওয়ার স্ক্রিনের একটি স্ক্রিনশট দিন।',
  'proof.verdict.wrongPayee.title': 'এই টাকা আপনাকে যায়নি। এটিকে পরিশোধিত বলে চিহ্নিত করা হচ্ছে না।',
  'proof.verdict.wrongPayee.body': 'এটি গেছে {payee}-কে।',
  'proof.verdict.payeeUnknown.title': 'কে এই পেমেন্ট পেয়েছেন তা দেখা যাচ্ছে না। এটিকে পরিশোধিত বলে চিহ্নিত করা হচ্ছে না।',
  'proof.verdict.payeeUnknown.body': 'গ্রহীতার নাম বা UPI ID দেখায় এমন একটি স্ক্রিনশট দিন।',
  'proof.verdict.duplicate.title': 'এই পেমেন্ট আগেই লিপিবদ্ধ আছে।',
  'proof.verdict.duplicate.body': 'UPI রেফারেন্স {utr} আগেই {name}-এর সঙ্গে চিহ্নিত আছে।',
  'proof.verdict.duplicate.someone': 'আপনার তালিকার একজন',
  // A match: one person owes exactly this.
  'proof.match.title': '{name}-এর {amount} পরিশোধিত বলে চিহ্নিত করব?',
  'proof.match.ref': 'UPI রেফারেন্স {utr}',
  'proof.match.noRef': 'এই স্ক্রিনে কোনো UPI রেফারেন্স নেই। ঠিক পেমেন্টটি কি না দেখে নিন।',
  'proof.match.confirm': 'পরিশোধিত বলে চিহ্নিত করুন',
  'proof.match.notThis': 'এটি না',
  'proof.match.done': '{name}-এর {amount} পরিশোধিত বলে চিহ্নিত করা হয়েছে।',
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': 'এটি কারও সঙ্গে মেলানো যায়নি।',
  'proof.nomatch.amount': 'স্ক্রিনে {amount} দেখাচ্ছে। তাঁদের মধ্যে কেউ টাকা দিয়ে থাকলে তাঁকে বেছে নিন।',
  'proof.nomatch.noAmount': 'স্ক্রিনে কোনো পরিমাণ দেখাচ্ছে না। তাঁদের মধ্যে কেউ টাকা দিয়ে থাকলে তাঁকে বেছে নিন।',
  'proof.nomatch.none': 'কারও কাছে ঠিক {amount} পাওনা নেই। বন্ধু বিভাগে পরিমাণটি দেখে নিন।',
  'proof.nomatch.pick': '{name} ({amount}) বেছে নিন',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'অন্য অ্যাপ থেকে শেয়ার করা',
  'proof.more.title': 'পৌঁছে গেছে? স্ক্রিনশট দিন',
  'proof.more.subtitle': 'স্ক্রিনশট থেকে UPI পেমেন্ট পরিশোধিত বলে চিহ্নিত করুন',
  // The link on a friend, a group's settle-up page: a screenshot of a payment to you.
  'proof.entry.cta': 'পেমেন্টের স্ক্রিনশট পেয়েছেন?',
} as const satisfies Messages
