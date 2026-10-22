/**
 * Cloudflare Pages serves the built app itself, so the headers and routes the Node server gives
 * it (web.ts) are restated in public/_headers and public/_redirects. These tests keep the two
 * deployments identical: change one without the other and they fail.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[path]]'
import { silentLogger, testConfig } from './testing'
import { APP_ROUTE, createWebApp } from './web'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

/** `_headers`: a path pattern line, then indented `Name: value` lines. */
function parseHeaders(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = new Map()
      rules.set(line.trim(), current)
      continue
    }
    const header = /^\s+([A-Za-z0-9-]+):\s*(.*)$/.exec(line)
    if (!header || current === null) throw new Error(`Unreadable _headers line: ${line}`)
    current.set((header[1] ?? '').toLowerCase(), (header[2] ?? '').trim())
  }
  return rules
}

interface Redirect {
  from: string
  to: string
  status: number
}

function parseRedirects(text: string): Redirect[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
    .map((line) => {
      const [from = '', to = '', status = '302'] = line.trim().split(/\s+/)
      return { from, to, status: Number(status) }
    })
}

/** Cloudflare's matching: `*` is a splat (anything, including slashes), `:name` one segment. */
function matches(pattern: string, path: string): boolean {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => (part === '*' ? '.*' : part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${source}$`).test(path)
}

/** Headers that describe one response rather than the site's policy. */
const PER_RESPONSE = new Set(['cache-control', 'content-type', 'content-length', 'content-encoding', 'last-modified', 'etag', 'vary', 'date'])

let clientDir: string
let web: ReturnType<typeof createWebApp>

beforeAll(() => {
  clientDir = mkdtempSync(join(tmpdir(), 'settle-pages-'))
  mkdirSync(join(clientDir, 'assets'))
  writeFileSync(join(clientDir, 'index.html'), '<!doctype html><title>Settle</title><div id="root"></div>')
  writeFileSync(join(clientDir, 'assets', 'index-abc123.js'), 'console.log(1)')
  web = createWebApp(testConfig({ apiKey: null }), { clientDir, logger: silentLogger() })
})

afterAll(() => {
  rmSync(clientDir, { recursive: true, force: true })
})

describe('public/_headers', () => {
  const rules = parseHeaders(read('../public/_headers'))
  const site = rules.get('/*') ?? new Map<string, string>()

  it('has a rule for every page and one for hashed assets', () => {
    expect([...rules.keys()]).toEqual(['/*', '/assets/*'])
  })

  it('sends exactly the security headers the Node server sends', async () => {
    const response = await web.request('/app')
    const server = new Map<string, string>()
    for (const [name, value] of response.headers) if (!PER_RESPONSE.has(name)) server.set(name, value)
    expect(server.size).toBeGreaterThan(10)
    expect(Object.fromEntries(site)).toEqual(Object.fromEntries(server))
  })

  it('caches hashed assets like the Node server, and leaves pages to revalidate', async () => {
    const asset = await web.request('/assets/index-abc123.js')
    expect(asset.status).toBe(200)
    expect(rules.get('/assets/*')?.get('cache-control')).toBe(asset.headers.get('cache-control'))
    // One Cache-Control per path: Pages joins repeated headers with commas.
    expect(site.has('cache-control')).toBe(false)
  })
})

describe('public/_redirects', () => {
  const redirects = parseRedirects(read('../public/_redirects'))
  const rewrite = (path: string) => redirects.find((rule) => matches(rule.from, path)) ?? null

  it('only rewrites to the shell at "/" (Pages turns "/index.html" into a redirect)', () => {
    expect(redirects.length).toBeGreaterThan(0)
    for (const rule of redirects) expect(rule, rule.from).toMatchObject({ to: '/', status: 200 })
  })

  it.each(['/app', '/app/', '/app/welcome', '/app/groups/abc/settle', '/app/expense/x-1', '/pay', '/pay/', '/privacy', '/privacy/', '/terms', '/terms/'])(
    'serves the shell at %s, like the Node server',
    (path) => {
      expect(APP_ROUTE.test(path)).toBe(true)
      expect(rewrite(path), path).not.toBeNull()
    },
  )

  it.each(['/', '/foo', '/payment', '/apps', '/assets/index-abc123.js', '/assets/missing.js', '/sw.js', '/api/health', '/privacy-policy'])(
    'leaves %s to the files (or a 404)',
    (path) => {
      expect(rewrite(path), path).toBeNull()
    },
  )

  it('agrees with APP_ROUTE on every path it rewrites', () => {
    for (const rule of redirects) {
      const sample = rule.from.replace('*', 'some/screen')
      expect(APP_ROUTE.test(sample), sample).toBe(true)
    }
  })

  it('puts exact paths before the splat (faster on Pages)', () => {
    const firstSplat = redirects.findIndex((rule) => /[*:]/.test(rule.from))
    expect(redirects.slice(firstSplat).every((rule) => /[*:]/.test(rule.from))).toBe(true)
  })
})

describe('functions/api/[[path]].ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hands /api/* to the edge proxy with the project settings', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, configured: true, models: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequest({
      request: new Request('https://settle.pages.dev/api/health', { headers: { 'cf-connecting-ip': '203.0.113.9' } }),
      env: { API_ORIGIN: 'https://settle-api.onrender.com', PROXY_SECRET: 'a-proxy-secret-of-enough-length' },
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toBe('https://settle-api.onrender.com/api/health')
    expect(new Headers(init.headers).get('x-forwarded-for')).toBe('203.0.113.9')
  })

  it('explains itself when API_ORIGIN is not set', async () => {
    const response = await onRequest({ request: new Request('https://settle.pages.dev/api/health'), env: {} })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: { code: 'not_configured' } })
  })
})
