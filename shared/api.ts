/**
 * Wire contract between the browser and the API server.
 * Imported by both `src/` (client) and `server/` — keep it dependency-free.
 */
import type { CategoryId } from './categories'

export type { CategoryId } from './categories'
export { CATEGORY_IDS, isCategoryId } from './categories'

/* ------------------------------------------------------------------ scan a bill */

/** Request body for `POST /api/scan`. */
export interface ScanRequest {
  /** The bill photo as a data URL: `data:image/jpeg;base64,...` (jpeg, png or webp). */
  image: string
}

/** Kinds of delivery-app fee (Swiggy, Zomato, Blinkit, Zepto…). */
export type ScannedFeeKind = 'delivery' | 'platform' | 'packaging' | 'surge' | 'small_order' | 'tip' | 'donation' | 'fee_tax' | 'other'
export const SCANNED_FEE_KINDS: readonly ScannedFeeKind[] = ['delivery', 'platform', 'packaging', 'surge', 'small_order', 'tip', 'donation', 'fee_tax', 'other']

/** One delivery-app fee line ("Delivery partner fee ₹35"). */
export interface ScannedFee {
  /** As printed. */
  label: string
  kind: ScannedFeeKind
  /** MAJOR units, > 0. */
  amount: number
}

/** One printed line of the bill. Amounts are in MAJOR units (e.g. rupees), as decimals. */
export interface ScannedItem {
  name: string
  /** Units on that line; defaults to 1 when the bill doesn't say. Always > 0. */
  quantity: number
  /** Price for the whole line (quantity already applied). Always >= 0. */
  amount: number
}

/**
 * Successful response of `POST /api/scan`. All money values are MAJOR units, 2dp-rounded.
 *
 * Restaurant, café, grocery and shop bills come back itemized. Service bills (electricity,
 * phone, cab rides, hotel stays, rent…) usually come back with `items: []` and just a
 * `total` — split those as an amount rather than item by item.
 */
export interface ScanResponse {
  merchant: string | null
  /** Bill date as printed, normalised to YYYY-MM-DD when unambiguous. */
  date: string | null
  /** ISO 4217 code in upper case, e.g. "INR". Null when the bill gives no hint. */
  currency: string | null
  /** What the bill is for ("food" for a restaurant, "utilities" for electricity…). Null when unclear. */
  category: CategoryId | null
  items: ScannedItem[]
  /** Sum of items before charges, as printed. */
  subtotal: number | null
  /** All taxes combined (GST, CGST+SGST, VAT, sales tax...). */
  tax: number | null
  /** Restaurant service charge only — delivery-app fees are in `fees`. */
  serviceCharge: number | null
  /** Delivery-app fees, each on its own (never also in serviceCharge). Older servers send none. */
  fees: ScannedFee[]
  /** All discounts combined, as a POSITIVE number. */
  discount: number | null
  /** Tip / gratuity, if printed. */
  tip: number | null
  /** Grand total payable, as printed (after round-off). */
  total: number | null
  /** Human-readable notes for the user, e.g. "Items don't add up to the subtotal — please check." */
  warnings: string[]
  /** The model that produced this result. */
  model: string
}

/* ------------------------------------------------------------------ describe a split ("Just say it") */

/** The four ways to divide an amount (itemized bills are a separate flow). */
export type AmountSplitMode = 'equal' | 'exact' | 'percent' | 'shares'

export interface DescribedPerson {
  /** As written, tidied: "Me" is the speaker; known people keep the caller's spelling. */
  name: string
  /** exact → MAJOR amount, percent → % (e.g. 40), shares → positive whole weight, equal → null. */
  value: number | null
}

/** What `POST /api/describe` makes of a sentence: a draft the user confirms before anything is saved. */
export interface DescribedSplit {
  title: string
  category: CategoryId
  /** MAJOR units (rupees), or null if the text didn't say. */
  amount: number | null
  /** ISO 4217 code — only when the text names a currency ("₹", "Rs", "$", "euros"…), else null. */
  currency: string | null
  mode: AmountSplitMode
  /** Who paid, as in `people[].name` ("Me" for the speaker) — only when the text says so, else null. */
  payer: string | null
  /** Everyone sharing the cost, de-duplicated. "Me" is the speaker. */
  people: DescribedPerson[]
  /**
   * How many people share it in all, the speaker included, when the text gives a number
   * ("Netflix 649 for 4"). Can exceed `people.length` when not everyone is named. Null when not said.
   */
  headcount?: number | null
  /** YYYY-MM-DD when the text names the day ("yesterday", "on Friday", "18 Oct"), never in the future. */
  date?: string | null
}

/** Languages "Speak to split" listens in (and the describe endpoint understands), as BCP-47 tags. */
export const VOICE_LANGS = ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'ta-IN', 'te-IN', 'kn-IN', 'gu-IN'] as const
export type VoiceLang = (typeof VOICE_LANGS)[number]

