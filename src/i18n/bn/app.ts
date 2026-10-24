/** Bengali copy for the app shell: tabs, page titles, storage and crash screens. Keys: `app.<area>.<element>`. */
import type { Messages } from '../types'

export const app = {
  // The bottom tabs.
  'app.tab.home': 'হোম',
  'app.tab.groups': 'গ্রুপ',
  'app.tab.activity': 'লেনদেন',
  'app.tab.you': 'আপনি',

  // The browser tab's title: "{page} · Settle".
  'app.title.format': '{page} · {brand}',
  // Page names for the browser tab (one per screen).
  'app.title.home': 'হোম',
  'app.title.welcome': 'স্বাগতম',
  'app.title.groups': 'গ্রুপ',
  'app.title.group': 'গ্রুপ',
  'app.title.settleUp': 'হিসাব মিটিয়ে নিন',
  'app.title.activity': 'লেনদেন',
  'app.title.you': 'আপনি',
  'app.title.newSplit': 'নতুন ভাগ',
  'app.title.editSplit': 'ভাগ বদলান',
  'app.title.fromSms': 'SMS থেকে',
  'app.title.lend': 'ধার দিন বা নিন',
  'app.title.editLend': 'ধার বদলান',
  'app.title.expense': 'খরচ',
  'app.title.claims': 'দাবি',
  'app.title.people': 'লোকজন',
  'app.title.person': 'ব্যক্তি',
  'app.title.insights': 'বিশ্লেষণ',
  'app.title.recurring': 'নিয়মিত ভাগ',
  'app.title.newRecurring': 'নতুন নিয়মিত ভাগ',
  'app.title.recurringOne': 'নিয়মিত ভাগ',
  'app.title.collections': 'চাঁদা',
  'app.title.newCollection': 'নতুন চাঁদা',
  'app.title.collection': 'চাঁদা',
  'app.title.editCollection': 'চাঁদা বদলান',
  'app.title.pro': 'Pro',

  // When the phone won't save (storage full or blocked).
  'app.storage.title': 'এই ফোন আপনার বদল সেভ করছে না',
  'app.storage.body': 'স্টোরেজ ভর্তি বা বন্ধ থাকতে পারে। কিছু জায়গা খালি করুন — {brand} খোলা থাকলে সবকিছু এখানেই থাকবে।',

  // While a screen's code loads.
  'app.loading.aria': 'লোড হচ্ছে',

  // A screen that crashed or couldn't load.
  'app.crash.title': 'কিছু একটা ভুল হয়েছে',
  'app.crash.body': 'দুঃখিত। আবার চেষ্টা করুন, অথবা হোমে ফিরে যান — আপনার ভাগগুলো নিরাপদ আছে।',
  'app.crash.retry.cta': 'আবার চেষ্টা করুন',
  'app.crash.home.cta': 'হোমে যান',
  'app.crash.offline.title': 'আপনি অফলাইনে আছেন',
  'app.crash.offline.body': 'এই পাতাটি প্রথমবার খুলতে ইন্টারনেট লাগে। সংযোগ ফিরিয়ে আবার চেষ্টা করুন।',
  'app.crash.updated.title': '{brand} আপডেট হয়েছে',
  'app.crash.updated.body': 'সবচেয়ে নতুন সংস্করণ পেতে আবার লোড করুন — আপনার ভাগগুলো এই ফোনেই নিরাপদ আছে।',
  'app.crash.reload.cta': 'আবার লোড করুন',
} as const satisfies Messages
