/** Bengali copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung.
  'stuckhelp.title.bank': 'আপনার ব্যাংককে জানান',
  'stuckhelp.title.compensation': '{amount} ক্ষতিপূরণ চান',
  'stuckhelp.title.compensationAny': 'ক্ষতিপূরণ চান',
  'stuckhelp.title.ombudsman': 'RBI Ombudsman-এর কাছে যান',
  'stuckhelp.title.merchant': '{name}-এর কাছে রিফান্ড চান',
  'stuckhelp.title.merchantAny': 'রিফান্ড চান',
  'stuckhelp.title.nch': 'জাতীয় ক্রেতা হেল্পলাইন',
  'stuckhelp.title.airsewa': 'AirSewa-তে অভিযোগ করুন',
  'stuckhelp.title.commission': 'ক্রেতা কমিশনে যান',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI-এর নিয়মে আপনার ব্যাংককে টাকা ফেরত দিতে হবে, আর প্রতিদিনের দেরির জন্য ₹100 করে দিতে হবে।',
  'stuckhelp.lead.compensation': 'RBI-এর নিয়মে টাকা যত দিন দেরিতে এসেছে, তার প্রতিদিনের জন্য ব্যাংক আপনাকে ₹100 দেবে। লিখিতভাবে দাবি করুন।',
  'stuckhelp.lead.ombudsman': 'RBI-এর অভিযোগ পরিষেবা — যখন আপনার ব্যাংক সমস্যা মেটায়নি।',
  'stuckhelp.lead.merchant': 'প্রথমে সংস্থাটিকেই লিখিতভাবে জানান, অর্ডার নম্বর সহ।',
  'stuckhelp.lead.nch': 'সরকারের হেল্পলাইন আপনার হয়ে অভিযোগটা সংস্থার কাছে পৌঁছে দেয়।',
  'stuckhelp.lead.airsewa': 'এয়ারলাইনের বিরুদ্ধে অভিযোগের জন্য অসামরিক বিমান পরিবহণ মন্ত্রকের পোর্টাল।',
  'stuckhelp.lead.commission': 'ক্রেতা কমিশন (ক্রেতা আদালত) মামলার রায় দেয়। অনলাইনেই দায়ের করা যায়।',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay-তে লেনদেনের হিস্ট্রি থেকে এই পেমেন্টটা খুলুন, Having issues ট্যাপ করুন, তারপর Payment issue (বা Stuck payment), আর একটা টিকিট তৈরি করুন।',
  'stuckhelp.bank.app.phonepe': 'PhonePe-তে History থেকে এই পেমেন্টটা খুলে Contact PhonePe Support ট্যাপ করুন।',
  'stuckhelp.bank.app.paytm':
    'Paytm-এ আপনার প্রোফাইলে ট্যাপ করুন, তারপর Help & Support। এই পেমেন্ট আর মানানসই সমস্যাটা বাছুন (টাকা কেটেছে, ব্যর্থ বা পেন্ডিং), তারপর টিকিট খুলুন।',
  'stuckhelp.bank.app.other': '{app}-এ আপনার হিস্ট্রি থেকে এই পেমেন্টটা খুলে সেখান থেকেই অভিযোগ করুন। প্রতিটি UPI অ্যাপকে এই সুযোগ দিতেই হয়।',
  'stuckhelp.bank.app.unknown': 'যে UPI অ্যাপে পেমেন্ট করেছিলেন, সেখানে এই পেমেন্টটা খুলে অভিযোগ করুন। প্রতিটি UPI অ্যাপকে এই সুযোগ দিতেই হয়।',
  'stuckhelp.bank.card': 'আপনার ব্যাংকের অ্যাপ বা নেট ব্যাংকিংয়ে এই পেমেন্ট নিয়ে ডিসপিউট করুন, বা কার্ডের পেছনের নম্বরে ফোন করুন।',
  'stuckhelp.bank.atm': 'যে ব্যাংক আপনার কার্ড দিয়েছে তাকেই জানান, ATM অন্য ব্যাংকের হলেও: তার অ্যাপে, কাস্টমার কেয়ারে বা ব্রাঞ্চে।',
  'stuckhelp.bank.wallet': 'ওয়ালেটের অ্যাপে এই পেমেন্টটা খুলে হেল্প সেকশন থেকে অভিযোগ করুন।',
  'stuckhelp.bank.direct': 'আপনার ব্যাংককে জানান: কাস্টমার কেয়ার, নেট ব্যাংকিংয়ের অভিযোগ ফর্ম, বা ব্রাঞ্চ।',
  'stuckhelp.bank.letter':
    'নিচের চিঠিটাও আপনার ব্যাংককে পাঠান — ইমেলে, নেট ব্যাংকিংয়ে বা ব্রাঞ্চে। টাকা ফেরত দেওয়া, আর দিনে ₹100, দুটোই ব্যাংকের দায়িত্ব।',
  'stuckhelp.bank.myupi':
    'অ্যাপ থেকে উত্তর আসেনি? পেমেন্টের 45 দিনের মধ্যে NPCI-এর MyUPI সাইটে (upihelp.npci.org.in) 12 অঙ্কের UPI রেফারেন্স দিয়ে জানান।',
  'stuckhelp.bank.note': 'অভিযোগ নম্বর পেয়েছেন? “অভিযোগ করেছি”-তে গিয়ে সেভ করুন। 30 দিনে না মিটলে এরপর RBI Ombudsman।',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'নিচের চিঠিটা আপনার ব্যাংককে পাঠান: কাস্টমার কেয়ারে ইমেল করে, নেট ব্যাংকিংয়ের অভিযোগ ফর্মে, বা ব্রাঞ্চে গিয়ে।',
  'stuckhelp.compensation.why': 'RBI-এর নিয়মে ব্যাংকের এটা না চাইতেই দেওয়ার কথা। চিঠিটা দিন গুনে লিখিতভাবে চায়।',

  // The RBI Ombudsman.
  'stuckhelp.ombudsman.when':
    'ব্যাংকে অভিযোগ করার পর 30 দিন কেটে গেলে দায়ের করতে পারবেন (ব্যাংক উত্তর দিয়েছে কিন্তু আপনি সন্তুষ্ট নন, তাহলে আগেই), আর তার পরের 90 দিনের মধ্যে।',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in-এ আপনার ব্যাংকের বিরুদ্ধে অভিযোগ দায়ের করুন। ফর্মের জন্য তথ্য নিচে দেওয়া আছে।',
  'stuckhelp.ombudsman.paste':
    'অভিযোগের বিবরণ হিসেবে চিঠিটা পেস্ট করুন। সঙ্গে জুড়ে দিন ব্যাংকে করা অভিযোগ, তার উত্তর (যদি থাকে), আর টাকা কাটা দেখানো স্টেটমেন্ট।',
  'stuckhelp.ombudsman.call': 'প্রশ্ন আছে? {phone}-এ ফোন করুন: সোমবার থেকে শনিবার, সকাল 8টা থেকে রাত 10টা। ওঁরা পথ দেখান, তবে অভিযোগ নিতে পারেন না।',
  'stuckhelp.ready.heading': 'এগুলো হাতের কাছে রাখুন',
  'stuckhelp.ready.complaint': 'ব্যাংকে করা আপনার অভিযোগ, আর তার নম্বর',
  'stuckhelp.ready.reply': 'ব্যাংকের উত্তর, যদি পাঠিয়ে থাকে',
  'stuckhelp.ready.payment': 'পেমেন্টের তারিখ আর রেফারেন্স',
  'stuckhelp.ready.account': 'আপনার অ্যাকাউন্ট বা কার্ড নম্বর',
  'stuckhelp.ready.relief': 'আপনি কী চাইছেন, ক্ষতিপূরণের হিসাব সহ (নিচে)',

  // The business.
  'stuckhelp.merchant.page': '{name}-এর হেল্প খুলুন, এই অর্ডারটা খুঁজে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.app': '{name}-এর অ্যাপ বা ওয়েবসাইটে এই অর্ডারটা খুলে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.unknown': 'সংস্থার সাপোর্টে যোগাযোগ করুন, পারলে অর্ডার থেকেই।',
  'stuckhelp.merchant.paste': 'নিচের মেসেজটা পেস্ট করুন আর একটা টিকিট নম্বর চেয়ে নিন।',
  'stuckhelp.merchant.nextNch': 'এক সপ্তাহে মেটেনি? এরপর জাতীয় ক্রেতা হেল্পলাইন।',
  'stuckhelp.merchant.nextAirsewa': 'এক সপ্তাহে মেটেনি? এরপর AirSewa।',
  'stuckhelp.rule.ecommerce':
    'অনলাইন ব্যবসাকে 48 ঘণ্টার মধ্যে অভিযোগ স্বীকার করতে হয় আর এক মাসের মধ্যে মেটাতে হয় (Consumer Protection (E-Commerce) Rules, 2020)।',
  'stuckhelp.rule.dgca': 'DGCA-র নিয়ম: কার্ডে পেমেন্ট হলে 7 দিনের মধ্যে রিফান্ড, আর এজেন্ট বা পোর্টাল দিয়ে বুক করলে 14 কাজের দিনের মধ্যে।',

  // The National Consumer Helpline.
  'stuckhelp.nch.send': 'নিচের মেসেজটা WhatsApp-এ {whatsapp}-এ পাঠান, {phone} বা {tollFree}-এ ফোন করুন (সকাল 8টা থেকে রাত 8টা), বা consumerhelpline.gov.in-এ নথিভুক্ত করুন।',
  'stuckhelp.nch.docket': 'হেল্পলাইন বিষয়টা {name}-এর কাছে তুলবে। হেল্পলাইন যে ডকেট নম্বর দেবে, সেটা লিখে রাখুন।',
  'stuckhelp.nch.docketAny': 'হেল্পলাইন বিষয়টা সংস্থার কাছে তুলবে। হেল্পলাইন যে ডকেট নম্বর দেবে, সেটা লিখে রাখুন।',
  'stuckhelp.nch.next': 'এক মাসে মেটেনি? এরপর ক্রেতা কমিশন।',

  // AirSewa.
  'stuckhelp.airsewa.file': 'airsewa.gov.in বা AirSewa অ্যাপে রেজিস্টার করে {name}-এর বিরুদ্ধে অভিযোগ দায়ের করুন।',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in বা AirSewa অ্যাপে রেজিস্টার করে এয়ারলাইনের বিরুদ্ধে অভিযোগ দায়ের করুন।',
  'stuckhelp.airsewa.paste': 'PNR সহ নিচের মেসেজটা পেস্ট করুন, আর টিকিট বাতিলের ও রিফান্ডের মেসেজ জুড়ে দিন।',
  'stuckhelp.airsewa.note': 'AirSewa যে রেফারেন্স নম্বর পাঠাবে, সেটা লিখে রাখুন।',

  // A consumer commission.
  'stuckhelp.commission.where': 'ক্রেতা অভিযোগ অনলাইনে e-Jagriti-তে (e-jagriti.gov.in) দায়ের করা হয়। ₹50 লাখ পর্যন্ত অঙ্কের জন্য আপনার জেলা কমিশন।',
  'stuckhelp.commission.attach': 'নিচের সারাংশ থেকে শুরু করুন। সঙ্গে জুড়ে দিন অর্ডার, রিফান্ড বা ব্যর্থ পেমেন্টের মেসেজ, আর নম্বর সহ আপনার অভিযোগগুলো।',
  'stuckhelp.commission.advice': 'Settle আইনি পরামর্শ দেয় না। দায়ের করতে সাহায্য লাগলে কমিশন বা কোনো ক্রেতা সংগঠনকে জিজ্ঞেস করুন।',

  // Buttons and links that take you there.
  'stuckhelp.link.cms': 'cms.rbi.org.in খুলুন',
  'stuckhelp.link.call': '{phone}-এ ফোন করুন',
  'stuckhelp.link.myupi': 'NPCI-এর MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe-র অভিযোগ ডেস্ক',
  'stuckhelp.link.merchantHelp': '{name}-এর হেল্প খুলুন',
  'stuckhelp.link.merchantRefunds': '{name}-এর রিফান্ড নীতি',
  'stuckhelp.link.whatsapp': 'WhatsApp-এ পাঠান',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa খুলুন',
  'stuckhelp.link.ejagriti': 'e-Jagriti খুলুন',
  'stuckhelp.links.aria': 'ওদের কাছে পৌঁছনোর অন্য উপায়',
  'stuckhelp.newTab': '{label} (নতুন ট্যাবে খোলে)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'ব্যর্থ পেমেন্ট',
  'stuckhelp.party.refund': 'রিফান্ড',
  'stuckhelp.how.heading': 'কোথায় আর কীভাবে',
  'stuckhelp.fields.heading': 'ফর্মের জন্য',
  'stuckhelp.fields.hint': 'cms.rbi.org.in-এর অভিযোগ ফর্মে এগুলো লিখুন।',
  'stuckhelp.field.entity': 'ব্যাংক',
  'stuckhelp.field.category': 'কী নিয়ে',
  'stuckhelp.field.date': 'পেমেন্টের তারিখ',
  'stuckhelp.field.amount': 'টাকার অঙ্ক',
  'stuckhelp.field.reference': 'লেনদেনের রেফারেন্স',
  'stuckhelp.field.account': 'অ্যাকাউন্ট বা কার্ড',
  'stuckhelp.field.bankComplaint': 'ব্যাংকে করা আপনার অভিযোগ',
  'stuckhelp.field.relief': 'যে প্রতিকার চাইছেন',
  'stuckhelp.field.copy': '{field} কপি করুন',
  'stuckhelp.field.copied': '{field} কপি হয়েছে',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {মেসেজ} summary {সারাংশ} other {চিঠি}}',
  'stuckhelp.letter.subject': 'বিষয়',
  'stuckhelp.letter.fill': 'পাঠানোর আগে [বন্ধনীর] ভেতরের অংশগুলো ভরে দিন।',
  'stuckhelp.letter.actions': 'চিঠিটা পাঠান',
  'stuckhelp.action.email': 'ইমেল',
  'stuckhelp.copied.status': 'কপি হয়েছে',
  'stuckhelp.copied.toast': 'কপি হয়েছে। যেখানে পাঠাচ্ছেন সেখানে পেস্ট করুন।',
  'stuckhelp.copyFailed.toast': 'কপি করা গেল না। লেখাটা সিলেক্ট করে কপি করুন।',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'অভিযোগ করেছি',
  'stuckhelp.raised.title': 'কবে অভিযোগ করেছেন?',
  'stuckhelp.raised.description': 'পরের ধাপের অপেক্ষা Settle এই দিন থেকে গুনবে।',
  'stuckhelp.raised.date': 'অভিযোগের তারিখ',
  'stuckhelp.raised.ref': '{kind, select, merchant {টিকিট নম্বর} nch {ডকেট নম্বর} airsewa {রেফারেন্স নম্বর} commission {কেস নম্বর} other {অভিযোগ নম্বর}}',
  'stuckhelp.raised.refHint': 'ঐচ্ছিক, যদি পেয়ে থাকেন',
  'stuckhelp.raised.save': 'সেভ করুন',
  'stuckhelp.raised.toast':
    '{kind, select, bank {নোট করা হল: {date}-এ আপনার ব্যাংককে জানানো হয়েছে} ombudsman {নোট করা হল: {date}-এ RBI Ombudsman-এর কাছে নিয়ে যাওয়া হয়েছে} merchant {নোট করা হল: {date}-এ {name}-কে জানানো হয়েছে} nch {নোট করা হল: {date}-এ জাতীয় ক্রেতা হেল্পলাইনে জানানো হয়েছে} airsewa {নোট করা হল: {date}-এ AirSewa-তে জানানো হয়েছে} other {নোট করা হল: {date}-এ ক্রেতা কমিশনে দায়ের করা হয়েছে}}',
}
