# Deploying Settle — free, in about 30 minutes

This guide takes Settle from its GitHub repository to a working `https://` address that anyone in India can open on their phone. It costs **₹0**: everything runs on free plans. You don't need to write code; you'll copy a few values between websites.

**What you'll end up with**

```
Phone ──► https://settle.pages.dev                 Cloudflare Pages: the app itself, served from
            │                                       Cloudflare's data centres across India —
            │                                       opens instantly, always.
            └─ /api/* (AI, Pro) ──► Pages Function ──► https://settle-api-xxxx.onrender.com
                                                    Render: the Settle server (bill reading,
                                                    "Just say it", Pro checkout and codes).
```

**Why two services?** Render's free server goes to sleep after 15 minutes without visitors and takes about a minute to wake up. If it also served the app, the first friend to open a pay link after a quiet spell would stare at a loading screen. With Cloudflare in front, the app, pay links and everything stored on the phone open instantly whether the server is awake or not; only AI and Pro need it, and step 4 keeps it awake anyway.

**What you need**

- The Settle code in **your own GitHub account** (this repository, or your fork of it).
- An email address for a Cloudflare account and a Render account (both free, no card needed).
- Optional: an NVIDIA API key (AI features), a Razorpay account (selling Pro), a domain name.

> Everything except AI and Pro works without any keys: splitting, groups, people, pay links, UPI QR codes, reminders and backups.

---

## Step 0 — Get your keys ready (5 minutes, optional)

Keep a notes file open; you'll paste these into Render in step 1. Anything you skip can be added later (step 6 shows where).

**NVIDIA API key** — turns on bill scanning and "Just say it".

1. Go to **build.nvidia.com** and sign in (or create a free account).
2. Click your profile picture (top right) → **API Keys** → **Generate API Key**.
3. Copy the key. It starts with `nvapi-`.

