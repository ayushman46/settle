# Changelog

## Unreleased — 25 Oct 2026

### New
- **Pay with your UPI app.** On a pay link, "Pay ₹…" lists Google Pay, PhonePe, Paytm, BHIM and any UPI app; tap one and it opens with the amount and name already filled in. The pay sheet shows the same list. Android only; iPhones keep the generic link.

## v5 — 24 Oct 2026

### New
- **Eight languages.** English (the default), Hindi, Bengali, Marathi, Tamil, Telugu, Kannada and Gujarati. Every app screen reads from a message catalog; each language loads as its own file only when it is chosen, and English ships with the screens that use it. Chosen on the first onboarding screen or in You → Language, and kept on the phone. Public pages (pay links, claim links, collections) use the phone's language with a small switcher. Money and dates keep Indian grouping with Latin digits.
- **Paid? Drop the screenshot.** Drop a GPay, PhonePe, Paytm or BHIM payment screenshot. `POST /api/proof` reads the status, amount, payee, UTR and date, and Settle matches it to who owes you. It marks the person paid after you confirm, and refuses pending or failed payments, payments to someone else, payments whose UTR is already recorded, and screenshots that are not payments. Android can share a screenshot straight to Settle; elsewhere, use the picker.
- **Entry points.** "Got a payment screenshot?" on the friend page and the Settle-up page.
- **Install Settle.** An install card on Home (after the first split or the second visit) and a You row. Android and desktop Chrome use the browser's install prompt; iPhone Safari gets the two Share → Add to Home Screen steps. Hidden once installed; dismissible for 30 days.

### Fixes
- Accessibility: the language tiles keep their contrast, radio chips use `aria-checked`, the currency button and the people pills read their visible text.
- Pay links: the "Which one are you?" area holds its place while the link loads, so the page does not jump on a slow connection.
- Pro checkout messages, scan busy and offline messages, the Just-say-it errors and data errors read through the catalog too.

### Not in this release
- **Shagun book.** Only the "What should I give?" rule is in the code (`src/features/shagun/suggest.ts`, unit-tested). The ledger, the screens and the reminders are not built, and the feature is off.
- **Offline, straight after the first visit.** The split screen can say "You're offline" on the first trip until the app has been opened once more online. The fix in progress waits for the service worker before preloading; the scenario test is still red.
- **Translation review.** The Indian-language catalogs are complete but have not been reviewed by native speakers.
- **English-only copy.** The public landing page and the policy text on the privacy and terms pages stay in English.

## v4 — 23 Oct 2026

### New
- **Claim your items**: one claim link per scanned bill; friends tick what they had on their phones, replies merge into the split.
- **From SMS**: paste or share a bank / UPI alert to split it, settle a friend, or let AI read it. OTPs are refused.
- **Food orders**: delivery-app screenshots keep delivery, platform, packaging, surge and small-order fees apart and share them fairly.
- **Speak to split** in eight Indian languages; number words ("dhai hazaar") become digits.
- **Collections (chanda)**: a `/pool` link for gifts, parties, trips and puja; contributors pay by UPI and reply.
- **Udhaar**: lend or borrow in two taps, part payments, reminders.
- **Next round's on you**: rotation for groups that take turns paying.
- **Trip currency**: ECB rates for the expense's day (cached, offline-safe), your own rate or your bank's total; trips spend in one currency and settle in another.
- Message catalogs and `t()` for every new screen (English now; Indian-language catalogs next).

### Faster (low-end Android profile: 4× CPU slowdown, 1.6 Mbps, 150 ms RTT; see bench/RESULTS.md)
- Opening a group with 300 expenses: 7.69 s → 1.59 s.
- Home with two years of data: 8.47 s → 6.52 s; data layer 2.61 s → 0.81 s.
- Activity, scrolling to the oldest of 1,500 expenses: 165 s → 66 s, then a further −24% (78 → 59 s, re-measured on a busier machine).
- Pay links: brotli assets (−11% JS) and the page's own code preloaded (content −10%).
- Currency names and the small collections no longer cost every start.

### Deploy
- Render Blueprint (`render.yaml`), Cloudflare Pages with an `/api/*` proxy, GitHub Actions CI, step-by-step DEPLOY.md. No new paid services; exchange rates come from the ECB's free feed.
