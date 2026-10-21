/**
 * The Settle API: health, AI (`POST /api/scan`, `POST /api/describe`) and Pro billing.
 *
 * Used twice: mounted inside the Vite dev server (see vite.config.ts) and wrapped with
 * static file serving for production (see web.ts / index.ts). No database, no sessions —
 * a photo or a sentence comes in, a draft goes out; a payment comes in, a signed license goes out.
 */
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import {
  API_LIMITS,
  LICENSE_HEADER,
  type ApiErrorCode,
  type DescribeResponse,
  type HealthResponse,
  type ScanResponse,
} from '../shared/api'
import { registerBilling } from './billing'
import { loadConfig, redactSecrets, type ServerConfig } from './config'
import { describeSplit, parseDescribeRequest } from './describe'
import { utcToday } from './describeText'
import { ERROR_MESSAGES, ERROR_STATUS, fail, NOT_JSON, ownPageOnly, readJson, type Logger, type Messages } from './http'
import { inspectImage } from './image'
import { MAX_TOKEN_LENGTH, verifyLicense } from './license'
import { extractBill, UpstreamError } from './nvidia'
import { isAcceptableReply, isUsable, normalize, parseExtraction } from './parse'
import { clientKey, concurrencyLimit, createRateLimiter, tieredRateLimit, type LimitChoice } from './ratelimit'

export { loadConfig, ERROR_MESSAGES, ERROR_STATUS }
export type { ServerConfig, Logger }

/** Wording for `/api/describe`, where there's no photo and the fallback is filling the split in by hand. */
export const DESCRIBE_MESSAGES: Messages = {
  bad_request: 'Something went wrong sending that. Please try again.',
  not_configured: "AI isn't available right now — you can fill in the split yourself.",
  upstream_auth: "AI isn't working right now — you can fill in the split yourself.",
  rate_limited: 'Too many AI requests right now. Try again in a few minutes — or fill it in yourself.',
  timeout: 'That took too long. Please try again.',
  unreadable: "We couldn't work that one out. Try rephrasing — like 'Dinner 2400 with Riya and Sam'.",
}

const UPSTREAM_BUSY = 'The AI service is busy right now. Try again in a minute — or type the items in.'
const UPSTREAM_BUSY_DESCRIBE = 'The AI service is busy right now. Try again in a minute — or fill it in yourself.'
const SCANS_BUSY = 'Lots of bills are being read right now — try again in a moment.'
const DESCRIBES_BUSY = 'Lots of people are using AI right now — try again in a moment.'
const PRO_DAILY_LIMIT = "You've reached today's fair-use limit for AI. It resets within a day — you can still fill things in yourself."
const INTERNAL_ERROR = 'Something went wrong on our side. Please try again.'

/** A slot frees up as soon as any request in flight finishes, usually within seconds. */
const BUSY_RETRY_AFTER_SECONDS = 10
/** After NVIDIA rejects the key, /api/health reports AI as off for this long. */
const KEY_REJECTED_MS = 10 * 60_000
const DAY_MS = 86_400_000
/** A sentence, a few names and a date: anything bigger isn't from our client. */
const MAX_DESCRIBE_BODY_BYTES = 16 * 1024

export interface AppOptions {
  /** Defaults to `console`. */
  logger?: Logger
  /** Clock for the rate limiters, licenses and timings (tests). */
  now?: () => number
}

interface Route {
  /** Log prefix. */
  tag: '[scan]' | '[describe]'
  messages: Messages
  busy: string
}

const SCAN: Route = { tag: '[scan]', messages: {}, busy: UPSTREAM_BUSY }
const DESCRIBE: Route = { tag: '[describe]', messages: DESCRIBE_MESSAGES, busy: UPSTREAM_BUSY_DESCRIBE }

/** `fail` with the route's own wording for `code`, when it has one. */
function failOn(c: Context, route: Route, code: ApiErrorCode, status?: ContentfulStatusCode) {
  return fail(c, code, { message: route.messages[code], ...(status === undefined ? {} : { status }) })
}

const ScanRequestSchema = z.object({ image: z.string().min(1) })

