import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { silentLogger, testConfig } from './testing'
import { createWebApp } from './web'

let clientDir: string
let app: ReturnType<typeof createWebApp>
const SHELL = '<!doctype html><html><head><title>BillSplit</title></head><body><div id="root"></div></body></html>'
const BIG_SCRIPT = `console.log(${JSON.stringify('x'.repeat(5000))});`

beforeAll(() => {
  clientDir = mkdtempSync(join(tmpdir(), 'billsplit-web-'))
  mkdirSync(join(clientDir, 'assets'))
  writeFileSync(join(clientDir, 'index.html'), SHELL)
  writeFileSync(join(clientDir, 'assets', 'index-abc123.js'), BIG_SCRIPT)
  writeFileSync(join(clientDir, 'sw.js'), 'self.addEventListener("fetch", () => {})')
  writeFileSync(join(clientDir, 'manifest.webmanifest'), '{"name":"BillSplit"}')
  app = createWebApp(testConfig({ apiKey: null }), { clientDir, logger: silentLogger() })
})

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
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ]) {
      expect(csp).toContain(directive)
    }
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('permissions-policy')).toContain('camera=(self)')
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

  it('serves the service worker and manifest without long-term caching', async () => {
    const sw = await app.request('/sw.js')
    expect(sw.status).toBe(200)
    expect(sw.headers.get('cache-control')).toBe('no-cache')
    const manifest = await app.request('/manifest.webmanifest')
    expect(manifest.headers.get('content-type')).toBe('application/manifest+json')
  })

  it('falls back to the app shell for client routes', async () => {
    for (const path of ['/review', '/some/deep/link', '/split?id=1']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
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
      expect((await bare.request('/api/health')).status).toBe(200)
    } finally {
      consoleError.mockRestore()
    }
  })
})
