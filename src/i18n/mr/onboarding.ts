/** Marathi copy for the first-run onboarding (language, intro slides, about you). Keys: `onboarding.<step>.<element>`. */
import type { Messages } from '../types'

export const onboarding = {
  // First step: the language (title is common.language.title).
  'onboarding.language.subtitle': 'तुम्ही → भाषा मध्ये कधीही बदलू शकता.',

  // The three intro slides.
  'onboarding.intro.heading': '{brand} मध्ये स्वागत',
  'onboarding.intro.carousel.aria': '{brand} काय करते',
  // A dot under the slides: "Slide 2: Split anything".
  'onboarding.intro.dot.aria': 'स्लाइड {number}: {title}',
  // Each slide, for screen readers: "2 of 3".
  'onboarding.intro.slide.aria': '{total} पैकी {number}',
  // Announced as the slide changes.
  'onboarding.intro.live': 'स्लाइड {total} पैकी {number}: {title}',
  'onboarding.intro.start.cta': 'सुरू करा',
  'onboarding.slide.scan.title': 'बिलाचा फोटो घ्या',
  'onboarding.slide.scan.text': 'AI प्रत्येक वस्तू वाचते. कोणी काय घेतले ते टॅप करा, काही सेकंदात वाटणी पूर्ण.',
  'onboarding.slide.split.title': 'काहीही वाटा',
  'onboarding.slide.split.text': 'भाडे, ट्रिप, कॅब, Netflix. किंवा फक्त सांगा: “कॅब 840, प्रिया आणि सचिनसोबत”.',
  'onboarding.slide.settle.title': 'UPI ने परत मिळवा',
  'onboarding.slide.settle.text': 'ग्रुपला एक लिंक पाठवा. मित्र त्यांचे नाव टॅप करतात आणि कोणत्याही UPI ॲपने पैसे देतात.',
  'onboarding.slide.stuck.title': 'पैसे अडकले? परत मिळवा',
  'onboarding.slide.stuck.text': 'पेमेंट फेल झाले पण पैसे कापले गेले, किंवा रिफंड आलाच नाही? Settle दिवस मोजते, उशिराबद्दल बँक तुम्हाला कधी भरपाई देणे लागते ते सांगते, आणि तक्रार लिहून देते.',

  // Last step: about you.
  'onboarding.about.title': 'तुमची माहिती भरूया',
  'onboarding.about.subtitle': 'तुम्ही पाठवलेल्या विनंत्यांवर मित्रांना तुमचे नाव दिसेल.',
  'onboarding.about.start.cta': 'वाटणी सुरू करा',
  'onboarding.about.skip.cta': 'आत्ता वगळा',
  // On the way to Stuck money, only the name is asked for.
  'onboarding.about.stuck.subtitle': 'Settle तुमच्यासाठी ज्या तक्रारी लिहिते, त्यांवर हे नाव असते.',
  'onboarding.about.stuck.cta': 'पुढे चला',
  'onboarding.about.name.label': 'तुमचे नाव',
  'onboarding.about.name.placeholder': 'उदा. Priya',
  'onboarding.about.name.error': 'तुमचे नाव लिहा — तुम्ही पाठवलेल्या विनंत्यांवर मित्रांना ते दिसेल.',
  'onboarding.about.upi.label': 'तुमचा UPI ID (ऐच्छिक)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'मित्रांना UPI ने पैसे परत करता यावेत म्हणून. नंतरही जोडू शकता.',
  // The UPI field was prefilled from an older split on this phone.
  'onboarding.about.upi.hint.remembered': 'या फोनवर तुम्ही केलेल्या आधीच्या वाटणीतून. तुमचा नसेल तर बदला.',
  'onboarding.about.upi.error': 'हा UPI ID वाटत नाही. तो name@bank सारखा असायला हवा.',
  'onboarding.about.currency.label': 'चलन',
  'onboarding.about.currency.change': 'बदला',
  'onboarding.about.currency.sheet.title': 'तुमचे चलन',
  'onboarding.about.currency.sheet.body': 'नवीन वाटण्या या चलनात सुरू होतील. कोणत्याही वाटणीसाठी दुसरे चलन निवडू शकता.',
} as const satisfies Messages