/** How a description arrived: typed, spoken (speech recognition) or a pasted bank SMS. */
export const DESCRIBE_SOURCES = ['typed', 'voice', 'sms'] as const
export type DescribeSource = (typeof DESCRIBE_SOURCES)[number]

/** Request body for `POST /api/describe`. */
export interface DescribeRequest {
  /** What the user typed, e.g. "Cab 840 with Riya and Sam, Sam pays double". */
  text: string
  /** The user's default currency (ISO 4217) — a hint for "$"/"Rs", never assumed when the text names none. */
  currency?: string
  /** Names the user already splits with; matching names come back spelled exactly like these. */
  people?: string[]
  /** The user's local date, YYYY-MM-DD, to resolve "yesterday" and weekdays. */
  today?: string
  /** The language the text was written or spoken in, when known (BCP-47). */
  lang?: VoiceLang
  /** How the text arrived: typed, spoken (speech recognition) or a pasted bank SMS. */
  source?: DescribeSource
}

/** Successful response of `POST /api/describe`. */
export type DescribeResponse = DescribedSplit & {
  /** The model that produced this result. */
  model: string
}

export const DESCRIBE_LIMITS = {
  maxTextChars: 500,
  maxPeople: 50,
  maxNameChars: 40,
} as const

/** The most time the server spends on one `POST /api/describe`, across every model. */
export const DESCRIBE_BUDGET_MS = 30_000

/* ------------------------------------------------------------------ health */

/** Response of `GET /api/health`. */
export interface HealthResponse {
  ok: true
  /** True when an NVIDIA API key is configured on the server. */
  configured: boolean
  /** Model(s) the server will try, in order. */
  models: string[]
}

/* ------------------------------------------------------------------ Pro: plans, checkout, licenses */

export type PlanId = 'pro_monthly' | 'pro_yearly' | 'pro_lifetime'

export const PLAN_IDS: readonly PlanId[] = ['pro_monthly', 'pro_yearly', 'pro_lifetime']

/** A one-time Pro pass. Nothing renews automatically. */
export interface Plan {
  id: PlanId
  /** "Monthly", "Yearly", "Lifetime". */
  name: string
  /** Price in MINOR units (paise). */
  amount: number
  currency: 'INR'
  /** How long the pass lasts; null = forever. */
  days: number | null
  /** Short highlight for the plan card, e.g. "Best value". */
  badge: string | null
  /** Whole percent saved against paying monthly for the same time (rounded down, never overstated). */
  savingsPercent: number | null
}

/** Response of `GET /api/billing/config`. */
export interface BillingConfig {
  /** 'razorpay' when checkout is set up on this server; null → show plans, offer "Redeem a code". */
  checkout: 'razorpay' | null
  /** Razorpay key id for Checkout (public by design); null when checkout is off. */
  keyId: string | null
  currency: 'INR'
  plans: Plan[]
  /** Ed25519 public key (SPKI DER, standard base64) that signs licenses; null when licensing is off. */
  licensePublicKey: string | null
  /** AI scans/describes per day included with Pro (fair use). */
  proAiPerDay: number
}

/** Request body for `POST /api/billing/order`. */
export interface OrderRequest {
  plan: PlanId
}

/** Response of `POST /api/billing/order`: everything Razorpay Checkout needs. */
export interface OrderResponse {
  orderId: string
  /** MINOR units (paise). */
  amount: number
  currency: 'INR'
  keyId: string
  plan: PlanId
}

/** Request body for `POST /api/billing/verify` — the three values Razorpay Checkout hands back. */
export interface VerifyRequest {
  orderId: string
  paymentId: string
  signature: string
}

/** Response of `POST /api/billing/verify`. */
export interface VerifyResponse {
  /** A signed license token (see `LICENSE_PREFIX`). Store it; it is the user's proof of Pro. */
  license: string
}

/** The signed part of a license token. */
export interface LicensePayload {
  /** Payment id (purchases) or code id (promo codes). */
  id: string
  plan: PlanId
  /** Issued at, epoch seconds. */
  iat: number
  /** Expires at, epoch seconds; null = lifetime. */
  exp: number | null
}

/** Request body for `POST /api/license/verify`. */
export interface LicenseVerifyRequest {
  license: string
}

/** Response of `POST /api/license/verify`. */
export interface LicenseVerifyResponse {
  /** True when the token is well-formed and signed by this server's key (even if it has expired). */
  valid: boolean
  /** True when valid and not expired. */
  active: boolean
  license: LicensePayload | null
}

/**
 * License tokens: `SETTLE1.<base64url(JSON LicensePayload)>.<base64url(Ed25519 signature)>`,
 * the signature covering the ASCII bytes `SETTLE1.<base64url payload>`.
 */
export const LICENSE_PREFIX = 'SETTLE1'

