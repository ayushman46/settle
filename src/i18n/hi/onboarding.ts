/** Hindi copy for onboarding (src/features/onboarding). Keys: `onboarding.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const onboarding = {
  'onboarding.language.subtitle': 'इसे कभी भी आप → भाषा में बदल सकते हैं।',

  'onboarding.intro.heading': '{brand} में आपका स्वागत है',
  'onboarding.intro.carousel.aria': '{brand} क्या करता है',
  'onboarding.intro.dot.aria': 'स्लाइड {number}: {title}',
  'onboarding.intro.slide.aria': '{total} में से {number}',
  'onboarding.intro.live': 'स्लाइड {number}/{total}: {title}',
  'onboarding.intro.start.cta': 'शुरू करें',
  'onboarding.slide.scan.title': 'बिल की फ़ोटो लें',
  'onboarding.slide.scan.text': 'AI हर आइटम पढ़ लेता है। किसने क्या लिया, बस टैप करें — सेकंडों में स्प्लिट तैयार।',
  'onboarding.slide.split.title': 'कुछ भी स्प्लिट करें',
  'onboarding.slide.split.text': 'किराया, ट्रिप, कैब, Netflix। या बस बोल दीजिए: “कैब 840 रिया और सैम के साथ”।',
  'onboarding.slide.settle.title': 'UPI से पैसे वापस पाएँ',
  'onboarding.slide.settle.text': 'ग्रुप में एक लिंक भेजें। दोस्त अपना नाम टैप करें और किसी भी UPI ऐप से पे करें।',

  'onboarding.about.title': 'चलिए, शुरू करते हैं',
  'onboarding.about.subtitle': 'आपके भेजे रिक्वेस्ट पर दोस्तों को आपका नाम दिखेगा।',
  'onboarding.about.start.cta': 'स्प्लिट शुरू करें',
  'onboarding.about.skip.cta': 'अभी छोड़ें',
  'onboarding.about.name.label': 'आपका नाम',
  'onboarding.about.name.placeholder': 'जैसे: आयुष',
  'onboarding.about.name.error': 'अपना नाम डालें — आपके भेजे रिक्वेस्ट पर दोस्तों को यही दिखेगा।',
  'onboarding.about.upi.label': 'आपकी UPI ID (ज़रूरी नहीं)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'ताकि दोस्त एक टैप में पैसे लौटा सकें। चाहें तो बाद में जोड़ें।',
  'onboarding.about.upi.hint.remembered': 'इस फ़ोन पर आपके एक पुराने स्प्लिट से ली गई है। आपकी नहीं है तो बदल दें।',
  'onboarding.about.upi.error': 'यह UPI ID जैसी नहीं लगती। UPI ID ऐसी दिखती है: name@bank',
  'onboarding.about.currency.label': 'करेंसी',
  'onboarding.about.currency.change': 'बदलें',
  'onboarding.about.currency.sheet.title': 'आपकी करेंसी',
  'onboarding.about.currency.sheet.body': 'नए स्प्लिट इसी करेंसी में शुरू होंगे। किसी भी स्प्लिट के लिए दूसरी चुन सकते हैं।',
  'onboarding.about.privacy': 'न साइन-अप, न विज्ञापन। आपका सारा डेटा इसी फ़ोन पर रहता है — {brand} का कोई डेटाबेस नहीं है।',
} as const satisfies Messages
