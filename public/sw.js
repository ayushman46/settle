/*
 * BillSplit service worker: lets the app open offline after one visit (typing a bill in and the
 * sample work without a connection; scanning needs the network).
 *
 * - Page loads: network first (always the latest deploy), falling back to the cached app shell.
 * - /assets/* (hashed, immutable build files): stale-while-revalidate.
 * - /api/*: never touched — scans and health checks always go to the server.
 *
 * It fails open: Cache Storage can be broken or full (damaged profiles, quota, some private
 * modes), so every cache step is best effort, cache writes never hold up a response, and if
 * anything here throws the request simply goes to the network.
 *
 * Registered from src/main.tsx in production builds only. Bump VERSION to drop old caches.
 */
const VERSION = 'v2'
const SHELL_CACHE = `billsplit-shell-${VERSION}`
const ASSET_CACHE = `billsplit-assets-${VERSION}`
const SHELL_KEY = '/'
/** Small same-origin files kept for offline use (outside /assets/): the manifest and its icons. */
const EXTRAS = [
  '/icon.svg',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
]
/** Old builds' assets are trimmed beyond this many entries (oldest first). */
const MAX_ASSETS = 80
/** On a crawling connection, show the cached shell after this long instead of waiting. */
const NAVIGATION_TIMEOUT_MS = 4000
/** Paths that name a file ("/icon.svg") rather than an app route; mirrors server/web.ts. */
const FILE_PATH = /\/[^/]*\.[a-z0-9]{1,8}$/i

/** Asset URLs (scripts, styles, preloads) referenced by the app shell's HTML. */
function shellAssets(html) {
  const urls = new Set()
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) urls.add(match[1])
  return [...urls]
}

function isCacheable(response) {
  return response.status === 200 && response.type === 'basic' && !response.redirected
}

function isHtml(response) {
  return (response.headers.get('Content-Type') || '').includes('text/html')
}

/** A cached response, or undefined when there is none or Cache Storage fails. */
async function cached(cacheName, request) {
  try {
    const cache = await caches.open(cacheName)
    return (await cache.match(request)) || undefined
  } catch {
    return undefined
  }
}

async function trim(cache, max) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)))
}

/** Runs cache work in the background: it keeps the worker alive and never fails the request. */
function inBackground(event, work) {
  event.waitUntil(work.catch(() => undefined))
}

/** Last resort when there is no network and nothing cached yet. */
function offlinePage() {
  const html =
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>BillSplit</title>' +
    '<body style="margin:0;display:grid;place-items:center;min-height:100vh;font:16px/1.5 system-ui,sans-serif;background:#F5F3EE;color:#141413;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:22px;margin:0 0 8px">You’re offline</h1>' +
    '<p style="margin:0">Connect to the internet and open BillSplit again.</p></div></body></html>'
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/**
 * Keeps a fresh app shell for offline launches, but only once every file it loads is cached
 * too: a shell without its scripts would open to a blank page. Until then the previous shell
 * (with its own files) stays.
 */
async function saveShell(response) {
  const html = await response.clone().text()
  const assets = await caches.open(ASSET_CACHE)
  const stored = await Promise.all(
    shellAssets(html).map(async (url) => {
      if (await assets.match(url)) return true
      return assets.add(url).then(
        () => true,
        () => false,
      )
    }),
  )
  if (stored.includes(false)) return
  await (await caches.open(SHELL_CACHE)).put(SHELL_KEY, response)
  await trim(assets, MAX_ASSETS)
}

async function precache() {
  const response = await fetch(SHELL_KEY, { cache: 'no-cache' })
  if (isCacheable(response) && isHtml(response)) await saveShell(response)
  const shell = await caches.open(SHELL_CACHE)
  // Best effort: one missing file must not stop the rest (or the install).
  await Promise.all(EXTRAS.map((url) => shell.add(url).catch(() => undefined)))
}

/** A response that's clearly not our app: a proxy's 5xx page, or something other than HTML for an app route. */
function isBrokenPage(response, url) {
  return response.status >= 500 || (!isHtml(response) && !FILE_PATH.test(url.pathname))
}

async function networkFirst(event) {
  const network = (async () => (await event.preloadResponse) || fetch(event.request))()
  // Registered before anyone reads the response, so the clone is taken while the body is unread.
  inBackground(
    event,
    network.then((response) => (isCacheable(response) && isHtml(response) ? saveShell(response.clone()) : undefined)),
  )

  const shell = await cached(SHELL_CACHE, SHELL_KEY)
  if (!shell) return network.catch(() => offlinePage())

  let timer
  const slow = new Promise((resolve) => {
    timer = setTimeout(() => resolve(shell), NAVIGATION_TIMEOUT_MS)
  })
  try {
    const response = await Promise.race([network, slow])
    return response !== shell && isBrokenPage(response, new URL(event.request.url)) ? shell : response
  } catch {
    return shell
  } finally {
    clearTimeout(timer)
  }
}

async function staleWhileRevalidate(event) {
  const hit = await cached(ASSET_CACHE, event.request)
  const network = fetch(event.request)
  inBackground(
    event,
    network.then(async (response) => {
      if (!isCacheable(response)) return
      const copy = response.clone()
      const cache = await caches.open(ASSET_CACHE)
      await cache.put(event.request, copy)
      await trim(cache, MAX_ASSETS)
    }),
  )
  return hit || network
}

/** Anything else on this origin (icon, manifest): the network, else the copy kept at install. */
async function networkThenCache(request) {
  try {
    return await fetch(request)
  } catch (error) {
    let copy
    try {
      copy = await caches.match(request)
    } catch {
      // Cache Storage is unusable: report the network failure.
    }
    if (copy) return copy
    throw error
  }
}

self.addEventListener('install', (event) => {
  // Offline support is a bonus: a failed precache must not block the new worker.
  event.waitUntil(precache().catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keep = new Set([SHELL_CACHE, ASSET_CACHE])
        const names = await caches.keys()
        await Promise.all(
          names.filter((name) => name.startsWith('billsplit-') && !keep.has(name)).map((name) => caches.delete(name)),
        )
      } catch {
        // Old caches stay behind; taking control matters more.
      }
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => undefined)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event).catch(() => event.preloadResponse.then((response) => response || fetch(request))))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(event).catch(() => fetch(request)))
  } else {
    event.respondWith(networkThenCache(request))
  }
})
