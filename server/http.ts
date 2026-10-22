/**
 * What every API route shares: the error catalogue, the JSON error response, reading a JSON
 * body, and the guard that keeps other sites from spending our quotas.
 */
import type { Context, MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { API_LIMITS, type ApiErrorBody, type ApiErrorCode } from '../shared/api'
import { PROXY_SECRET_HEADER } from './edgeProxy'
import { fromTrustedEdge } from './ratelimit'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

const MAX_IMAGE_MB = Math.round(API_LIMITS.maxImageBytes / (1024 * 1024))

/**
 * What end users see by default (routes override the wording where it differs). Short, calm,
 * and always with a next step. Never operator hints (env vars, keys, files): those go to the log.
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  bad_request: 'Something went wrong sending the photo. Please try again.',
  unsupported_image: 'Please use a JPG or PNG photo.',
  image_too_large: `That photo is too large (over ${MAX_IMAGE_MB} MB). Try a smaller photo or a screenshot of it.`,
  not_a_bill: "That doesn't look like a bill. Try a clear photo of the full receipt.",
  unreadable: "We couldn't read any items. Try a clearer, well-lit photo — or enter them manually.",
  not_a_split: "That doesn't read like an expense — try 'Dinner 2400 with Riya and Sam'.",
  not_configured: "Photo scanning isn't available right now — you can type the items in.",
  upstream_auth: "Photo scanning isn't working right now — you can type the items in.",
  rate_limited: 'Too many scans right now. Try again in a few minutes — or type the items in.',
  timeout: 'Reading the bill took too long. Try again with a sharper, closer photo.',
  upstream_error: "Couldn't reach the AI service. Please try again.",
  billing_unavailable: "Checkout isn't set up yet — you can still redeem a code.",
}

export const ERROR_STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  bad_request: 400,
  unsupported_image: 415,
  image_too_large: 413,
  not_a_bill: 422,
  unreadable: 422,
  not_a_split: 422,
  not_configured: 503,
  upstream_auth: 502,
  rate_limited: 429,
  timeout: 504,
  upstream_error: 502,
  billing_unavailable: 503,
}

/** Route-specific wording for some codes. */
export type Messages = Partial<Record<ApiErrorCode, string>>

export interface FailOptions {
  status?: ContentfulStatusCode
  message?: string
}

/** The JSON error response every `/api/*` failure uses. */
export function fail(c: Context, code: ApiErrorCode, overrides: FailOptions = {}): Response {
  const body: ApiErrorBody = { error: { code, message: overrides.message ?? ERROR_MESSAGES[code] } }
  return c.json(body, overrides.status ?? ERROR_STATUS[code])
}

/** Marks a body that isn't JSON at all. */
export const NOT_JSON: unique symbol = Symbol('not json')

/** The request's JSON body, or `NOT_JSON`. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return (await c.req.json()) as unknown
  } catch {
    return NOT_JSON
  }
}

/**
 * Only our own page may spend the AI and billing quotas. A JSON body means a cross-site form
 * can't send one without a CORS preflight (which we never grant), and browsers label
 * cross-site fetches. Runs before the rate limiters, so these rejects cost the client nothing.
 * Also tells the operator, once each, when requests arrive through a proxy it doesn't trust, or
 * from the Cloudflare proxy with a different `PROXY_SECRET`.
 */
export function ownPageOnly(options: { trustProxy: number; proxySecret?: string | null; log: Logger }): MiddlewareHandler {
  const proxySecret = options.proxySecret ?? null
  let warnedAboutProxy = options.trustProxy > 0
  let warnedAboutSecret = false
  return async (c, next) => {
    if (c.req.header('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') {
      return fail(c, 'bad_request', { status: 403, message: 'Requests from other sites are not allowed.' })
    }
    if (!/^application\/json\b/i.test(c.req.header('content-type')?.trim() ?? '')) {
      return fail(c, 'bad_request', { status: 415, message: 'Please send JSON.' })
    }
    const viaEdge = fromTrustedEdge(c, proxySecret)
    if (!warnedAboutSecret && !viaEdge && c.req.header(PROXY_SECRET_HEADER)) {
      warnedAboutSecret = true
      options.log.warn(
        proxySecret === null
          ? '[api] Requests come through the Cloudflare proxy with a PROXY_SECRET, but this server has none: set the same PROXY_SECRET here so each visitor gets their own limits.'
          : "[api] Requests come through the Cloudflare proxy with a PROXY_SECRET that doesn't match this server's: set the same value in both places so each visitor gets their own limits.",
      )
    }
    if (!warnedAboutProxy && !viaEdge && c.req.header('x-forwarded-for')) {
      warnedAboutProxy = true
      options.log.warn(
        '[api] Requests carry X-Forwarded-For but TRUST_PROXY=0, so clients are told apart by the connecting address: ' +
          'behind a proxy, they all share one rate limit. Set TRUST_PROXY=1 when running behind one proxy, e.g. Render/Fly/nginx.',
      )
    }
    await next()
  }
}
