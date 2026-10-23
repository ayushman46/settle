/**
 * The production web server: the API plus the built client (`dist/client`), with
 * security headers, compression, long-lived caching for hashed assets and the app's routes.
 */
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
 * Pages the client app renders: the landing page, the app (`/app/...`), friends' pay, claim and
 * collection pages and the legal pages. Anything else that isn't a file still gets the app shell
 * (which shows the landing page), but with a 404 so search engines don't index made-up URLs.
 */
export const APP_ROUTE = /^\/(?:app(?:\/.*)?|pay|claim|pool|privacy|terms)?\/?$/

/**
 * Where Android's share sheet posts (manifest `share_target`). The service worker answers it; this
 * runs only when the worker isn't there yet (first visit, or it was cleared), and sends people to
 * the paste screen with a note that the shared text didn't come through.
 */
export const SHARE_TARGET_PATH = '/share-target'
export const SHARE_TARGET_MISSED = '/app/share?missed=1'

/** The screen each public link page shows, by its source module (as the Vite manifest names it). */
export const LINK_PAGE_MODULES: Readonly<Record<string, string>> = {
  '/pay': 'src/features/pay/PayPage.tsx',
  '/claim': 'src/features/claim/ClaimPage.tsx',
  '/pool': 'src/features/pools/PoolPage.tsx',
}

interface ManifestChunk {
  file?: unknown
  css?: unknown
  imports?: unknown
  isEntry?: unknown
}

/** A built asset path we're willing to put in a header ("assets/PayPage-AbC123.js"). */
const ASSET_FILE = /^assets\/[\w.-]+\.(?:js|css)$/

/**
 * `Link` preload headers for the link pages friends open from WhatsApp (`LINK_PAGE_MODULES`),
 * from the client build's manifest (`<clientDir>/.vite/manifest.json`). Without them the page's
 * own code and styles are only discovered once the app's main script has downloaded and run: a
 * whole extra round trip on a slow network before the friend sees their name. What the HTML
 * shell loads already (the entry and everything it imports) is left out. Empty without a
 * readable manifest (dev, tests), so pages are served exactly as before.
 */
export function linkPagePreloads(clientDir: string): Map<string, string> {
  const out = new Map<string, string>()
  let manifest: Record<string, ManifestChunk>
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(clientDir, '.vite', 'manifest.json'), 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return out
    manifest = parsed as Record<string, ManifestChunk>
  } catch {
    return out
  }
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  /** `key` and every chunk it imports statically (what loading it brings in). */
  const closure = (key: string, into: Set<string>): Set<string> => {
    if (into.has(key) || !Object.hasOwn(manifest, key)) return into
    into.add(key)
    for (const next of list(manifest[key]?.imports)) closure(next, into)
    return into
  }
  const inShell = new Set<string>()
  for (const [key, chunk] of Object.entries(manifest)) if (chunk?.isEntry === true) closure(key, inShell)
  const shellFiles = new Set<string>()
  for (const key of inShell) {
    const chunk = manifest[key]
    if (typeof chunk?.file === 'string') shellFiles.add(chunk.file)
    for (const css of list(chunk?.css)) shellFiles.add(css)
  }

  for (const [path, module] of Object.entries(LINK_PAGE_MODULES)) {
    const links = new Set<string>()
    for (const key of closure(module, new Set())) {
      if (inShell.has(key)) continue
      const { file, css } = manifest[key] ?? {}
      for (const style of list(css)) if (ASSET_FILE.test(style) && !shellFiles.has(style)) links.add(`</${style}>; rel=preload; as=style`)
      if (typeof file === 'string' && ASSET_FILE.test(file)) links.add(`</${file}>; rel=modulepreload`)
    }
    if (links.size > 0) out.set(path, [...links].join(', '))
  }
  return out
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
      // The microphone is for "Speak to split" (this origin only; the browser still asks).
      permissionsPolicy: { camera: ['self'], microphone: ['self'], geolocation: [], payment: ['self', ...RAZORPAY_ORIGINS.frames], usb: [] },
    }),
  )
  app.use(compress())
  app.use(cacheHeaders)

  app.route('/', createApp(config, appOptions))
  app.post(SHARE_TARGET_PATH, (c) => c.redirect(SHARE_TARGET_MISSED, 303))

  // The build manifest is for this server (`linkPagePreloads`), not for the web.
  app.get('/.vite/*', (c) => c.notFound())
  // Hashed assets: the build's brotli copy (vite.config.ts `precompress`) when the browser takes
  // it, else gzip made on the fly by `compress` above.
  app.use('/assets/*', serveStatic({ root: clientDir, precompressed: true }))
  app.use('*', serveStatic({ root: clientDir }))
  // App routes get the app shell. Missing files stay 404s, so a stale script URL never
  // receives HTML (which the service worker could then cache).
  const shell = serveStatic({ root: clientDir, path: 'index.html' })
  const preloads = linkPagePreloads(clientDir)
  app.get('*', async (c, next) => {
    if (FILE_PATH.test(c.req.path)) return next()
    if (APP_ROUTE.test(c.req.path)) {
      const link = preloads.get(c.req.path.replace(/\/+$/, ''))
      if (link) c.header('Link', link)
      return shell(c, next)
    }
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
