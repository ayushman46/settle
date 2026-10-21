/**
 * Wire contract between the browser and the API server.
 * Imported by both `src/` (client) and `server/` — keep it dependency-free.
 */

/** Request body for `POST /api/scan`. */
export interface ScanRequest {
  /** The bill photo as a data URL: `data:image/jpeg;base64,...` (jpeg, png or webp). */
  image: string
}

/** One printed line of the bill. Amounts are in MAJOR units (e.g. rupees), as decimals. */
export interface ScannedItem {
  name: string
  /** Units on that line; defaults to 1 when the bill doesn't say. Always > 0. */
  quantity: number
  /** Price for the whole line (quantity already applied). Always >= 0. */
  amount: number
}

/** Successful response of `POST /api/scan`. All money values are MAJOR units, 2dp-rounded. */
export interface ScanResponse {
  merchant: string | null
  /** Bill date as printed, normalised to YYYY-MM-DD when unambiguous. */
  date: string | null
  /** ISO 4217 code in upper case, e.g. "INR". Null when the bill gives no hint. */
  currency: string | null
  items: ScannedItem[]
  /** Sum of items before charges, as printed. */
  subtotal: number | null
  /** All taxes combined (GST, CGST+SGST, VAT, sales tax...). */
  tax: number | null
  /** Service charge / service fee. */
  serviceCharge: number | null
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

/** Response of `GET /api/health`. */
export interface HealthResponse {
  ok: true
  /** True when an NVIDIA API key is configured on the server. */
  configured: boolean
  /** Model(s) the server will try, in order. */
  models: string[]
}

export type ApiErrorCode =
  | 'bad_request' // malformed body / not a data URL
  | 'unsupported_image' // mime type not accepted
  | 'image_too_large' // decoded image over the limit
  | 'not_a_bill' // the model says the photo isn't a bill/receipt
  | 'unreadable' // model answered but nothing usable could be extracted
  | 'not_configured' // NVIDIA_API_KEY missing on the server
  | 'upstream_auth' // NVIDIA rejected the key (401/403)
  | 'rate_limited' // too many requests (ours or NVIDIA's 429)
  | 'timeout' // NVIDIA took too long
  | 'upstream_error' // any other NVIDIA/network failure

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
