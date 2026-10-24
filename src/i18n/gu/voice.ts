/** Gujarati copy for "Just say it" voice entry (speak to split). Keys: `voice.<screen>.<element>`. */
import type { Messages } from '../types'

export const voice = {
  'voice.mic.home.aria': 'બોલીને વહેંચો',
  'voice.mic.sheet.aria': 'બદલામાં બોલો',
  'voice.mic.offline': 'અવાજ માટે ઇન્ટરનેટ જોઈએ',

  'voice.listen.title': 'સાંભળી રહ્યું છે…',
  'voice.listen.aria': '{language} માં સાંભળી રહ્યું છે',
  'voice.listen.language.aria': '{native}, {language} માં બોલી રહ્યા છો. ભાષા બદલો',
  'voice.listen.stop.cta': 'બંધ કરો',
  'voice.listen.tip': 'શું હતું, કેટલું અને કોણ હતું તે કહો — જેમ કે',
  'voice.listen.heard.aria': 'સાંભળ્યું: {text}',

  'voice.heard.chip': '“{phrase}” સાંભળ્યું → {amount}',
  'voice.heard.label': 'અમે સાંભળેલા આંકડા',

  'voice.long.title': 'ઘણું લાંબું છે — ટૂંકું રાખો',
  'voice.long.body': 'ફક્ત પહેલા {max} અક્ષરો બેસે છે. કાપો, અથવા એક વાક્યમાં ફરી બોલો.',

  'voice.banner.title': 'તમે કહ્યું તે પ્રમાણે ભરાયું',
  'voice.banner.body': 'રકમ અને કોણ છે તે તપાસો, પછી સેવ કરો.',

  'voice.lang.title': 'આ ભાષામાં બોલો',
  'voice.lang.note': 'તમારું બ્રાઉઝર તમારા અવાજને લખાણમાં ફેરવે છે — એ માટે Chrome, Google ની સ્પીચ સેવા વાપરે છે. Settle ક્યારેય ઑડિયો રેકોર્ડ કરતું નથી કે રાખતું નથી.',
  'voice.lang.en.english': 'અંગ્રેજી (ભારત)',
  'voice.lang.hi.english': 'હિન્દી · હિંગ્લિશ માટે પણ',
  'voice.lang.bn.english': 'બંગાળી',
  'voice.lang.mr.english': 'મરાઠી',
  'voice.lang.ta.english': 'તમિલ',
  'voice.lang.te.english': 'તેલુગુ',
  'voice.lang.kn.english': 'કન્નડ',
  'voice.lang.gu.english': 'ગુજરાતી',

  'voice.error.blocked.title': 'માઇક બ્લૉક છે',
  'voice.error.blocked.body': 'તમારા બ્રાઉઝરની સાઇટ સેટિંગમાં Settle ને માઇક્રોફોનની મંજૂરી આપો — અથવા ફક્ત ટાઇપ કરો.',
  'voice.error.noSpeech.title': 'સંભળાયું નહીં',
  'voice.error.noSpeech.body': 'માઇક ટૅપ કરીને ફરી પ્રયાસ કરો — બીપ પછી બોલો.',
  'voice.error.noMic.title': 'માઇક્રોફોન મળ્યો નથી',
  'voice.error.noMic.body': 'એક જોડો, અથવા તેને બદલે ટાઇપ કરો.',
  'voice.error.network.title': 'અવાજ માટે ઇન્ટરનેટ જોઈએ',
  'voice.error.network.body': 'તમારું બ્રાઉઝર ઑનલાઇન રહીને બોલીને લખાણમાં ફેરવે છે. ઑફલાઇન હો ત્યારે ટાઇપ કરો.',
  'voice.error.language.title': '{language} આ બ્રાઉઝરમાં ઉપલબ્ધ નથી',
  'voice.error.language.body': 'અંગ્રેજી અથવા હિન્દી અજમાવો, અથવા ટાઇપ કરો.',
  'voice.error.other.title': 'આ વખતે અવાજ કામ ન કર્યો',
  'voice.error.other.body': 'ફરી પ્રયાસ કરો, અથવા ટાઇપ કરો.',
} as const satisfies Messages
