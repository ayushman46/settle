#!/usr/bin/env node
/**
 * Builds Settle for Vercel (`npm run build:vercel`, run by Vercel itself — see vercel.json) as a
 * Build Output API v3 folder, so what is deployed is exactly what this script makes:
 *
 *   .vercel/output/static/              the client build (no .br copies: Vercel compresses itself)
 *   .vercel/output/functions/api.func/  the API (server/vercel.ts) bundled into one index.mjs
 *   .vercel/output/config.json          routes: the same security headers as public/_headers,
 *                                       app routes → the shell, link pages preloading their own
 *                                       code, missing files → a real 404, /api/* → the function
 *
 *   node scripts/vercel-build.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, '.vercel', 'output')
const STATIC = join(OUTPUT, 'static')
const FUNC = join(OUTPUT, 'functions', 'api.func')
const CLIENT = join(ROOT, 'dist', 'client')
/** Longest a scan may take on the server (SCAN_BUDGET_MS is 80 s), with room to answer. */
const MAX_DURATION_S = 90

function fail(message) {
  console.error(`[vercel-build] ${message}`)
  process.exit(1)
}

// Vercel compresses responses itself; the precompress plugin skips its .br copies when it sees this.
process.env.VERCEL ??= '1'
rmSync(OUTPUT, { recursive: true, force: true })

// 1. The client.
await build({ root: ROOT, logLevel: 'warn' })
if (!existsSync(join(CLIENT, 'index.html'))) fail('The client build has no index.html.')

// 2. The API: one self-contained ES module (dependencies bundled, Node built-ins left out).
await build({
  root: ROOT,
  logLevel: 'warn',
  ssr: { noExternal: true },
  build: {
    ssr: 'server/vercel.ts',
    outDir: FUNC,
    emptyOutDir: true,
    manifest: false,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'index.mjs', codeSplitting: false } },
  },
})
writeFileSync(
  join(FUNC, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: MAX_DURATION_S }, null, 2),
)
writeFileSync(join(FUNC, 'package.json'), JSON.stringify({ type: 'module' }))

// 3. Headers and routes, from the same sources the other hosts use.
const api = await import(pathToFileURL(join(FUNC, 'index.mjs')).href)
const preloads = api.linkPagePreloads(CLIENT)

/** `public/_headers` blocks → { "/*": {name: value}, "/assets/*": {...} }. */
function readHeaders(file) {
  const blocks = {}
  let current = null
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = blocks[line.trim()] = {}
      continue
    }
    const at = line.indexOf(':')
    if (current && at > 0) current[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return blocks
}
const headers = readHeaders(join(ROOT, 'public', '_headers'))
if (!headers['/*']?.['Content-Security-Policy'] || !headers['/assets/*']?.['Cache-Control']) fail('public/_headers is missing its "/*" or "/assets/*" block.')

/** Same as server/web.ts APP_ROUTE. */
const APP_ROUTE = '^/(?:app(?:/.*)?|pay|claim|pool|privacy|terms)?/?$'
const linkRoutes = [...preloads].map(([path, link]) => ({ src: `^${path}/?$`, dest: '/index.html', headers: { Link: link } }))

const config = {
  version: 3,
  routes: [
    { src: '^/.*$', headers: headers['/*'], continue: true },
    { src: '^/api(?:/.*)?$', dest: '/api' },
    // Android's share sheet before the service worker is installed (server/web.ts does the same).
    { src: `^${api.SHARE_TARGET_PATH}/?$`, methods: ['POST'], status: 303, headers: { Location: api.SHARE_TARGET_MISSED } },
    { src: '^/assets/.*$', headers: headers['/assets/*'], continue: true },
    { handle: 'filesystem' },
    ...linkRoutes,
    { src: APP_ROUTE, dest: '/index.html' },
    { src: '^/.*$', dest: '/404.html', status: 404 },
  ],
}

// 4. The static folder: the client build, minus the build manifest and the other hosts' files.
mkdirSync(STATIC, { recursive: true })
cpSync(CLIENT, STATIC, { recursive: true })
for (const extra of ['.vite', '_headers', '_redirects']) rmSync(join(STATIC, extra), { recursive: true, force: true })
cpSync(join(STATIC, 'index.html'), join(STATIC, '404.html'))
writeFileSync(join(OUTPUT, 'config.json'), JSON.stringify(config, null, 2))

console.log(`[vercel-build] .vercel/output is ready: static app, /api function (${MAX_DURATION_S} s), ${preloads.size} link pages with preloads.`)
