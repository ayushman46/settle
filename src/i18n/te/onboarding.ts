/** Telugu copy for onboarding (src/features/onboarding). Keys: `onboarding.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const onboarding = {
  // First step: the language (title is common.language.title).
  'onboarding.language.subtitle': 'మీరు → భాషలో ఎప్పుడైనా మార్చుకోవచ్చు.',
  // The three intro slides.
  'onboarding.intro.heading': '{brand} కు స్వాగతం',
  'onboarding.intro.carousel.aria': '{brand} ఏమి చేస్తుంది',
  // A dot under the slides: "Slide 2: Split anything".
  'onboarding.intro.dot.aria': 'స్లైడ్ {number}: {title}',
  // Each slide, for screen readers: "2 of 3".
  'onboarding.intro.slide.aria': '{number} / {total}',
  // Announced as the slide changes.
  'onboarding.intro.live': 'స్లైడ్ {number} / {total}: {title}',
  'onboarding.intro.start.cta': 'మొదలుపెట్టండి',
  'onboarding.slide.scan.title': 'బిల్లును ఫోటో తీయండి',
  'onboarding.slide.scan.text': 'AI ప్రతి ఐటమ్‌ను చదువుతుంది. ఎవరు ఏది తీసుకున్నారో ట్యాప్ చేయండి — సెకన్లలో స్ప్లిట్ పూర్తవుతుంది.',
  'onboarding.slide.split.title': 'ఏదైనా పంచండి',
  'onboarding.slide.split.text': 'అద్దె, ట్రిప్‌లు, క్యాబ్‌లు, Netflix. లేదా చెప్పేయండి: “Riya, Sam తో క్యాబ్ 840”.',
  'onboarding.slide.settle.title': 'UPI ద్వారా తిరిగి పొందండి',
  'onboarding.slide.settle.text': 'గ్రూప్‌కు ఒక లింక్ పంపండి. స్నేహితులు తమ పేరును ట్యాప్ చేసి, ఏ UPI యాప్‌తోనైనా చెల్లిస్తారు.',
  // Last step: about you.
  'onboarding.about.title': 'మిమ్మల్ని సెటప్ చేద్దాం',
  'onboarding.about.subtitle': 'మీరు పంపే అభ్యర్థనలపై స్నేహితులు మీ పేరు చూస్తారు.',
  'onboarding.about.start.cta': 'పంచడం మొదలుపెట్టండి',
  'onboarding.about.skip.cta': 'ఇప్పుడు దాటవేయండి',
  'onboarding.about.name.label': 'మీ పేరు',
  'onboarding.about.name.placeholder': 'ఉదా. Ayush',
  'onboarding.about.name.error': 'మీ పేరు జోడించండి — మీరు పంపే అభ్యర్థనలపై స్నేహితులు దాన్ని చూస్తారు.',
  'onboarding.about.upi.label': 'మీ UPI ID (ఐచ్ఛికం)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'స్నేహితులు UPIతో మీకు తిరిగి చెల్లించేందుకు. తర్వాత కూడా జోడించవచ్చు.',
  // The UPI field was prefilled from an older split on this phone.
  'onboarding.about.upi.hint.remembered': 'ఈ ఫోన్‌లో మీరు చేసిన ఒక స్ప్లిట్ నుంచి. అది మీది కాకపోతే మార్చండి.',
  'onboarding.about.upi.error': 'అది UPI ID లా కనిపించడం లేదు. name@bank లా ఉండాలి.',
  'onboarding.about.currency.label': 'కరెన్సీ',
  'onboarding.about.currency.change': 'మార్చు',
  'onboarding.about.currency.sheet.title': 'మీ కరెన్సీ',
  'onboarding.about.currency.sheet.body': 'కొత్త స్ప్లిట్‌లు ఈ కరెన్సీలో మొదలవుతాయి. ఏ స్ప్లిట్‌కైనా వేరేది ఎంచుకోవచ్చు.',
  'onboarding.about.privacy': 'సైన్-అప్ లేదు, ప్రకటనలు లేవు. మీరు జోడించేవన్నీ ఈ ఫోన్‌లోనే ఉంటాయి — {brand} కు డేటాబేస్ లేదు.',
  'onboarding.restore.cta': 'ఫోన్ మారుస్తున్నారా? బ్యాకప్ తిరిగి తెచ్చుకోండి',
  'onboarding.restore.done': 'మళ్లీ స్వాగతం — అంతా ఇక్కడే ఉంది',
} as const satisfies Messages
