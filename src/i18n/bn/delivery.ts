/** Bengali copy for food and delivery orders (scan, fees, who-had-what). Keys: `delivery.<step>.<element>`. */
import type { Messages } from '../types'

export const delivery = {
  // The scan step opened from Home's "Food order" tile.
  'delivery.scan.title': 'ফুড অর্ডার ভাগ করুন',
  'delivery.scan.subtitle': 'Swiggy, Zomato, Blinkit, Zepto বা Instamart-এর অর্ডারের স্ক্রিনশট দিন — আমরা আইটেম, ফি আর কুপন বের করে দেব।',
  'delivery.scan.choose.cta': 'স্ক্রিনশট বেছে নিন',
  'delivery.scan.camera.cta': 'ছবি তুলুন',
  // Extra lines in the rotating "reading" status while a delivery order is read.
  'delivery.scan.status.fees': 'ফি খোঁজা হচ্ছে…',
  'delivery.scan.status.coupon': 'কুপন যাচাই করা হচ্ছে…',

  // The fees section on the bill review step.
  'delivery.review.fees.title': 'ফি ও চার্জ',
  'delivery.review.fees.add.cta': 'ফি যোগ করুন',
  'delivery.review.fees.hint': 'পরের ধাপে ফি কীভাবে ভাগ হবে তা বেছে নেবেন।',
  // A fee row's accessible name: "Delivery fee, ₹35, edit".
  'delivery.review.fees.row.aria': '{label}, {amount}, এডিট করুন',
  'delivery.review.fees.removed.toast': '{label} সরানো হয়েছে',
  'delivery.review.fees.full.toast': 'একটি বিলে সর্বোচ্চ {max}টি ফি রাখা যায়।',
  'delivery.review.fees.converted.toast': '{label} এখন একটি আইটেম — পরের ধাপে বলুন কে নিয়েছিল',
  'delivery.review.fees.undoFailed.toast': 'ফিরিয়ে নেওয়া যায়নি — বিল বদলে গেছে',
  // The sheet for one fee.
  'delivery.fee.title': 'ফি',
  'delivery.fee.name.label': 'নাম',
  'delivery.fee.amount.label': 'পরিমাণ',
  'delivery.fee.amount.error': 'ফি লিখুন (0-এর বেশি)',
  'delivery.fee.kind.label': 'ধরন',
  'delivery.fee.kind.delivery': 'ডেলিভারি',
  'delivery.fee.kind.platform': 'প্ল্যাটফর্ম',
  'delivery.fee.kind.packaging': 'প্যাকেজিং',
  'delivery.fee.kind.surge': 'সারচার্জ/বৃষ্টি',
  'delivery.fee.kind.smallOrder': 'ছোট অর্ডার',
  'delivery.fee.kind.tip': 'টিপস',
  'delivery.fee.kind.donation': 'অনুদান',
  'delivery.fee.kind.feeTax': 'ফির উপর GST',
  'delivery.fee.kind.other': 'অন্যান্য',
  // The name a fee gets when none is typed (also the field's placeholder).
  'delivery.fee.default.delivery': 'ডেলিভারি ফি',
  'delivery.fee.default.platform': 'প্ল্যাটফর্ম ফি',
  'delivery.fee.default.packaging': 'প্যাকেজিং',
  'delivery.fee.default.surge': 'বৃষ্টির ফি',
  'delivery.fee.default.smallOrder': 'ছোট অর্ডার ফি',
  'delivery.fee.default.tip': 'টিপস',
  'delivery.fee.default.donation': 'অনুদান',
  'delivery.fee.default.feeTax': 'ফির উপর GST',
  'delivery.fee.default.other': 'ফি',
  'delivery.fee.add.cta': 'ফি যোগ করুন',
  'delivery.fee.save.cta': 'সেভ করুন',
  'delivery.fee.remove.cta': 'ফি সরান',
  'delivery.fee.tip.hint': 'শুধু একজন টিপ দিচ্ছেন? তাহলে এটি একটি আইটেম হিসেবে যোগ করুন।',
  'delivery.fee.tip.cta': 'আইটেম বানান',

  // The fee policy on the "What you paid" step.
  'delivery.paid.policy.label': 'ফি কীভাবে ভাগ হবে?',
  'delivery.paid.policy.equal': 'সমানভাবে',
  'delivery.paid.policy.proportional': 'যে যা খেয়েছে সেই অনুপাতে',
  'delivery.paid.explain.equal': 'ফি {fees} — যাঁরা অর্ডার করেছেন তাঁদের মধ্যে সমানভাবে ভাগ হবে; ট্যাক্স ও {coupon} কুপন যে যা খেয়েছে সেই অনুপাতে।',
  'delivery.paid.explain.equal.coupon': 'ফি {fees} — যাঁরা অর্ডার করেছেন তাঁদের মধ্যে সমানভাবে ভাগ হবে; {coupon} কুপন যে যা খেয়েছে সেই অনুপাতে।',
  'delivery.paid.explain.equal.tax': 'ফি {fees} — যাঁরা অর্ডার করেছেন তাঁদের মধ্যে সমানভাবে ভাগ হবে; ট্যাক্স যে যা খেয়েছে সেই অনুপাতে।',
  'delivery.paid.explain.equal.only': 'ফি {fees} — যাঁরা অর্ডার করেছেন তাঁদের মধ্যে সমানভাবে ভাগ হবে।',
  'delivery.paid.explain.proportional': 'ফি, ট্যাক্স ও কুপন — সবই যে যা খেয়েছে সেই অনুপাতে ভাগ হবে।',
  'delivery.paid.explain.proportional.coupon': 'ফি ও কুপন — দুটোই যে যা খেয়েছে সেই অনুপাতে ভাগ হবে।',
  'delivery.paid.explain.proportional.tax': 'ফি ও ট্যাক্স — দুটোই যে যা খেয়েছে সেই অনুপাতে ভাগ হবে।',
  'delivery.paid.explain.proportional.only': 'ফি যে যা খেয়েছে সেই অনুপাতে ভাগ হবে।',

  // Each person's lines on the result step.
  'delivery.result.fees': 'ফি',
  'delivery.result.other': 'ট্যাক্স, চার্জ ও অফার',
  'delivery.result.total': 'মোট',
  'delivery.result.none': 'অর্ডার করেননি · {amount}',
} as const satisfies Messages
