# Settle — what works and what doesn't

Live: **https://settleupi.vercel.app** · last checked 24 Oct 2026, 01:30 IST · updated as work lands.

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
| AI on the live site (scan a bill photo, "Just say it", speak to split, "let AI read" an SMS) | ❌ | The NVIDIA API key isn't set on Vercel yet. Add `NVIDIA_API_KEY` in Vercel → settle → Settings → Environment Variables, then redeploy. Everything else works without it. |
| Pro (paid plan) on the live site | ❌ | Needs `LICENSE_PRIVATE_KEY` (and Razorpay keys to sell it) on Vercel; see [DEPLOY.md](DEPLOY.md) step 0 and 6. Without them the Pro page shows the plans but can't unlock. |
| Indian languages for the screens | ❌ (in progress) | Voice input understands 8 Indian languages, but the screens are English only. Hindi first, then Bengali, Marathi, Tamil, Telugu, Kannada, Gujarati. |
| An "Install app" button | ❌ (in progress) | Installing works from the browser menu; there's no in-app button yet. |
| Very long histories on budget phones | ⚠️ | Scrolling Activity to the oldest of 1,500 entries takes ~59 s on the budget-phone profile (was 165 s). |
| Speak to split | ⚠️ | Needs a browser with speech recognition (Chrome, Edge, Safari; not Firefox) and the AI key. |
| Sharing an SMS into Settle | ⚠️ | Android with the installed app only (iPhone doesn't let web apps receive shares). |
| Using one account on two phones | ⚠️ by design | No accounts and no database: data stays on the phone. Move it with a backup file. |
| Automatic deploys | ⚠️ | Deploys run from the command line (`npx vercel deploy --prod`); GitHub isn't connected to Vercel for deploy-on-push yet. |

## Tests (last full run, 23 Oct 2026)

- Unit and component tests: **4,591 passed**, 0 failed.
- End-to-end on the production build: **164 passed** across 360 px and 390 px phones, light and dark (accessibility scans with axe on every journey).
- End-to-end against the live site: **58 passed**, 2 skipped (offline / service-worker cases run on the local build).
