/**
 * The production web server: the API plus the built client (`dist/client`), with
 * security headers, compression, long-lived caching for hashed assets and an SPA fallback.
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

/**
 * What the client needs and nothing more: same-origin scripts, styles (plus inline style
 * attributes React sets), fonts (Vite may inline tiny ones as data: URIs), photo previews
 * from blob:/data: URLs, the web manifest and the service worker. `upi:` links are
 * navigations, which CSP doesn't restrict.
 */
export const CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  mediaSrc: ["'self'", 'blob:'],
  manifestSrc: ["'self'"],
  workerSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
}

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
      permissionsPolicy: { camera: ['self'], microphone: [], geolocation: [], payment: [], usb: [] },
    }),
  )
  app.use(compress())
  app.use(cacheHeaders)

  app.route('/', createApp(config, appOptions))

  app.use('*', serveStatic({ root: clientDir }))
  // SPA fallback: any other page URL gets the app shell. Missing files stay 404s, so a
  // stale script URL never receives HTML (which the service worker could then cache).
  const shell = serveStatic({ root: clientDir, path: 'index.html' })
  app.get('*', async (c, next) => (FILE_PATH.test(c.req.path) ? next() : shell(c, next)))

  app.notFound((c) => c.text('Not found', 404))
  app.onError((error, c) => {
    console.error(`[web] ${c.req.method} ${c.req.path} failed:`, error)
    return c.text('Something went wrong.', 500)
  })
  return app
}
