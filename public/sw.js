/*
 * Settle service worker: lets the app open offline after one visit (splitting, groups, people,
 * activity and the sample bill all work without a connection; AI, pay-link previews and checkout
 * need the network).
 *
 * - Page loads: network first (always the latest deploy), falling back to the cached app shell.
 *   Every page — `/`, `/app/...` (the installed app starts at `/app`), `/pay#...`, `/privacy`,
 *   `/terms` — is the same single-page shell, so one cached copy opens any of them offline.
 * - /assets/* (hashed, immutable build files, including each screen's code-split chunk — the app
 *   preloads the main ones while idle): stale-while-revalidate.
 * - /api/*: never touched — AI, billing and health checks always go to the server.
 * - POST /share-target (Android's share sheet, see the manifest's share_target): the shared text
 *   and files are kept in the `settle-share` cache for an hour and the app opens /app/share?k=<id>
 *   to read them (src/lib/sharedPayload.ts).
 *
 * It fails open: Cache Storage can be broken or full (damaged profiles, quota, some private
 * modes), so every cache step is best effort, cache writes never hold up a response, and if
 * anything here throws the request simply goes to the network.
 *
 * Registered from src/main.tsx in production builds only. Bump VERSION to drop old caches.
 */
const VERSION = 'v4'
const SHELL_CACHE = `settle-shell-${VERSION}`
const ASSET_CACHE = `settle-assets-${VERSION}`
/** Things shared into Settle, waiting for the app to read them (kept across worker versions). */
const SHARE_CACHE = 'settle-share'
const SHARE_PATH = '/share-target'
/** A shared title, text or link longer than this is cut. */
const MAX_SHARED_TEXT = 64 * 1024
/** Files kept from one share: how many, each, and all together. */
const MAX_SHARED_FILES = 4
const MAX_SHARED_FILE_BYTES = 15 * 1024 * 1024
const MAX_SHARED_TOTAL_BYTES = 30 * 1024 * 1024
/** A share nobody picked up is dropped after an hour. */
const SHARE_TTL_MS = 60 * 60 * 1000
/** Caches this worker manages (older ones, including BillSplit's, are dropped on activate). */
const CACHE_PREFIXES = ['settle-', 'billsplit-']
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
/** Old builds' assets are trimmed beyond this many entries (oldest first): room for a whole code-split build and then some. */
const MAX_ASSETS = 160
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

/** Last resort when there is no network and nothing cached yet (in the app's colours, light or dark). */
function offlinePage() {
  const html =
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark">' +
    '<title>You’re offline · Settle</title>' +
    '<style>body{margin:0;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;' +
    'font:16px/1.5 system-ui,sans-serif;text-align:center;background:#F5F6F8;color:#0E1013}' +
    'h1{font-size:22px;margin:0 0 8px}p{margin:0;color:#4B515A}' +
    '@media (prefers-color-scheme:dark){body{background:#0B0C0E;color:#F3F5F7}p{color:#A9B0BA}}</style>' +
    '<body><main><h1>You’re offline</h1>' +
    '<p>Connect to the internet and open Settle again.</p></main></body></html>'
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

/** 12 random base64url characters (9 bytes). */
function shareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_')
}

function clip(value) {
  return typeof value === 'string' ? value.slice(0, MAX_SHARED_TEXT) : ''
}

/** Drops shares older than an hour (nobody came back for them). */
async function dropOldShares(cache, now) {
  for (const request of await cache.keys()) {
    const response = await cache.match(request)
    const at = Number(response && response.headers.get('X-Stored-At'))
    if (!(now - at < SHARE_TTL_MS)) await cache.delete(request)
  }
}

/**
 * Keeps what another app shared (title, text, link and up to 4 files) and opens the app on it.
 * Anything going wrong still opens the app, on the paste screen with a note.
 */
async function receiveShare(request) {
  const missed = new URL('/app/share?missed=1', self.location.origin).href
  try {
    const form = await request.formData()
    const id = shareId()
    const now = Date.now()
    const cache = await caches.open(SHARE_CACHE)
    await dropOldShares(cache, now).catch(() => undefined)
    let total = 0
    let count = 0
    let images = 0
    for (const file of form.getAll('media')) {
      if (count >= MAX_SHARED_FILES || typeof file === 'string') continue
      if (file.size > MAX_SHARED_FILE_BYTES || total + file.size > MAX_SHARED_TOTAL_BYTES) continue
      total += file.size
      const headers = { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'shared'), 'X-Stored-At': String(now) }
      await cache.put(`${SHARE_PATH}/${id}/file-${count}`, new Response(file, { headers }))
      if (String(file.type).startsWith('image/')) images++
      count++
    }
    const meta = { title: clip(form.get('title')), text: clip(form.get('text')), url: clip(form.get('url')), files: count }
    await cache.put(`${SHARE_PATH}/${id}/meta`, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json', 'X-Stored-At': String(now) } }))
    // A screenshot on its own is a payment to check (Paid? Drop the screenshot); anything else is the paste-and-split screen.
    const onlyScreenshots = images > 0 && images === count && !meta.title && !meta.text && !meta.url
    const opens = onlyScreenshots ? `/app/proof?k=${id}` : `/app/share?k=${id}`
    return Response.redirect(new URL(opens, self.location.origin).href, 303)
  } catch {
    return Response.redirect(missed, 303)
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
        const keep = new Set([SHELL_CACHE, ASSET_CACHE, SHARE_CACHE])
        const names = await caches.keys()
        const ours = (name) => CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))
        await Promise.all(names.filter((name) => ours(name) && !keep.has(name)).map((name) => caches.delete(name)))
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
  if (request.method === 'POST' && new URL(request.url).pathname === SHARE_PATH) {
    event.respondWith(receiveShare(request))
    return
  }
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
