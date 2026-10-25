#!/usr/bin/env node
/**
 * Copies the server settings from your local `.env` to the linked Vercel project (Production),
 * then redeploys so they take effect: `npm run vercel:env`.
 *
 * - Only the variables the server reads (server/config.ts) are sent; anything else in `.env`
 *   (and `.env.local`, which holds Vercel's own login token) stays on your computer.
 * - Keys and private keys are stored as Vercel "Secret" variables (hidden in the dashboard).
 * - Values go to the Vercel CLI on stdin, never as command-line arguments, and are never printed.
 * - Existing values are overwritten (`--force`), so running it again after editing `.env` updates
 *   Vercel.
 *
 * Needs `npx vercel login` and `npx vercel link --project settle` first (DEPLOY.md).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = join(ROOT, '.env')

/** What the server reads, and how Vercel should store it. */
const VARIABLES = {
  NVIDIA_API_KEY: 'secret',
  NVIDIA_MODEL: 'config',
  NVIDIA_TEXT_MODEL: 'config',
  NVIDIA_BASE_URL: 'config',
  NVIDIA_TIMEOUT_MS: 'config',
  NVIDIA_TEXT_TIMEOUT_MS: 'config',
  LICENSE_PRIVATE_KEY: 'secret',
  LICENSE_PUBLIC_KEY: 'config',
  RAZORPAY_KEY_ID: 'config',
  RAZORPAY_KEY_SECRET: 'secret',
  PRO_PRICES: 'config',
  PRO_AI_PER_DAY: 'config',
  RATE_LIMIT_MAX: 'config',
  RATE_LIMIT_WINDOW_MS: 'config',
  BILLING_RATE_LIMIT_MAX: 'config',
  MAX_CONCURRENT_SCANS: 'config',
}

function vercel(args, input) {
  // `shell` so Windows finds npx.cmd; the arguments are fixed names, never values.
  return spawnSync('npx', ['vercel', ...args], { cwd: ROOT, input, encoding: 'utf8', shell: true })
}

if (!existsSync(ENV_FILE)) {
  console.error('[vercel-env] No .env file here. Copy .env.example to .env and fill it in first.')
  process.exit(1)
}
if (!existsSync(join(ROOT, '.vercel', 'project.json'))) {
  console.error('[vercel-env] This folder is not linked to Vercel yet: run `npx vercel link --project settle`.')
  process.exit(1)
}

const env = parseEnv(readFileSync(ENV_FILE, 'utf8'))
const toSend = Object.entries(VARIABLES).filter(([name]) => typeof env[name] === 'string' && env[name].trim() !== '')
if (toSend.length === 0) {
  console.error('[vercel-env] .env has none of the server settings (e.g. NVIDIA_API_KEY). Nothing sent.')
  process.exit(1)
}

if (process.argv.includes('--dry-run')) {
  for (const [name, type] of toSend) console.log(`[vercel-env] would set ${name} (${type}, ${env[name].trim().length} characters)`)
  process.exit(0)
}

let failed = 0
for (const [name, type] of toSend) {
  const result = vercel(['env', 'add', name, '--environment', 'production', type === 'secret' ? '--sensitive' : '--no-sensitive', '--force', '--yes'], env[name].trim())
  if (result.status === 0) {
    console.log(`[vercel-env] set ${name} (${type})`)
  } else {
    failed++
    // The CLI's own message, minus anything that could echo the value back.
    const reason = `${result.stderr ?? ''}`.split('\n').find((line) => /error|not|denied|invalid/i.test(line)) ?? `exit ${result.status}`
    console.error(`[vercel-env] could not set ${name}: ${reason.replace(env[name].trim(), '***').trim()}`)
  }
}
if (failed > 0) {
  console.error(`[vercel-env] ${failed} variable(s) not set; not redeploying. Fix the above and run it again.`)
  process.exit(1)
}

console.log('[vercel-env] Redeploying so the new settings take effect…')
const deploy = vercel(['deploy', '--prod', '--yes'])
const message = `${deploy.stdout ?? ''}${deploy.stderr ?? ''}`.match(/Production URL: (\S+)/)
if (deploy.status !== 0) {
  console.error('[vercel-env] The deploy failed; run `npx vercel deploy --prod` to see why.')
  process.exit(1)
}
console.log(`[vercel-env] Done. Live at ${message ? message[1].replace(/["',]+$/, '') : 'your production URL'} — check /api/health says "configured": true.`)
