/** Hindi copy for S3 · food-delivery splits. Keys: `delivery.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const delivery = {
  // The scan step opened from Home's "Food order" tile.
  'delivery.scan.title': 'फ़ूड ऑर्डर बाँटें',
  'delivery.scan.subtitle':
    'Swiggy, Zomato, Blinkit, Zepto या Instamart के ऑर्डर का स्क्रीनशॉट डालें — हम आइटम, चार्ज और कूपन खुद निकाल लेंगे।',
  'delivery.scan.choose.cta': 'स्क्रीनशॉट चुनें',
  'delivery.scan.camera.cta': 'फ़ोटो लें',
  // Extra lines in the rotating "reading" status while a delivery order is read.
  'delivery.scan.status.fees': 'चार्ज ढूँढ रहे हैं…',
  'delivery.scan.status.coupon': 'कूपन देख रहे हैं…',

  // The fees section on the bill review step.
  'delivery.review.fees.title': 'फ़ीस और चार्ज',
  'delivery.review.fees.add.cta': 'चार्ज जोड़ें',
  'delivery.review.fees.hint': 'चार्ज कैसे बाँटने हैं, ये अगले स्टेप में चुनेंगे।',
  // A fee row's accessible name: "Delivery fee, ₹35, edit".
  'delivery.review.fees.row.aria': '{label}, {amount}, बदलें',
  'delivery.review.fees.removed.toast': '{label} हटाया',
  'delivery.review.fees.full.toast': 'एक बिल में ज़्यादा से ज़्यादा {max} चार्ज हो सकते हैं।',
  'delivery.review.fees.converted.toast': '{label} अब एक आइटम है — अगले स्टेप में बताएँ किसने लिया',
  'delivery.review.fees.undoFailed.toast': 'वापस नहीं ले पाए — बिल बदल गया है',
  // The sheet for one fee.
  'delivery.fee.title': 'चार्ज',
  'delivery.fee.name.label': 'नाम',
  'delivery.fee.amount.label': 'रकम',
  'delivery.fee.amount.error': 'चार्ज की रकम डालें (0 से ज़्यादा)',
  'delivery.fee.kind.label': 'किस तरह का',
  'delivery.fee.kind.delivery': 'डिलीवरी',
  'delivery.fee.kind.platform': 'प्लेटफ़ॉर्म',
  'delivery.fee.kind.packaging': 'पैकेजिंग',
  'delivery.fee.kind.surge': 'सर्ज/बारिश',
  'delivery.fee.kind.smallOrder': 'छोटा ऑर्डर',
  'delivery.fee.kind.tip': 'टिप',
  'delivery.fee.kind.donation': 'दान',
  'delivery.fee.kind.feeTax': 'चार्ज पर GST',
  'delivery.fee.kind.other': 'अन्य',
  // The name a fee gets when none is typed (also the field's placeholder).
  'delivery.fee.default.delivery': 'डिलीवरी चार्ज',
  'delivery.fee.default.platform': 'प्लेटफ़ॉर्म चार्ज',
  'delivery.fee.default.packaging': 'पैकेजिंग',
  'delivery.fee.default.surge': 'बारिश चार्ज',
  'delivery.fee.default.smallOrder': 'छोटे ऑर्डर का चार्ज',
  'delivery.fee.default.tip': 'टिप',
  'delivery.fee.default.donation': 'दान',
  'delivery.fee.default.feeTax': 'चार्ज पर GST',
  'delivery.fee.default.other': 'चार्ज',
  'delivery.fee.add.cta': 'चार्ज जोड़ें',
  'delivery.fee.save.cta': 'सेव करें',
  'delivery.fee.remove.cta': 'चार्ज हटाएँ',
  'delivery.fee.tip.hint': 'सिर्फ़ एक व्यक्ति ने टिप दी? इसे आइटम की तरह जोड़ें।',
  'delivery.fee.tip.cta': 'आइटम बनाएँ',

  // The fee policy on the "What you paid" step.
  'delivery.paid.policy.label': 'चार्ज कैसे बाँटें?',
  'delivery.paid.policy.equal': 'बराबर-बराबर',
  'delivery.paid.policy.proportional': 'जिसने जितना लिया',
  'delivery.paid.explain.equal':
    '{fees} के चार्ज ऑर्डर करने वाले सबमें बराबर बँटेंगे — टैक्स और {coupon} कूपन इस हिसाब से कि किसने कितना लिया।',
  'delivery.paid.explain.equal.coupon':
    '{fees} के चार्ज ऑर्डर करने वाले सबमें बराबर बँटेंगे — {coupon} कूपन इस हिसाब से कि किसने कितना लिया।',
  'delivery.paid.explain.equal.tax': '{fees} के चार्ज ऑर्डर करने वाले सबमें बराबर बँटेंगे — टैक्स इस हिसाब से कि किसने कितना लिया।',
  'delivery.paid.explain.equal.only': '{fees} के चार्ज ऑर्डर करने वाले सबमें बराबर बँटेंगे।',
  'delivery.paid.explain.proportional': 'चार्ज, टैक्स और कूपन — सब इस हिसाब से बँटेंगे कि किसने कितना लिया।',
  'delivery.paid.explain.proportional.coupon': 'चार्ज और कूपन, दोनों इस हिसाब से बँटेंगे कि किसने कितना लिया।',
  'delivery.paid.explain.proportional.tax': 'चार्ज और टैक्स, दोनों इस हिसाब से बँटेंगे कि किसने कितना लिया।',
  'delivery.paid.explain.proportional.only': 'चार्ज इस हिसाब से बँटेंगे कि किसने कितना लिया।',

  // Each person's lines on the result step.
  'delivery.result.fees': 'चार्ज',
  'delivery.result.other': 'टैक्स, चार्ज और ऑफ़र',
  'delivery.result.total': 'कुल',
  'delivery.result.none': 'ऑर्डर नहीं किया · {amount}',
} as const satisfies Messages
