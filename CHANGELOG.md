# Changelog

## v6 — 27 Oct 2026

Getting paid back, start to finish — and the things nobody checks: the bill, the electricity, who has actually paid.

### New
- **Auto-settle — payments tick themselves off (Android app).** Settle now comes as an Android app (`android/`, Capacitor loading the live site, built by `.github/workflows/android.yml`). With Auto-settle on, when Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik or CRED — or, if you allow it, your bank's SMS — says money arrived, Settle matches it to whoever owed you and ticks them off, with a toast and Undo. A payment it isn't sure of (a part payment, a name it can't place) waits under "Payments to check" for one tap; one that fits nobody is let go. The same payment told twice (the UPI app's alert and the bank's SMS) is counted once. Only alerts from those apps that say money came in are kept, on the phone, until Settle reads them; every other notification is ignored. A clear disclosure comes before Android's notification-access switch, and it can be turned off there any time. The matching is "Who's paid?"'s, which stays the way in on iPhone and the web.
- **Who's paid?** Bring in what you received and Settle ticks off everyone who paid you back, in one go. Three ways in: screenshots of your UPI app's history (up to 6, read by `POST /api/history` and not kept), a bank statement (CSV, Excel, or the HTML ".xls" banks email) or pasted bank SMS — the statement and SMS are read on the phone and never uploaded. Each payment is matched on the bank names you've confirmed, the UPI ID (whole or masked), the name, the amount and the date: clear matches are ticked for you, doubtful ones ask with one tap, and part payments, overpayments and one payment for several splits are offered as such. A statement whose running balance doesn't add up, a row only a green colour marks as money in, and a cut-off row are never ticked for you; references already marked are skipped. One tap marks them, with Undo; the bank name you confirm is remembered; whoever paid in cash is one more tap. Share a statement from the bank's or mail app (Android) and it opens here. From Home → More and any expense people still owe on.
- **To collect.** Everyone who owes you on one list, the longest wait first, with what it's for and how long it's been. Remind opens the message in the tone that comes next — friendly, then funny, then firm — and every reminder sent anywhere in the app is remembered, so each row says when you last asked (and to give it a day if it was today or yesterday). Late at night it says the reminder can wait. Paid ticks someone off across their splits and groups, with Undo. Home's balance card, when you're only owed, says **Get paid back** and opens it.
- **Bill check.** Before a restaurant bill is split, Settle checks it: a service charge (or "staff contribution") added by default — optional under the CCPA guidelines of 4 Jul 2022, upheld by the Delhi High Court on 28 Mar 2025 (under appeal) — with the GST charged on it; service tax and its cesses (gone since July 2017); GST on a bill of supply; an odd tax rate; CGST ≠ SGST; a total above the bill's own lines; the same line twice. "Possible saving ₹121.01", a polite note for the staff in any of the eight languages, the consumer helplines, and one tap to split without the charges (with Undo).
- **Fair bijli.** Split a flat's electricity bill by the tariff's slabs instead of equally: everyday units by days at home, each higher slab only on whoever used that much, a lost subsidy on whoever crossed the line. Tariffs in force on 27 Oct 2026 for BESCOM, MSEDCL, AEML, Delhi, TNPDCL, TGSPDCL, CESC, Torrent, UGVCL and UPPCL, or a flat rate; extra units from AC nights (BEE star-label energy, calibrated to the bill) or room meters; reconciled to the bill to the paisa. Saved as an ordinary split. From Home → More, or a rented flat's page.
- **What each had.** A fifth way to split a meal with no bill: type what each person had; tax, tip or a discount on what was paid is shared in proportion. The split-mode picker says in one line what each way is for.
- **Ask each person, and "I've paid" replies.** The share sheet lists everyone who still owes, each with their own WhatsApp message and a personal pay link that opens on their share. On the pay page a friend says how they paid (UPI with the 12-digit reference, or cash) and sends a reply; you tap it and they're ticked off after one confirmation.
- **Rent, split right — with HRA receipts.** A flat's rent with each flatmate's share and the landlord's UPI ID and PAN. One rent link a month makes the landlord the payee: each flatmate pays their own share directly (nobody fronts the whole rent), and has their own payment trail. HRA rent receipts for each flatmate's share — a month or a quarter of the financial year, amount in words, landlord PAN (needed above ₹1,00,000 a year), a ₹1 revenue stamp on cash receipts above ₹5,000 — printed or saved as PDF. Home → More and You → Shortcuts.
- **Proprietary licence.** All rights reserved (LICENSE); open-source components listed in THIRD-PARTY-NOTICES.md.

### Changed
- **Paying a person, the ways UPI allows.** NPCI has payer apps refuse a payment to a person that starts from a link or intent (OC 76C, April 2025; UPI Consolidated Circular 7.9), so the "Pay with GPay / PhonePe…" buttons are gone. On a computer: the QR, scanned with any UPI app (amount and note filled in). On a phone, up to ₹2,000: save the QR to the gallery and upload it in the UPI app (a QR picture pays a person up to ₹2,000), or copy the UPI ID; above ₹2,000: copy the UPI ID and the amount. "Show QR for another phone" works for any amount. Back from the UPI app, "Did you pay …?" leads to "I've paid" or to what to do when a payment doesn't go through. The name check reads honestly (UPI apps show the bank's name).

### Fixes
- **Offline straight after the first visit.** A screen opened on the first visit (the split screen, say) was missing offline until Settle had been opened online once more: its code loaded before the service worker took over, and loading it again never asked the network. When the worker takes over, Settle now fetches what the page already loaded once more through it (from the browser's cache), so it's kept. The scenario test that was red since v5 passes.
- A bill photo shared into Settle (Android) opened "Paid? Drop the screenshot" and stopped at "That doesn't look like a UPI payment". It now goes on to the bill scan.
- The Hindi firm reminder no longer assumes the sender is male.
- "Who's paid?" and "To collect" fit a 320 px phone; long choices wrap instead of being cut off.

### Known limits
- Auto-settle reads the wording UPI apps and banks use today ("Riya Sharma paid you ₹420", "Received ₹420 from …", "Rs.420 credited … VPA …"); the exact alerts of each app version have not been collected from real phones yet, so some may need adding. The Android app is built as a debug APK by CI; a Play Store release needs a signing key and Play's review of notification access.
- Bank statement layouts were built from published formats and synthetic files for HDFC, SBI, ICICI, Axis and Kotak; real statements may need small fixes.
- The saved-QR route (₹2,000 cap) and opening UPI apps on iPhone have not been tried on physical phones yet.

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
