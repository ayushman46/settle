/**
 * Server configuration, read once from environment variables.
 * Secrets stay in here: nothing returned to clients or written to logs includes them.
 */
import type { KeyObject } from 'node:crypto'
import { DESCRIBE_BUDGET_MS, SCAN_BUDGET_MS, type PlanId } from '../shared/api'
import { loadLicenseKeys, type LicenseKeys } from './license'
import { parsePrices } from './plans'

export interface RateLimitConfig {
  /** Requests allowed per key per window. 0 disables rate limiting. */
  max: number
  windowMs: number
}

export interface RazorpayKeys {
  keyId: string
  keySecret: string
}

export interface BillingSettings {
  /** Razorpay API keys, or null when checkout isn't set up. */
  razorpay: RazorpayKeys | null
  /** Razorpay REST base URL, without a trailing slash (tests point it elsewhere). */
  razorpayBaseUrl: string
  /** Plan prices in paise. */
  prices: Record<PlanId, number>
  /** Billing calls (order, verify, license check) per client IP per window. */
  rateLimit: RateLimitConfig
}

export interface ServerConfig {
  /** NVIDIA API key, or null when it isn't configured (AI features are then off). */
  apiKey: string | null
  /** Vision models that read bill photos, tried in order. Never empty. */
  models: string[]
  /** Text models that turn "Cab 840 with Riya and Sam" into a split, tried in order. Never empty. */
  textModels: string[]
  /** OpenAI-compatible base URL, without a trailing slash. */
  baseUrl: string
  /**
   * Time limit for a single scan attempt, in milliseconds. All attempts of one scan also
   * share `SCAN_BUDGET_MS`, so a slow first model still leaves the fallbacks a fair try.
   */
  timeoutMs: number
  /** Time limit for a single describe attempt (all attempts share `DESCRIBE_BUDGET_MS`). */
  describeTimeoutMs: number
  /** AI calls (scans + describes together) allowed per client IP per window, for free users. */
  rateLimit: RateLimitConfig
  /** AI calls per Pro license per day. 0 = no cap. */
  proAiPerDay: number
  /**
   * How many proxies we run behind (0–5). The client's address is read that many hops from
   * the end of `X-Forwarded-For`; 0 ignores the header and uses the socket's address.
   */
  trustProxy: number
  /**
   * Shared with the Cloudflare Pages Function in front of this server (`PROXY_SECRET` on both).
   * A request carrying it may name the visitor's address in `X-Settle-Client-IP`, however many
   * proxies sit in between. Null when unset (or too short to be safe).
   */
  proxySecret: string | null
  /** AI requests handled at the same time; any more get an immediate 429. 0 = no limit. */
  maxConcurrentScans: number
  billing: BillingSettings
  license: LicenseKeys
  /** Settings that were ignored or look wrong, for the startup log. Never contains secrets. */
  warnings: string[]
}

export type Env = Record<string, string | undefined>

export const DEFAULT_MODELS: readonly string[] = ['nvidia/nemotron-3.5-super-vl-120b-a12b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning']
export const DEFAULT_TEXT_MODELS: readonly string[] = ['nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning']
export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1'
export const DEFAULT_TIMEOUT_MS = 35_000
export const DEFAULT_DESCRIBE_TIMEOUT_MS = 15_000
export const DEFAULT_RATE_LIMIT: Readonly<RateLimitConfig> = { max: 30, windowMs: 600_000 }
export const DEFAULT_BILLING_RATE_LIMIT: Readonly<RateLimitConfig> = { max: 30, windowMs: 600_000 }
export const DEFAULT_PRO_AI_PER_DAY = 200
export const DEFAULT_MAX_CONCURRENT_SCANS = 8

/** More hops than any real deployment has: a bigger number is a typo, so it's ignored. */
const MAX_TRUST_PROXY = 5

/** Values people leave in `.env` that are clearly not a real key. */
const PLACEHOLDER_KEY =
  /^(?:nvapi-?|(?:nvapi-)?(?:x+|\.{3,}|…|<[^>]*>|\[[^\]]*\]|\{[^}]*\}|your[-_ ]?(?:nvidia[-_ ]?)?(?:api[-_ ]?)?key(?:[-_ ]?here)?|(?:api[-_ ]?)?key[-_ ]?here|change[-_ ]?me|replace[-_ ]?me|todo|none|null|undefined|false))$/i
/** Real Razorpay values are plain alphanumerics, so "your_key_secret" / "secret-here" can't be one. */
const PLACEHOLDER_SECRET =
  /^(?:x+|\.{3,}|…|<[^>]*>|\[[^\]]*\]|\{[^}]*\}|your[-_ ].*|.*[-_ ]here|change[-_ ]?me|replace[-_ ]?me|secret|todo|none|null|undefined|false)$/i
/** rzp_test_… / rzp_live_… followed by Razorpay's 14 alphanumerics (accept a little leeway). */
const RAZORPAY_KEY_ID = /^rzp_(?:test|live)_[A-Za-z0-9]{8,32}$/

