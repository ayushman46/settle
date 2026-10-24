/** Marathi copy for food and delivery orders (scan, fees, who-had-what). Keys: `delivery.<step>.<element>`. */
import type { Messages } from '../types'

export const delivery = {
  // The scan step opened from Home's "Food order" tile.
  'delivery.scan.title': 'फूड ऑर्डर वाटा',
  'delivery.scan.subtitle': 'Swiggy, Zomato, Blinkit, Zepto किंवा Instamart ऑर्डरचा स्क्रीनशॉट टाका — आम्ही वस्तू, शुल्क आणि कूपन वेगळे काढू.',
  'delivery.scan.choose.cta': 'स्क्रीनशॉट निवडा',
  'delivery.scan.camera.cta': 'फोटो काढा',
  // Extra lines in the rotating "reading" status while a delivery order is read.
  'delivery.scan.status.fees': 'शुल्क शोधत आहे…',
  'delivery.scan.status.coupon': 'कूपन तपासत आहे…',

  // The fees section on the bill review step.
  'delivery.review.fees.title': 'शुल्क आणि चार्जेस',
  'delivery.review.fees.add.cta': 'शुल्क जोडा',
  'delivery.review.fees.hint': 'पुढच्या टप्प्यात शुल्क कसे वाटायचे ते ठरवाल.',
  // A fee row's accessible name: "Delivery fee, ₹35, edit".
  'delivery.review.fees.row.aria': '{label}, {amount}, बदला',
  'delivery.review.fees.removed.toast': '{label} काढले',
  'delivery.review.fees.full.toast': 'एका बिलात जास्तीत जास्त {max} शुल्क असू शकतात.',
  'delivery.review.fees.converted.toast': '{label} आता एक वस्तू आहे — पुढच्या टप्प्यात कोणी घेतली ते सांगा',
  'delivery.review.fees.undoFailed.toast': 'पूर्ववत करता आले नाही — बिल बदलले आहे',
  // The sheet for one fee.
  'delivery.fee.title': 'शुल्क',
  'delivery.fee.name.label': 'नाव',
  'delivery.fee.amount.label': 'रक्कम',
  'delivery.fee.amount.error': 'शुल्क टाका (0 पेक्षा जास्त)',
  'delivery.fee.kind.label': 'प्रकार',
  'delivery.fee.kind.delivery': 'डिलिव्हरी',
  'delivery.fee.kind.platform': 'प्लॅटफॉर्म',
  'delivery.fee.kind.packaging': 'पॅकेजिंग',
  'delivery.fee.kind.surge': 'सरचार्ज/पाऊस',
  'delivery.fee.kind.smallOrder': 'छोटी ऑर्डर',
  'delivery.fee.kind.tip': 'टिप',
  'delivery.fee.kind.donation': 'देणगी',
  'delivery.fee.kind.feeTax': 'शुल्कावरील GST',
  'delivery.fee.kind.other': 'इतर',
  // The name a fee gets when none is typed (also the field's placeholder).
  'delivery.fee.default.delivery': 'डिलिव्हरी शुल्क',
  'delivery.fee.default.platform': 'प्लॅटफॉर्म शुल्क',
  'delivery.fee.default.packaging': 'पॅकेजिंग',
  'delivery.fee.default.surge': 'पावसाचे शुल्क',
  'delivery.fee.default.smallOrder': 'छोटी ऑर्डर शुल्क',
  'delivery.fee.default.tip': 'टिप',
  'delivery.fee.default.donation': 'देणगी',
  'delivery.fee.default.feeTax': 'शुल्कावरील GST',
  'delivery.fee.default.other': 'शुल्क',
  'delivery.fee.add.cta': 'शुल्क जोडा',
  'delivery.fee.save.cta': 'सेव्ह करा',
  'delivery.fee.remove.cta': 'शुल्क काढा',
  'delivery.fee.tip.hint': 'फक्त एकजण टिप देत आहे? ते एक वस्तू म्हणून जोडा.',
  'delivery.fee.tip.cta': 'वस्तू करा',

  // The fee policy on the "What you paid" step.
  'delivery.paid.policy.label': 'शुल्क कसे वाटायचे?',
  'delivery.paid.policy.equal': 'समान',
  'delivery.paid.policy.proportional': 'प्रत्येकाने जे घेतले त्या प्रमाणात',
  'delivery.paid.explain.equal': 'शुल्क {fees} — ऑर्डर देणाऱ्या सर्वांमध्ये समान वाटले जाईल; कर आणि {coupon} कूपन प्रत्येकाने जे घेतले त्या प्रमाणात.',
  'delivery.paid.explain.equal.coupon': 'शुल्क {fees} — ऑर्डर देणाऱ्या सर्वांमध्ये समान वाटले जाईल; {coupon} कूपन प्रत्येकाने जे घेतले त्या प्रमाणात.',
  'delivery.paid.explain.equal.tax': 'शुल्क {fees} — ऑर्डर देणाऱ्या सर्वांमध्ये समान वाटले जाईल; कर प्रत्येकाने जे घेतले त्या प्रमाणात.',
  'delivery.paid.explain.equal.only': 'शुल्क {fees} — ऑर्डर देणाऱ्या सर्वांमध्ये समान वाटले जाईल.',
  'delivery.paid.explain.proportional': 'शुल्क, कर आणि कूपन — सर्व काही प्रत्येकाने जे घेतले त्या प्रमाणात वाटले जाईल.',
  'delivery.paid.explain.proportional.coupon': 'शुल्क आणि कूपन — दोन्ही प्रत्येकाने जे घेतले त्या प्रमाणात वाटले जाईल.',
  'delivery.paid.explain.proportional.tax': 'शुल्क आणि कर — दोन्ही प्रत्येकाने जे घेतले त्या प्रमाणात वाटले जाईल.',
  'delivery.paid.explain.proportional.only': 'शुल्क प्रत्येकाने जे घेतले त्या प्रमाणात वाटले जाईल.',

  // Each person's lines on the result step.
  'delivery.result.fees': 'शुल्क',
  'delivery.result.other': 'कर, शुल्क आणि ऑफर',
  'delivery.result.total': 'एकूण',
  'delivery.result.none': 'ऑर्डर नव्हती · {amount}',
} as const satisfies Messages
