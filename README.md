# Settle

**Split anything. Settle in a tap.**

Settle is a mobile-first web app for splitting any expense — a restaurant bill, the rent, a Goa trip, a cab, Netflix — and actually getting paid back over UPI. No sign-up, no ads, and no database: everything lives on your phone.

- **AI that reads the bill.** Snap a restaurant bill and every item, tax, service charge and discount is filled in; tap who had what. Snap any other bill (electricity, cab, hotel) and the total and category are ready to split.
- **Just say it.** Type "Cab 840 with Riya and Sam, Sam pays double" and get a ready-to-save split.
- **One pay link for the group.** Each friend taps their name and pays their exact share with GPay, PhonePe, Paytm or BHIM. Friends don't need the app or an account.
- **Five ways to split.** Equally, exact amounts, percentages, shares ("pays double") or item by item, with optional rounding to whole rupees.
- **Groups that settle themselves.** Trips, flats and couples keep a running tab with different payers; Settle works out the fewest payments to square everyone up, with a UPI QR for each.
- **Collect and nudge.** See "₹1,840 of ₹2,766 collected", tick people off, and send a friendly, funny or firm reminder on WhatsApp or SMS.
- **Share cards, recurring splits and insights.** A receipt image for the group chat; rent and subscriptions reminded monthly; where your money goes by category and month.
- **Everyone claims their own items.** Send one claim link for a scanned bill; each friend ticks what they had on their own phone and the replies merge into the split.
- **From SMS.** Paste or share a bank or UPI alert and it's ready to split; OTP messages are refused.
- **Food orders, fairly.** A Swiggy, Zomato, Blinkit or Zepto screenshot keeps delivery, platform, packaging and small-order fees apart from the food, and shares them in proportion or equally.
- **Speak to split.** Say it in Hindi, Bengali, Marathi, Tamil, Telugu, Kannada, Gujarati or English — "dhai hazaar" becomes ₹2,500.
- **Collections (chanda).** One link for a birthday gift, a farewell, a Diwali party or a puja; everyone pays by UPI and you tick them off.
- **Udhaar.** Lend or borrow in two taps, record part payments, and send a polite (or firm) reminder.
- **Next round's on you.** Groups that take turns paying see whose round it is and what squares everyone up.
- **Trips abroad.** Spend in baht or dirhams, settle in ₹ at that day's ECB rate (cached for offline) or at what your bank actually charged.

## Quick start

