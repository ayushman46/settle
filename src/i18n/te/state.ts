/** Telugu copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'ఫీజు',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'ఐటమ్‌లు',
  'state.breakdown.serviceCharge': 'సర్వీస్ ఛార్జ్',
  'state.breakdown.tax': 'పన్ను',
  'state.breakdown.tip': 'టిప్',
  'state.breakdown.discount': 'డిస్కౌంట్',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'రౌండ్-ఆఫ్',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'ఇతర ఛార్జీలు',
  'state.breakdown.otherDiscounts': 'ఇతర డిస్కౌంట్లు',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'మొత్తం కలిపితే',
  'state.breakdown.total': 'బిల్లు మొత్తం',
  // Errors when a draft can't be saved yet.
  'state.error.expense.noPeople': 'పంచడానికి కనీసం ఒక వ్యక్తిని జోడించండి.',
  'state.error.expense.badTotal': 'సున్నా కంటే ఎక్కువ మొత్తం నమోదు చేయండి.',
  'state.error.expense.exactMismatch': 'మొత్తాలు ఇంకా మొత్తంతో సరిపోలడం లేదు.',
  'state.error.expense.percentMismatch': 'శాతాలు ఇంకా 100% గా సరిపోలడం లేదు.',
  'state.error.expense.payerMissing': 'ఎవరు చెల్లించారో ఎంచుకోండి.',
  'state.error.expense.zeroWeights': 'కనీసం ఒకరికి ఒక వాటా ఇవ్వండి.',
  'state.error.expense.nothingHad': 'కనీసం ఒకరు ఎంత తిన్నారో రాయండి.',
  'state.error.expense.notFound': 'ఆ ఖర్చు ఇక లేదు.',
  'state.error.data.notFound': 'అది కనుగొనలేకపోయాం — తొలగించబడి ఉండవచ్చు.',
  'state.error.data.emptyName': 'ముందుగా ఒక పేరు జోడించండి.',
  'state.error.data.duplicateName': 'ఆ పేరుతో ఒకరు ఇప్పటికే మీ వ్యక్తుల్లో ఉన్నారు.',
  'state.error.data.limit': 'ఇక్కడ పరిమితికి చేరుకున్నారు — అవసరం లేనిది ఏదైనా తీసేయండి.',
  'state.error.data.invalid': 'అది సరిగా కనిపించడం లేదు — చెక్ చేసి మళ్ళీ ప్రయత్నించండి.',
} as const satisfies Messages
