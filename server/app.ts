/**
 * The BillSplit API: `GET /api/health` and `POST /api/scan`.
 *
 * Used twice: mounted inside the Vite dev server (see vite.config.ts) and wrapped with
 * static file serving for production (see web.ts / index.ts). No database, no sessions —
 * a photo comes in, a parsed bill goes out.
 */
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import { API_LIMITS, type ApiErrorBody, type ApiErrorCode, type HealthResponse, type ScanResponse } from '../shared/api'
import { loadConfig, redactSecrets, type ServerConfig } from './config'
import { inspectImage } from './image'
import { extractBill, UpstreamError } from './nvidia'
import { isAcceptableReply, isUsable, normalize, parseExtraction } from './parse'
import { clientKey, concurrencyLimit, rateLimit } from './ratelimit'

export { loadConfig }
export type { ServerConfig }

const MAX_IMAGE_MB = Math.round(API_LIMITS.maxImageBytes / (1024 * 1024))

/**
 * What end users see. Short, calm, and always with a next step. Never operator hints
 * (env vars, keys, files): those go to the server log.
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  bad_request: "Something went wrong sending the photo. Please try again.",
  unsupported_image: 'Please use a JPG or PNG photo.',
  image_too_large: `That photo is too large (over ${MAX_IMAGE_MB} MB). Try a smaller photo or a screenshot of it.`,
  not_a_bill: "That doesn't look like a bill. Try a clear photo of the full receipt.",
  unreadable: "We couldn't read any items. Try a clearer, well-lit photo — or enter them manually.",
  not_configured: "Photo scanning isn't available right now — you can type the items in.",
  upstream_auth: "Photo scanning isn't working right now — you can type the items in.",
  rate_limited: 'Too many scans right now. Try again in a few minutes — or type the items in.',
  timeout: 'Reading the bill took too long. Try again with a sharper, closer photo.',
  upstream_error: "Couldn't reach the AI service. Please try again.",
}

const UPSTREAM_BUSY = 'The AI service is busy right now. Try again in a minute — or type the items in.'
const SCANS_BUSY = 'Lots of bills are being read right now — try again in a moment.'
const INTERNAL_ERROR = 'Something went wrong on our side. Please try again.'

/** A slot frees up as soon as any scan in flight finishes, usually within seconds. */
const BUSY_RETRY_AFTER_SECONDS = 10
/** After NVIDIA rejects the key, /api/health reports scanning as off for this long. */
const KEY_REJECTED_MS = 10 * 60_000

export const ERROR_STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  bad_request: 400,
  unsupported_image: 415,
  image_too_large: 413,
  not_a_bill: 422,
  unreadable: 422,
  not_configured: 503,
  upstream_auth: 502,
  rate_limited: 429,
  timeout: 504,
  upstream_error: 502,
}

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface AppOptions {
  /** Defaults to `console`. */
  logger?: Logger
  /** Clock for the rate limiter and timings (tests). */
  now?: () => number
}

const ScanRequestSchema = z.object({ image: z.string().min(1) })

function fail(c: Context, code: ApiErrorCode, overrides: { status?: ContentfulStatusCode; message?: string } = {}) {
  const body: ApiErrorBody = { error: { code, message: overrides.message ?? ERROR_MESSAGES[code] } }
  return c.json(body, overrides.status ?? ERROR_STATUS[code])
}

