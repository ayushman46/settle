#!/usr/bin/env node
/**
 * The web server Playwright starts: Settle built exactly as `npm run build` builds it, served by
 * the production Node server exactly as Render runs it (`node dist/server/index.js`).
 *
 * It builds into .e2e-build/ — never dist/, which the benchmarks own — and skips the build when
 * nothing it is made from has changed since the last one (E2E_REBUILD=1 forces one).
 *
 *   node e2e/support/serve.mjs [--port 4121] [--build-only]
 *
 * The server gets a clean environment: no NVIDIA or Razorpay keys (tests mock /api/* in the
 * browser, so nothing reaches either service), no .env (it runs from the build folder), and a
 * fixed test-only license key (see license.ts) so redeem codes signed by tests verify.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, createPrivateKey } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, '.e2e-build')
const STAMP = join(OUT, '.built')
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
/** What the build is made from. */
const SOURCES = ['src', 'server', 'shared', 'public', 'index.html', 'vite.config.ts', 'package-lock.json']

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : (args[at + 1] ?? fallback)
}
const port = Number(option('--port', process.env.E2E_PORT ?? '4121'))

/** Newest modification time under `path` (files and folders), skipping tests. */
function newest(path) {
  if (!existsSync(path)) return 0
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.mtimeMs
  let latest = stat.mtimeMs
  for (const entry of readdirSync(path)) {
    if (/\.test\.tsx?$/.test(entry)) continue
    latest = Math.max(latest, newest(join(path, entry)))
  }
  return latest
}

function upToDate() {
  if (process.env.E2E_REBUILD === '1' || !existsSync(STAMP) || !existsSync(join(OUT, 'client', 'index.html'))) return false
  const built = statSync(STAMP).mtimeMs
  return SOURCES.every((source) => newest(join(ROOT, source)) < built)
}

function vite(...viteArgs) {
  const result = spawnSync(process.execPath, [VITE, ...viteArgs], { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`[e2e] vite ${viteArgs.join(' ')} failed`)
    process.exit(result.status ?? 1)
  }
}

function build() {
  if (upToDate()) {
    console.log('[e2e] .e2e-build is up to date')
    return
  }
  console.log('[e2e] building the client and server into .e2e-build/ …')
  const started = Date.now()
  vite('build', '--outDir', join(OUT, 'client'), '--emptyOutDir', '--logLevel', 'warn')
  vite('build', '--ssr', 'server/index.ts', '--outDir', join(OUT, 'server'), '--emptyOutDir', '--logLevel', 'warn')
  mkdirSync(OUT, { recursive: true })
  writeFileSync(STAMP, new Date().toISOString())
  console.log(`[e2e] built in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

/** The test-only license key (mirrors e2e/support/license.ts). Never used outside tests. */
function testLicenseKey() {
  const seed = createHash('sha256').update('settle-e2e-test-license-key').digest()
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed])
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }).export({ format: 'der', type: 'pkcs8' }).toString('base64')
}

function serve() {
  const env = { ...process.env }
  for (const name of Object.keys(env)) {
    if (/^(NVIDIA_|RAZORPAY_|LICENSE_|PRO_|RATE_LIMIT_|BILLING_|TRUST_PROXY|PROXY_SECRET|MAX_CONCURRENT)/.test(name)) delete env[name]
  }
  Object.assign(env, {
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: '127.0.0.1',
    LICENSE_PRIVATE_KEY: testLicenseKey(),
    // Tests hammer the mocked AI from one address; the real limits have their own unit tests.
    RATE_LIMIT_MAX: '0',
    BILLING_RATE_LIMIT_MAX: '0',
  })
  // From the build folder, so the server never reads the developer's .env (with real keys).
  const child = spawn(process.execPath, [join(OUT, 'server', 'index.js')], { cwd: OUT, env, stdio: 'inherit' })
  const stop = (signal) => {
    if (!child.killed) child.kill(signal)
  }
  process.on('SIGINT', () => stop('SIGINT'))
  process.on('SIGTERM', () => stop('SIGTERM'))
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
}

build()
if (!flag('--build-only')) serve()
