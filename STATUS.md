# Settle — what works and what doesn't

Live: **https://settleupi.vercel.app** · last checked 25 Oct 2026, 12:40 IST (the 28 Oct work is in the repository and awaiting deploy).

Legend: ✅ works on the live site · ⚠️ works with a limit · ❌ not working yet

## Working

| Area | Status | Notes |
| --- | --- | --- |
| Install on a phone | ✅ | Opens in any browser; **Add to Home screen** (Android Chrome ⋮ menu, iPhone Safari Share) installs it as an app. Full-screen, offline after the first visit. |
| Split any amount | ✅ | Equally, exact amounts, percentages, shares ("pays double"), item by item, or what each had (a meal with no bill: tax and tip shared in proportion); rounding to whole rupees. |
| Restaurant bill, typed in | ✅ | Items, tax, service charge, discount, "what you actually paid", who had what, per-person result to the paisa. |
| Bill check | ✅ | Before splitting: a service charge added by default, GST on it, service tax (gone since 2017), GST on a bill of supply, odd rates, CGST ≠ SGST, totals above the lines, repeated lines. A note for the staff in eight languages; one tap to split without the charges, with Undo. Scanned bills now read each tax line. |
| Groups | ✅ | Trips, flats, couples; running balances; fewest payments to settle up; UPI QR per payment. |
| Pay links | ✅ | One link for the group, or a personal one each; each friend taps their name and pays their exact share in their own UPI app (see "Paying a person" below), then replies "I've paid" with the UPI reference or cash, and you tick them off in one tap. No app or account needed. |
| Auto-settle (Android app) | ⚠️ | When Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik or CRED (or, if allowed, the bank's SMS) says money arrived, whoever owed that is ticked off, with Undo; unsure ones wait for a tap. Read on the phone, nothing uploaded. **Not yet on the Play Store, and not yet tried on physical phones:** CI builds a debug APK (Actions → Android → settle-android-debug); the alert wordings come from published soundbox apps and test texts, not from collected notifications. |
| Who's paid? | ✅ | UPI history screenshots (AI, not kept), a bank statement (CSV, Excel, the HTML ".xls" banks email) or pasted bank SMS (both read on the phone) tick off everyone who paid you back, with Undo. Matched on confirmed bank names, UPI ID, name, amount and date; doubtful ones ask; part payments and overpayments recognised; a statement whose balance doesn't add up ticks nothing for you. A statement shared from another app (Android) opens it. |
| To collect | ✅ | Everyone who owes you, the longest wait first, with when you last reminded them. The next reminder opens friendly, then funny, then firm; "give it a day" after a recent one; a note late at night. Paid ticks them off with Undo. Home's balance card opens it when you're only owed. |
| Fair bijli | ✅ | The flat's electricity bill by the tariff's slabs: everyday units by days at home, each higher slab only on whoever used that much, a lost subsidy on whoever crossed the line. Ten tariffs in force on 27 Oct 2026 (BESCOM, MSEDCL, AEML, Delhi, TNPDCL, TGSPDCL, CESC, Torrent, UGVCL, UPPCL) or a flat rate; AC nights or room meters; reconciled to the bill to the paisa. |
| Reminders and share cards | ✅ | Friendly / funny / firm nudges for WhatsApp and SMS, remembered so the next one knows when you last asked; a receipt image for the group chat. |
| Recurring splits, insights, backups | ✅ | Rent and subscriptions reminded monthly; spending by category and month; export / import a backup file. |
| Claim your items | ✅ | One claim link per bill; friends tick what they had on their own phone; replies merge into the split. |
| From SMS | ✅ | Paste or share a bank / UPI alert to split it; OTP messages are refused. Sharing into Settle needs the installed app on Android. |
| Food orders | ✅ | Delivery, platform, packaging, surge and small-order fees kept apart and shared in proportion or equally. |
| Collections (chanda) | ✅ | One `/pool` link for a gift, party or puja; everyone pays by UPI and replies; you tick them off. |
| Udhaar (lend / borrow) | ✅ | Two taps; part payments; reminders. |
| Next round's on you | ✅ | Groups that take turns paying see whose round it is. |
| Trips abroad | ✅ | Spend in another currency, settle in ₹ at that day's ECB rate (cached for offline), your own rate or your bank's total. |
| Rupees by default in India | ✅ | Uses the phone's time zone, so English (US) phones in India still start in ₹. |
| Speed | ✅ | On a budget-phone profile: a 300-expense group opens in 1.6 s (was 7.7 s); Home with two years of data 6.5 s (was 8.5 s); details in [bench/RESULTS.md](bench/RESULTS.md). |
| Security | ✅ | Strict security headers (CSP, HSTS, no framing), signed claim / collection replies, other sites can't call the API, per-visitor rate limits. |

## Not working yet, or limited

| Area | Status | Why / what's needed |
| --- | --- | --- |
| AI on the live site (scan a bill photo, "Just say it", speak to split, "let AI read" an SMS) | ✅ | The NVIDIA key is on Vercel (25 Oct). Checked live: a restaurant bill photo read in 4.4 s (7 items, ₹2,766 total) and "Dinner 2400 with Riya and Sam" turned into an equal ₹2,400 split. Free plan: 3 AI splits a day per phone. |
| Pro (paid plan) on the live site | ⚠️ | Licence keys are on Vercel, so **Redeem a code** works (`npm run license issue …` makes codes). Selling Pro needs Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`); until then the Pro page shows the plans without checkout. |
| Indian languages for the screens | ⚠️ | Eight languages (English, Hindi, Bengali, Marathi, Tamil, Telugu, Kannada, Gujarati) on every app screen; pick on the first onboarding screen or in You → Language. **Translations not yet reviewed by native speakers**, and the landing page and the privacy / terms text stay in English. |
| Rent & HRA receipts | ✅ | Set up a flat's rent (landlord's UPI ID and PAN, each flatmate's share). One rent link a month: each flatmate pays the landlord their own share directly. HRA rent receipts per flatmate, monthly or quarterly, with the PAN and revenue-stamp rules checked. Receipts print in English; the screens are in English and Hindi (other languages show English for now). |
| Paying a person (NPCI rules) | ⚠️ | UPI apps refuse a payment to a person that starts from a link or intent (NPCI OC 76C; Consolidated Circular 7.9), so Settle offers what UPI allows: on a computer, the QR (amount filled in, any amount); on a phone, the QR saved to the gallery and uploaded in the UPI app (up to ₹2,000 — UPI's cap for a QR picture to a person) or the UPI ID to copy with the amount; iPhone can open GPay, PhonePe, Paytm or BHIM on their home screen. **Not yet tried on physical phones**: the gallery route and the ₹2,000 cap per app, and the iPhone app schemes. Settle can't move money itself — that needs an NPCI licence. |
| Bank statements in "Who's paid?" | ⚠️ | Read on the phone from CSV, Excel (.xlsx) and the HTML ".xls" banks email; the column and narration formats (HDFC, SBI, ICICI, Axis, Kotak and similar) were built from published layouts and synthetic files, **not yet from real statements**, so an unusual layout may need a fix. Old binary .xls files can't be read — save as CSV or .xlsx. |
| "Install Settle" card | ✅ | On Home after the first split or second visit, and a You row. Android / desktop Chrome use the install prompt; iPhone gets the two Share → Add to Home Screen steps. Hidden once installed; dismissible for 30 days. |
| Paid? Drop the screenshot | ✅ | Drop a GPay / PhonePe / Paytm / BHIM payment screenshot: the AI reads status, amount, payee, UTR and date and matches it to who owes you. Refuses pending or failed payments, payments to someone else and duplicate UTRs. Uses the same AI key, now live. |
| Shagun book (gifts ledger) | ❌ | Only the "What should I give?" suggestion rule is in the code and tested. The ledger screens and reminders are not built, and the feature is off. |
| Very long histories on budget phones | ⚠️ | Scrolling Activity to the oldest of 1,500 entries takes ~59 s on the budget-phone profile (was 165 s). |
| Speak to split | ⚠️ | Needs a browser with speech recognition (Chrome, Edge, Safari; not Firefox) and the AI key. |
| Sharing an SMS into Settle | ⚠️ | Android with the installed app only (iPhone doesn't let web apps receive shares). |
| Using one account on two phones | ⚠️ by design | No accounts and no database: data stays on the phone. Move it with a backup file. |
| Automatic deploys | ⚠️ | Deploys run from the command line (`npx vercel deploy --prod`); GitHub isn't connected to Vercel for deploy-on-push yet. |

## Tests (28 Oct 2026)

- Unit and component tests: **5,081 passed**, 0 failed; typecheck and lint clean. (On a busy machine a few slow screen tests can hit the 5-second limit; they pass when run again.)
- End-to-end on the production build, Microsoft Edge as 360 px and 390 px phones in light and dark (364 journeys): every journey for the new work passes — Auto-settle, "Who's paid?" (statement, screenshots, a statement shared in through the service worker), "To collect", part payments, pay links, offline straight after the first visit (red since v5, now fixed), sharing a bill photo in. The 1,500-expense scroll test needs a quiet machine (60 s alone, against a 90 s budget). CI runs the whole suite in four parallel shards.
- The Android app compiles in CI (Actions → Android, debug APK).