/** Request header carrying the license token on AI calls, for the Pro allowance. */
export const LICENSE_HEADER = 'X-Settle-License'

/* ------------------------------------------------------------------ errors */

export type ApiErrorCode =
  | 'bad_request' // malformed body / not a data URL
  | 'unsupported_image' // mime type not accepted
  | 'image_too_large' // decoded image over the limit
  | 'not_a_bill' // the model says the photo isn't a bill/receipt
  | 'unreadable' // model answered but nothing usable could be extracted
  | 'not_a_split' // the text doesn't describe an expense
  | 'not_configured' // NVIDIA_API_KEY missing on the server
  | 'upstream_auth' // NVIDIA rejected the key (401/403)
  | 'rate_limited' // too many requests (ours or NVIDIA's 429)
  | 'timeout' // NVIDIA took too long
  | 'upstream_error' // any other NVIDIA/network failure
  | 'billing_unavailable' // checkout / licensing isn't set up on this server
  | 'rates_unavailable' // no exchange rate for that day (GET /api/rates)

/* ------------------------------------------------------------------ exchange rates */

/** Response of `GET /api/rates?date=YYYY-MM-DD` (date optional = latest). */
export interface RatesResponse {
  /** The ECB business day used (≤ the asked date). */
  date: string
  base: 'EUR'
  /** Units per 1 EUR, EUR included, plus pegged currencies derived exactly. */
  rates: Record<string, number>
  /** Currencies derived from a peg: code → the currency it's pegged to and the peg. */
  pegged: Record<string, { to: string; peg: number }>
}

/** Currencies the ECB doesn't publish but that are pegged to one it does: code → [base, units per base]. */
export const PEGS = {
  AED: ['USD', 3.6725],
  SAR: ['USD', 3.75],
  QAR: ['USD', 3.64],
  OMR: ['USD', 0.3845],
  BHD: ['USD', 0.376],
  NPR: ['INR', 1.6],
  BTN: ['INR', 1],
} as const satisfies Record<string, readonly [string, number]>

/** Body of every non-2xx response from `/api/*`. `message` is safe to show to end users. */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string }
}

/**
 * The most time the server spends on one `POST /api/scan`, across every model and retry.
 * The client waits a little longer than this (see `SCAN_TIMEOUT_MS`), so the server's own
 * answer — a result or a friendly `timeout` error — always arrives before the browser gives up.
 */
export const SCAN_BUDGET_MS = 80_000

export const API_LIMITS = {
  /** Max decoded image size accepted by the server. The client compresses well below this. */
  maxImageBytes: 8 * 1024 * 1024,
  /** Max JSON body size (base64 overhead included). */
  maxBodyBytes: 12 * 1024 * 1024,
} as const

/* ------------------------------------------------------------------ payment screenshots */

/** The one error `POST /api/proof` adds to the shared codes: the screenshot isn't a UPI payment (422). */
export const NOT_A_PAYMENT_CODE = 'not_a_payment'
export type NotAPaymentCode = typeof NOT_A_PAYMENT_CODE

/** Request body for `POST /api/proof`: a screenshot of a UPI payment (same image rules as a bill). */
export interface ProofRequest {
  /** The screenshot as a data URL: `data:image/jpeg;base64,...` (jpeg, png or webp). */
  image: string
}

/** The UPI app the screenshot comes from, as far as the model can tell. */
export const PAYMENT_APPS = ['gpay', 'phonepe', 'paytm', 'bhim', 'bank', 'other', 'unknown'] as const
export type PaymentApp = (typeof PAYMENT_APPS)[number]

/** What the payment screen says about the money: only `success` may be recorded. */
export const PAYMENT_STATUSES = ['success', 'pending', 'failed', 'unknown'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
 * Successful response of `POST /api/proof`: what a payment screenshot says. Money is in MAJOR
 * units (rupees, 2dp). Anything the screenshot doesn't show is null; the client decides what
 * to trust (see src/features/proof/matchProof.ts).
 */
export interface ProofResponse {
  app: PaymentApp
  status: PaymentStatus
  /** Amount paid, e.g. 420 for "₹420". */
  amount: number | null
  /** ISO 4217 code, "INR" for rupees; null when the screen shows no currency. */
  currency: string | null
  /** Who paid (the sender's name as shown). */
  payerName: string | null
  /** Who received it (the name shown on the payee line). */
  payeeName: string | null
  /** The receiver's UPI ID as shown (name@bank), lower case, or null. */
  payeeUpi: string | null
  /** UPI transaction reference / UTR: 12 digits on most apps, digits only. Null when not shown. */
  utr: string | null
  /** Date of the payment as printed, YYYY-MM-DD, or null. */
  date: string | null
  /** Time of the payment as printed (24h "HH:MM"), or null. */
  time: string | null
  /** Model that read the screenshot (for logs and the report). */
  model: string
}
