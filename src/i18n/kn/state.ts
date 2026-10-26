/** Kannada copy for the bill draft state (src/state). Keys: `state.<screen>.<element>`. */
import type { Messages } from '../types'

export const state = {
  'state.fee.default': 'ಶುಲ್ಕ',

  'state.breakdown.items': 'ಐಟಂಗಳು',
  'state.breakdown.serviceCharge': 'ಸರ್ವಿಸ್ ಚಾರ್ಜ್',
  'state.breakdown.tax': 'ತೆರಿಗೆ',
  'state.breakdown.tip': 'ಟಿಪ್',
  'state.breakdown.discount': 'ರಿಯಾಯಿತಿ',
  'state.breakdown.roundOff': 'ರೌಂಡ್-ಆಫ್',
  'state.breakdown.otherCharges': 'ಇತರ ಶುಲ್ಕಗಳು',
  'state.breakdown.otherDiscounts': 'ಇತರ ರಿಯಾಯಿತಿಗಳು',
  'state.breakdown.addsUpTo': 'ಒಟ್ಟು ಸೇರುವುದು',
  'state.breakdown.total': 'ಬಿಲ್ ಒಟ್ಟು',

  'state.error.expense.noPeople': 'ವಿಭಜಿಸಲು ಕನಿಷ್ಠ ಒಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ಸೇರಿಸಿ.',
  'state.error.expense.badTotal': 'ಶೂನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಮೊತ್ತ ನಮೂದಿಸಿ.',
  'state.error.expense.exactMismatch': 'ಮೊತ್ತಗಳು ಇನ್ನೂ ಒಟ್ಟಿಗೆ ಸರಿಹೊಂದುತ್ತಿಲ್ಲ.',
  'state.error.expense.percentMismatch': 'ಶೇಕಡಾವಾರುಗಳು ಇನ್ನೂ 100% ಗೆ ಸರಿಹೊಂದುತ್ತಿಲ್ಲ.',
  'state.error.expense.payerMissing': 'ಯಾರು ಪಾವತಿಸಿದರು ಆರಿಸಿ.',
  'state.error.expense.zeroWeights': 'ಕನಿಷ್ಠ ಒಬ್ಬ ವ್ಯಕ್ತಿಗೆ ಪಾಲು ನೀಡಿ.',
  'state.error.expense.nothingHad': 'ಕನಿಷ್ಠ ಒಬ್ಬರು ಎಷ್ಟು ತಿಂದರು ಎಂದು ಬರೆಯಿರಿ.',
  'state.error.expense.notFound': 'ಆ ಖರ್ಚು ಇನ್ನು ಇಲ್ಲ.',
  'state.error.data.notFound': 'ಅದು ಸಿಗಲಿಲ್ಲ — ಅದನ್ನು ಅಳಿಸಿರಬಹುದು.',
  'state.error.data.emptyName': 'ಮೊದಲು ಹೆಸರು ಸೇರಿಸಿ.',
  'state.error.data.duplicateName': 'ಆ ಹೆಸರಿನ ಯಾರಾದರೂ ಈಗಾಗಲೇ ನಿಮ್ಮ ಜನರಲ್ಲಿದ್ದಾರೆ.',
  'state.error.data.limit': 'ಇಲ್ಲಿ ಮಿತಿ ತಲುಪಿದ್ದೀರಿ — ಇನ್ನು ಬೇಡದ್ದನ್ನು ತೆಗೆದುಹಾಕಿ.',
  'state.error.data.invalid': 'ಅದು ಸರಿಯಾಗಿ ಕಾಣುತ್ತಿಲ್ಲ — ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
} as const satisfies Messages
