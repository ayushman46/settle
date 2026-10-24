/** English copy for onboarding (src/features/onboarding). Keys: `onboarding.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const onboarding = {
  // First step: the language (title is common.language.title).
  'onboarding.language.subtitle': 'You can change it any time in You → Language.',

  // The three intro slides.
  'onboarding.intro.heading': 'Welcome to {brand}',
  'onboarding.intro.carousel.aria': 'What {brand} does',
  // A dot under the slides: "Slide 2: Split anything".
  'onboarding.intro.dot.aria': 'Slide {number}: {title}',
  // Each slide, for screen readers: "2 of 3".
  'onboarding.intro.slide.aria': '{number} of {total}',
  // Announced as the slide changes.
  'onboarding.intro.live': 'Slide {number} of {total}: {title}',
  'onboarding.intro.start.cta': 'Get started',
  'onboarding.slide.scan.title': 'Snap the bill',
  'onboarding.slide.scan.text': 'AI reads every item. Tap who had what, and the split is done in seconds.',
  'onboarding.slide.split.title': 'Split anything',
  'onboarding.slide.split.text': 'Rent, trips, cabs, Netflix. Or just say it: “Cab 840 with Riya and Sam”.',
  'onboarding.slide.settle.title': 'Get paid back by UPI',
  'onboarding.slide.settle.text': 'Send one link to the group. Friends tap their name and pay with any UPI app.',

  // Last step: about you.
  'onboarding.about.title': 'Let’s set you up',
  'onboarding.about.subtitle': 'Friends see your name on the requests you send.',
  'onboarding.about.start.cta': 'Start splitting',
  'onboarding.about.skip.cta': 'Skip for now',
  'onboarding.about.name.label': 'Your name',
  'onboarding.about.name.placeholder': 'e.g. Ayush',
  'onboarding.about.name.error': 'Add your name — friends see it on the requests you send.',
  'onboarding.about.upi.label': 'Your UPI ID (optional)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'So friends can pay you back in one tap. You can add it later.',
  // The UPI field was prefilled from an older split on this phone.
  'onboarding.about.upi.hint.remembered': 'From a split you made on this phone. Change it if it isn’t yours.',
  'onboarding.about.upi.error': 'That doesn’t look like a UPI ID. It looks like name@bank.',
  'onboarding.about.currency.label': 'Currency',
  'onboarding.about.currency.change': 'Change',
  'onboarding.about.currency.sheet.title': 'Your currency',
  'onboarding.about.currency.sheet.body': 'New splits start in this currency. You can pick another for any split.',
  'onboarding.about.privacy': 'No sign-up, no ads. Everything you add stays on this phone — {brand} has no database.',
} as const satisfies Messages
