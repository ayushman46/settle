/** Gujarati copy for the bill draft state (src/state). Keys: `state.<screen>.<element>`. */
import type { Messages } from '../types'

export const state = {
  'state.fee.default': 'ફી',

  'state.breakdown.items': 'આઇટમ',
  'state.breakdown.serviceCharge': 'સર્વિસ ચાર્જ',
  'state.breakdown.tax': 'ટેક્સ',
  'state.breakdown.tip': 'ટિપ',
  'state.breakdown.discount': 'ડિસ્કાઉન્ટ',
  'state.breakdown.roundOff': 'રાઉન્ડ-ઓફ',
  'state.breakdown.otherCharges': 'બીજા ચાર્જ',
  'state.breakdown.otherDiscounts': 'બીજા ડિસ્કાઉન્ટ',
  'state.breakdown.addsUpTo': 'કુલ થાય છે',
  'state.breakdown.total': 'બિલનો કુલ',

  'state.error.expense.noPeople': 'વહેંચવા ઓછામાં ઓછી એક વ્યક્તિ ઉમેરો.',
  'state.error.expense.badTotal': 'શૂન્યથી વધુ રકમ દાખલ કરો.',
  'state.error.expense.exactMismatch': 'રકમો હજી સરભર થતી નથી.',
  'state.error.expense.percentMismatch': 'ટકા હજી 100% સુધી બરાબર થતા નથી.',
  'state.error.expense.payerMissing': 'કોણે ચૂકવ્યું તે પસંદ કરો.',
  'state.error.expense.zeroWeights': 'ઓછામાં ઓછી એક વ્યક્તિને હિસ્સો આપો.',
  'state.error.expense.nothingHad': 'ઓછામાં ઓછી એક વ્યક્તિએ કેટલું ખાધું તે લખો.',
  'state.error.expense.notFound': 'એ ખર્ચ હવે અસ્તિત્વમાં નથી.',
  'state.error.data.notFound': 'એ મળ્યું નહીં — તે કાઢી નખાયું હશે.',
  'state.error.data.emptyName': 'પહેલાં નામ ઉમેરો.',
  'state.error.data.duplicateName': 'એ નામની વ્યક્તિ પહેલેથી તમારા લોકોમાં છે.',
  'state.error.data.limit': 'અહીં મર્યાદા પહોંચી ગઈ — હવે ન જોઈતું કંઈક કાઢી નાખો.',
  'state.error.data.invalid': 'એ બરાબર લાગતું નથી — તપાસીને ફરી પ્રયાસ કરો.',
} as const satisfies Messages
