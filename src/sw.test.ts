/**
 * The hand-written service worker (public/sw.js), run against a fake worker scope: precaching,
 * old-cache cleanup, the routing rules (network-first pages, stale-while-revalidate assets,
 * the API never touched), and failing open when Cache Storage misbehaves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import source from '../public/sw.js?raw'

const ORIGIN = 'https://billsplit.test'

const SHELL_HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-abc123.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-def456.js">
<link rel="stylesheet" crossorigin href="/assets/index-789xyz.css">
<link rel="icon" href="/icon.svg"></head><body><div id="root"></div></body></html>`

type Listener = (event: never) => void

/** A same-origin response as `fetch` would return it (`type: 'basic'`). */
function basic(body: string, contentType = 'text/javascript', status = 200): Response {
  const response = new Response(body, { status, headers: { 'Content-Type': contentType } })
  Object.defineProperty(response, 'type', { value: 'basic' })
  return response
}

function keyOf(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw, ORIGIN).href
}

/** Switches that make the fake Cache Storage fail the way real ones do (broken profile, full disk). */
const faults = { open: false, put: false }

class FakeCache {
  readonly entries = new Map<string, Response>()
  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(keyOf(request))?.clone()
  }
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    if (faults.put) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    const key = keyOf(request)
    this.entries.delete(key)
    this.entries.set(key, response)
  }
  async add(url: string): Promise<void> {
    const response = await fakeFetch(url)
    if (!response.ok) throw new TypeError(`Bad response for ${url}`)
    await this.put(url, response)
  }
  async keys(): Promise<Array<{ url: string }>> {
    return [...this.entries.keys()].map((url) => ({ url }))
  }
  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(keyOf(request))
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>()
  async open(name: string): Promise<FakeCache> {
    if (faults.open) throw new DOMException('Unexpected internal error.', 'UnknownError')
    let cache = this.stores.get(name)
    if (!cache) {
      cache = new FakeCache()
      this.stores.set(name, cache)
    }
    return cache
  }
  async keys(): Promise<string[]> {
    if (faults.open) throw new DOMException('Unexpected internal error.', 'UnknownError')
    return [...this.stores.keys()]
  }
  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name)
  }
  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    if (faults.open) throw new DOMException('Unexpected internal error.', 'UnknownError')
    for (const cache of this.stores.values()) {
      const hit = await cache.match(request)
      if (hit) return hit
    }
    return undefined
  }
}

/** What the "network" answers; `null` = offline. */
let network: ((url: string) => Response | Promise<Response>) | null = null
const fakeFetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  if (!network) throw new TypeError('Failed to fetch')
  return network(keyOf(input))
})

function online(routes: Record<string, () => Response>): void {
  network = (url) => {
    const route = routes[new URL(url).pathname]
    return route ? route() : basic('Not found', 'text/plain', 404)
  }
}

interface FakeFetchEvent {
  request: { url: string; method: string; mode: string }
  preloadResponse: Promise<Response | undefined>
  response: Promise<Response> | null
  waits: Array<Promise<unknown>>
  respondWith(response: Promise<Response>): void
  waitUntil(promise: Promise<unknown>): void
}

function boot() {
  const listeners = new Map<string, Listener>()
  const caches = new FakeCacheStorage()
  const scope = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    registration: { navigationPreload: { enable: vi.fn(async () => undefined) } },
  }
  new Function('self', 'caches', 'fetch', source)(scope, caches, fakeFetch)

  const lifecycle = async (type: 'install' | 'activate') => {
    const waits: Array<Promise<unknown>> = []
    listeners.get(type)?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) } as never)
    await Promise.all(waits)
  }

  const request = (path: string, init: { mode?: string; method?: string } = {}): FakeFetchEvent => {
    const event: FakeFetchEvent = {
      request: { url: new URL(path, ORIGIN).href, method: init.method ?? 'GET', mode: init.mode ?? 'cors' },
      preloadResponse: Promise.resolve(undefined),
      response: null,
      waits: [],
      respondWith(response) {
        this.response = response
      },
      waitUntil(promise) {
        this.waits.push(promise)
      },
    }
    listeners.get('fetch')?.(event as never)
    return event
  }

  /** Dispatches a fetch, waits for the answer and any background work. */
  const get = async (path: string, init?: { mode?: string; method?: string }) => {
    const event = request(path, init)
    const response = event.response ? await event.response : null
    await Promise.all(event.waits)
    return { event, response }
  }

  return { scope, caches, lifecycle, request, get }
}

