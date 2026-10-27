/** Bengali copy for the first-run onboarding (language, intro slides, about you). Keys: `onboarding.<step>.<element>`. */
import type { Messages } from '../types'

export const onboarding = {
  // First step: the language (title is common.language.title).
  'onboarding.language.subtitle': 'আপনি → ভাষা থেকে যেকোনো সময় বদলাতে পারবেন।',

  // The three intro slides.
  'onboarding.intro.heading': '{brand}-এ স্বাগতম',
  'onboarding.intro.carousel.aria': '{brand} যা করে',
  // A dot under the slides: "Slide 2: Split anything".
  'onboarding.intro.dot.aria': 'স্লাইড {number}: {title}',
  // Each slide, for screen readers: "2 of 3".
  'onboarding.intro.slide.aria': '{total}টির মধ্যে {number}',
  // Announced as the slide changes.
  'onboarding.intro.live': 'স্লাইড {number} / {total}: {title}',
  'onboarding.intro.start.cta': 'শুরু করুন',
  'onboarding.slide.scan.title': 'বিলের ছবি তুলুন',
  'onboarding.slide.scan.text': 'AI প্রতিটি আইটেম পড়ে। কে কী নিয়েছিল ট্যাপ করুন, কয়েক সেকেন্ডেই ভাগ হয়ে যাবে।',
  'onboarding.slide.split.title': 'যেকোনো কিছু ভাগ করুন',
  'onboarding.slide.split.text': 'ভাড়া, ট্রিপ, ক্যাব, Netflix। অথবা শুধু বলুন: “ক্যাব 840, Riya ও Sourav-এর সঙ্গে”।',
  'onboarding.slide.settle.title': 'UPI দিয়ে টাকা ফেরত নিন',
  'onboarding.slide.settle.text': 'গ্রুপে একটি লিংক পাঠান। বন্ধুরা নিজের নামে ট্যাপ করে যেকোনো UPI অ্যাপ দিয়ে পে করবে।',

  // Last step: about you.
  'onboarding.about.title': 'চলুন, আপনাকে সাজিয়ে নিই',
  'onboarding.about.subtitle': 'আপনার পাঠানো অনুরোধে বন্ধুরা আপনার নাম দেখবে।',
  'onboarding.about.start.cta': 'ভাগ শুরু করুন',
  'onboarding.about.skip.cta': 'এখন বাদ দিন',
  'onboarding.about.name.label': 'আপনার নাম',
  'onboarding.about.name.placeholder': 'যেমন: Ayush',
  'onboarding.about.name.error': 'আপনার নাম লিখুন — আপনার পাঠানো অনুরোধে বন্ধুরা এটি দেখবে।',
  'onboarding.about.upi.label': 'আপনার UPI ID (ঐচ্ছিক)',
  'onboarding.about.upi.placeholder': 'name@bank',
  'onboarding.about.upi.hint': 'যাতে বন্ধুরা UPI-তে টাকা ফেরত দিতে পারে। পরে যোগ করতে পারবেন।',
  // The UPI field was prefilled from an older split on this phone.
  'onboarding.about.upi.hint.remembered': 'এই ফোনে আপনার আগের একটি ভাগ থেকে। আপনার না হলে বদলে দিন।',
  'onboarding.about.upi.error': 'এটি UPI ID বলে মনে হচ্ছে না। name@bank-এর মতো হওয়া দরকার।',
  'onboarding.about.currency.label': 'মুদ্রা',
  'onboarding.about.currency.change': 'বদলান',
  'onboarding.about.currency.sheet.title': 'আপনার মুদ্রা',
  'onboarding.about.currency.sheet.body': 'নতুন ভাগ এই মুদ্রায় শুরু হবে। যেকোনো ভাগের জন্য অন্য মুদ্রা বেছে নিতে পারবেন।',
  'onboarding.about.privacy': 'সাইন-আপ নেই, বিজ্ঞাপন নেই। আপনি যা যোগ করেন সবই এই ফোনে থাকে — {brand}-এর কোনো ডেটাবেস নেই।',
  'onboarding.restore.cta': 'ফোন বদলাচ্ছেন? ব্যাকআপ ফিরিয়ে আনুন',
  'onboarding.restore.done': 'আবার স্বাগত — সবকিছু এখানে আছে',
} as const satisfies Messages
