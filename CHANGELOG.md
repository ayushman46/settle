# Changelog

## v7.1 — 2 Nov 2026

Stuck money, after 24 people tried it on phones — in English and all seven Indian languages — and told us what got in their way.

### Fixes
- **Part of it back.** Marking ₹1,000 of a ₹1,299 refund back no longer closes it as "All back": the other ₹299 stays open, keeps its days late, and is what the list, Home, the letters and the next "It's back" (which starts at what's still owed) talk about. More of it back adds up. An Android reversal alert for part of it does the same.
- **Back, but the bank still owes for the wait.** Once the money is back, the case shows the compensation owed — not the original amount "On its way" — under a new "Owed for the wait" section, and walks the bank → RBI Ombudsman ladder for that amount.
- **The list says where each one stands**: Needs you, Waiting on them, Owed for the wait, Not due yet, Got back, Set aside. Raised cases keep their days late and the ₹ owed. Titles say what it is ("Failed payment to Swiggy", "Flipkart refund") so a shop never looks like a friend who owes you; rows show the order number.
- **The clock is in date order**, says where each due date comes from (the date they gave, their own timeline, or the usual 7 working days — never a promise that wasn't made), and shows what comes next and the last day for the RBI Ombudsman.
- **Ombudsman timing.** The bank's 30th day is still the bank's; the Ombudsman is offered from day 31 — or at once after "My bank replied or said no". The 90-day window counts from that reply. No more made-up deadline after a complaint is with the Ombudsman, and a closed window is said plainly.
- **Airline refunds paid by card** are due within the DGCA's 7 days even when the airline says later, and the app and the letters say it's the DGCA's rule.
- **Wallets and NACH.** A wallet payment's complaint goes to the wallet company (Paytm, PhonePe, Amazon Pay, MobiKwik), not "your bank". A debit after you cancelled a NACH mandate gets a letter that says exactly that, not "the payment failed".
- **Amounts and dates.** "99,99,999" typed with Indian commas is ₹99,99,999, not ₹99.99. Future days and a promise before the cancellation are caught. Dates from another year show the year.
- **Duplicates.** The same reference or order number can't be tracked twice (it opens the one you have); a pasted SMS you've already tracked says so.
- Undo after adding a case no longer lands on "This one's gone"; Delete asks first (and offers Set aside).

### New
- **Your bank, app and account on the form**, with labels for the way you paid (ATM slip number, card's last 4, IMPS reference, mandate UMRN, PNR), so letters no longer say "[your bank's name]". "Failed payment or refund?" says which is which (an IRCTC booking that failed but took the money is a failed payment).
- **Letters ready to send**: your mobile, city and address filled in once (kept on this phone, never in backups), the email address you send to remembered per bank or business, a two-line summary in your language of what the English letter asks, the complaint history carried into every later step (the NCH message includes the AirSewa complaint), a printable copy with an acknowledgement slip for the branch, and NPCI's MyUPI only within its 45 days.
- **Paste several messages at once.** Each is read on its own, so an OTP in the paste no longer hides a failed payment; a debit SMS can become a failed payment with one "Yes, it failed"; anything not recognised keeps what it found for the form. Hindi and Hinglish bank SMS, and 18 more banks (Canara, Union, Bank of India, Indian Bank, IOB, Karur Vysya, City Union and others), are recognised. A pending payment waits for its final SMS instead of being called stuck.
- **Remind me** on the next deadline, as a calendar event made on the phone (or Google Calendar). **A win card** when it's all back, with something to share that carries no references or account digits. **Notes** on a case. **"They don't answer"** goes straight to the next step.
- **Easier to find.** A Stuck money tile on Home from day one; the Home card names the case and opens it; it sits above the first-split card when something needs you; onboarding has a Stuck money slide, and arriving from a Stuck money link lands there. The More sheet is now "More": getting your money back, then starting a split.
- Backup, restore and Clear all data count stuck payments.

### Changed
- Toasts give long messages (and long translations) time to be read, have a close button, stay with the page they were shown on, and sit above an open sheet instead of over its buttons; a plain message makes way for a sheet, an Undo stays.
- **Regional languages.** Hindi and Bengali vowel signs no longer clipped in status pills; words no longer break mid-word; Tamil and Bengali case endings no longer glued on with a hyphen; Undo no longer reads as "take the money back"; "you" no longer flips the meaning of a share line. Rent & HRA is now in all eight languages, and the You tab, backup note, Home's example sentence and screen-reader labels are translated.
- Privacy policy: letter details stay on the phone and out of backups; a backup file is readable by anyone who has it; what the Google Calendar link sends; the app's check-ins with the server.

## v7 — 2 Nov 2026

From "friends who owe you" to "banks and businesses who owe you": money stuck in a failed payment or a refund that never came, tracked to the day and claimed the way the RBI says.

### New
- **Stuck money.** A UPI, card, ATM or IMPS payment that failed but took your money, or a refund a business promised (Amazon, Flipkart, Swiggy, Zomato, IRCTC, airlines…), tracked until it's back. For a failed payment Settle uses the RBI's deadline for that kind of payment (RBI/2019-20/67, 20 Sep 2019): T+1 for UPI to a person, IMPS, card-to-card, NACH and on-us wallets; T+5 for UPI to a shop, cards online or at a shop, ATM cash not dispensed and AePS — calendar days from the payment, as the circular counts them; the longer one when the way you paid isn't known. A refund goes by the date the business gave, or its published timeline (DGCA's 7 days for an airline's card refund). Past the deadline it counts the ₹100 a day the circular says the bank pays on its own, without being asked.
- **The complaint ladder, with the letter ready.** Each stuck payment says what to do today: a failed payment goes to your bank or UPI app, then — after 30 days without a fix — to the RBI Ombudsman (cms.rbi.org.in, Reserve Bank – Integrated Ombudsman Scheme, 2026); a refund goes to the business, then the National Consumer Helpline (1915 or WhatsApp), then a consumer commission (e-Jagriti); an airline's refund can go to AirSewa. The letters carry the dates, the amount, the circular's row, the compensation so far and your name and UPI ID — copy, share or email them. "I've raised it" keeps the date and complaint number; "It's back" records the money and any compensation paid, and a delayed reversal without compensation turns into a claim for it. Settle drafts, you send: it never contacts anyone for you.
- **Found by itself on Android.** With notification access on, the Settle Android app also reads failed, pending and refund alerts from the UPI apps (and from your bank's SMS, if you allowed it), and refund alerts from a short list of shopping, food and travel apps. A failure becomes a stuck payment — confirmed when the bank's debit for the same amount arrives, or with one tap ("Did ₹500 leave your account?") — and an open one is ticked off when the reversal or refund lands, with a toast and Undo. Read on the phone, never uploaded. On iPhone and the web: paste or share the bank SMS, or add one in three taps.
- Home shows what banks and shops owe you when something is open; Stuck money is also under Home → More and You → Shortcuts. Stuck payments are in backups.

### Changed
- **The landing page and README lead with Stuck money**: a "New" link above the tagline, the first feature tile (with its numbers from the real rules), and three new questions in the FAQ — how it works, whether the ₹100 a day is real, and whether Settle files complaints (it doesn't). Auto-settle's tile says it now catches failed payments and refunds too.
- **Privacy policy**: what Stuck money keeps on the phone and in backups, and what the Android app now reads — failed-payment, pending and refund alerts from UPI apps and a few shopping, food and travel apps, and a bank's debit SMS only to check that a failed payment took the money — and that complaint letters leave the phone only when you send them.

### Known limits
- The wording of failed-payment, reversal and refund alerts comes from published samples and test texts, not yet from notifications collected on real phones; the shopping and travel apps' package names are as Google Play lists them and haven't been tried on a device.
- Deadlines are counted in calendar days, as the circular does; NPCI's own FAQ speaks of working days for UPI reversals, so a bank may answer by that. Refund timelines in working days skip weekends but not bank holidays.
- Settle states the published rules and where to complain. It isn't legal advice, it can't make a bank or a business pay, and it can't see compensation paid to you unless you record it.

## v6 — 27 Oct 2026

Getting paid back, start to finish — and the things nobody checks: the bill, the electricity, who has actually paid.

### New
- **Auto-settle — payments tick themselves off (Android app).** Settle now comes as an Android app (`android/`, Capacitor loading the live site, built by `.github/workflows/android.yml`). With Auto-settle on, when Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik or CRED — or, if you allow it, your bank's SMS — says money arrived, Settle matches it to whoever owed you and ticks them off, with a toast and Undo. A payment it isn't sure of (a part payment, a name it can't place) waits under "Payments to check" for one tap; one that fits nobody is let go. The same payment told twice (the UPI app's alert and the bank's SMS) is counted once. Only alerts from those apps that say money came in are kept, on the phone, until Settle reads them; every other notification is ignored. A clear disclosure comes before Android's notification-access switch, and it can be turned off there any time. The matching is "Who's paid?"'s, which stays the way in on iPhone and the web.
- **Who's paid?** Bring in what you received and Settle ticks off everyone who paid you back, in one go. Three ways in: screenshots of your UPI app's history (up to 6, read by `POST /api/history` and not kept), a bank statement (CSV, Excel, or the HTML ".xls" banks email) or pasted bank SMS — the statement and SMS are read on the phone and never uploaded. Each payment is matched on the bank names you've confirmed, the UPI ID (whole or masked), the name, the amount and the date: clear matches are ticked for you, doubtful ones ask with one tap, and part payments, overpayments and one payment for several splits are offered as such. A statement whose running balance doesn't add up, a row only a green colour marks as money in, and a cut-off row are never ticked for you; references already marked are skipped. One tap marks them, with Undo; the bank name you confirm is remembered; whoever paid in cash is one more tap. Share a statement from the bank's or mail app (Android) and it opens here. From Home → More and any expense people still owe on.
- **Part payments.** Someone who pays ₹200 of their ₹420 now owes ₹220 — everywhere: Home, the friend's page, To collect, the expense ("₹200 paid · ₹220 left"), reminders and their pay link, which asks only for the rest and says what's already paid. "Who's paid?" and Auto-settle record a part payment as just that, instead of marking the whole share paid. Edits keep what was paid; a share it now covers is ticked off.
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
- "Who's paid?" (and Auto-settle) ticked a group expense's share as paid, which a group ignores — its balances still said they owed. Money owed in a group is now matched against the group's simplified payments and settled by recording the payment in the group, with Undo.
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
