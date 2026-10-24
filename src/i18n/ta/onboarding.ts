/** Tamil copy for onboarding (src/features/onboarding). Keys: `onboarding.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const onboarding = {
  // First step: the language (title is common.language.title).
  'onboarding.language.subtitle': 'நீங்கள் → மொழியில் எப்போதும் மாற்றலாம்.',
  // The three intro slides.
  'onboarding.intro.heading': 'வரவேற்கிறோம் — {brand}',
  'onboarding.intro.carousel.aria': '{brand} என்ன செய்கிறது',
  // A dot under the slides: "Slide 2: Split anything".
  'onboarding.intro.dot.aria': 'ஸ்லைடு {number}: {title}',
  // Each slide, for screen readers: "2 of 3".
  'onboarding.intro.slide.aria': '{number} / {total}',
  // Announced as the slide changes.
  'onboarding.intro.live': 'ஸ்லைடு {number} / {total}: {title}',
  'onboarding.intro.start.cta': 'தொடங்கு',
  'onboarding.slide.scan.title': 'பில்லைப் புகைப்படம் எடுங்கள்',
  'onboarding.slide.scan.text': 'AI ஒவ்வொரு பொருளையும் படிக்கும். யார் எதை எடுத்தார்கள் என்பதைத் தட்டுங்கள் — நொடிகளில் பிரிப்பு முடிந்துவிடும்.',
  'onboarding.slide.split.title': 'எதையும் பிரியுங்கள்',
  'onboarding.slide.split.text': 'வாடகை, பயணங்கள், கேப், Netflix. அல்லது சொல்லுங்கள்: “ரியா, சாமுடன் கேப் 840”.',
  'onboarding.slide.settle.title': 'UPI மூலம் திருப்பிப் பெறுங்கள்',
  'onboarding.slide.settle.text': 'குழுவுக்கு ஒரு இணைப்பை அனுப்புங்கள். நண்பர்கள் தங்கள் பெயரைத் தட்டி, எந்த UPI ஆப்பிலும் பணம் செலுத்துவார்கள்.',
  // Last step: about you.
  'onboarding.about.title': 'உங்களை அமைப்போம்',
  'onboarding.about.subtitle': 'நீங்கள் அனுப்பும் கோரிக்கைகளில் நண்பர்கள் உங்கள் பெயரைப் பார்ப்பார்கள்.',
  'onboarding.about.start.cta': 'பிரிக்கத் தொடங்கு',
  'onboarding.about.skip.cta': 'இப்போதைக்குத் தவிர்',
  'onboarding.about.name.label': 'உங்கள் பெயர்',
  'onboarding.about.name.placeholder': 'உதா. Ayush',
  'onboarding.about.name.error': 'உங்கள் பெயரைச் சேருங்கள் — நீங்கள் அனுப்பும் கோரிக்கைகளில் நண்பர்கள் அதைப் பார்ப்பார்கள்.',
  'onboarding.about.upi.label': 'உங்கள் UPI ID (விருப்பமானது)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'நண்பர்கள் ஒரே தட்டில் உங்களுக்குத் திருப்பிச் செலுத்த. பின்னர் சேர்க்கலாம்.',
  // The UPI field was prefilled from an older split on this phone.
  'onboarding.about.upi.hint.remembered': 'இந்த ஃபோனில் நீங்கள் செய்த ஒரு பிரிப்பிலிருந்து. உங்களுடையது இல்லையென்றால் மாற்றுங்கள்.',
  'onboarding.about.upi.error': 'இது UPI ID போலத் தெரியவில்லை. name@bank போன்று இருக்க வேண்டும்.',
  'onboarding.about.currency.label': 'நாணயம்',
  'onboarding.about.currency.change': 'மாற்று',
  'onboarding.about.currency.sheet.title': 'உங்கள் நாணயம்',
  'onboarding.about.currency.sheet.body': 'புதிய பிரிப்புகள் இந்த நாணயத்தில் தொடங்கும். எந்தப் பிரிப்புக்கும் வேறொன்றைத் தேர்ந்தெடுக்கலாம்.',
  'onboarding.about.privacy': 'பதிவு இல்லை, விளம்பரங்கள் இல்லை. நீங்கள் சேர்ப்பது அனைத்தும் இந்த ஃபோனிலேயே இருக்கும். {brand} ஒரு தரவுத்தளத்தை வைத்திருப்பதில்லை.',
} as const satisfies Messages
