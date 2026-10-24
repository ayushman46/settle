/** English copy for Pro (src/features/pro). Keys: `pro.<screen>.<element>` (see i18n-plan §3). "Pro" stays "Pro" in every language. */
import type { Messages } from '../types'

export const pro = {
  // What Pro adds (the perk list). {count} is Pro's fair-use AI allowance a day.
  'pro.perk.ai.title': 'Unlimited AI',
  'pro.perk.ai.body': 'Scan bills and “Just say it” as often as you like — fair use, up to {count} a day.',
  'pro.perk.recurring.title': 'Recurring splits',
  'pro.perk.recurring.body': 'Rent, Wi-Fi, Netflix: a reminder each month and a one-tap split.',
  'pro.perk.insights.title': 'Insights',
  'pro.perk.insights.body': 'Where your money goes — by category, month and friend.',
  'pro.perk.export.title': 'CSV export',
  'pro.perk.export.body': 'Every expense, ready for Excel or Google Sheets.',
  'pro.perk.themes.title': 'Accent colours',
  'pro.perk.themes.body': 'Make it yours in mint, sky, violet or coral.',
  'pro.perk.cleanCards.title': 'Clean share cards',
  'pro.perk.cleanCards.body': 'Split cards for the group chat, without the “Made with {brand}” line.',
  'pro.perk.early.title': 'Early access',
  'pro.perk.early.body': 'Try new features before they reach everyone.',
  'pro.perks.aria': 'What Pro adds',

  // What the paywall (and a locked screen) leads with, per feature. `.cta` unlocks it.
  'pro.pitch.general.title': '{brand} Pro',
  'pro.pitch.general.body': 'Unlimited AI, recurring splits and insights. Pay once — nothing renews.',
  'pro.pitch.general.cta': 'See Pro',
  'pro.pitch.ai.title': 'Unlimited AI with Pro',
  // {free}: the free AI allowance a day; {count}: Pro's fair-use cap.
  'pro.pitch.ai.body':
    'Free includes {free} AI scans or “Just say it” splits a day, and they reset at midnight. Pro lifts the limit — fair use, up to {count} a day.',
  'pro.pitch.ai.cta': 'Get unlimited AI',
  'pro.pitch.recurring.title': 'Recurring splits are part of Pro',
  'pro.pitch.recurring.body': 'Set up rent, Wi-Fi or Netflix once. Each month you get a reminder and split it in one tap.',
  'pro.pitch.recurring.cta': 'Unlock recurring splits',
  'pro.pitch.insights.title': 'See where your money goes',
  'pro.pitch.insights.body': 'Your spending by category, month and friend — worked out on your phone, never uploaded.',
  'pro.pitch.insights.cta': 'Unlock Insights',
  'pro.pitch.export.title': 'Export to a spreadsheet',
  'pro.pitch.export.body': 'Download every expense as a CSV for Excel or Google Sheets. Backups stay free for everyone.',
  'pro.pitch.export.cta': 'Unlock CSV export',
  'pro.pitch.themes.title': 'Make it yours',
  'pro.pitch.themes.body': 'Pick mint, sky, violet or coral as your accent colour. Lime stays free.',
  'pro.pitch.themes.cta': 'Unlock accent colours',
  'pro.pitch.cleanCards.title': 'Cleaner share cards',
  'pro.pitch.cleanCards.body': 'Share split cards in the group chat without the “Made with {brand}” line.',
  'pro.pitch.cleanCards.cta': 'Unlock clean cards',
  'pro.freeForever': 'Free forever: unlimited manual splits, groups, pay links, UPI QR codes, nudges and backups.',

  // The passes.
  'pro.plan.monthly': 'Monthly',
  'pro.plan.yearly': 'Yearly',
  'pro.plan.lifetime': 'Lifetime',
  // The server's highlights on a pass.
  'pro.plan.badge.bestValue': 'Best value',
  'pro.plan.badge.payOnce': 'Pay once',
  'pro.plan.term.forever': 'Yours for good',
  'pro.plan.term.years': '{count, plural, one {# year} other {# years}}',
  'pro.plan.term.days': '{count, plural, one {# day} other {# days}}',
  'pro.plan.perMonth': 'About {amount} a month',
  // For screen readers: "Yearly, ₹399 for 1 year, about ₹33 a month, save 32%, Best value".
  'pro.plan.spoken.price': '{price} for {term}',
  'pro.plan.spoken.save': 'save {percent}%',
  'pro.plan.save': 'Save {percent}%',
  'pro.plan.legend': 'Choose your pass',
  'pro.plan.loading': 'Loading prices…',
  'pro.checkout.cta': 'Get Pro — {price}',
  'pro.checkout.cta.noPlan': 'Get Pro',
  'pro.checkout.note.lifetime': 'One-time payment · Pro for good',
  'pro.checkout.note': 'One-time payment · {term} · nothing renews',
  'pro.checkout.cancelled.toast': 'Checkout closed. No payment was made.',
  'pro.checkout.off.title': "Checkout isn't set up yet",
  'pro.checkout.off.body': "Payments aren't switched on here yet, so passes can't be bought right now. Got a Pro code? You can redeem it.",
  'pro.trust.aria': 'How paying works',
  'pro.trust.once': 'One-time payment',
  'pro.trust.noAccount': 'No account needed',
  'pro.trust.methods': 'UPI or card via Razorpay',

  // The pass on this phone.
  'pro.pass.forever': '{name} pass · yours for good',
  'pro.pass.until': '{name} pass · until {date}',
  'pro.pass.ended': 'Ended',
  'pro.pass.endsToday': 'Ends today',
  'pro.pass.endsTomorrow': 'Ends tomorrow',
  'pro.pass.endsIn': '{count, plural, one {Ends in # day} other {Ends in # days}}',
  'pro.pass.endedOn': 'Ended {date}',
  'pro.pass.lifetime': 'Lifetime',
  'pro.pass.active': 'Active',

  // A locked Pro feature.
  'pro.lock.ended': 'Your Pro pass ended on {date}.',
  'pro.lock.renew.cta': 'Renew Pro',
  'pro.lock.from': 'Pro from {price} · one-time payment, nothing renews',

  // Redeem a code. {prefix} is how every code starts.
  'pro.redeem.cta': 'Redeem a code',
  'pro.redeem.title': 'Redeem a code',
  'pro.redeem.description': 'Paste the Pro code you were given or copied from your old phone. Codes start with {prefix}.',
  'pro.redeem.submit.cta': 'Redeem',
  'pro.redeem.label': 'Pro code',
  'pro.redeem.paste.aria': 'Paste from clipboard',
  'pro.redeem.paste.error': "Couldn't read the clipboard. Long-press the field to paste instead.",
  'pro.redeem.error.notACode': "That doesn't look like a {brand} Pro code. Codes start with {prefix}.",
  'pro.redeem.error.invalid': "That code isn't valid. Check you copied all of it, then try again.",
  'pro.redeem.error.expired': 'That code has expired.',
  'pro.redeem.error.offline': "You're offline. Connect to the internet to check the code.",
  'pro.redeem.error.network': "Couldn't check the code right now. Try again in a moment.",
  'pro.redeem.kept.title': 'You already have a longer pass',
  'pro.redeem.kept.lifetime': 'Your Lifetime pass is already on, so nothing changed here.',
  'pro.redeem.kept.until': 'Your pass runs until {date} — longer than this code — so nothing changed.',
  'pro.redeem.kept.elsewhere': 'The code still works on another phone.',
  'pro.redeem.same.title': 'That code is already on this phone',
  'pro.redeem.same.body': "Pro is on — there's nothing else to do.",
  'pro.redeem.note': 'Your pass lives on this phone — no account needed. Keep your code private: anyone with it gets your Pro.',

  // The paywall sheet.
  'pro.paywall.on.title': 'Pro is on',
  'pro.paywall.continue.cta': 'Continue',
  'pro.paywall.all.cta': 'See everything in Pro',
  'pro.paywall.on.body': 'Everything in Pro is unlocked on this phone.',
  'pro.paywall.also.aria': 'Also in Pro',
  'pro.unlocked.title': 'Pro unlocked',

  // The upgrade screen (`/app/pro`).
  'pro.upgrade.unlocked.title': "What you've unlocked",
  'pro.upgrade.perks.title': 'Everything in Pro',
  'pro.upgrade.have.title': 'Already have Pro?',
  'pro.upgrade.have.body':
    "Your pass lives on the phone it was bought on — there's no account. Moving phones? Copy your Pro code on the old one and redeem it here. Promo codes work the same way.",
  // <terms> and <privacy> become links.
  'pro.upgrade.legal':
    'Payments are handled securely by Razorpay. By buying a pass you agree to the <terms>Terms</terms>; see how we treat your data in the <privacy>Privacy policy</privacy>.',
  'pro.upgrade.expired.body':
    'Your Pro pass has run out. Pick a pass to switch Pro back on — your recurring splits and settings are all still here.',
  'pro.upgrade.lede': 'Unlimited AI, recurring splits and insights. Pay once — nothing renews.',
  'pro.upgrade.plans.title': 'Choose your pass',
  'pro.upgrade.plans.description': 'One-time payments — nothing renews automatically.',
  'pro.lifetime.title': 'Make it lifetime',
  'pro.lifetime.body':
    "Pay {price} once and never renew. It replaces your current pass from today — passes don't add up, so the days left on this one aren't carried over.",
  'pro.lifetime.cta': 'Go lifetime — {price}',
  'pro.move.title': 'Moving to a new phone?',
  'pro.move.body':
    "Your pass lives on this phone — there's no account, and backups don't include it. Copy your Pro code and redeem it on the new phone. Keep it private: anyone with the code gets your Pro.",
  'pro.move.copy.cta': 'Copy your Pro code',
  'pro.move.redeem.cta': 'Redeem another code',
  'pro.move.copied.toast': 'Pro code copied. Redeem it in {brand} on your new phone.',
  'pro.move.copy.error': "Couldn't copy your Pro code. Please try again.",
} as const satisfies Messages
