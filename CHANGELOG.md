# Changelog

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