afterEach(() => {
  network = null
  faults.open = false
  faults.put = false
  fakeFetch.mockClear()
  vi.useRealTimers()
})

const SHELL = 'billsplit-shell-v2'
const ASSETS = 'billsplit-assets-v2'

/** The deployed build: its shell and every file the shell loads. */
const BUILD = {
  '/': () => basic(SHELL_HTML, 'text/html; charset=utf-8'),
  '/assets/index-abc123.js': () => basic('app'),
  '/assets/vendor-def456.js': () => basic('vendor'),
  '/assets/index-789xyz.css': () => basic('css', 'text/css'),
}

describe('service worker', () => {
  it('precaches the app shell, its assets and the icon/manifest on install', async () => {
    online({
      '/': () => basic(SHELL_HTML, 'text/html; charset=utf-8'),
      '/assets/index-abc123.js': () => basic('app'),
      '/assets/vendor-def456.js': () => basic('vendor'),
      '/assets/index-789xyz.css': () => basic('css', 'text/css'),
      '/icon.svg': () => basic('<svg/>', 'image/svg+xml'),
      '/manifest.webmanifest': () => basic('{}', 'application/manifest+json'),
      '/apple-touch-icon.png': () => basic('png', 'image/png'),
      '/icon-192.png': () => basic('png', 'image/png'),
      '/icon-512.png': () => basic('png', 'image/png'),
      '/icon-maskable-512.png': () => basic('png', 'image/png'),
    })
    const sw = boot()
    await sw.lifecycle('install')

    expect(sw.scope.skipWaiting).toHaveBeenCalled()
    const shell = sw.caches.stores.get(SHELL)
    const assets = sw.caches.stores.get(ASSETS)
    expect([...(shell?.entries.keys() ?? [])].sort()).toEqual(
      [
        `${ORIGIN}/`,
        `${ORIGIN}/icon.svg`,
        `${ORIGIN}/manifest.webmanifest`,
        `${ORIGIN}/apple-touch-icon.png`,
        `${ORIGIN}/icon-192.png`,
        `${ORIGIN}/icon-512.png`,
        `${ORIGIN}/icon-maskable-512.png`,
      ].sort(),
    )
    expect([...(assets?.entries.keys() ?? [])].sort()).toEqual(
      [
        `${ORIGIN}/assets/index-789xyz.css`,
        `${ORIGIN}/assets/index-abc123.js`,
        `${ORIGIN}/assets/vendor-def456.js`,
      ].sort(),
    )
  })

  it('still installs when precaching fails (offline at install time)', async () => {
    const sw = boot()
    await expect(sw.lifecycle('install')).resolves.toBeUndefined()
    expect(sw.scope.skipWaiting).toHaveBeenCalled()
  })

  it('drops old BillSplit caches on activate, keeps others, and takes control', async () => {
    const sw = boot()
    await sw.caches.open('billsplit-shell-v1')
    await sw.caches.open('billsplit-assets-v1')
    await sw.caches.open(SHELL)
    await sw.caches.open('someone-else')
    await sw.lifecycle('activate')

    expect((await sw.caches.keys()).sort()).toEqual([SHELL, 'someone-else'].sort())
    expect(sw.scope.clients.claim).toHaveBeenCalled()
    expect(sw.scope.registration.navigationPreload.enable).toHaveBeenCalled()
  })

  it('never handles the API, other origins or non-GET requests', () => {
    const sw = boot()
    expect(sw.request('/api/scan', { method: 'POST' }).response).toBeNull()
    expect(sw.request('/api/health').response).toBeNull()
    expect(sw.request('https://fonts.example.com/font.woff2').response).toBeNull()
    expect(sw.request('/', { mode: 'navigate', method: 'POST' }).response).toBeNull()
  })

  it('loads pages from the network first and refreshes the cached shell', async () => {
    const sw = boot()
    const shell = await sw.caches.open(SHELL)
    await shell.put('/', basic('old shell', 'text/html'))
    online({ '/': () => basic('new shell', 'text/html'), '/people': () => basic('new shell', 'text/html') })

    const { response } = await sw.get('/people', { mode: 'navigate' })
    expect(await response?.text()).toBe('new shell')
    expect(await (await shell.match('/'))?.text()).toBe('new shell')
  })

  it('opens the cached shell offline, or a friendly page when there is none', async () => {
    const sw = boot()
    const first = await sw.get('/', { mode: 'navigate' })
    expect(first.response?.status).toBe(503)
    expect(await first.response?.text()).toContain('offline')

    await (await sw.caches.open(SHELL)).put('/', basic('cached shell', 'text/html'))
    const second = await sw.get('/review', { mode: 'navigate' })
    expect(await second.response?.text()).toBe('cached shell')
  })

  it('shows the cached shell when the network is crawling, then updates it', async () => {
    vi.useFakeTimers()
    const sw = boot()
    const shell = await sw.caches.open(SHELL)
    await shell.put('/', basic('cached shell', 'text/html'))
    let finish: (response: Response) => void = () => {}
    network = () => new Promise<Response>((resolve) => (finish = resolve))

    const event = sw.request('/', { mode: 'navigate' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(await (await event.response)?.text()).toBe('cached shell')

    finish(basic('fresh shell', 'text/html'))
    await Promise.all(event.waits)
    expect(await (await shell.match('/'))?.text()).toBe('fresh shell')
  })

  it('does not cache error pages as the shell', async () => {
    const sw = boot()
    online({ '/': () => basic('Server error', 'text/plain', 500) })
    const { response } = await sw.get('/', { mode: 'navigate' })
    expect(response?.status).toBe(500)
    expect(await (await sw.caches.open(SHELL)).match('/')).toBeUndefined()
  })

  it('serves assets stale-while-revalidate', async () => {
    const sw = boot()
    online({ '/assets/app.js': () => basic('v1') })
    const miss = await sw.get('/assets/app.js')
    expect(await miss.response?.text()).toBe('v1')

    online({ '/assets/app.js': () => basic('v2') })
    const hit = await sw.get('/assets/app.js')
    expect(await hit.response?.text()).toBe('v1') // instant, from the cache…
    const assets = await sw.caches.open(ASSETS)
    expect(await (await assets.match('/assets/app.js'))?.text()).toBe('v2') // …refreshed behind the scenes

    network = null
    const offline = await sw.get('/assets/app.js')
    expect(await offline.response?.text()).toBe('v2')
  })

  it('keeps the asset cache bounded', async () => {
    const sw = boot()
    network = () => basic('x')
    for (let i = 0; i < 85; i++) await sw.get(`/assets/chunk-${i}.js`)
    const assets = await sw.caches.open(ASSETS)
    const keys = await assets.keys()
    expect(keys).toHaveLength(80)
    expect(keys[0]?.url).toBe(`${ORIGIN}/assets/chunk-5.js`)
  })

  it('falls back to the installed copy of other files when offline', async () => {
    const sw = boot()
    await (await sw.caches.open(SHELL)).put('/icon.svg', basic('<svg/>', 'image/svg+xml'))
    const { response } = await sw.get('/icon.svg')
    expect(await response?.text()).toBe('<svg/>')
    await expect(sw.request('/robots.txt').response).rejects.toThrow()
  })

  it('stores a new shell together with the files it loads, so an offline launch after a deploy works', async () => {
    const sw = boot()
    online({ ...BUILD, '/people': BUILD['/'] })
    const { response } = await sw.get('/people', { mode: 'navigate' })
    expect(await response?.text()).toBe(SHELL_HTML)

    const assets = await sw.caches.open(ASSETS)
    expect([...assets.entries.keys()].sort()).toEqual(
      [`${ORIGIN}/assets/index-789xyz.css`, `${ORIGIN}/assets/index-abc123.js`, `${ORIGIN}/assets/vendor-def456.js`].sort(),
    )
    expect(await (await (await sw.caches.open(SHELL)).match('/'))?.text()).toBe(SHELL_HTML)

    // Already-cached files aren't downloaded again on the next visit.
    fakeFetch.mockClear()
    await sw.get('/', { mode: 'navigate' })
    expect(fakeFetch.mock.calls.map(([input]) => keyOf(input))).toEqual([`${ORIGIN}/`])
  })

  it('keeps the previous shell when the new one\'s files could not be cached', async () => {
    const sw = boot()
    await (await sw.caches.open(SHELL)).put('/', basic('old shell', 'text/html'))
    online({ '/': BUILD['/'], '/assets/index-abc123.js': BUILD['/assets/index-abc123.js'] }) // two files missing
    const { response } = await sw.get('/', { mode: 'navigate' })
    expect(await response?.text()).toBe(SHELL_HTML)
    expect(await (await (await sw.caches.open(SHELL)).match('/'))?.text()).toBe('old shell')
  })

  it('serves the cached app instead of a proxy\'s 5xx page', async () => {
    const sw = boot()
    await (await sw.caches.open(SHELL)).put('/', basic('cached shell', 'text/html'))
    for (const status of [500, 502, 503]) {
      online({ '/': () => basic(`<h1>${status} Bad Gateway</h1>`, 'text/html', status) })
      const { response } = await sw.get('/', { mode: 'navigate' })
      expect(response?.status).toBe(200)
      expect(await response?.text()).toBe('cached shell')
    }
    expect(await (await (await sw.caches.open(SHELL)).match('/'))?.text()).toBe('cached shell')
  })

  it('serves the cached app when an app route answers with something other than HTML, but not for files', async () => {
    const sw = boot()
    await (await sw.caches.open(SHELL)).put('/', basic('cached shell', 'text/html'))
    online({ '/review': () => basic('{"error":"upstream"}', 'application/json'), '/icon.svg': () => basic('<svg/>', 'image/svg+xml') })
    expect(await (await sw.get('/review', { mode: 'navigate' })).response?.text()).toBe('cached shell')
    expect(await (await sw.get('/icon.svg', { mode: 'navigate' })).response?.text()).toBe('<svg/>')
  })

  it('still loads pages and assets from the network when Cache Storage is broken', async () => {
    const sw = boot()
    faults.open = true
    online({ ...BUILD, '/assets/app.js': () => basic('app code') })

    const page = await sw.get('/', { mode: 'navigate' })
    expect(page.response?.status).toBe(200)
    expect(await page.response?.text()).toBe(SHELL_HTML)

    const asset = await sw.get('/assets/app.js')
    expect(asset.response?.status).toBe(200)
    expect(await asset.response?.text()).toBe('app code')
  })

  it('serves the page, not the offline screen, when storing it fails (e.g. the disk is full)', async () => {
    const sw = boot()
    faults.put = true
    online({ '/': () => basic('new shell', 'text/html'), '/assets/app.js': () => basic('app code') })

    const page = await sw.get('/', { mode: 'navigate' })
    expect(page.response?.status).toBe(200)
    expect(await page.response?.text()).toBe('new shell')
    expect(await (await sw.get('/assets/app.js')).response?.text()).toBe('app code')
  })

  it('still takes control on activate when Cache Storage is broken', async () => {
    const sw = boot()
    faults.open = true
    await expect(sw.lifecycle('activate')).resolves.toBeUndefined()
    expect(sw.scope.clients.claim).toHaveBeenCalled()
  })

  it('falls back to the network for other files when Cache Storage is broken', async () => {
    const sw = boot()
    faults.open = true
    online({ '/manifest.webmanifest': () => basic('{}', 'application/manifest+json') })
    expect(await (await sw.get('/manifest.webmanifest')).response?.text()).toBe('{}')
    network = null
    await expect(sw.request('/manifest.webmanifest').response).rejects.toThrow('Failed to fetch')
  })
})
