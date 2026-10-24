/** Bengali copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'দ্রুত কাজ',
  'home.quick.scan': 'বিল স্ক্যান',
  'home.quick.split': 'টাকা ভাগ করুন',
  'home.quick.lend': 'ধার দিন / নিন',
  'home.quick.collect': 'টাকা তুলুন',
  'home.quick.sms': 'SMS থেকে',
  'home.quick.food': 'ফুড অর্ডার',
  'home.quick.group': 'নতুন গ্রুপ',
  'home.quick.more': 'আরও',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'ভাড়া',
  'home.template.travel': 'ট্রিপ',
  'home.template.subscription': 'সাবস্ক্রিপশন',
  'home.template.utilities': 'বিদ্যুৎ ও জল',
  'home.template.transport': 'ক্যাব',
  // The sheet behind the More tile.
  'home.more.title': 'ভাগ করার আরও উপায়',
  'home.more.subtitle': 'এর যেকোনোটির জন্য শুধু টাকার পরিমাণ দিয়ে শুরু করুন।',
  // "Just say it" — what the AI reading of a sentence shows.
  'home.describe.looksRight': 'ঠিক আছে',
  'home.describe.changeWords': 'আমি যা বলেছি তা বদলান',
  'home.describe.off.title': 'AI সহায়ক এখন বন্ধ আছে',
  'home.describe.off.body': 'AI ছাড়াও হাতে করে যেকোনো কিছু ভাগ করতে পারেন — একটু সময় লাগবে।',
  'home.describe.off.cta': 'হাতে করে ভাগ করুন',
  'home.describe.retry': 'আবার চেষ্টা করুন',
  'home.describe.tryOne': 'একটি চেষ্টা করুন',
  'home.describe.unlimited': 'সীমাহীন AI ভাগ',
  'home.describe.reading': 'আপনার ভাগ পড়া হচ্ছে…',
  'home.describe.noAmount': 'পরের স্ক্রিনে পরিমাণ যোগ করুন',
  'home.describe.paidBy': '{name} দিয়েছেন · {mode}',
  // The first-run card and the split-now prompt.
  'home.first.title': 'আপনার প্রথম খরচ ভাগ করুন',
  'home.first.body': 'ডিনার, ভাড়া, বাড়ি ফেরার ক্যাব — Settle হিসাব করে কে কার কাছে কত পাবে, আর UPI-তে টাকা ফেরত আনতে সাহায্য করে।',
  'home.first.split': 'একটি খরচ ভাগ করুন',
  'home.first.sample': 'নমুনা বিল দেখুন',
  'home.due.splitNow': 'এখনই ভাগ করুন',
  // "Just say it" — the search pill on Home.
  'home.say.title': 'শুধু বলুন',
  'home.say.placeholder': 'শুধু বলুন…',
  'home.say.label': 'শুধু বলুন: AI ভাগ করার জন্য একটি খরচের বর্ণনা দিন',
  'home.trust': 'গোপনীয়তা মাথায় রেখে বানানো — আপনার ভাগগুলো এই ফোনেই থাকে। কোনো অ্যাকাউন্ট নেই, বিজ্ঞাপন নেই।',
  'home.people.add': 'যোগ করুন',
} as const satisfies Messages
