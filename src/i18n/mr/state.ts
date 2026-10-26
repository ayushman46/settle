/** Marathi copy for bill state labels (the breakdown of what the bill says). Keys: `state.<area>.<element>`. */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'शुल्क',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'वस्तू',
  'state.breakdown.serviceCharge': 'सर्व्हिस चार्ज',
  'state.breakdown.tax': 'कर',
  'state.breakdown.tip': 'टिप',
  'state.breakdown.discount': 'सवलत',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'राउंड-ऑफ',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'इतर शुल्क',
  'state.breakdown.otherDiscounts': 'इतर सवलती',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'बेरीज',
  'state.breakdown.total': 'बिलाची एकूण रक्कम',

  // Why a split can't be saved yet (the expense and the saved data).
  'state.error.expense.noPeople': 'वाटण्यासाठी किमान एक व्यक्ती जोडा.',
  'state.error.expense.badTotal': 'शून्यापेक्षा जास्त रक्कम टाका.',
  'state.error.expense.exactMismatch': 'रकमा अजून एकूणाशी जुळत नाहीत.',
  'state.error.expense.percentMismatch': 'टक्केवारी अजून 100% पर्यंत जुळत नाही.',
  'state.error.expense.payerMissing': 'कोणी दिले ते निवडा.',
  'state.error.expense.zeroWeights': 'किमान एका व्यक्तीला हिस्सा द्या.',
  'state.error.expense.nothingHad': 'किमान एका व्यक्तीचे किती झाले ते लिहा.',
  'state.error.expense.notFound': 'तो खर्च आता नाही.',
  'state.error.data.notFound': 'ते सापडले नाही — कदाचित हटवले गेले असेल.',
  'state.error.data.emptyName': 'आधी नाव जोडा.',
  'state.error.data.duplicateName': 'त्या नावाची व्यक्ती आधीच तुमच्या लोकांमध्ये आहे.',
  'state.error.data.limit': 'इथली मर्यादा संपली आहे — ज्याची गरज नाही ते काढा.',
  'state.error.data.invalid': 'हे बरोबर वाटत नाही — तपासून पुन्हा प्रयत्न करा.',
} as const satisfies Messages
