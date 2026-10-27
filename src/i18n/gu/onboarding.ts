/** Gujarati copy for onboarding (src/features/onboarding). Keys: `onboarding.<screen>.<element>`. */
import type { Messages } from '../types'

export const onboarding = {
  'onboarding.language.subtitle': 'ગમે ત્યારે તમે → ભાષા માં બદલી શકો છો.',

  'onboarding.intro.heading': '{brand} માં આપનું સ્વાગત છે',
  'onboarding.intro.carousel.aria': '{brand} શું કરે છે',
  'onboarding.intro.dot.aria': 'સ્લાઇડ {number}: {title}',
  'onboarding.intro.slide.aria': '{total} માંથી {number}',
  'onboarding.intro.live': 'સ્લાઇડ {number} / {total}: {title}',
  'onboarding.intro.start.cta': 'શરૂ કરો',
  'onboarding.slide.scan.title': 'બિલનો ફોટો પાડો',
  'onboarding.slide.scan.text': 'AI દરેક આઇટમ વાંચે છે. કોણે શું લીધું એ ટૅપ કરો, અને સેકન્ડોમાં સ્પ્લિટ પૂરી.',
  'onboarding.slide.split.title': 'કંઈ પણ વહેંચો',
  'onboarding.slide.split.text': 'ભાડું, ટ્રિપ, કેબ, Netflix. અથવા બસ બોલી દો: “રિયા અને સેમ સાથે કેબ 840”.',
  'onboarding.slide.settle.title': 'UPI થી પાછા મેળવો',
  'onboarding.slide.settle.text': 'ગ્રુપને એક લિંક મોકલો. મિત્રો પોતાનું નામ ટૅપ કરીને કોઈ પણ UPI એપથી ચૂકવે છે.',

  'onboarding.about.title': 'ચાલો તમારી સેટિંગ કરીએ',
  'onboarding.about.subtitle': 'તમે મોકલેલી વિનંતીઓ પર મિત્રો તમારું નામ જુએ છે.',
  'onboarding.about.start.cta': 'વહેંચવાનું શરૂ કરો',
  'onboarding.about.skip.cta': 'અત્યારે છોડો',
  'onboarding.about.name.label': 'તમારું નામ',
  'onboarding.about.name.placeholder': 'દા.ત. Ayush',
  'onboarding.about.name.error': 'તમારું નામ ઉમેરો — તમે મોકલેલી વિનંતીઓ પર મિત્રો તે જુએ છે.',
  'onboarding.about.upi.label': 'તમારું UPI ID (વૈકલ્પિક)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'જેથી મિત્રો UPIથી તમને પાછા ચૂકવી શકે. તમે પછીથી પણ ઉમેરી શકો છો.',
  'onboarding.about.upi.hint.remembered': 'આ ફોન પરની જૂની સ્પ્લિટમાંથી. તમારું ન હોય તો બદલો.',
  'onboarding.about.upi.error': 'એ UPI ID જેવું લાગતું નથી. name@bank જેવું હોવું જોઈએ.',
  'onboarding.about.currency.label': 'કરન્સી',
  'onboarding.about.currency.change': 'બદલો',
  'onboarding.about.currency.sheet.title': 'તમારી કરન્સી',
  'onboarding.about.currency.sheet.body': 'નવી સ્પ્લિટ આ કરન્સીમાં શરૂ થશે. કોઈ પણ સ્પ્લિટ માટે બીજી પસંદ કરી શકો છો.',
  'onboarding.about.privacy': 'સાઇન-અપ નહીં, જાહેરાત નહીં. તમે ઉમેરેલું બધું આ ફોન પર જ રહે છે — {brand} પાસે કોઈ ડેટાબેઝ નથી.',
} as const satisfies Messages
