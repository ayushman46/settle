/** Gujarati copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name}ને કરેલું {amount}નું પેમેન્ટ ફેલ થયું પણ પૈસા કપાયા — અટકેલા પૈસામાં ટ્રૅક થાય છે',
  'stuckalerts.failed.anon': '{amount}નું પેમેન્ટ ફેલ થયું પણ પૈસા કપાયા — અટકેલા પૈસામાં ટ્રૅક થાય છે',
  'stuckalerts.failed.late':
    '{name}ને કરેલું {amount}નું પેમેન્ટ ફેલ થયું પણ પૈસા કપાયા — {days, plural, one {# દિવસ મોડું} other {# દિવસ મોડું}} થયું: અત્યાર સુધી મોડું થવા બદલ તમારી બૅન્કે તમને {compensation} આપવાના છે',
  'stuckalerts.failed.anon.late':
    '{amount}નું પેમેન્ટ ફેલ થયું પણ પૈસા કપાયા — {days, plural, one {# દિવસ મોડું} other {# દિવસ મોડું}} થયું: અત્યાર સુધી મોડું થવા બદલ તમારી બૅન્કે તમને {compensation} આપવાના છે',
  'stuckalerts.failed.atm': 'ATMમાંથી {amount} ન નીકળ્યા, પણ ખાતામાંથી કપાઈ ગયા — અટકેલા પૈસામાં ટ્રૅક થાય છે',
  'stuckalerts.failed.atm.late':
    'ATMમાંથી {amount} ન નીકળ્યા, પણ ખાતામાંથી કપાઈ ગયા — {days, plural, one {# દિવસ મોડું} other {# દિવસ મોડું}} થયું: અત્યાર સુધી મોડું થવા બદલ તમારી બૅન્કે તમને {compensation} આપવાના છે',
  'stuckalerts.check': '{name}ને મોકલેલા {amount} કદાચ અટક્યા છે — તમારા ખાતામાંથી કપાયા?',
  'stuckalerts.check.anon': '{amount}નું પેમેન્ટ કદાચ અટક્યું છે — તમારા ખાતામાંથી કપાયા?',
  'stuckalerts.refund': '{name} તરફથી {amount}નું રિફંડ આવે ત્યાં સુધી ટ્રૅક થશે',
  'stuckalerts.refund.anon': '{amount}નું રિફંડ આવે ત્યાં સુધી ટ્રૅક થશે',
  'stuckalerts.added.many': '{count, plural, one {# પેમેન્ટ અટકેલા પૈસામાં ઉમેર્યું} other {# પેમેન્ટ અટકેલા પૈસામાં ઉમેર્યા}}',
  'stuckalerts.back.failed': '{name}ને કરેલા ફેલ પેમેન્ટના {amount} પાછા આવ્યા',
  'stuckalerts.back.failed.anon': 'ફેલ થયેલા પેમેન્ટના {amount} પાછા આવ્યા',
  'stuckalerts.back.failed.late':
    '{name}ને કરેલા ફેલ પેમેન્ટના {amount} પાછા આવ્યા — {days, plural, one {# દિવસ મોડા} other {# દિવસ મોડા}}: મોડું થવા બદલ તમારી બૅન્કે તમને {compensation} આપવાના છે',
  'stuckalerts.back.failed.anon.late':
    'ફેલ થયેલા પેમેન્ટના {amount} પાછા આવ્યા — {days, plural, one {# દિવસ મોડા} other {# દિવસ મોડા}}: મોડું થવા બદલ તમારી બૅન્કે તમને {compensation} આપવાના છે',
  'stuckalerts.back.refund': '{name} તરફથી {amount}નું રિફંડ આવી ગયું',
  'stuckalerts.back.refund.anon': '{amount}નું રિફંડ આવી ગયું',
  'stuckalerts.back.part': 'તમારા {amount}માંથી {back} પાછા આવ્યા — {rest} હજુ આવવાના બાકી, Settle તેને ટ્રૅક કરતું રહેશે',
  'stuckalerts.back.many': '{count, plural, one {# અટકેલું પેમેન્ટ પાછું આવ્યું} other {# અટકેલા પેમેન્ટ પાછા આવ્યા}}',
  'stuckalerts.cleared': '{name}ને કરેલું {amount}નું પેમેન્ટ આખરે થઈ ગયું — કંઈ અટક્યું નથી',
  'stuckalerts.cleared.anon': '{amount}નું પેમેન્ટ આખરે થઈ ગયું — કંઈ અટક્યું નથી',
  'stuckalerts.cleared.many': '{count, plural, one {# પેમેન્ટ આખરે થઈ ગયું} other {# પેમેન્ટ આખરે થઈ ગયા}} — કંઈ અટક્યું નથી',
}
