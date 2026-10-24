/** Tamil copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'கட்டணம்',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'பொருட்கள்',
  'state.breakdown.serviceCharge': 'சேவைக் கட்டணம்',
  'state.breakdown.tax': 'வரி',
  'state.breakdown.tip': 'டிப்',
  'state.breakdown.discount': 'தள்ளுபடி',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'வட்டமிடல்',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'மற்ற கட்டணங்கள்',
  'state.breakdown.otherDiscounts': 'மற்ற தள்ளுபடிகள்',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'கூட்டுத்தொகை',
  'state.breakdown.total': 'பில் மொத்தம்',
  // Errors when a draft can't be saved yet.
  'state.error.expense.noPeople': 'பிரிக்க குறைந்தது ஒரு நபரைச் சேருங்கள்.',
  'state.error.expense.badTotal': 'பூஜ்ஜியத்தை விட அதிகமான தொகையை உள்ளிடுங்கள்.',
  'state.error.expense.exactMismatch': 'தொகைகள் இன்னும் மொத்தத்துடன் சரியாகக் கூடவில்லை.',
  'state.error.expense.percentMismatch': 'சதவீதங்கள் இன்னும் 100% ஆகச் சரியாகக் கூடவில்லை.',
  'state.error.expense.payerMissing': 'யார் செலுத்தினார் என்று தேர்ந்தெடுங்கள்.',
  'state.error.expense.zeroWeights': 'குறைந்தது ஒருவருக்காவது பங்கு கொடுங்கள்.',
  'state.error.expense.notFound': 'அந்தச் செலவு இனி இல்லை.',
  'state.error.data.notFound': 'அது கண்டுபிடிக்கப்படவில்லை — நீக்கப்பட்டிருக்கலாம்.',
  'state.error.data.emptyName': 'முதலில் ஒரு பெயரைச் சேருங்கள்.',
  'state.error.data.duplicateName': 'அந்தப் பெயரில் ஒருவர் ஏற்கனவே உங்கள் நபர்களில் இருக்கிறார்.',
  'state.error.data.limit': 'இங்கு வரம்பை எட்டிவிட்டீர்கள் — இனி தேவையில்லாததை அகற்றுங்கள்.',
  'state.error.data.invalid': 'அது சரியாகத் தெரியவில்லை — சரிபார்த்து மீண்டும் முயற்சி செய்யுங்கள்.',
} as const satisfies Messages
