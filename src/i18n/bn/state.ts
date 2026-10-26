/** Bengali copy for bill state labels (the breakdown of what the bill says). Keys: `state.<area>.<element>`. */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'ফি',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'আইটেম',
  'state.breakdown.serviceCharge': 'সার্ভিস চার্জ',
  'state.breakdown.tax': 'ট্যাক্স',
  'state.breakdown.tip': 'টিপস',
  'state.breakdown.discount': 'ছাড়',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'রাউন্ড-অফ',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'অন্যান্য চার্জ',
  'state.breakdown.otherDiscounts': 'অন্যান্য ছাড়',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'যোগফল',
  'state.breakdown.total': 'বিলের মোট',

  // Why a split can't be saved yet (the expense and the saved data).
  'state.error.expense.noPeople': 'ভাগ করার জন্য অন্তত একজন মানুষ যোগ করুন।',
  'state.error.expense.badTotal': 'শূন্যের বেশি একটি পরিমাণ লিখুন।',
  'state.error.expense.exactMismatch': 'পরিমাণগুলো এখনও মোটের সঙ্গে মিলছে না।',
  'state.error.expense.percentMismatch': 'শতাংশগুলো এখনও 100%-এ মিলছে না।',
  'state.error.expense.payerMissing': 'কে দিয়েছেন বেছে নিন।',
  'state.error.expense.zeroWeights': 'অন্তত একজনকে একটি অংশ দিন।',
  'state.error.expense.nothingHad': 'অন্তত একজন কত খেয়েছে লিখুন।',
  'state.error.expense.notFound': 'ওই খরচটি আর নেই।',
  'state.error.data.notFound': 'সেটি খুঁজে পাওয়া যায়নি — হয়তো মুছে ফেলা হয়েছে।',
  'state.error.data.emptyName': 'আগে একটি নাম যোগ করুন।',
  'state.error.data.duplicateName': 'ওই নামে একজন আগে থেকেই আপনার লোকজনের মধ্যে আছেন।',
  'state.error.data.limit': 'এখানে সীমায় পৌঁছে গেছেন — যা আর লাগে না তা সরান।',
  'state.error.data.invalid': 'এটি ঠিক মনে হচ্ছে না — দেখে আবার চেষ্টা করুন।',
} as const satisfies Messages
