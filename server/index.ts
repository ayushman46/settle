/**
 * Production entry point (`npm start` → `node dist/server/index.js`).
 * Serves the API and the built client from one Node process.
 */
import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, parsePort } from './config'
import { createWebApp } from './web'

try {
  process.loadEnvFile()
} catch {
  // No .env file: the real environment is all we have, which is fine (e.g. in Docker).
}

const config = loadConfig(process.env)
// The bundle lives in dist/server/, the client build in dist/client/.
const clientDir = fileURLToPath(new URL('../client', import.meta.url))
const port = parsePort(process.env.PORT)
const hostname = process.env.HOST?.trim() || undefined

if (!existsSync(join(clientDir, 'index.html'))) {
  console.warn(`[billsplit] No client build at ${clientDir} — run "npm run build". The API still works.`)
}
if (config.apiKey === null) {
  console.warn('[billsplit] NVIDIA_API_KEY is not set: photo scanning is off (manual entry still works).')
}

const app = createWebApp(config, { clientDir })
const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  const host = hostname && hostname !== '0.0.0.0' && hostname !== '::' ? hostname : 'localhost'
  console.log(`[billsplit] Ready on http://${host}:${info.port} · models: ${config.models.join(', ')}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE' ? `[billsplit] Port ${port} is already in use. Set PORT to use another one.` : `[billsplit] Server error: ${error.message}`,
  )
  process.exit(1)
})

let shuttingDown = false
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[billsplit] ${signal} received, finishing in-flight requests…`)
  server.close((error) => process.exit(error ? 1 : 0))
  // In-flight scans can take a while; don't hang forever.
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
