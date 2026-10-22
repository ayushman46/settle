/**
 * Production entry point (`npm start` → `node dist/server/index.js`).
 * Serves the API and the built client from one Node process.
 */
import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, parsePort } from './config'
import { LOG_TAG as TAG, readyLine, startupWarnings } from './startup'
import { createWebApp } from './web'

/** Idle keep-alive connections stay open this long (see below). */
const KEEP_ALIVE_MS = 120_000

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

for (const note of startupWarnings(config, { clientDir, clientBuilt: existsSync(join(clientDir, 'index.html')) })) {
  console.warn(`${TAG} ${note}`)
}

const app = createWebApp(config, { clientDir })
const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`${TAG} ${readyLine(config, { hostname, port: info.port })}`)
})

// Hosts put a load balancer in front that reuses connections for a minute or more (Render,
// Fly, AWS). Node's 5-second default closes them first, so the balancer would sometimes send a
// request down a dying connection and answer 502. Keep idle connections longer than it does.
if ('keepAliveTimeout' in server) {
  server.keepAliveTimeout = KEEP_ALIVE_MS
  server.headersTimeout = KEEP_ALIVE_MS + 1_000
}

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `${TAG} Port ${port} is already in use. Set PORT to use another one.` : `${TAG} Server error: ${error.message}`)
  process.exit(1)
})

let shuttingDown = false
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${TAG} ${signal} received, finishing in-flight requests…`)
  server.close((error) => process.exit(error ? 1 : 0))
  // In-flight scans can take a while; don't hang forever.
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