**License key** — turns on Pro (paid passes and promo codes). This one is made on a computer with the Settle code and [Node.js 22](https://nodejs.org) installed:

1. Open a terminal in the Settle folder and run:
   ```sh
   npm install
   npm run license keygen
   ```
2. It prints two lines. Copy the long value after `LICENSE_PRIVATE_KEY=` (everything after the `=`).
3. Keep it secret and keep a safe copy: it signs every Pro pass. If you ever change it, passes already sold stop working.

---

## Step 1 — Render: the server (10 minutes)

1. Go to **render.com** → **Get Started** → sign up with **GitHub**, and allow Render to see your Settle repository.
2. In the Render dashboard, click **+ New** (top right) → **Blueprint**.
3. Under **Connect a repository**, pick your Settle repository → **Connect**.
4. **Blueprint Name**: `settle`. **Branch**: `main`. Render reads the `render.yaml` file from the code and shows one service: **settle-api** — Web Service · Free · Singapore.
5. Render asks for the values marked secret. Paste what you have from step 0; leave the rest empty (if Render insists on a value, type `none`):
   | Name | Value |
   | --- | --- |
   | `NVIDIA_API_KEY` | your `nvapi-…` key |
   | `LICENSE_PRIVATE_KEY` | your license key |
   | `RAZORPAY_KEY_ID` | empty for now (step 6) |
   | `RAZORPAY_KEY_SECRET` | empty for now (step 6) |
6. Click **Apply** (or **Deploy Blueprint**). The first build takes 3–6 minutes. Wait until the service shows **Live**.
7. Click **settle-api**. At the top you'll see its address, like `https://settle-api-xxxx.onrender.com`. **Copy it into your notes** (without a `/` at the end).
8. Open that address in your browser — the full Settle app should appear. Then open the same address with `/api/health` at the end. You should see something like:
   ```json
   {"ok":true,"configured":true,"models":["nvidia/…"]}
   ```
   `"configured": true` means AI is on (`false` means no NVIDIA key — fine if you skipped it).
9. In the left menu click **Environment**. Find **PROXY_SECRET** (Render made it up for you), click the eye icon to reveal it and **copy it into your notes**. Cloudflare needs the same value, so the server can tell your visitors apart (each person gets their own fair-use limits instead of everyone sharing one).

> Already works on its own: the Render address is a complete Settle. The next step puts the fast front door in front of it.

---

## Step 2 — Cloudflare Pages: the app, fast everywhere (10 minutes)

1. Go to **dash.cloudflare.com** and sign up (free plan).
2. In the left menu open **Workers & Pages** (it may sit under **Compute**). Click **Create** (or **Create application**), choose the **Pages** tab, then **Connect to Git** (it may say **Import an existing Git repository**).
3. Choose **GitHub**, allow Cloudflare to see your Settle repository, select it, and click **Begin setup**.
4. Fill in the setup page exactly like this:
   | Field | Value |
   | --- | --- |
   | Project name | `settle` (your address becomes `settle.pages.dev`; if it's taken, try `settle-app` or similar) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | `npm run build:pages` |
   | Build output directory | `dist/client` |
   | Root directory | leave empty |
5. Open **Environment variables (advanced)** and add two variables:
   | Variable name | Value |
   | --- | --- |
   | `API_ORIGIN` | your Render address from step 1.7, e.g. `https://settle-api-xxxx.onrender.com` |
   | `PROXY_SECRET` | the value you copied in step 1.9 (click **Encrypt** next to it if the button is there) |
6. Click **Save and Deploy**. The build takes about 2 minutes. When it says **Success**, click **Continue to project** and open your `https://settle.pages.dev` address.
7. Check the connection to the server: open `https://settle.pages.dev/api/health`. You should see the same `{"ok":true,…}` as in step 1.8.
   - If it says *"Settle's server isn't connected yet"*: `API_ORIGIN` is missing or mistyped. Fix it under **Settings → Variables and Secrets**, then go to **Deployments**, open the **…** menu on the latest deployment and choose **Retry deployment** (changed variables only apply to a new deployment).
   - If it says *"Couldn't reach Settle's server"*: the Render server is asleep or still building. Wait a minute and refresh.

You don't need to set a Node.js version anywhere: the `.node-version` file in the code tells Cloudflare, Render and GitHub to use Node 22.14.0.

---

## Step 3 — Try it on your phone (2 minutes)

Open your `https://settle.pages.dev` address on your phone and run through this:

- [ ] The landing page opens; **Open Settle — free** leads to the welcome screens.
- [ ] Enter your name and your UPI ID → Home says "Hi, …".
- [ ] **Split an expense**: ₹1,000 with two friends → **Save split**.
- [ ] **Share pay link** → **Copy link** → open the link in another browser (or send it to a friend): they tap their name and see **₹333.33** with a **Pay with any UPI app** button.
- [ ] With an NVIDIA key: **Just say it** → "Dinner 2400 with Riya and Sam" fills in a split.
- [ ] Browser menu → **Add to Home screen** / **Install app**: Settle opens like an app, even offline.

---

## Step 4 — Keep the server awake (3 minutes, free)

Render's free server sleeps after 15 minutes without visitors. A free uptime monitor visiting it every 5 minutes keeps it awake, so AI always answers quickly.

1. Go to **uptimerobot.com** → **Register for FREE** and confirm your email.
2. Click **+ New monitor** (or **Add New Monitor**).
3. **Monitor type**: HTTP(s). **Friendly name**: `Settle server`. **URL**: your Render address followed by `/api/health`, e.g. `https://settle-api-xxxx.onrender.com/api/health`. **Monitoring interval**: 5 minutes.
4. Click **Create monitor**. You'll also get an email if the server ever goes down.

Use the **Render** address here, not the `pages.dev` one: every request through Cloudflare's `/api/` counts towards its free daily allowance (see "Free plan limits" below), and a monitor doesn't need to.

Render's free plan includes 750 server hours a month — enough for this one server to run day and night (a 31-day month has 744 hours). Don't run a second always-on free service in the same Render workspace, or both will run out before the month ends.

*Optional backup:* GitHub can ping it too. In your repository go to **Settings → Secrets and variables → Actions → Variables → New repository variable**, name it `KEEP_WARM_URL` and give it the same `…/api/health` address. The "Keep warm" workflow then pings every 10 minutes (GitHub's schedules can run late, so keep the uptime monitor as the main one).

---

## Step 5 — Your own domain (optional)

A short address like `settle.in` or `split.yourname.in` is easier to trust and share. Pay links always use the address the organiser opened Settle at, so once you move, share your new address; old `pages.dev` links keep working.

1. Buy a domain from any registrar (`.in` domains cost roughly ₹500–900 a year; Cloudflare Registrar sells many at cost).
2. In Cloudflare: **Workers & Pages** → your **settle** project → **Custom domains** → **Set up a custom domain**.
3. Type the address you want and click **Continue**:
   - **A subdomain** (`app.yourname.in`): if your domain is not on Cloudflare, Cloudflare shows a **CNAME** record. At your registrar, add a DNS record of type `CNAME`, name `app`, target `settle.pages.dev`. Back in Cloudflare, click **Activate domain**.
   - **The bare domain** (`yourname.in`): the domain has to use Cloudflare's DNS. Click **Add a domain** in the Cloudflare dashboard, pick the **Free** plan, and at your registrar replace the nameservers with the two Cloudflare shows. Then add the custom domain as above; Cloudflare creates the record itself.
4. Wait a few minutes until the domain shows **Active**. The `https://` certificate is issued automatically.

Keep **Render** on its `onrender.com` address and keep `API_ORIGIN` pointing there — visitors never see it. If you sell Pro, add the new domain in Razorpay too (step 6.3).

---

## Step 6 — Turn on Pro with Razorpay (optional)

Pro is sold as one-time passes (₹49 / ₹399 / ₹999 by default). Payments go to your Razorpay account; Settle never touches the money.

### 6.1 Change server settings on Render

Whenever this guide says "set on Render": **Render → settle-api → Environment → Edit** (or **+ Add Environment Variable**) → enter the name and value → **Save, rebuild, and deploy** (or **Save and deploy**). The server restarts with the new value in a minute or two.

### 6.2 Test mode first

1. Make sure `LICENSE_PRIVATE_KEY` is set on Render (step 0). Without it, Pro stays off.
2. Sign up at **dashboard.razorpay.com**. Switch the toggle at the top to **Test Mode**.
3. Go to **Account & Settings → API Keys → Generate Test Key**. Copy the **Key Id** (`rzp_test_…`) and the **Key Secret** (shown only once).
4. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on Render (6.1).
5. On your site: **You → Go Pro** → choose a plan → pay with Razorpay's test details: UPI ID `success@razorpay`, or a card from Razorpay's **Test card details** page in their docs. No real money moves in test mode. Pro unlocks immediately.

### 6.3 Going live

1. In Razorpay, complete **account activation** (KYC: business details, PAN, bank account). Razorpay reviews your website: it must show your **privacy policy** and **terms** (Settle has `/privacy` and `/terms`), plus contact details and a refund/cancellation policy — check what Razorpay asks for when you apply.
2. Under **Account & Settings → Website and app settings**, add your site's address (your custom domain or `pages.dev` address).
3. Switch the toggle to **Live Mode** → **API Keys → Generate Live Key**, and replace both Razorpay values on Render with the live ones (`rzp_live_…`).
4. Render's log (**Logs** tab) should now say `checkout: Razorpay live mode`.

### 6.4 Promo and support codes

On your computer, with the same `LICENSE_PRIVATE_KEY` in the Settle folder's `.env` file:

```sh
npm run license issue -- --plan pro_yearly --id diwali-2026
```

It prints a code anyone can redeem under **You → Redeem a code**.

---

## Updating Settle

Push changes to the `main` branch on GitHub. Then, automatically:

1. **GitHub Actions** checks everything: typecheck, lint, about 3,400 tests, the production build, and the main journeys in Microsoft Edge on phone-sized screens (repository → **Actions** tab).
2. **Cloudflare Pages** rebuilds and publishes the app in about 2 minutes.
3. **Render** rebuilds the server once GitHub's checks pass (about 5 minutes). A red check stops a broken server from going live; to deploy on every push instead, change `autoDeployTrigger: checksPass` to `commit` in `render.yaml`.

Phones pick up the new version the next time Settle is opened (it updates itself in the background).

**Undo a bad release**: Cloudflare → your project → **Deployments** → **…** next to an older deployment → **Rollback to this deployment**. Render → settle-api → **Events** → **Rollback** next to an earlier deploy.

---

## Free plan limits — and when to pay

| | Free allowance | What happens beyond it | Upgrade |
| --- | --- | --- | --- |
| Cloudflare Pages — the app | Unlimited visits and bandwidth; 500 builds a month | — | not needed |
| Cloudflare Pages Functions — only `/api/*` | 100,000 requests a day (resets 05:30 IST) | The app keeps working; AI and Pro fail until the reset | Workers Paid, US$5/month (10 million requests a month) |
| Render free server | 512 MB memory, 0.1 CPU, 750 hours a month, sleeps after 15 idle minutes | Hours run out → server off until next month | Starter, US$7/month: always on, faster CPU |
| NVIDIA API | Free credits / rate limits of your NVIDIA account | AI says it's busy; manual splitting still works | NVIDIA paid tier, or another model |

Each app open costs about one Function request (the AI-availability check) and each AI scan or "Just say it" one more, so the free tier comfortably serves tens of thousands of people a day. Settle also limits free AI use to 30 requests per person per 10 minutes and Pro to 200 a day (change with `RATE_LIMIT_MAX` and `PRO_AI_PER_DAY` on Render).

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `pages.dev/api/health` says *"Settle's server isn't connected yet"* (503) | Set `API_ORIGIN` on Cloudflare, then **Retry deployment** (step 2.7). |
| `pages.dev/api/health` says *"Couldn't reach Settle's server"* (502) | Render is asleep, building or down: open the Render address, wait a minute. Check `API_ORIGIN` is exactly the Render address. |
| Error 508 *"The API proxy is pointed at itself"* | `API_ORIGIN` is your Pages address; it must be the **Render** address. |
| Render's log: *"…PROXY_SECRET that doesn't match…"* | Copy `PROXY_SECRET` from Render again into Cloudflare, then retry the Cloudflare deployment. |
| Render's log: *"PROXY_SECRET is ignored…"* | It must be at least 24 characters without spaces. Use Render's **Generate** button. |
| AI says it isn't available | `/api/health` shows `"configured":false` → set `NVIDIA_API_KEY` on Render. If it's set, Render's log names the problem (e.g. *check NVIDIA_API_KEY*). |
| Pro page says *"Checkout isn't set up yet"* | Set `LICENSE_PRIVATE_KEY`, `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on Render (step 6). The log's first lines list what's missing. |
| Cloudflare build fails | Open the failed deployment's log. Check the build command is `npm run build:pages` and the output directory `dist/client`. |
| The old version still shows | Close Settle completely and open it again; it updates in the background on each open. |

Render's log: **Render → settle-api → Logs**. It never contains keys or what people typed.

---

## Other ways to run it

**Render only** (no Cloudflare): step 1 alone gives you a complete Settle at the Render address. Fine for trying it out; visitors may wait a minute while a sleeping server wakes up.

**Your own server or any Docker host**:

```sh
docker build -t settle .
docker run --rm -p 3000:3000 --env-file .env settle
```

Put it behind HTTPS, and set `TRUST_PROXY=1` when one proxy or load balancer sits in front. `.env.example` lists every setting.

---

## For developers

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck, then build the client (`dist/client`) and server (`dist/server`), as Render does. |
| `npm run build:pages` | Build the client for Cloudflare Pages (adds `404.html`, checks `_headers` / `_redirects`). |
| `npm run e2e` | Playwright journeys on the installed Microsoft Edge as phones (360×800 and 390×844, light and dark), against a production build in `.e2e-build/` on port 4121. External network is blocked; AI and Razorpay are mocked. |
| `E2E_TARGET=dev npm run e2e` | The same against the Vite dev server (port 4120). |
| `E2E_BASE_URL=https://… npm run e2e` | The same against a deployed site. |

**How the pieces fit**

- `functions/api/[[path]].ts` is the Pages Function: it streams `/api/*` to `API_ORIGIN` (logic and tests in `server/edgeProxy.ts`). It forwards the visitor's address from Cloudflare's `CF-Connecting-IP` as `X-Forwarded-For`, and — with `PROXY_SECRET` set on both sides — as `X-Settle-Client-IP`, which the server trusts only alongside the secret.
- `public/_headers` repeats the Node server's security headers and asset caching for Cloudflare; `public/_redirects` sends the app's routes to the shell. `server/pagesConfig.test.ts` fails if either drifts from `server/web.ts`.
- Test the Cloudflare side locally: run `npm run build:pages`, start the server (`npm start`, port 3000), then from a folder **without** your `.env` (wrangler would load it) run `npx wrangler pages dev <path>/dist/client --binding API_ORIGIN=http://127.0.0.1:3000 --binding PROXY_SECRET=<24+ characters>` with this repository's `functions/` folder beside it. `E2E_BASE_URL=http://127.0.0.1:8788 npm run e2e` then runs the journeys through it.
