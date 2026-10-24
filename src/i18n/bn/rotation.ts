/** Bengali copy for "Pay it forward" rounds (take turns paying for everyone). Keys: `rotation.<part>.<element>`. */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included.
  'rotation.everyone': '{count, plural, =2 {আপনারা দুজনেই} other {আপনারা সবাই, মোট #জন}}',
  'rotation.everyone.you': '{count, plural, =2 {আপনারা দুজনেই} other {সবাই, মোট #জন}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': 'পরের পালা {name}-এর',
  'rotation.card.title.you': 'পরের পালা আপনার',
  'rotation.card.body': '{name}-এর {behind} বাকি। {name} যদি {everyone}-এর জন্য পরের {squares} দেন, তাহলে {name}-এর হিসাব সমান হবে।',
  'rotation.card.body.you': 'আপনার {behind} বাকি। {everyone}-এর জন্য পরের {squares} দিলে আপনার হিসাব সমান হবে।',
  'rotation.card.usual': 'এখানে সাধারণ পালা {usual} — তাতে গ্রুপের বাকি {out}-এর মধ্যে {settles} মিটে যায়।',
  // When the usual round is bigger than helps.
  'rotation.card.fallback': '{name}-এর {behind} বাকি। {everyone}-এর জন্য সর্বোচ্চ {squares} দিলে {name}-এর হিসাব সমান হয় — বড় পালা হলে {name} এগিয়ে যাবেন।',
  'rotation.card.fallback.you': 'আপনার {behind} বাকি। {everyone}-এর জন্য সর্বোচ্চ {squares} দিলে আপনার হিসাব সমান হয় — বড় পালা হলে আপনি এগিয়ে যাবেন।',
  // When only people who left the group are behind.
  'rotation.card.left.title': 'বরং হিসাব মিটিয়ে নিন',
  'rotation.card.left': '{name} গ্রুপ ছেড়েছেন, তাঁর {amount} মেটানো বাকি — বরং হিসাব মিটিয়ে নিন।',
  'rotation.card.left.many': 'গ্রুপ ছেড়ে যাওয়া {count} জনের {amount} মেটানো বাকি — বরং হিসাব মিটিয়ে নিন।',
  'rotation.card.log.cta': 'পরের পালা লিখে রাখুন',
  'rotation.card.plan.cta': 'পালার পরিকল্পনা দেখুন',
  'rotation.card.settle.cta': 'হিসাব মেটান',
  // The banner on the new split the card opens.
  'rotation.banner.title': '{name}-এর পালা',
  'rotation.banner.title.you': 'আপনার পালা',
  'rotation.banner.body': 'সর্বোচ্চ {amount} দিলে {name}-এর হিসাব সমান হয়। এর বেশি হলে {name} এগিয়ে যাবেন।',
  'rotation.banner.body.you': 'সর্বোচ্চ {amount} দিলে আপনার হিসাব সমান হয়। এর বেশি হলে আপনি এগিয়ে যাবেন।',
  // The rotation sheet.
  'rotation.sheet.title': 'আগে আপনি, পরে আমি',
  'rotation.sheet.description': 'একে অপরকে ফেরত না দিয়ে পালা করে সবার জন্য দিন। প্রতিটি পালা {everyone}-এর মধ্যে সমান ভাগে ভাগ হবে।',
  'rotation.sheet.amount.label': 'প্রতি পালায় প্রায়',
  'rotation.sheet.amount.error': 'একটি পরিমাণ লিখুন',
  'rotation.sheet.reset.cta': 'আবার শুরু',
  'rotation.sheet.reset.aria': 'সাধারণ পালায় ফিরে যান',
  'rotation.sheet.rounds.label': 'পালাগুলো',
  'rotation.sheet.round.title': '{n} · {name} দেবেন',
  'rotation.sheet.round.title.you': '{n} · আপনি দেবেন',
  'rotation.sheet.round.subtitle': 'গ্রুপের বাকি {before} → {after}',
  'rotation.sheet.round.settles': '{amount} মেটে',
  'rotation.sheet.round.aria': 'পালা {n}, {name} দেবেন, গ্রুপের বাকি {before} থেকে {after}, {amount} মেটে',
  'rotation.sheet.round.aria.you': 'পালা {n}, আপনি দেবেন, গ্রুপের বাকি {before} থেকে {after}, {amount} মেটে',
  'rotation.sheet.square': 'পালা {n} শেষে সবার হিসাব সমান 🎉',
  'rotation.sheet.leftover': 'তারপর শেষের {amount} মিটিয়ে নিন:',
  'rotation.sheet.empty.title': 'একটি {amount} পালা কারও বাকির চেয়ে বড়',
  'rotation.sheet.empty.body': 'ছোট পালা দিয়ে দেখুন — অথবা হিসাব মিটিয়ে নিন।',
  'rotation.sheet.settle.cta': 'হিসাব মেটান',
  'rotation.sheet.log.cta': 'পালা 1 লিখুন, {name} দিচ্ছেন',
  'rotation.sheet.log.cta.you': 'পালা 1 লিখুন, আপনি দিচ্ছেন',
  'rotation.sheet.live': 'পরিকল্পনা আপডেট হয়েছে: {count, plural, one {# টি পালা} other {# টি পালা}}',
  'rotation.sheet.live.none': 'পরিকল্পনা আপডেট হয়েছে: কোনো পালাই সাহায্য করছে না',
} as const satisfies Messages
