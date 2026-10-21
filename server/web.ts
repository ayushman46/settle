/**
 * The production web server: the API plus the built client (`dist/client`), with
 * security headers, compression, long-lived caching for hashed assets and the app's routes.
 */
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type MiddlewareHandler } from 'hono'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'
import { createApp, type AppOptions } from './app'
import type { ServerConfig } from './config'

export interface WebAppOptions extends AppOptions {
  /** Absolute path of the built client (the folder holding index.html). */
  clientDir: string
}

/** Razorpay Checkout: its script, the payment frame it opens, its API and telemetry, its logos. */
export const RAZORPAY_ORIGINS = {
  script: 'https://checkout.razorpay.com',
  frames: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
  connect: ['https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
  images: 'https://cdn.razorpay.com',
} as const

/**
 * What the client needs and nothing more: same-origin scripts, styles (plus inline style
 * attributes React sets), fonts (Vite may inline tiny ones as data: URIs), photo previews and
 * share cards from blob:/data: URLs, the web manifest, the service worker — and Razorpay
 * Checkout. `upi:` and WhatsApp links are navigations, which CSP doesn't restrict.
 */
export const CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  scriptSrc: ["'self'", RAZORPAY_ORIGINS.script],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:', RAZORPAY_ORIGINS.images],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'", ...RAZORPAY_ORIGINS.connect],
  mediaSrc: ["'self'", 'blob:'],
  manifestSrc: ["'self'"],
  workerSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: [...RAZORPAY_ORIGINS.frames],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
}

/**
 * Pages the client app renders: the landing page, the app (`/app/...`), friends' pay pages
 * and the legal pages. Anything else that isn't a file still gets the app shell (which shows
 * the landing page), but with a 404 so search engines don't index made-up URLs.
 */
export const APP_ROUTE = /^\/(?:app(?:\/.*)?|pay|privacy|terms)?\/?$/

const IMMUTABLE = 'public, max-age=31536000, immutable'
/** Paths that name a file ("/sw.js", "/assets/x.css") rather than an app route. */
const FILE_PATH = /\/[^/]*\.[a-z0-9]{1,8}$/i

/** Hashed build assets are cached forever; everything else (HTML, sw.js, manifest) revalidates. */
const cacheHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  if (c.req.path.startsWith('/api/') || c.res.headers.has('Cache-Control')) return
  const immutable = c.res.status === 200 && c.req.path.startsWith('/assets/')
  c.header('Cache-Control', immutable ? IMMUTABLE : 'no-cache')
}

export function createWebApp(config: ServerConfig, { clientDir, ...appOptions }: WebAppOptions): Hono {
  const app = new Hono()

  app.use(
    secureHeaders({
      contentSecurityPolicy: CONTENT_SECURITY_POLICY,
      xFrameOptions: 'DENY',
      permissionsPolicy: { camera: ['self'], microphone: [], geolocation: [], payment: ['self', ...RAZORPAY_ORIGINS.frames], usb: [] },
    }),
  )
  app.use(compress())
  app.use(cacheHeaders)

  app.route('/', createApp(config, appOptions))

  app.use('*', serveStatic({ root: clientDir }))
  // App routes get the app shell. Missing files stay 404s, so a stale script URL never
  // receives HTML (which the service worker could then cache).
  const shell = serveStatic({ root: clientDir, path: 'index.html' })
  app.get('*', async (c, next) => {
    if (FILE_PATH.test(c.req.path)) return next()
    if (APP_ROUTE.test(c.req.path)) return shell(c, next)
    const response = await shell(c, async () => {})
    if (!(response instanceof Response) || response.status !== 200) return next()
    return new Response(response.body, { status: 404, headers: response.headers })
  })

  app.notFound((c) => c.text('Not found', 404))
  app.onError((error, c) => {
    console.error(`[web] ${c.req.method} ${c.req.path} failed:`, error)
    return c.text('Something went wrong.', 500)
  })
  return app
}
