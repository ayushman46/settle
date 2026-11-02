/** Bengali copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung — the same words as the button that opens it ({amount} is pre-formatted: "₹300"; {name} a business or a wallet: "Swiggy", "Paytm").
  'stuckhelp.title.bank': 'আপনার ব্যাংককে জানান',
  'stuckhelp.title.wallet': '{name}কে জানান',
  'stuckhelp.title.walletAny': 'ওয়ালেট কোম্পানিকে জানান',
  'stuckhelp.title.compensation': '{amount} ক্ষতিপূরণ চান',
  'stuckhelp.title.compensationAny': 'ক্ষতিপূরণ চান',
  'stuckhelp.title.ombudsman': 'RBI Ombudsman-এর কাছে যান',
  'stuckhelp.title.merchant': '{name}-কে জানান',
  'stuckhelp.title.merchantAny': 'সংস্থাটিকে জানান',
  'stuckhelp.title.nch': 'জাতীয় ক্রেতা হেল্পলাইনে যান',
  'stuckhelp.title.airsewa': 'AirSewa-তে যান',
  'stuckhelp.title.commission': 'ক্রেতা কমিশনে যান',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI-এর নিয়মে আপনার ব্যাংককে টাকা ফেরত দিতে হবে, আর প্রতিদিনের দেরির জন্য ₹100 করে দিতে হবে।',
  'stuckhelp.lead.wallet': 'RBI-এর নিয়মে ওয়ালেট কোম্পানিকে পরের দিনের মধ্যে টাকা ফেরত দিতে হবে, আর প্রতিদিনের দেরির জন্য ₹100 করে দিতে হবে।',
  'stuckhelp.lead.compensation': 'RBI-এর নিয়মে টাকা যত দিন দেরিতে এসেছে, তার প্রতিদিনের জন্য ব্যাংক আপনাকে ₹100 দেবে। লিখিতভাবে দাবি করুন।',
  'stuckhelp.lead.compensationWallet': 'RBI-এর নিয়মে টাকা যত দিন দেরিতে এসেছে, তার প্রতিদিনের জন্য ওয়ালেট কোম্পানি আপনাকে ₹100 দেবে। লিখিতভাবে দাবি করুন।',
  'stuckhelp.lead.ombudsman': 'RBI-এর অভিযোগ পরিষেবা — যখন আপনার ব্যাংক সমস্যা মেটায়নি।',
  'stuckhelp.lead.ombudsmanWallet': 'RBI-এর অভিযোগ পরিষেবা — যখন ওয়ালেট কোম্পানি সমস্যা মেটায়নি।',
  'stuckhelp.lead.merchant': 'প্রথমে সংস্থাটিকেই লিখিতভাবে জানান, অর্ডার নম্বর সহ।',
  'stuckhelp.lead.airline': 'প্রথমে এয়ারলাইনকেই লিখিতভাবে জানান, আপনার PNR সহ।',
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
    'অ্যাপ থেকে উত্তর আসেনি? পেমেন্টের 45 দিনের মধ্যে UPI হেল্প ওয়েবসাইটে অভিযোগ করুন (upihelp.npci.org.in — চালায় NPCI, UPI-এর পেছনের সংস্থা)। SMS-এর 12 অঙ্কের নম্বরটা হাতের কাছে রাখুন।',
  'stuckhelp.bank.myupiPassed': 'UPI হেল্প ওয়েবসাইট শুধু পেমেন্টের 45 দিনের মধ্যে অভিযোগ নেয়, আর সেই সময় পেরিয়ে গেছে। তার বদলে আপনার ব্যাংককে চিঠিটা পাঠান।',
  'stuckhelp.bank.note': 'অভিযোগ নম্বর পেয়েছেন? “অভিযোগ করেছি” ট্যাপ করে সেভ করুন। 30 দিনে না মিটলে এরপর RBI Ombudsman।',
  // Once it's raised ({date}: "2 Nov"; {ref}: the complaint number, or "none").
  'stuckhelp.bank.raised': 'আপনি {date}-এ অভিযোগ করেছেন{ref, select, none {} other { (নম্বর {ref})}}। তার 30 দিনের মধ্যে না মিটলে, এরপর RBI Ombudsman।',

  // A wallet payment ({name}: "Paytm").
  'stuckhelp.wallet.app': '{name} অ্যাপে এই পেমেন্টটা খুলে তার হেল্প সেকশন থেকে অভিযোগ করুন।',
  'stuckhelp.wallet.letter':
    'অ্যাপে মেটেনি? নিচের চিঠিটা ওয়ালেট কোম্পানির অভিযোগ আধিকারিককে (grievance officer) পাঠান; যোগাযোগের ঠিকানা অ্যাপের হেল্পে বা ওদের অভিযোগ নীতিতে পাবেন। টাকা ফেরত দেওয়া, আর দিনে ₹100, দুটোই ওয়ালেট কোম্পানির দায়িত্ব।',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'নিচের চিঠিটা আপনার ব্যাংককে পাঠান: কাস্টমার কেয়ারে ইমেল করে, নেট ব্যাংকিংয়ের অভিযোগ ফর্মে, বা ব্রাঞ্চে গিয়ে।',
  'stuckhelp.compensation.sendWallet': 'নিচের চিঠিটা ওয়ালেট কোম্পানির অভিযোগ আধিকারিককে পাঠান: ইমেলে, বা ওদের অ্যাপের হেল্প সেকশন থেকে।',
  'stuckhelp.compensation.why': 'RBI-এর নিয়মে এটা না চাইতেই দেওয়ার কথা। চিঠিটা দিন গুনে লিখিতভাবে চায়।',

  // The RBI Ombudsman ({phone}: 14448; {issuer}: "Paytm Payments Bank Ltd"; {email}: crpc@rbi.org.in; {address}: the RBI's postal address, in English).
  'stuckhelp.ombudsman.when':
    'ব্যাংকে অভিযোগ করার পর 30 দিন কেটে গেলে দায়ের করতে পারবেন (ব্যাংক উত্তর দিয়েছে কিন্তু আপনি সন্তুষ্ট নন, তাহলে আগেই)। তারপর 90 দিন সময় পাবেন — ওই 30 দিন শেষ হওয়া আর ব্যাংকের শেষ উত্তর, এই দুইয়ের যেটা পরে, সেদিন থেকে।',
  'stuckhelp.ombudsman.whenWallet':
    'ওয়ালেট কোম্পানিতে অভিযোগ করার পর 30 দিন কেটে গেলে দায়ের করতে পারবেন (কোম্পানি উত্তর দিয়েছে কিন্তু আপনি সন্তুষ্ট নন, তাহলে আগেই)। তারপর 90 দিন সময় পাবেন — ওই 30 দিন শেষ হওয়া আর কোম্পানির শেষ উত্তর, এই দুইয়ের যেটা পরে, সেদিন থেকে।',
  // This case's last day ({date}: "2 Mar 2027"; {kind}: bank or wallet).
  'stuckhelp.ombudsman.lastDay':
    '{kind, select, wallet {বড়জোর {date}-এর মধ্যে দায়ের করুন: ওয়ালেট কোম্পানির 30 দিন শেষ হওয়া আর ওদের শেষ উত্তর, এই দুইয়ের যেটা পরে, সেদিন থেকে 90 দিন (RBI Integrated Ombudsman Scheme, 2026)।} other {বড়জোর {date}-এর মধ্যে দায়ের করুন: আপনার ব্যাংকের 30 দিন শেষ হওয়া আর ব্যাংকের শেষ উত্তর, এই দুইয়ের যেটা পরে, সেদিন থেকে 90 দিন (RBI Integrated Ombudsman Scheme, 2026)।}}',
  'stuckhelp.ombudsman.post': 'ওয়েবসাইট ব্যবহার করতে পারছেন না? অভিযোগটা {email} ঠিকানায় ইমেল করুন, বা সই করে, কাগজপত্রের কপি সহ ডাকে পাঠান এই ঠিকানায়: {address}।',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in-এ আপনার ব্যাংকের বিরুদ্ধে অভিযোগ দায়ের করুন। ফর্মের জন্য তথ্য নিচে দেওয়া আছে।',
  'stuckhelp.ombudsman.fileWallet': 'cms.rbi.org.in-এ অভিযোগ দায়ের করুন। কার বিরুদ্ধে: {issuer} (ওয়ালেটটা এই কোম্পানির)। ফর্মের জন্য তথ্য নিচে দেওয়া আছে।',
  'stuckhelp.ombudsman.fileWalletAny': 'cms.rbi.org.in-এ ওয়ালেটটা যে কোম্পানির, তার বিরুদ্ধে অভিযোগ দায়ের করুন। ফর্মের জন্য তথ্য নিচে দেওয়া আছে।',
  'stuckhelp.ombudsman.paste':
    'অভিযোগের বিবরণ হিসেবে চিঠিটা পেস্ট করুন। সঙ্গে জুড়ে দিন ব্যাংকে করা অভিযোগ, তার উত্তর (যদি থাকে), আর টাকা কাটা দেখানো স্টেটমেন্ট।',
  'stuckhelp.ombudsman.pasteWallet':
    'অভিযোগের বিবরণ হিসেবে চিঠিটা পেস্ট করুন। সঙ্গে জুড়ে দিন ওয়ালেট কোম্পানিতে করা অভিযোগ, তার উত্তর (যদি থাকে), আর টাকা কাটা দেখানো ওয়ালেট স্টেটমেন্ট।',
  'stuckhelp.ombudsman.call': 'প্রশ্ন আছে? {phone} নম্বরে ফোন করুন: সোমবার থেকে শনিবার, সকাল 8টা থেকে রাত 10টা। ওঁরা পথ দেখান, তবে অভিযোগ নিতে পারেন না।',
  'stuckhelp.ready.heading': 'এগুলো হাতের কাছে রাখুন',
  'stuckhelp.ready.complaint': 'ব্যাংকে করা আপনার অভিযোগ, আর তার নম্বর',
  'stuckhelp.ready.complaintWallet': 'ওয়ালেট কোম্পানিতে করা আপনার অভিযোগ, আর তার নম্বর',
  'stuckhelp.ready.reply': 'ব্যাংকের উত্তর, যদি পাঠিয়ে থাকে',
  'stuckhelp.ready.replyWallet': 'ওয়ালেট কোম্পানির উত্তর, যদি পাঠিয়ে থাকে',
  'stuckhelp.ready.payment': 'পেমেন্টের তারিখ আর রেফারেন্স',
  'stuckhelp.ready.account': 'আপনার অ্যাকাউন্ট বা কার্ড নম্বর',
  'stuckhelp.ready.wallet': 'ওয়ালেটে রেজিস্টার করা মোবাইল নম্বর',
  'stuckhelp.ready.relief': 'আপনি কী চাইছেন, ক্ষতিপূরণের হিসাব সহ (নিচে)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} হেল্প খুলুন, এই অর্ডারটা খুঁজে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.app': '{name} অ্যাপ বা ওয়েবসাইটে এই অর্ডারটা খুলে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.unknown': 'সংস্থার সাপোর্টে যোগাযোগ করুন, পারলে অর্ডার থেকেই।',
  // An airline: a booking, not an order.
  'stuckhelp.merchant.pageBooking': '{name} হেল্প খুলুন, এই বুকিংটা খুঁজে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.appBooking': '{name} অ্যাপ বা ওয়েবসাইটে এই বুকিংটা খুলে সেখান থেকে সাপোর্টে যোগাযোগ করুন।',
  'stuckhelp.merchant.nodal': 'কয়েক দিনে উত্তর আসেনি? {name} ওয়েবসাইটে অভিযোগের জন্য Nodal Officer-এর যোগাযোগ দেওয়া থাকে — PNR আর টিকিট নম্বর সহ তাঁকে লিখুন।',
  'stuckhelp.merchant.nodalAny': 'কয়েক দিনে উত্তর আসেনি? এয়ারলাইনের ওয়েবসাইটে অভিযোগের জন্য Nodal Officer-এর যোগাযোগ দেওয়া থাকে — PNR আর টিকিট নম্বর সহ তাঁকে লিখুন।',
  'stuckhelp.merchant.paste': 'নিচের মেসেজটা পেস্ট করুন আর একটা টিকিট নম্বর চেয়ে নিন।',
  // Settle's own advice (a week), not the law's month.
  'stuckhelp.merchant.nextNch': 'ওদের এক সপ্তাহ সময় দিন। তবুও না মিটলে জাতীয় ক্রেতা হেল্পলাইনে যেতে পারেন; পুরো এক মাস অপেক্ষা করতে হবে না।',
  'stuckhelp.merchant.nextAirsewa': 'ওদের এক সপ্তাহ সময় দিন। তবুও না মিটলে AirSewa-তে যেতে পারেন।',
  'stuckhelp.rule.ecommerce':
    'অনলাইন ব্যবসাকে 48 ঘণ্টার মধ্যে অভিযোগ স্বীকার করতে হয় আর এক মাসের মধ্যে মেটাতে হয় (Consumer Protection (E-Commerce) Rules, 2020)।',
  'stuckhelp.rule.dgca': 'DGCA-র নিয়ম: কার্ডে পেমেন্ট হলে 7 দিনের মধ্যে রিফান্ড, আর এজেন্ট বা পোর্টাল দিয়ে বুক করলে 14 কাজের দিনের মধ্যে।',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'নিচের মেসেজটা WhatsApp-এ {whatsapp} নম্বরে পাঠান, {phone} বা {tollFree} নম্বরে ফোন করুন (সকাল 8টা থেকে রাত 8টা), বা consumerhelpline.gov.in-এ নথিভুক্ত করুন।',
  'stuckhelp.nch.docket': 'হেল্পলাইন বিষয়টা {name}-কে জানাবে। হেল্পলাইন যে ডকেট নম্বর দেবে, সেটা লিখে রাখুন।',
  'stuckhelp.nch.docketAny': 'হেল্পলাইন বিষয়টা সংস্থার কাছে তুলবে। হেল্পলাইন যে ডকেট নম্বর দেবে, সেটা লিখে রাখুন।',
  'stuckhelp.nch.next': 'এক মাসে মেটেনি? এরপর ক্রেতা কমিশন।',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in বা AirSewa অ্যাপে রেজিস্টার করে {name} নিয়ে অভিযোগ দায়ের করুন।',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in বা AirSewa অ্যাপে রেজিস্টার করে এয়ারলাইনের বিরুদ্ধে অভিযোগ দায়ের করুন।',
  'stuckhelp.airsewa.paste': 'PNR সহ নিচের মেসেজটা পেস্ট করুন, আর টিকিট বাতিলের ও রিফান্ডের মেসেজ জুড়ে দিন।',
  'stuckhelp.airsewa.note': 'AirSewa যে রেফারেন্স নম্বর পাঠাবে, সেটা লিখে রাখুন।',

  // A consumer commission.
  'stuckhelp.commission.where': 'ক্রেতা অভিযোগ অনলাইনে e-Jagriti-তে (e-jagriti.gov.in) দায়ের করা হয়। ₹50 লাখ পর্যন্ত অঙ্কের জন্য আপনার জেলা কমিশন।',
  'stuckhelp.commission.attach': 'নিচের সারাংশ থেকে শুরু করুন। সঙ্গে জুড়ে দিন অর্ডার, রিফান্ড বা ব্যর্থ পেমেন্টের মেসেজ, আর নম্বর সহ আপনার অভিযোগগুলো।',
  'stuckhelp.commission.advice': 'Settle আইনি পরামর্শ দেয় না। দায়ের করতে সাহায্য লাগলে কমিশন বা কোনো ক্রেতা সংগঠনকে জিজ্ঞেস করুন।',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in খুলুন',
  'stuckhelp.link.call': '{phone} নম্বরে ফোন করুন',
  'stuckhelp.link.myupi': 'UPI হেল্প ওয়েবসাইট',
  'stuckhelp.link.phonepeGrievance': 'PhonePe-র অভিযোগ ডেস্ক',
  'stuckhelp.link.merchantHelp': '{name} হেল্প খুলুন',
  'stuckhelp.link.merchantRefunds': '{name} রিফান্ড হেল্প খুলুন',
  'stuckhelp.link.whatsapp': 'WhatsApp-এ পাঠান',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa খুলুন',
  'stuckhelp.link.ejagriti': 'e-Jagriti খুলুন',
  'stuckhelp.links.aria': 'ওদের কাছে পৌঁছনোর অন্য উপায়',
  'stuckhelp.newTab': '{label} (নতুন ট্যাবে খোলে)',

  // The sheet. Above the title, what's still owed ({amount}, {rest}, {owed}: "₹49"; {name}: who it was paid to, or the business).
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.eyebrow.part': 'মোট {amount} থেকে {rest} বাকি · {name}',
  'stuckhelp.eyebrow.owed': 'দেরির জন্য {owed} · {name}',
  'stuckhelp.party.failed': 'ব্যর্থ পেমেন্ট',
  'stuckhelp.party.refund': 'রিফান্ড',
  'stuckhelp.how.heading': 'কোথায় আর কীভাবে',
  'stuckhelp.fields.heading': 'ফর্মের জন্য',
  'stuckhelp.fields.hint': 'cms.rbi.org.in-এর অভিযোগ ফর্মে এগুলো লিখুন।',
  'stuckhelp.field.entity': 'ব্যাংক',
  'stuckhelp.field.entityWallet': 'ওয়ালেট কোম্পানি',
  'stuckhelp.field.category': 'কী নিয়ে',
  'stuckhelp.field.date': 'পেমেন্টের তারিখ',
  'stuckhelp.field.amount': 'টাকার অঙ্ক',
  'stuckhelp.field.reference': 'লেনদেনের রেফারেন্স',
  'stuckhelp.field.account': 'অ্যাকাউন্ট বা কার্ড',
  'stuckhelp.field.mobile': 'রেজিস্টার করা মোবাইল',
  'stuckhelp.field.bankComplaint': 'ব্যাংকে করা আপনার অভিযোগ',
  'stuckhelp.field.walletComplaint': 'ওয়ালেট কোম্পানিতে করা আপনার অভিযোগ',
  'stuckhelp.field.relief': 'যে প্রতিকার চাইছেন',
  'stuckhelp.field.copy': '{field} কপি করুন',
  'stuckhelp.field.copied': '{field} কপি হয়েছে',

  // Your details for letters: asked once, kept on this phone. The name and UPI ID go to your profile.
  'stuckhelp.me.heading': 'আপনার তথ্য',
  'stuckhelp.me.hint': 'Settle এগুলো চিঠিতে বসায়। এগুলো এই ফোনেই থাকে, কোথাও পাঠানো হয় না।',
  'stuckhelp.me.name': 'আপনার নাম',
  'stuckhelp.me.mobile': 'মোবাইল নম্বর',
  'stuckhelp.me.upi': 'আপনার UPI ID (ঐচ্ছিক)',
  'stuckhelp.me.upiHint': 'UPI পেমেন্টটা খুঁজে পেতে এটা ব্যাংকের কাজে লাগে। Settle এটা আপনার প্রোফাইলে সেভ করে।',
  'stuckhelp.me.place': 'শহর আর রাজ্য',
  // Under the empty field, so it never looks filled in.
  'stuckhelp.me.placeExample': 'যেমন: Kolkata, West Bengal',
  'stuckhelp.me.address': 'ঠিকানা (ঐচ্ছিক)',
  'stuckhelp.me.change': 'বদলান',
  'stuckhelp.me.changeLabel': 'আপনার তথ্য বদলান',

  // A NACH debit: was the mandate cancelled before it?
  'stuckhelp.mandate.heading': 'ম্যান্ডেট',
  'stuckhelp.mandate.question': 'টাকা কাটার আগে কি এই ম্যান্ডেট আপনার ব্যাংকে বাতিল করেছিলেন?',
  'stuckhelp.mandate.no': 'না',
  'stuckhelp.mandate.yes': 'হ্যাঁ, বাতিল করেছিলাম',
  'stuckhelp.mandate.date': 'বাতিলের তারিখ (ঐচ্ছিক)',
  'stuckhelp.mandate.hint': 'ম্যান্ডেট বাতিলের পরে টাকা কাটা ব্যর্থ পেমেন্ট নয়, তাই চিঠিতে লেখা থাকে যে বাতিলের পরে টাকা কাটা হয়েছে।',

  // Who the email goes to ({kind}: bank, wallet or business; {email}: "crpc@rbi.org.in").
  'stuckhelp.email.label': 'কাকে পাঠাবেন (ইমেল)',
  'stuckhelp.email.hint':
    '{kind, select, wallet {ওয়ালেট কোম্পানির অভিযোগ জানানোর ইমেল, ওদের অ্যাপের হেল্পে পাবেন।} business {সংস্থার সাপোর্ট ইমেল, যদি থাকে।} other {আপনার ব্যাংকের অভিযোগ জানানোর ইমেল, ওদের ওয়েবসাইট বা অ্যাপে পাবেন।}} Settle এটা এই ফোনে মনে রাখে।',
  'stuckhelp.email.crpc': 'ইমেল যাবে RBI-এর অভিযোগ কেন্দ্রে, {email}।',

  // The payment's reference, when it wasn't saved ({kind}: upi, imps, wallet, nach or other).
  'stuckhelp.ref.label':
    '{kind, select, upi {UPI রেফারেন্স (12 অঙ্ক)} imps {IMPS রেফারেন্স (12 অঙ্ক)} wallet {ওয়ালেট লেনদেনের ID} nach {ম্যান্ডেট (UMRN) বা টাকা কাটার রেফারেন্স} other {লেনদেনের রেফারেন্স}}',
  'stuckhelp.ref.hint': 'ব্যাংকের SMS থেকে, বা আপনার অ্যাপে পেমেন্টটা খুলে। Settle এটা এই পেমেন্টের সঙ্গে সেভ করে রাখে।',

  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {মেসেজ} summary {সারাংশ} other {চিঠি}}',
  'stuckhelp.letter.blanks':
    '{count, plural, one {[ব্র্যাকেটের] ভেতরের #টা অংশ এখনো ভরা বাকি। পাঠানোর আগে সেটা ভরে দিন।} other {[ব্র্যাকেটের] ভেতরের #টা অংশ এখনো ভরা বাকি। পাঠানোর আগে সেগুলো ভরে দিন।}}',
  'stuckhelp.letter.actions': 'চিঠিটা পাঠান',
  // Sending while a [bracket] is still empty: said first ({count}: how many; {action}: copy, share, print, email or send).
  'stuckhelp.blanks.title': '{count, plural, one {#টা অংশ এখনো খালি} other {#টা অংশ এখনো খালি}}',
  'stuckhelp.blanks.description':
    '{count, plural, one {সেটা [ব্র্যাকেট] দিয়ে চিহ্নিত। আগে ভরে দিন, বা যেমন আছে তেমনই পাঠিয়ে যেখানে পেস্ট করবেন সেখানে ভরে নিন।} other {সেগুলো [ব্র্যাকেট] দিয়ে চিহ্নিত। আগে ভরে দিন, বা যেমন আছে তেমনই পাঠিয়ে যেখানে পেস্ট করবেন সেখানে ভরে নিন।}}',
  'stuckhelp.blanks.list': 'এখনো খালি',
  'stuckhelp.blanks.fill': '{count, plural, one {ভরে দিন} other {ভরে দিন}}',
  'stuckhelp.blanks.anyway': '{action, select, copy {তবুও কপি করুন} share {তবুও শেয়ার করুন} print {তবুও প্রিন্ট করুন} email {তবুও ইমেল করুন} other {তবুও পাঠান}}',
  // Above the letter, in the app's language: what it asks for ({amount}, {compensation}, {total}: "₹500").
  'stuckhelp.summary.reverse': 'এতে {amount} ফেরত চাওয়া হয়েছে, আর দেরির প্রতিদিনের জন্য ₹100।',
  'stuckhelp.summary.reverseOwed': 'এতে {amount} ফেরত চাওয়া হয়েছে, আর দেরির জন্য এখন পর্যন্ত পাওনা {compensation} (দিনে ₹100)।',
  'stuckhelp.summary.compensation': 'এতে টাকা যত দিন দেরিতে এসেছে, তার জন্য পাওনা {compensation} চাওয়া হয়েছে (দিনে ₹100)।',
  'stuckhelp.summary.compensationAny': 'এতে টাকা যত দিন দেরিতে এসেছে, তার জন্য পাওনা ক্ষতিপূরণ চাওয়া হয়েছে (দিনে ₹100)।',
  'stuckhelp.summary.ombudsman': 'এতে RBI Ombudsman-কে জানানো হয়েছে কী ঘটেছে আর আপনার অভিযোগের কী হল, আর এখন পর্যন্ত আপনার পাওনা {total} চাওয়া হয়েছে।',
  'stuckhelp.summary.ombudsmanBoth':
    'এতে RBI Ombudsman-কে জানানো হয়েছে কী ঘটেছে আর আপনার অভিযোগের কী হল, আর আপনার {amount} ফেরত চাওয়া হয়েছে, সঙ্গে দেরির জন্য এখন পর্যন্ত পাওনা {compensation} (দিনে ₹100)।',
  'stuckhelp.summary.ombudsmanAny': 'এতে RBI Ombudsman-কে জানানো হয়েছে কী ঘটেছে আর আপনার অভিযোগের কী হল, আর আপনার যা পাওনা তা চাওয়া হয়েছে।',
  'stuckhelp.summary.refund': 'এতে আপনার {amount} রিফান্ড চাওয়া হয়েছে, বা আগেই পাঠানো হয়ে থাকলে তার রেফারেন্স নম্বর, যাতে আপনি খোঁজ নিতে পারেন।',
  'stuckhelp.summary.confirm': 'এতে ওদের লিখিতভাবে জানাতে বলা হয়েছে আপনার {amount} ওদের কাছে পৌঁছেছে কি না, যাতে আপনি ব্যাংককে দেখাতে পারেন।',
  'stuckhelp.summary.nch': 'এতে হেল্পলাইনকে আপনার {amount} নিয়ে সংস্থার সঙ্গে কথা বলতে বলা হয়েছে, আর এ পর্যন্ত আপনি কী কী করেছেন তা লেখা আছে।',
  'stuckhelp.summary.airsewa': 'এতে AirSewa-কে বলা হয়েছে, DGCA-র নিয়ম অনুযায়ী এয়ারলাইন যেন আপনার {amount} রিফান্ড দেয়।',
  'stuckhelp.summary.commission': 'এতে কমিশনের জন্য আপনার মামলার সারাংশ আছে: কী ঘটেছে, কবে, আপনি কী করেছেন, আর আপনি যে {amount} চাইছেন।',
  'stuckhelp.summary.english':
    '{kind, select, message {মেসেজটা} summary {সারাংশটা} other {চিঠিটা}} ইংরেজিতে, কারণ ব্যাংক, ব্যবসা আর নিয়ন্ত্রক সংস্থাগুলো এই ভাষাতেই কাজ করে।',
  'stuckhelp.action.copy': '{kind, select, message {মেসেজ কপি করুন} summary {সারাংশ কপি করুন} other {চিঠি কপি করুন}}',
  'stuckhelp.action.email': 'ইমেল',
  'stuckhelp.action.print': 'প্রিন্ট বা PDF হিসেবে সেভ করুন',
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
  // Not "Back": in a money app that reads as money returned ({kind}: letter, message or summary).
  'stuckhelp.raised.back': '{kind, select, message {মেসেজে ফিরে যান} summary {সারাংশে ফিরে যান} other {চিঠিতে ফিরে যান}}',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {নোট করা হল: {date}-এ আপনার ব্যাংককে জানানো হয়েছে} ombudsman {নোট করা হল: {date}-এ RBI Ombudsman-এর কাছে নিয়ে যাওয়া হয়েছে} merchant {নোট করা হল: {date}-এ {name}-কে জানানো হয়েছে} nch {নোট করা হল: {date}-এ জাতীয় ক্রেতা হেল্পলাইনে জানানো হয়েছে} airsewa {নোট করা হল: {date}-এ AirSewa-তে জানানো হয়েছে} other {নোট করা হল: {date}-এ ক্রেতা কমিশনে দায়ের করা হয়েছে}}',
}
