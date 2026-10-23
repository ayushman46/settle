import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { silentLogger, testConfig } from './testing'
import { createWebApp, linkPagePreloads } from './web'

let clientDir: string
let app: ReturnType<typeof createWebApp>
const SHELL = '<!doctype html><html><head><title>Settle</title></head><body><div id="root"></div></body></html>'
const BIG_SCRIPT = `console.log(${JSON.stringify('x'.repeat(5000))});`
const PAGE_SCRIPT = `export const page = ${JSON.stringify('y'.repeat(4000))};`

beforeAll(() => {
  clientDir = mkdtempSync(join(tmpdir(), 'settle-web-'))
  mkdirSync(join(clientDir, 'assets'))
  writeFileSync(join(clientDir, 'index.html'), SHELL)
  writeFileSync(join(clientDir, 'assets', 'index-abc123.js'), BIG_SCRIPT)
  writeFileSync(join(clientDir, 'assets', 'page-def456.js'), PAGE_SCRIPT)
  writeFileSync(join(clientDir, 'assets', 'page-def456.js.br'), brotliCompressSync(PAGE_SCRIPT))
  writeFileSync(join(clientDir, 'sw.js.br'), brotliCompressSync('not served'))
  writeFileSync(join(clientDir, 'sw.js'), 'self.addEventListener("fetch", () => {})')
  writeFileSync(join(clientDir, 'manifest.webmanifest'), '{"name":"Settle"}')
  mkdirSync(join(clientDir, '.vite'))
  writeFileSync(join(clientDir, '.vite', 'manifest.json'), JSON.stringify(BUILD_MANIFEST))
  app = createWebApp(testConfig({ apiKey: null }), { clientDir, logger: silentLogger() })
})

/** A client build's manifest: the shell's entry, the pay page and what it imports (some shared). */
const BUILD_MANIFEST = {
  'index.html': { file: 'assets/index-abc123.js', isEntry: true, imports: ['_vendor-v1.js'], css: ['assets/index-c1.css'], dynamicImports: ['src/features/pay/PayPage.tsx'] },
  '_vendor-v1.js': { file: 'assets/vendor-v1.js' },
  'src/features/pay/PayPage.tsx': {
    file: 'assets/PayPage-p1.js',
    isDynamicEntry: true,
    imports: ['_vendor-v1.js', '_payLink-l1.js'],
    css: ['assets/PayPage-p1.css'],
  },
  '_payLink-l1.js': { file: 'assets/payLink-l1.js', css: ['assets/index-c1.css'] },
  // A name that could break the header is never sent.
  'src/features/pools/PoolPage.tsx': { file: 'assets/PoolPage.js\r\nSet-Cookie: x=1', isDynamicEntry: true },
}

afterAll(() => {
  rmSync(clientDir, { recursive: true, force: true })
})

