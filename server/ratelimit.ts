/**
 * Tiny in-memory fixed-window rate limiters (per client IP, per Pro license) plus a cap on
 * requests in flight. Good enough for a single instance: they protect the NVIDIA quota from
 * one noisy client and the server's memory from a burst.
 */
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'
import type { RateLimitConfig } from './config'

export interface RateLimitDecision {
  allowed: boolean
  limit: number
  remaining: number
  /** Epoch ms when the current window ends. */
  resetAt: number
}

export interface RateLimiter {
  hit(key: string): RateLimitDecision
  /** Number of keys currently tracked. */
  readonly size: number
}

/** Hard cap on tracked keys so a flood of spoofed addresses can't grow memory without bound. */
const MAX_KEYS = 10_000
const MAX_PRUNE_INTERVAL_MS = 60_000

export function createRateLimiter(config: RateLimitConfig, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>()
  let nextPrune = 0

  const prune = (time: number) => {
    for (const [key, window] of windows) if (window.resetAt <= time) windows.delete(key)
    nextPrune = time + Math.min(config.windowMs, MAX_PRUNE_INTERVAL_MS)
  }

  return {
    hit(key) {
      const time = now()
      if (time >= nextPrune || windows.size >= MAX_KEYS) prune(time)

      let window = windows.get(key)
      if (window === undefined || window.resetAt <= time) {
        // Map order = insertion order, so the first key is the stalest one.
        if (window === undefined && windows.size >= MAX_KEYS) {
          const oldest = windows.keys().next()
          if (!oldest.done) windows.delete(oldest.value)
        }
        windows.delete(key)
        window = { count: 0, resetAt: time + config.windowMs }
        windows.set(key, window)
      }
      window.count++

      const unlimited = config.max <= 0
      return {
        allowed: unlimited || window.count <= config.max,
        limit: config.max,
        remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, config.max - window.count),
        resetAt: window.resetAt,
      }
    },
    get size() {
      return windows.size
    },
  }
}

/** IPv4 / IPv6 (optionally bracketed, with port) — rejects junk like "unknown". */
const PLAUSIBLE_ADDRESS = /^[0-9a-f:.[\]]{2,64}$/i

/**
 * The client's address, else "anon". IPv6 clients are grouped by /64, since one subscriber
 * usually owns a whole /64.
 *
 * `trustProxy` is how many proxies we run behind. With 0 the socket's address is used and
 * `X-Forwarded-For` is ignored: anyone can send that header. With N, we take the entry N
 * hops from the END of the header, which is the address our outermost trusted proxy saw.
 * Proxies append to whatever the client sent, so the entries further left are unverified.
 */
export function clientKey(c: Context, trustProxy = 0): string {
  const address = forwardedAddress(c.req.header('x-forwarded-for'), trustProxy) ?? socketAddress(c)
  return address ? normalizeAddress(address) : 'anon'
}

function forwardedAddress(header: string | undefined, trustProxy: number): string | undefined {
  if (trustProxy <= 0 || !header) return undefined
  const hops = header.split(',').map((hop) => hop.trim())
  const hop = hops[hops.length - trustProxy]
  return hop && PLAUSIBLE_ADDRESS.test(hop) ? hop : undefined
}

function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined // not running on @hono/node-server (e.g. tests calling app.request)
  }
}

export function normalizeAddress(raw: string): string {
  let address = raw.trim().toLowerCase()
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(address)
  if (bracketed) address = bracketed[1] ?? address
  address = address.replace(/%.*$/, '') // IPv6 zone id
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address)
  if (mapped) return mapped[1] ?? address
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(address)
  if (ipv4WithPort) return ipv4WithPort[1] ?? address
  return address.includes(':') ? ipv6Prefix(address) : address
}

function ipv6Prefix(address: string): string {
  const halves = address.split('::')
  if (halves.length > 2) return address
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if (halves.length === 1 ? left.length !== 8 : missing < 1) return address
  const groups = [...left, ...Array<string>(halves.length === 1 ? 0 : missing).fill('0'), ...right]
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return address
  return `${groups
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(':')}::/64`
}

export interface RateLimitOptions {
  /** Builds the 429 response. `retryAfter` is in seconds. */
  onLimited: (c: Context, retryAfter: number) => Response | Promise<Response>
  now?: () => number
  keyFor?: (c: Context) => string
}

/** Middleware form. A `max` of 0 disables limiting. Sets IETF draft `RateLimit-*` headers. */
export function rateLimit(config: RateLimitConfig, options: RateLimitOptions): MiddlewareHandler {
  if (config.max <= 0) return async (_c, next) => next()
  const now = options.now ?? Date.now
  const keyFor = options.keyFor ?? clientKey
  const limiter = createRateLimiter(config, now)
  return tieredRateLimit({
    now,
    choose: (c) => ({ limiter, key: keyFor(c), tier: 'default' }),
    onLimited: (c, retryAfter) => options.onLimited(c, retryAfter),
  })
}

/** Which allowance a request draws from. */
export interface LimitChoice<Tier extends string = string> {
  limiter: RateLimiter
  key: string
  tier: Tier
}

export interface TieredRateLimitOptions<Tier extends string> {
  /** The allowance for this request, or null when it is unlimited. */
  choose: (c: Context) => LimitChoice<Tier> | null
  /** Builds the 429 response. `retryAfter` is in seconds. */
  onLimited: (c: Context, retryAfter: number, tier: Tier) => Response | Promise<Response>
  now?: () => number
}

/**
 * Rate limiting with more than one allowance — e.g. per IP for everyone, per license for Pro.
 * Sets IETF draft `RateLimit-*` headers for the allowance used.
 */
export function tieredRateLimit<Tier extends string>(options: TieredRateLimitOptions<Tier>): MiddlewareHandler {
  const now = options.now ?? Date.now
  return async (c, next) => {
    const choice = options.choose(c)
    if (choice === null) return next()
    const decision = choice.limiter.hit(choice.key)
    const resetSeconds = Math.max(1, Math.ceil((decision.resetAt - now()) / 1000))
    c.header('RateLimit-Limit', String(decision.limit))
    c.header('RateLimit-Remaining', String(decision.remaining))
    c.header('RateLimit-Reset', String(resetSeconds))
    if (!decision.allowed) {
      c.header('Retry-After', String(resetSeconds))
      return options.onLimited(c, resetSeconds, choice.tier)
    }
    await next()
  }
}

/**
 * Caps how many requests run at once (each scan holds a photo of up to 12 MB in memory for
 * as long as the model takes). When every slot is taken it answers straight away with
 * `onBusy` rather than queueing. A `max` of 0 disables the cap.
 */
export function concurrencyLimit(max: number, onBusy: (c: Context) => Response | Promise<Response>): MiddlewareHandler {
  if (max <= 0) return async (_c, next) => next()
  let active = 0
  return async (c, next) => {
    if (active >= max) return onBusy(c)
    active++
    try {
      await next()
    } finally {
      active--
    }
  }
}
