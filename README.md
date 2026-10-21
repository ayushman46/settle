# BillSplit

Snap a restaurant bill, tap who ate what, and get a fair per-person split in seconds.

- **Reads the bill for you.** A photo goes to an NVIDIA vision model, which pulls out every item, the tax, service charge, discounts and total.
- **Splits it fairly.** Tax, tips and discounts are shared in proportion to what each person had, and the shares always add up to exactly what was paid.
- **Feels like a payments app.** One big action per screen, bottom sheets, swipe and undo, haptics, and the phone's Back button works as you'd expect.
- **Settle up on the spot.** Pick who paid, and everyone else gets a UPI QR code or a ready-to-send payment request (rupee bills).

## Quick start

1. Get a free API key at [build.nvidia.com](https://build.nvidia.com) (Profile, then API Keys). It starts with `nvapi-`.
2. Copy `.env.example` to `.env` and paste the key after `NVIDIA_API_KEY=`.
3. Install and run (Node 22.12 or newer):

   ```sh
   npm install
   npm run dev
   ```

4. Open the **Network** URL Vite prints (for example `http://192.168.1.20:5173`) on your phone, on the same Wi-Fi.

No key yet? The app still works: type the items in, or tap **Try a sample bill**.

## How the split works

1. Each item is shared among the people who had it. An even split is the default; "Split unevenly" gives someone more shares (for example 2 of the 3 beers). Items nobody claims are shared by everyone.
2. Each person's items add up to their **items subtotal**.
3. The amount you actually paid (tax, service, tip and discounts included) is shared **in proportion to those subtotals**. Someone who ordered 40% of the food pays 40% of the bill.
4. All money is kept in whole paise (or cents). Leftover paise from rounding go out by the **largest-remainder method**, so the shares always add up exactly to what was paid.

## Settle up with UPI

On the result screen, choose **Who paid the bill?**. Everyone else then shows what they owe that person. For rupee bills, add the payer's UPI ID (it's remembered on this device). Each person then gets **Pay via UPI**: a QR code that GPay, PhonePe, Paytm or BHIM can scan, with the amount already filled in, plus a payment request you can share in any chat.

## Configuration

Set these in `.env` (for development and `npm start`) or in the environment (for Docker).

| Variable | Default | What it does |
| --- | --- | --- |
| `NVIDIA_API_KEY` | (none) | Your NVIDIA key. Without it, photo scanning is turned off and manual entry still works. |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-super-vl-120b-a12b,google/gemma-4-31b-it,meta/llama-3.2-90b-vision-instruct` | Vision models to try, in order, separated by commas. |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible API base URL. |
| `NVIDIA_TIMEOUT_MS` | `35000` | Time limit for one model attempt. A whole scan, fallbacks included, always ends within 80 seconds, so a slow first model still leaves the next one time to try. |
| `RATE_LIMIT_MAX` | `30` | Scans allowed per client in each window. `0` turns the limit off. |
| `RATE_LIMIT_WINDOW_MS` | `600000` | Length of the rate-limit window (10 minutes). |
| `MAX_CONCURRENT_SCANS` | `8` | Scans read at the same time. Past that, people are asked to try again in a moment. `0` means no limit. |
| `TRUST_PROXY` | `0` | How many proxies sit in front of the app (`0` to `5`). Set it to `1` behind one proxy (see below). |
| `PORT` | `3000` | Port for `npm start` (the dev server uses 5173). |
| `HOST` | all interfaces | Address for `npm start` to listen on. |

**Behind a proxy, set `TRUST_PROXY`.** The scan limit counts per client address. With the default `TRUST_PROXY=0`, that's the address connecting to the server, and `X-Forwarded-For` is ignored because anyone can send it. Behind one proxy or load balancer (Render, Fly.io, Railway, Heroku, nginx, Caddy), every request arrives from the proxy, so all your users would share one limit. Set `TRUST_PROXY=1` there: the app then uses the address your proxy added to the end of `X-Forwarded-For`. That's the one a client can't fake. Use `2` if there are two proxies in a row, for example Cloudflare in front of a load balancer. The server log warns once if requests carry `X-Forwarded-For` while `TRUST_PROXY` is `0`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app and the API together, with hot reload, on port 5173 (also on your LAN). |
| `npm run build` | Typechecks, then builds the client into `dist/client` and the server into `dist/server`. |
| `npm start` | Serves the production build (API and app) from one Node process. |
| `npm test` | Runs all tests (client in jsdom, server in Node). |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint. `npm run check` runs typecheck, lint and tests. |

## Project structure

```
server/        Hono API: /api/scan and /api/health, the NVIDIA client, the prompt, bill parsing,
               rate limiting, and the production web server (index.ts)
shared/api.ts  The wire contract shared by the browser and the server
src/
  screens/     Scan, Review, Paid, People, Assign and Result, plus their bottom sheets
  components/  Design system (buttons, sheets, toasts, amount input, receipt, QR code…)
  state/       Session store, reducer, selectors, saving, and browser-history integration
  lib/         Money maths, split, settle up, UPI, sharing, image prep, haptics
  api/         API client, sample bill, scan-to-bill mapping
  styles/      Design tokens and global styles
public/        Icon, web manifest and the offline service worker
```

## Deploy

```sh
npm run build && npm start        # http://localhost:3000
```

Or with Docker:

```sh
docker build -t billsplit .
docker run --rm -p 3000:3000 -e NVIDIA_API_KEY=nvapi-... billsplit
```

On a host that puts a proxy in front of your app (most do), also pass `-e TRUST_PROXY=1` or set it in the host's environment settings. Only scans are limited. The app itself and `/api/health` aren't.

The production server adds security headers and compression, caches built assets for a year, and serves the app as an installable PWA. After one visit, it opens offline too (typing a bill in and the sample work offline; scanning needs a connection). Use HTTPS in production: browsers only enable the offline service worker, native sharing and the clipboard on secure origins (or `localhost`).

**If scans fail with an image-size error** from NVIDIA (HTTP 400 or 413 in the server log), the model you're using limits inline images. Try another model in `NVIDIA_MODEL`.

## Privacy

- **No database.** There are no accounts and nothing is stored on the server.
- **Photos go to NVIDIA only to be read.** The server forwards the photo to NVIDIA's API, returns the items it reads, and keeps nothing. Photos aren't logged or saved.
- **Everything else stays in your browser.** Your bill, the names and the UPI ID are saved in this browser's local storage so a refresh never loses your work. Starting a new bill clears the bill; names are kept as quick picks.
