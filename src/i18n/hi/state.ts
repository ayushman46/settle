/** Hindi copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  'state.fee.default': 'चार्ज',

  'state.breakdown.items': 'आइटम',
  'state.breakdown.serviceCharge': 'सर्विस चार्ज',
  'state.breakdown.tax': 'टैक्स',
  'state.breakdown.tip': 'टिप',
  'state.breakdown.discount': 'छूट',
  'state.breakdown.roundOff': 'राउंड-ऑफ़',
  'state.breakdown.otherCharges': 'दूसरे चार्ज',
  'state.breakdown.otherDiscounts': 'दूसरी छूट',
  'state.breakdown.addsUpTo': 'कुल जोड़',
  'state.breakdown.total': 'कुल बिल',
  'state.error.expense.noPeople': 'बाँटने के लिए कम से कम एक व्यक्ति जोड़ें।',
  'state.error.expense.badTotal': 'शून्य से ज़्यादा रकम डालें।',
  'state.error.expense.exactMismatch': 'रकमें अभी कुल के बराबर नहीं हैं।',
  'state.error.expense.percentMismatch': 'प्रतिशत अभी 100% के बराबर नहीं हैं।',
  'state.error.expense.payerMissing': 'चुनें किसने पैसे दिए।',
  'state.error.expense.zeroWeights': 'कम से कम एक व्यक्ति को हिस्सा दें।',
  'state.error.expense.nothingHad': 'कम से कम एक व्यक्ति का कितना हुआ, लिखें।',
  'state.error.expense.notFound': 'यह खर्च अब मौजूद नहीं है।',
  'state.error.data.notFound': 'यह नहीं मिला — शायद मिटा दिया गया है।',
  'state.error.data.emptyName': 'पहले नाम लिखें।',
  'state.error.data.duplicateName': 'इस नाम का कोई व्यक्ति पहले से आपकी सूची में है।',
  'state.error.data.limit': 'यहाँ की सीमा पूरी हो गई है — जो अब ज़रूरी नहीं, उसे हटाएँ।',
  'state.error.data.invalid': 'यह सही नहीं लग रहा — जाँचकर फिर से कोशिश करें।',
} as const satisfies Messages
