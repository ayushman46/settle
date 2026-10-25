# Settle — what works and what doesn't

Live: **https://settleupi.vercel.app** · last checked 25 Oct 2026, 12:40 IST.

Legend: ✅ works on the live site · ⚠️ works with a limit · ❌ not working yet

## Working

| Area | Status | Notes |
| --- | --- | --- |
| Install on a phone | ✅ | Opens in any browser; **Add to Home screen** (Android Chrome ⋮ menu, iPhone Safari Share) installs it as an app. Full-screen, offline after the first visit. |
| Split any amount | ✅ | Equally, exact amounts, percentages, shares ("pays double"), item by item; rounding to whole rupees. |
| Restaurant bill, typed in | ✅ | Items, tax, service charge, discount, "what you actually paid", who had what, per-person result to the paisa. |
| Groups | ✅ | Trips, flats, couples; running balances; fewest payments to settle up; UPI QR per payment. |
| Pay links | ✅ | One link for the group; each friend taps their name and pays their exact share in GPay / PhonePe / Paytm / BHIM. No app or account needed. |
| Reminders and share cards | ✅ | Friendly / funny / firm nudges for WhatsApp and SMS; a receipt image for the group chat. |
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
| Pay with your UPI app | ✅ | Tap "Pay ₹…" on a pay link (or the pay sheet) and pick Google Pay, PhonePe, Paytm, BHIM or any UPI app: it opens with the amount and name already filled in; you only enter your UPI PIN. Android: not installed → its Play Store page. iPhone / iPad: each app opens by its own scheme (the iOS prefixes payment gateways document); iOS can't tell a page whether an app is installed, so if the page is still showing after the tap it suggests picking another app. Not yet tried on a physical iPhone. |
| "Install Settle" card | ✅ | On Home after the first split or second visit, and a You row. Android / desktop Chrome use the install prompt; iPhone gets the two Share → Add to Home Screen steps. Hidden once installed; dismissible for 30 days. |
| Paid? Drop the screenshot | ✅ | Drop a GPay / PhonePe / Paytm / BHIM payment screenshot: the AI reads status, amount, payee, UTR and date and matches it to who owes you. Refuses pending or failed payments, payments to someone else and duplicate UTRs. Uses the same AI key, now live. |
| Shagun book (gifts ledger) | ❌ | Only the "What should I give?" suggestion rule is in the code and tested. The ledger screens and reminders are not built, and the feature is off. |
| Very long histories on budget phones | ⚠️ | Scrolling Activity to the oldest of 1,500 entries takes ~59 s on the budget-phone profile (was 165 s). |
| Speak to split | ⚠️ | Needs a browser with speech recognition (Chrome, Edge, Safari; not Firefox) and the AI key. |
| Sharing an SMS into Settle | ⚠️ | Android with the installed app only (iPhone doesn't let web apps receive shares). |
| Using one account on two phones | ⚠️ by design | No accounts and no database: data stays on the phone. Move it with a backup file. |
| Automatic deploys | ⚠️ | Deploys run from the command line (`npx vercel deploy --prod`); GitHub isn't connected to Vercel for deploy-on-push yet. |

## Tests (24 Oct 2026, after the night-2 changes)

- Unit and component tests: **4,790 passed**, 0 failed (`npm run check`: typecheck and lint clean).
- End-to-end against the live site (this morning): smoke and foundations journeys, **13 passed** on 360 px and 390 px phones. The full 164-journey production run was last done on 23 Oct; the night-2 scenario matrix (offline, slow 3G, 320 px, Hindi, 1,500 expenses) was written but not run in full before the wrap-up.

