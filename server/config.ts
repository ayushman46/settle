/**
 * Server configuration, read once from environment variables.
 * Nothing here is secret-aware beyond keeping the key out of anything we return.
 */
import { SCAN_BUDGET_MS } from '../shared/api'

export interface RateLimitConfig {
  /** Scans allowed per client IP per window. 0 disables rate limiting. */
  max: number
  windowMs: number
}

export interface ServerConfig {
  /** NVIDIA API key, or null when it isn't configured (scanning is then disabled). */
  apiKey: string | null
  /** Vision models to try, in order. Never empty. */
  models: string[]
  /** OpenAI-compatible base URL, without a trailing slash. */
  baseUrl: string
  /**
   * Time limit for a single model attempt, in milliseconds. All attempts of one scan also
   * share `SCAN_BUDGET_MS`, so a slow first model still leaves the fallbacks a fair try.
   */
  timeoutMs: number
  rateLimit: RateLimitConfig
  /**
   * How many proxies we run behind (0–5). The client's address is read that many hops from
   * the end of `X-Forwarded-For`; 0 ignores the header and uses the socket's address.
   */
  trustProxy: number
  /** Scans read at the same time; any more get an immediate 429. 0 = no limit. */
  maxConcurrentScans: number
}

export type Env = Record<string, string | undefined>

export const DEFAULT_MODELS: readonly string[] = [
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'google/gemma-4-31b-it',
  'meta/llama-3.2-90b-vision-instruct',
]
export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_TIMEOUT_MS = 35_000
export const DEFAULT_RATE_LIMIT: Readonly<RateLimitConfig> = { max: 30, windowMs: 600_000 }
export const DEFAULT_MAX_CONCURRENT_SCANS = 8

/** One attempt can't outlast the whole scan. */
const MAX_TIMEOUT_MS = SCAN_BUDGET_MS
/** More hops than any real deployment has: a bigger number is a typo, so it's ignored. */
const MAX_TRUST_PROXY = 5

/** Values people leave in `.env` that are clearly not a real key. */
const PLACEHOLDER_KEY =
  /^(?:nvapi-?|(?:nvapi-)?(?:x+|\.{3,}|…|<[^>]*>|\[[^\]]*\]|\{[^}]*\}|your[-_ ]?(?:nvidia[-_ ]?)?(?:api[-_ ]?)?key(?:[-_ ]?here)?|(?:api[-_ ]?)?key[-_ ]?here|change[-_ ]?me|replace[-_ ]?me|todo|none|null|undefined|false))$/i

export function loadConfig(env: Env): ServerConfig {
  return {
    apiKey: parseApiKey(env.NVIDIA_API_KEY),
    models: parseModels(env.NVIDIA_MODEL),
    baseUrl: parseBaseUrl(env.NVIDIA_BASE_URL),
    timeoutMs: Math.min(parseInteger(env.NVIDIA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1), MAX_TIMEOUT_MS),
    rateLimit: {
      max: parseInteger(env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT.max, 0),
      windowMs: parseInteger(env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT.windowMs, 1),
    },
    trustProxy: parseInteger(env.TRUST_PROXY, 0, 0, MAX_TRUST_PROXY),
    maxConcurrentScans: parseInteger(env.MAX_CONCURRENT_SCANS, DEFAULT_MAX_CONCURRENT_SCANS, 0),
  }
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

function parseModels(raw: string | undefined): string[] {
  const seen = new Set<string>()
  for (const part of (raw ?? '').split(',')) {
    const model = unquote(part)
    if (model) seen.add(model)
  }
  return seen.size > 0 ? [...seen] : [...DEFAULT_MODELS]
}

function parseBaseUrl(raw: string | undefined): string {
  const value = unquote(raw ?? '')
  if (!value) return DEFAULT_BASE_URL
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_BASE_URL
  } catch {
    return DEFAULT_BASE_URL
  }
  return value.replace(/\/+$/, '')
}

export const DEFAULT_PORT = 3000

/** HTTP port from `PORT`; anything that isn't 1–65535 → 3000. */
export function parsePort(raw: string | undefined): number {
  return parseInteger(raw, DEFAULT_PORT, 1, 65_535)
}

/** Strips the API key (and anything shaped like a key or bearer token) from text bound for logs. */
export function redactSecrets(text: string, apiKey: string | null = null): string {
  let out = apiKey ? text.split(apiKey).join('[redacted]') : text
  out = out.replace(/nvapi-[\w-]{6,}/g, 'nvapi-[redacted]')
  return out.replace(/(Bearer\s+)[^\s"',;]+/gi, '$1[redacted]')
}

/** Parses a whole number in `min`–`max`; anything else (blank, junk, fractions, out of range) → `fallback`. */
function parseInteger(raw: string | undefined, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = unquote(raw ?? '').replace(/_/g, '')
  if (!/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
