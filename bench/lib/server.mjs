/**
 * Runs the production server (`node <dist>/server/index.js`) on a bench port, exactly as
 * deployed: same compression, cache headers and static serving. Started from an empty working
 * directory so no local `.env` (API keys) is picked up.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { CACHE_DIR } from './paths.mjs'

export async function startServer({ dist, port }) {
  const entry = resolve(dist, 'server/index.js')
  if (!existsSync(entry)) throw new Error(`No production build at ${entry} — run \`npm run build\` first.`)
  const cwd = join(CACHE_DIR, 'server-cwd')
  mkdirSync(cwd, { recursive: true })
  const child = spawn(process.execPath, [entry], {
    cwd,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', NVIDIA_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let log = ''
  child.stdout.on('data', (chunk) => (log += chunk))
  child.stderr.on('data', (chunk) => (log += chunk))
  let exited = false
  child.on('exit', () => (exited = true))

  const origin = `http://127.0.0.1:${port}`
  // Up to a minute: on a machine busy with builds and tests, Node can take a while to start.
  for (let i = 0; i < 600; i++) {
    if (exited) throw new Error(`Server exited:\n${log}`)
    try {
      const res = await fetch(`${origin}/api/health`)
      if (res.ok) break
    } catch {
      await sleep(100)
    }
    if (i === 599) throw new Error(`Server did not start on ${port}:\n${log}`)
  }

  return {
    origin,
    log: () => log,
    async stop() {
      if (exited) return
      child.kill()
      for (let i = 0; i < 20 && !exited; i++) await sleep(100)
      if (!exited && process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/F', '/T'], { stdio: 'ignore' })
    },
  }
}
