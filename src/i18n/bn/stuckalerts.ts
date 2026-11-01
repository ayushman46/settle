/** Bengali copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name}-কে পাঠানো {amount} ব্যর্থ হয়েছে, কিন্তু টাকা কেটেছে — “আটকে থাকা টাকা”-য় নজর রাখা হচ্ছে',
  'stuckalerts.failed.anon': '{amount}-এর একটা পেমেন্ট ব্যর্থ হয়েছে, কিন্তু টাকা কেটেছে — “আটকে থাকা টাকা”-য় নজর রাখা হচ্ছে',
  'stuckalerts.check': '{name}-কে পাঠানো {amount} হয়তো আটকে আছে — আপনার অ্যাকাউন্ট থেকে কি কেটেছে?',
  'stuckalerts.check.anon': '{amount}-এর একটা পেমেন্ট হয়তো আটকে আছে — আপনার অ্যাকাউন্ট থেকে কি কেটেছে?',
  'stuckalerts.refund': '{name}-এর {amount} রিফান্ড না আসা পর্যন্ত নজর রাখা হচ্ছে',
  'stuckalerts.refund.anon': '{amount}-এর একটা রিফান্ড না আসা পর্যন্ত নজর রাখা হচ্ছে',
  'stuckalerts.added.many': '{count, plural, one {#টা পেমেন্ট} other {#টা পেমেন্ট}} “আটকে থাকা টাকা”-য় যোগ হয়েছে',
  'stuckalerts.back.failed': '{name}-এর ব্যর্থ পেমেন্টের {amount} ফেরত এসেছে',
  'stuckalerts.back.failed.anon': 'একটা ব্যর্থ পেমেন্টের {amount} ফেরত এসেছে',
  'stuckalerts.back.failed.late':
    '{name}-এর ব্যর্থ পেমেন্টের {amount} ফেরত এসেছে — {days, plural, one {# দিন} other {# দিন}} দেরিতে: দেরির জন্য আপনার ব্যাংকের কাছে আপনার {compensation} পাওনা',
  'stuckalerts.back.failed.anon.late':
    'একটা ব্যর্থ পেমেন্টের {amount} ফেরত এসেছে — {days, plural, one {# দিন} other {# দিন}} দেরিতে: দেরির জন্য আপনার ব্যাংকের কাছে আপনার {compensation} পাওনা',
  'stuckalerts.back.refund': '{name}-এর {amount} রিফান্ড এসে গেছে',
  'stuckalerts.back.refund.anon': '{amount}-এর একটা রিফান্ড এসে গেছে',
  'stuckalerts.back.many': '{count, plural, one {#টা আটকে থাকা পেমেন্ট} other {#টা আটকে থাকা পেমেন্ট}} ফেরত এসেছে',
}