export function createApp(config: ServerConfig, options: AppOptions = {}): Hono {
  const log = options.logger ?? console
  const now = options.now ?? Date.now
  const redact = (text: string) => redactSecrets(text, config.apiKey, config.billing.razorpay?.keySecret)
  const app = new Hono()

  /** When NVIDIA last rejected the key; /api/health reports AI as off for a while after (until a call works again). */
  let keyRejectedAt: number | null = null
  const aiAvailable = () => config.apiKey !== null && (keyRejectedAt === null || now() - keyRejectedAt >= KEY_REJECTED_MS)

  // API answers are per-request and may describe someone's bill: never cache them.
  app.use('/api/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })

  app.get('/api/health', (c) => {
    const body: HealthResponse = { ok: true, configured: aiAvailable(), models: config.models }
    return c.json(body)
  })

  const guard = ownPageOnly({ trustProxy: config.trustProxy, log })

  /* ---------------------------------------------------------------- AI allowances */

  // Free: per client IP (scans and describes together). Pro: per license, per day.
  const ipLimiter = config.rateLimit.max > 0 ? createRateLimiter(config.rateLimit, now) : null
  const proLimiter = config.proAiPerDay > 0 ? createRateLimiter({ max: config.proAiPerDay, windowMs: DAY_MS }, now) : null

  /** The license id behind a valid, active `X-Settle-License` header, else null. */
  function proLicenseId(c: Context): string | null {
    const token = c.req.header(LICENSE_HEADER)?.trim()
    if (!token || token.length > MAX_TOKEN_LENGTH || config.license.publicKey === null) return null
    const check = verifyLicense(token, config.license.publicKey, Math.floor(now() / 1000))
    return check.active ? check.license.id : null
  }

  const aiAllowance = (route: Route): MiddlewareHandler =>
    tieredRateLimit<'free' | 'pro'>({
      now,
      choose: (c): LimitChoice<'free' | 'pro'> | null => {
        const licenseId = proLicenseId(c)
        if (licenseId !== null) return proLimiter && { limiter: proLimiter, key: `license:${licenseId}`, tier: 'pro' }
        return ipLimiter && { limiter: ipLimiter, key: clientKey(c, config.trustProxy), tier: 'free' }
      },
      onLimited: (c, _retryAfter, tier) => fail(c, 'rate_limited', { message: tier === 'pro' ? PRO_DAILY_LIMIT : route.messages.rate_limited }),
    })

  const inFlight = (busyMessage: string) =>
    concurrencyLimit(config.maxConcurrentScans, (c) => {
      c.header('Retry-After', String(BUSY_RETRY_AFTER_SECONDS))
      return fail(c, 'rate_limited', { message: busyMessage })
    })

  /* ---------------------------------------------------------------- POST /api/scan */

  app.post(
    '/api/scan',
    guard,
    aiAllowance(SCAN),
    inFlight(SCANS_BUSY),
    bodyLimit({ maxSize: API_LIMITS.maxBodyBytes, onError: (c) => fail(c, 'image_too_large') }),
    async (c) => {
      const json = await readJson(c)
      const request = json === NOT_JSON ? null : ScanRequestSchema.safeParse(json)
      if (!request?.success) return fail(c, 'bad_request')

      const photo = inspectImage(request.data.image)
      if (!photo.ok) return fail(c, photo.code)
      if (config.apiKey === null) return fail(c, 'not_configured')

      const started = now()
      try {
        const result = await extractBill(config, photo.dataUrl, {
          signal: c.req.raw.signal,
          accept: isAcceptableReply,
          onAttemptFailed: (error) => log.warn(`[scan] attempt failed: ${describeUpstream(error, redact)}`),
        })
        keyRejectedAt = null
        const extraction = parseExtraction(result.raw)
        const elapsed = now() - started
        if (!extraction.isBill) {
          log.info(`[scan] not a bill · ${result.model} · ${elapsed} ms`)
          return fail(c, 'not_a_bill')
        }
        const scan: ScanResponse = normalize(extraction, result.model)
        if (!isUsable(scan)) {
          log.info(`[scan] nothing usable · ${result.model} · ${elapsed} ms`)
          return fail(c, 'unreadable')
        }
        const what = scan.items.length > 0 ? `${scan.items.length} items` : 'total only'
        log.info(`[scan] ok · ${result.model} · ${what} · ${scan.category ?? 'no category'} · ${Math.round(photo.bytes / 1024)} KB · ${elapsed} ms`)
        return c.json(scan)
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error
        return upstreamFailure(c, error, SCAN)
      }
    },
  )

  /* ---------------------------------------------------------------- POST /api/describe */

  app.post(
    '/api/describe',
    guard,
    aiAllowance(DESCRIBE),
    inFlight(DESCRIBES_BUSY),
    bodyLimit({ maxSize: MAX_DESCRIBE_BODY_BYTES, onError: (c) => failOn(c, DESCRIBE, 'bad_request', 413) }),
    async (c) => {
      const json = await readJson(c)
      const request = json === NOT_JSON ? null : parseDescribeRequest(json, utcToday(now()))
      if (request === null) return failOn(c, DESCRIBE, 'bad_request')
      if (!request.ok) return fail(c, 'bad_request', { message: request.message })
      if (config.apiKey === null) return failOn(c, DESCRIBE, 'not_configured')

      const started = now()
      try {
        const { outcome, model } = await describeSplit(config, request.input, {
          signal: c.req.raw.signal,
          onAttemptFailed: (error) => log.warn(`[describe] attempt failed: ${describeUpstream(error, redact)}`),
        })
        keyRejectedAt = null
        const elapsed = now() - started
        if (outcome.kind === 'not_a_split') {
          log.info(`[describe] not a split · ${model} · ${elapsed} ms`)
          return fail(c, 'not_a_split')
        }
        const { split } = outcome
        log.info(`[describe] ok · ${model} · ${split.mode} · ${split.people.length} people · ${elapsed} ms`)
        const body: DescribeResponse = { ...split, model }
        return c.json(body)
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error
        return upstreamFailure(c, error, DESCRIBE)
      }
    },
  )

  function upstreamFailure(c: Context, error: UpstreamError, route: Route) {
    const summary = describeUpstream(error, redact)
    switch (error.kind) {
      case 'aborted':
        log.info(`${route.tag} cancelled by the client`)
        return failOn(c, route, 'timeout', 408)
      case 'not_configured':
        return failOn(c, route, 'not_configured')
      case 'auth':
        keyRejectedAt = now()
        log.error(`${route.tag} ${summary} — check NVIDIA_API_KEY. AI shows as off for the next ${KEY_REJECTED_MS / 60_000} minutes.`)
        return failOn(c, route, 'upstream_auth')
      case 'rate_limited':
        log.warn(`${route.tag} ${summary}`)
        if (error.retryAfter !== null) c.header('Retry-After', String(Math.max(1, error.retryAfter)))
        return fail(c, 'rate_limited', { message: route.busy })
      case 'timeout':
        log.error(`${route.tag} ${summary}`)
        return failOn(c, route, 'timeout')
      case 'bad_output':
        log.error(`${route.tag} ${summary}`)
        return failOn(c, route, 'unreadable')
      case 'unavailable':
        log.error(`${route.tag} ${summary}${error.status === 404 ? ' — check the model ids in NVIDIA_MODEL / NVIDIA_TEXT_MODEL' : ''}`)
        return failOn(c, route, 'upstream_error')
    }
  }

  /* ---------------------------------------------------------------- billing, licenses */

  registerBilling(app, { config, log, now, ownPageOnly: guard })

  /* ---------------------------------------------------------------- everything else */

  for (const path of ['/api/scan', '/api/describe']) {
    app.on(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], path, (c) => {
      c.header('Allow', 'POST')
      return fail(c, 'bad_request', { status: 405, message: 'Use POST here.' })
    })
  }
  app.on(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/api/health', (c) => {
    c.header('Allow', 'GET, HEAD')
    return fail(c, 'bad_request', { status: 405, message: 'Use GET for the health check.' })
  })
  app.all('/api/*', (c) => fail(c, 'bad_request', { status: 404, message: "That API endpoint doesn't exist." }))
  app.notFound((c) => fail(c, 'bad_request', { status: 404, message: 'Not found.' }))

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      if (error.status === 413) return fail(c, 'image_too_large')
      return fail(c, 'bad_request', { status: error.status >= 400 && error.status < 500 ? error.status : 400 })
    }
    const detail = error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error)
    log.error(`[api] ${c.req.method} ${c.req.path} failed: ${redact(detail)}`)
    return fail(c, 'upstream_error', { status: 500, message: INTERNAL_ERROR })
  })

  return app
}

function describeUpstream(error: UpstreamError, redact: (text: string) => string): string {
  const parts = [error.message]
  if (error.detail) parts.push(`upstream said: ${error.detail.replace(/\s+/g, ' ').slice(0, 300)}`)
  return redact(parts.join(' · '))
}