export function createApp(config: ServerConfig, options: AppOptions = {}): Hono {
  const log = options.logger ?? console
  const now = options.now ?? Date.now
  const redact = (text: string) => redactSecrets(text, config.apiKey)
  const app = new Hono()

  /** When NVIDIA last rejected the key; /api/health reports scanning as off for a while after (until a scan works again). */
  let keyRejectedAt: number | null = null
  const scanningAvailable = () => config.apiKey !== null && (keyRejectedAt === null || now() - keyRejectedAt >= KEY_REJECTED_MS)

  // API answers are per-request and may describe someone's bill: never cache them.
  app.use('/api/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })

  app.get('/api/health', (c) => {
    const body: HealthResponse = { ok: true, configured: scanningAvailable(), models: config.models }
    return c.json(body)
  })

  /** Behind an untrusted proxy every client shares the proxy's address: say so once, in the log. */
  let warnedAboutProxy = config.trustProxy > 0

  /**
   * Only our own page may spend the scan quota. A JSON body means a cross-site form can't
   * send one without a CORS preflight (which we never grant), and browsers label cross-site
   * fetches. Runs before the rate limiter, so these rejects cost the client nothing.
   */
  const ownPageOnly: MiddlewareHandler = async (c, next) => {
    if (c.req.header('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') {
      return fail(c, 'bad_request', { status: 403 })
    }
    if (!/^application\/json\b/i.test(c.req.header('content-type')?.trim() ?? '')) {
      return fail(c, 'bad_request', { status: 415 })
    }
    if (!warnedAboutProxy && c.req.header('x-forwarded-for')) {
      warnedAboutProxy = true
      log.warn(
        '[scan] Requests carry X-Forwarded-For but TRUST_PROXY=0, so clients are told apart by the connecting address: ' +
          'behind a proxy, they all share one scan limit. Set TRUST_PROXY=1 when running behind one proxy, e.g. Render/Fly/nginx.',
      )
    }
    await next()
  }

  app.post(
    '/api/scan',
    ownPageOnly,
    rateLimit(config.rateLimit, { now, keyFor: (c) => clientKey(c, config.trustProxy), onLimited: (c) => fail(c, 'rate_limited') }),
    concurrencyLimit(config.maxConcurrentScans, (c) => {
      c.header('Retry-After', String(BUSY_RETRY_AFTER_SECONDS))
      return fail(c, 'rate_limited', { message: SCANS_BUSY })
    }),
    bodyLimit({ maxSize: API_LIMITS.maxBodyBytes, onError: (c) => fail(c, 'image_too_large') }),
    async (c) => {
      let json: unknown
      try {
        json = await c.req.json()
      } catch {
        return fail(c, 'bad_request')
      }
      const request = ScanRequestSchema.safeParse(json)
      if (!request.success) return fail(c, 'bad_request')

      const image = inspectImage(request.data.image)
      if (!image.ok) return fail(c, image.code)
      if (config.apiKey === null) return fail(c, 'not_configured')

      const started = now()
      try {
        const result = await extractBill(config, image.dataUrl, {
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
          log.info(`[scan] no usable items · ${result.model} · ${elapsed} ms`)
          return fail(c, 'unreadable')
        }
        log.info(`[scan] ok · ${result.model} · ${scan.items.length} items · ${Math.round(image.bytes / 1024)} KB · ${elapsed} ms`)
        return c.json(scan)
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error
        return upstreamFailure(c, error)
      }
    },
  )

  function upstreamFailure(c: Context, error: UpstreamError) {
    const summary = describeUpstream(error, redact)
    switch (error.kind) {
      case 'aborted':
        log.info('[scan] cancelled by the client')
        return fail(c, 'timeout', { status: 408 })
      case 'not_configured':
        return fail(c, 'not_configured')
      case 'auth':
        keyRejectedAt = now()
        log.error(`[scan] ${summary} — check NVIDIA_API_KEY. Photo scanning shows as off for the next ${KEY_REJECTED_MS / 60_000} minutes.`)
        return fail(c, 'upstream_auth')
      case 'rate_limited':
        log.warn(`[scan] ${summary}`)
        if (error.retryAfter !== null) c.header('Retry-After', String(Math.max(1, error.retryAfter)))
        return fail(c, 'rate_limited', { message: UPSTREAM_BUSY })
      case 'timeout':
        log.error(`[scan] ${summary}`)
        return fail(c, 'timeout')
      case 'bad_output':
        log.error(`[scan] ${summary}`)
        return fail(c, 'unreadable')
      case 'unavailable':
        log.error(`[scan] ${summary}${error.status === 404 ? ' — check the model ids in NVIDIA_MODEL' : ''}`)
        return fail(c, 'upstream_error')
    }
  }

  app.on(['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/api/scan', (c) => {
    c.header('Allow', 'POST')
    return fail(c, 'bad_request', { status: 405, message: 'Use POST to scan a bill.' })
  })
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