describe('createWebApp', () => {
  it('serves the app shell at / with revalidation', async () => {
    const response = await app.request('/')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(await response.text()).toBe(SHELL)
  })

  it('sends a CSP that fits the client and other security headers', async () => {
    const response = await app.request('/')
    const csp = response.headers.get('content-security-policy') ?? ''
    for (const directive of [
      "default-src 'self'",
      "script-src 'self' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.razorpay.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "manifest-src 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive)
    }
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    const permissions = response.headers.get('permissions-policy') ?? ''
    expect(permissions).toContain('camera=(self)')
    expect(permissions).toContain('microphone=(self)')
    expect(permissions).toContain('payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")')
  })

  it('serves the claim and collection pages, and sends a share that missed the service worker to the paste screen', async () => {
    for (const path of ['/claim', '/claim/', '/pool', '/pool/']) expect((await app.request(path)).status, path).toBe(200)
    expect((await app.request('/claims')).status).toBe(404)
    const shared = await app.request('/share-target', { method: 'POST', body: new FormData() })
    expect(shared.status).toBe(303)
    expect(shared.headers.get('location')).toBe('/app/share?missed=1')
  })

  it('caches hashed assets forever and compresses them', async () => {
    const response = await app.request('/assets/index-abc123.js', { headers: { 'accept-encoding': 'gzip, br' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('content-encoding')).toBe('gzip')
    const plain = await new Response(response.body?.pipeThrough(new DecompressionStream('gzip'))).text()
    expect(plain).toBe(BIG_SCRIPT)
  })

  it("sends the build's brotli copy of an asset to browsers that take it, and gzip to the rest", async () => {
    const br = await app.request('/assets/page-def456.js', { headers: { 'accept-encoding': 'gzip, deflate, br, zstd' } })
    expect(br.status).toBe(200)
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(br.headers.get('content-type')).toMatch(/javascript/)
    expect(br.headers.get('vary')).toMatch(/accept-encoding/i)
    expect(br.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(br.headers.get('content-length')).toBe(String(brotliCompressSync(PAGE_SCRIPT).length))
    expect(brotliDecompressSync(Buffer.from(await br.arrayBuffer())).toString()).toBe(PAGE_SCRIPT)

    const gzip = await app.request('/assets/page-def456.js', { headers: { 'accept-encoding': 'gzip' } })
    expect(gzip.headers.get('content-encoding')).toBe('gzip')
    expect(await new Response(gzip.body?.pipeThrough(new DecompressionStream('gzip'))).text()).toBe(PAGE_SCRIPT)

    const plain = await app.request('/assets/page-def456.js')
    expect(plain.headers.get('content-encoding')).toBeNull()
    expect(await plain.text()).toBe(PAGE_SCRIPT)

    // No brotli copy (or not an asset): compressed on the fly as before; the .br itself is just a file.
    const noCopy = await app.request('/assets/index-abc123.js', { headers: { 'accept-encoding': 'br, gzip' } })
    expect(noCopy.headers.get('content-encoding')).toBe('gzip')
    const sw = await app.request('/sw.js', { headers: { 'accept-encoding': 'br' } })
    expect(sw.headers.get('content-encoding')).toBeNull()
    expect((await app.request('/assets/missing-000000.js', { headers: { 'accept-encoding': 'br' } })).status).toBe(404)
  })

  it("preloads a link page's own code and styles with the page, from the build manifest", async () => {
    const expected = '</assets/PayPage-p1.css>; rel=preload; as=style, </assets/PayPage-p1.js>; rel=modulepreload, </assets/payLink-l1.js>; rel=modulepreload'
    for (const path of ['/pay', '/pay/']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('link'), path).toBe(expected)
      expect(await response.text()).toBe(SHELL)
    }
    // Pages without their own chunk in the manifest (or with an unsafe name), and the app itself: as before.
    for (const path of ['/', '/app', '/claim', '/pool', '/privacy']) expect((await app.request(path)).headers.get('link'), path).toBeNull()
    expect(linkPagePreloads(join(clientDir, 'assets'))).toEqual(new Map())
    // The manifest itself stays private.
    expect((await app.request('/.vite/manifest.json')).status).toBe(404)
  })

  it('serves the service worker and manifest without long-term caching', async () => {
    const sw = await app.request('/sw.js')
    expect(sw.status).toBe(200)
    expect(sw.headers.get('cache-control')).toBe('no-cache')
    const manifest = await app.request('/manifest.webmanifest')
    expect(manifest.headers.get('content-type')).toBe('application/manifest+json')
  })

  it('serves the app shell for every app route', async () => {
    for (const path of ['/', '/app', '/app/', '/app/groups', '/app/groups/g_123/settle', '/app/split/new?from=describe', '/app/bill', '/pay', '/pay#j.eyJ2IjoxfQ', '/privacy', '/terms']) {
      const response = await app.request(path)
      expect(response.status, path).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^text\/html/)
      expect(await response.text()).toBe(SHELL)
    }
  })

  it('serves the shell for unknown pages too (the app shows its landing page), but as a 404', async () => {
    for (const path of ['/review', '/some/deep/link', '/apps', '/payments', '/app-store']) {
      const response = await app.request(path)
      expect(response.status, path).toBe(404)
      expect(response.headers.get('content-type')).toMatch(/^text\/html/)
      expect(response.headers.get('content-security-policy')).toBeTruthy()
      expect(await response.text()).toBe(SHELL)
    }
  })

  it('answers HEAD for pages', async () => {
    const response = await app.request('/', { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('404s missing files instead of serving HTML for them', async () => {
    for (const path of ['/assets/missing-123.js', '/favicon.ico', '/robots.txt']) {
      const response = await app.request(path)
      expect(response.status).toBe(404)
      expect(await response.text()).not.toContain('<html')
    }
  })

  it('refuses path traversal', async () => {
    for (const path of ['/%2e%2e/package.json', '/assets/..%2f..%2fpackage.json', '/..%5c..%5cpackage.json']) {
      const response = await app.request(path)
      expect(await response.text()).not.toContain('"dependencies"')
    }
  })

  it('serves the billing config through the web app', async () => {
    const response = await app.request('/api/billing/config')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ currency: 'INR', plans: [{ id: 'pro_monthly' }, { id: 'pro_yearly' }, { id: 'pro_lifetime' }] })
  })

  it('serves the API with JSON errors and no-store', async () => {
    const health = await app.request('/api/health')
    expect(health.status).toBe(200)
    expect(health.headers.get('cache-control')).toBe('no-store')
    expect(await health.json()).toMatchObject({ ok: true, configured: false })

    const missing = await app.request('/api/nope')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'bad_request' } })

    const scan = await app.request('/api/scan', { method: 'POST', body: '{"image": 1}', headers: { 'content-type': 'application/json' } })
    expect(scan.status).toBe(400)
    expect(scan.headers.get('content-security-policy')).toBeTruthy()
  })

  it('still answers when the client has not been built', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const bare = createWebApp(testConfig(), { clientDir: join(clientDir, 'does-not-exist'), logger: silentLogger() })
      expect((await bare.request('/')).status).toBe(404)
      expect((await bare.request('/unknown-page')).status).toBe(404)
      expect((await bare.request('/api/health')).status).toBe(200)
    } finally {
      consoleError.mockRestore()
    }
  })
})