1. Get a free API key at [build.nvidia.com](https://build.nvidia.com) (Profile → API Keys). It starts with `nvapi-`.
2. Copy `.env.example` to `.env` and paste the key after `NVIDIA_API_KEY=`.
3. Install and run (Node 22.12 or newer):

   ```sh
   npm install
   npm run dev
   ```

4. Open the **Network** URL Vite prints (for example `http://192.168.1.20:5173`) on your phone, on the same Wi-Fi.

Everything except AI works without a key: split amounts by hand, type a bill in, or tap **Try a sample bill**.

## Free and Pro

| | Free | Pro |
| --- | --- | --- |
| Manual splits, groups, people, pay links, UPI QR, nudges, backup | Unlimited | Unlimited |
| AI bill scans and "Just say it" | 3 a day | Unlimited (fair use) |
| Recurring splits, insights, CSV export, accent colours | — | ✓ |
| Share cards without the "Made with Settle" line | — | ✓ |

Pro is sold as **one-time passes with no auto-renewal**: ₹49 for 30 days, ₹399 for a year, ₹999 for life (set your own with `PRO_PRICES`).

**How it works without a database:** payment goes through Razorpay; the server checks the payment signature, re-reads the order from Razorpay to confirm what was paid for, and returns an Ed25519-signed license. The app verifies it on the device. Promo and support codes are the same signed licenses:

```sh
npm run license keygen                                   # once: prints LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY for .env
npm run license issue -- --plan pro_yearly --id diwali   # prints a code anyone can redeem under You → Redeem a code
npm run license verify <code>
```

Without Razorpay keys the Pro page still shows the plans, says checkout isn't set up yet, and **Redeem a code** works. Use Razorpay test keys (`rzp_test_…`) to try real checkout safely.

## How the maths works

1. Every amount is kept in whole paise (or cents) — no floating-point money.
2. **Amount splits:** equal, exact, percentage and share modes divide the total by weight; leftover paise go out by the **largest-remainder method**, so the shares always add up to exactly the total. When rounding is involved, the payer absorbs it, so friends never pay a stray extra paisa.
3. **Bills:** each item is shared among the people who had it. What you actually paid (tax, service, tip and discounts included) is then shared **in proportion to each person's items** — someone who ordered 40% of the food pays 40% of the bill.
4. **Groups:** each member's balance is what they paid minus their shares, plus settlements. Balances always sum to zero, and a greedy matcher turns them into at most *n − 1* payments.

## Configuration

Set these in `.env` (for `npm run dev` and `npm start`) or in your host's environment. Everything is optional; `.env.example` documents each one.

| Variable | Default | What it does |
| --- | --- | --- |
| `NVIDIA_API_KEY` | (none) | Turns on AI bill scanning and "Just say it". |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-super-vl-120b-a12b,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Vision models that read bill photos, tried in order. |
| `NVIDIA_TEXT_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Text models for "Just say it", tried in order. |
| `LICENSE_PRIVATE_KEY` / `LICENSE_PUBLIC_KEY` | (none) | Ed25519 key pair that signs Pro licenses (`npm run license keygen`). Without it Pro is off. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | (none) | Turns on Pro checkout. |
| `PRO_PRICES` | `pro_monthly=4900,pro_yearly=39900,pro_lifetime=99900` | Prices in paise. |
| `PRO_AI_PER_DAY` | `200` | AI calls per Pro license per day. `0` = no cap. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `30` / `600000` | Free AI calls per address per window. |
| `MAX_CONCURRENT_SCANS` | `8` | AI requests handled at once. |
| `TRUST_PROXY` | `0` | Set to the number of proxies in front of the app (usually `1` on Render, Fly.io, Railway, Heroku, nginx) so each user gets their own limits. |
| `PORT` / `HOST` | `3000` / all interfaces | Where `npm start` listens. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | App and API together with hot reload on port 5173 (also on your LAN). |
| `npm run build` | Typechecks, then builds the client to `dist/client` and the server to `dist/server`. |
| `npm start` | Runs the production build on port 3000. |
| `npm run check` | Typecheck, lint and the full test suite. |
| `npm run license` | Pro license keys and codes (see above). |

## Project structure

```
src/
  features/   screens: home, onboarding, split, expense, bill, groups, friends, activity,
              you, pro, insights, recurring, landing, legal, pay
  kit/        feature components (people picker, split editor, share & UPI sheets…)
  components/ design system (buttons, sheets, charts, tab bar…)
  data/       on-device stores, actions and hooks (localStorage, no database)
  engine/     pure maths: split modes, balances, fewest payments, insights, recurring
  share/      pay links, share-card images, nudges
  pro/ ai/    Pro licenses, checkout, AI quota, "Just say it" client
  app/        router, app shell, theming
server/       Hono API: NVIDIA scan + describe, Razorpay orders, licenses, security headers
shared/       types shared by the client and the server
scripts/      license CLI
```

## Deploy

```sh
npm run build && npm start        # http://localhost:3000
```

Or with Docker:

```sh
docker build -t settle .
docker run --rm -p 3000:3000 --env-file .env settle
```

Serve it over **HTTPS**: browsers only enable offline mode, the native share sheet and the clipboard on secure origins. On a host with a proxy in front (most of them), also set `TRUST_PROXY=1`. The server adds security headers and compression, caches built assets for a year, and the app installs as a PWA that opens offline after one visit.

## Privacy

- **No database and no accounts.** Nothing about you or your splits is stored on the server.
- **Photos and "Just say it" text go to NVIDIA only to be read**, and the server keeps nothing.
- **Pay links carry the split in the link itself** (after the `#`), which browsers never send to the server.
- **Everything else stays in your browser** — people, expenses, groups and settings — with a backup file you can export and restore.