export function loadConfig(env: Env): ServerConfig {
  const warnings: string[] = []
  const prices = parsePrices(env.PRO_PRICES)
  warnings.push(...prices.problems)
  const license = loadLicenseKeys(env.LICENSE_PRIVATE_KEY, env.LICENSE_PUBLIC_KEY)
  warnings.push(...license.problems)

  return {
    apiKey: parseApiKey(env.NVIDIA_API_KEY),
    models: parseModels(env.NVIDIA_MODEL, DEFAULT_MODELS),
    textModels: parseModels(env.NVIDIA_TEXT_MODEL, DEFAULT_TEXT_MODELS),
    baseUrl: parseBaseUrl(env.NVIDIA_BASE_URL, DEFAULT_BASE_URL),
    // One attempt can't outlast the whole scan (or describe).
    timeoutMs: Math.min(parseInteger(env.NVIDIA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1), SCAN_BUDGET_MS),
    describeTimeoutMs: Math.min(parseInteger(env.NVIDIA_TEXT_TIMEOUT_MS, DEFAULT_DESCRIBE_TIMEOUT_MS, 1), DESCRIBE_BUDGET_MS),
    rateLimit: {
      max: parseInteger(env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT.max, 0),
      windowMs: parseInteger(env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT.windowMs, 1),
    },
    proAiPerDay: parseInteger(env.PRO_AI_PER_DAY, DEFAULT_PRO_AI_PER_DAY, 0),
    trustProxy: parseInteger(env.TRUST_PROXY, 0, 0, MAX_TRUST_PROXY),
    proxySecret: parseProxySecret(env.PROXY_SECRET, warnings),
    maxConcurrentScans: parseInteger(env.MAX_CONCURRENT_SCANS, DEFAULT_MAX_CONCURRENT_SCANS, 0),
    billing: {
      razorpay: parseRazorpay(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, warnings),
      razorpayBaseUrl: DEFAULT_RAZORPAY_BASE_URL,
      prices: prices.prices,
      rateLimit: {
        max: parseInteger(env.BILLING_RATE_LIMIT_MAX, DEFAULT_BILLING_RATE_LIMIT.max, 0),
        windowMs: DEFAULT_BILLING_RATE_LIMIT.windowMs,
      },
    },
    license: license.keys,
    warnings,
  }
}

/** Checkout needs Razorpay keys AND a way to sign the license it sells. */
export function checkoutReady(config: ServerConfig): config is ServerConfig & {
  billing: BillingSettings & { razorpay: RazorpayKeys }
  license: LicenseKeys & { privateKey: KeyObject }
} {
  return config.billing.razorpay !== null && config.license.privateKey !== null
}

function unquote(value: string): string {
  const trimmed = value.trim()
  const match = /^(["'`])(.*)\1$/s.exec(trimmed)
  return (match?.[2] ?? trimmed).trim()
}

function parseApiKey(raw: string | undefined): string | null {
  if (raw === undefined) return null
  const key = unquote(raw)
  if (key === '' || PLACEHOLDER_KEY.test(key)) return null
  return key
}

function parseRazorpay(rawId: string | undefined, rawSecret: string | undefined, warnings: string[]): RazorpayKeys | null {
  const keyId = unquote(rawId ?? '')
  const keySecret = unquote(rawSecret ?? '')
  const idSet = keyId !== '' && !PLACEHOLDER_SECRET.test(keyId) && !/^rzp_(?:test|live)_(?:x+|\.+|…)?$/i.test(keyId)
  const secretSet = keySecret !== '' && !PLACEHOLDER_SECRET.test(keySecret)
  if (!idSet && !secretSet) return null
  if (!idSet || !secretSet) {
    warnings.push(`Razorpay checkout is off: ${idSet ? 'RAZORPAY_KEY_SECRET' : 'RAZORPAY_KEY_ID'} is missing.`)
    return null
  }
  if (!RAZORPAY_KEY_ID.test(keyId)) {
    warnings.push('Razorpay checkout is off: RAZORPAY_KEY_ID should look like rzp_test_… or rzp_live_….')
    return null
  }
  return { keyId, keySecret }
}

/** Shorter than this, a shared secret could be guessed; Render's generated values are far longer. */
export const MIN_PROXY_SECRET_LENGTH = 24

function parseProxySecret(raw: string | undefined, warnings: string[]): string | null {
  const secret = unquote(raw ?? '')
  if (secret === '' || PLACEHOLDER_SECRET.test(secret)) return null
  if (secret.length < MIN_PROXY_SECRET_LENGTH || /\s/.test(secret)) {
    warnings.push(
      `PROXY_SECRET is ignored: use at least ${MIN_PROXY_SECRET_LENGTH} characters with no spaces (Render's "Generate" button makes a good one).`,
    )
    return null
  }
  return secret
}

function parseModels(raw: string | undefined, defaults: readonly string[]): string[] {
  const seen = new Set<string>()
  for (const part of (raw ?? '').split(',')) {
    const model = unquote(part)
    if (model) seen.add(model)
  }
  return seen.size > 0 ? [...seen] : [...defaults]
}

function parseBaseUrl(raw: string | undefined, fallback: string): string {
  const value = unquote(raw ?? '')
  if (!value) return fallback
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
  } catch {
    return fallback
  }
  return value.replace(/\/+$/, '')
}

export const DEFAULT_PORT = 3000

/** HTTP port from `PORT`; anything that isn't 1–65535 → 3000. */
export function parsePort(raw: string | undefined): number {
  return parseInteger(raw, DEFAULT_PORT, 1, 65_535)
}

/**
 * Strips secrets from text bound for logs: the given values, anything shaped like an NVIDIA
 * key, a bearer token or HTTP basic credentials.
 */
export function redactSecrets(text: string, ...secrets: ReadonlyArray<string | null | undefined>): string {
  let out = text
  for (const secret of secrets) if (secret) out = out.split(secret).join('[redacted]')
  out = out.replace(/nvapi-[\w-]{6,}/g, 'nvapi-[redacted]')
  return out.replace(/((?:Bearer|Basic)\s+)[^\s"',;]+/gi, '$1[redacted]')
}

/** Parses a whole number in `min`–`max`; anything else (blank, junk, fractions, out of range) → `fallback`. */
function parseInteger(raw: string | undefined, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = unquote(raw ?? '').replace(/_/g, '')
  if (!/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
