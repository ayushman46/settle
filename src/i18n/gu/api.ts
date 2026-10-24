/** Gujarati copy for client API errors (src/api). Keys: `api.<screen>.<element>`. */
import type { Messages } from '../types'

export const api = {
  'api.scan.error.bad_request': 'એ ફોટો સાથે કંઈક ગડબડ થઈ. બીજો ફોટો અજમાવો.',
  'api.scan.error.unsupported_image': 'કૃપા કરીને JPG અથવા PNG ફોટો વાપરો.',
  'api.scan.error.image_too_large': 'એ ફોટો બહુ મોટો છે. નાનો અજમાવો — અથવા તેનો સ્ક્રીનશોટ લો.',
  'api.scan.error.not_a_bill': 'આ બિલ જેવું લાગતું નથી. આખી રસીદનો સ્પષ્ટ ફોટો લો.',
  'api.scan.error.unreadable': 'અમે કોઈ આઇટમ વાંચી શક્યા નહીં. વધુ સ્પષ્ટ, સારા પ્રકાશવાળો ફોટો અજમાવો — અથવા જાતે લખો.',
  'api.scan.error.not_configured': 'ફોટો સ્કેનિંગ અત્યારે ઉપલબ્ધ નથી — તમે આઇટમ ટાઇપ કરી શકો છો.',
  'api.scan.error.upstream_auth': 'ફોટો સ્કેનિંગ અત્યારે કામ કરતું નથી — તમે આઇટમ ટાઇપ કરી શકો છો.',
  'api.scan.error.rate_limited': 'અત્યારે બહુ બધા સ્કેન થયા છે. થોડી મિનિટો પછી ફરી પ્રયાસ કરો — અથવા આઇટમ ટાઇપ કરો.',
  'api.scan.error.timeout': 'બિલ વાંચવામાં બહુ સમય લાગ્યો. વધુ સ્પષ્ટ, નજીકનો ફોટો લઈને ફરી પ્રયાસ કરો.',
  'api.scan.error.upstream_error': 'AI સેવા સુધી પહોંચી શક્યા નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'api.scan.error.network': 'તમે ઑફલાઇન લાગો છો. ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો.',
  'api.scan.error.aborted': 'સ્કેન રદ કરવામાં આવ્યું.',
  'api.scan.busy': 'અત્યારે ઘણાં બિલ વંચાઈ રહ્યાં છે — થોડી વારમાં ફરી પ્રયાસ કરો.',
  'api.scan.proLimit': 'આજની વાજબી વપરાશની AI મર્યાદા પૂરી થઈ. {wait} માં ફરી શરૂ થશે — તમે હજુ પણ આઇટમ ટાઇપ કરી શકો છો.',
  'api.scan.limit': 'બહુ બધા સ્કેન થયા. {wait} પછી ફરી પ્રયાસ કરો — અથવા આઇટમ ટાઇપ કરો.',
  'api.scan.offline': 'તમે ઑફલાઇન છો — તમે હજુ પણ આઇટમ ટાઇપ કરી શકો છો.',
  'api.image.error.not_image': 'એ ફાઇલ ફોટો નથી. કૃપા કરીને JPG અથવા PNG ઇમેજ પસંદ કરો.',
  'api.image.error.decode_failed': 'એ ઇમેજ ખોલી શકાઈ નહીં. JPG અથવા PNG અજમાવો — અથવા તેનો સ્ક્રીનશોટ લો.',
  'api.image.error.too_large': 'એ ફોટો બહુ મોટો છે (25 MB થી વધુ). નાનો અજમાવો — અથવા સ્ક્રીનશોટ લો.',
  'api.wait.minute': 'લગભગ એક મિનિટ',
  'api.wait.minutes': 'લગભગ {count} મિનિટ',
  'api.wait.hours': 'લગભગ {count} કલાક',
} as const satisfies Messages
