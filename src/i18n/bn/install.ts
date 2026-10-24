/** Bengali copy for "Install Settle" (the Home card, the You row and the iPhone steps). Keys: `install.<part>.<element>`. */
import type { Messages } from '../types'

export const install = {
  // The card on Home (after the first split or a second visit).
  'install.card.title': 'Settle ইনস্টল করুন',
  'install.card.body': 'অ্যাপের মতো খোলে, অফলাইনেও চলে।',
  'install.card.install': 'ইনস্টল করুন',
  'install.card.howto': 'ইনস্টলের নিয়ম',
  'install.card.later': 'এখন না',
  // The You → Shortcuts row.
  'install.row.title': 'অ্যাপ ইনস্টল করুন',
  'install.row.subtitle': 'হোম স্ক্রিন থেকে খোলে, অফলাইনেও চলে',
  // The iPhone steps.
  'install.sheet.title': 'Settle হোম স্ক্রিনে যোগ করুন',
  'install.sheet.description': 'প্রায় দশ সেকেন্ড লাগে। iPhone-এর Safari-তে কাজ করে।',
  'install.sheet.step1.title': 'শেয়ার-এ ট্যাপ করুন',
  'install.sheet.step1.body': 'Safari-র একদম নিচে, তীরচিহ্নসহ বর্গক্ষেত্রটি।',
  'install.sheet.step2.title': 'হোম স্ক্রিনে যোগ করুন-এ ট্যাপ করুন',
  'install.sheet.step2.body': 'তারপর ওপরের ডানদিকে যোগ করুন-এ ট্যাপ করুন।',
  'install.sheet.done': 'বুঝেছি',
} as const satisfies Messages
