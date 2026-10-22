/**
 * Loads the app's own TypeScript modules (split engine, schemas, pay-link encoder) through Vite's
 * SSR loader, so seed data and pay links are produced by exactly the code the app runs.
 */
import { ROOT } from './paths.mjs'

let serverPromise = null

async function server() {
  serverPromise ??= (async () => {
    const { createServer } = await import('vite')
    return createServer({
      root: ROOT,
      configFile: false,
      logLevel: 'error',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, watch: null, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    })
  })()
  return serverPromise
}

export async function loadAppModule(path) {
  return (await server()).ssrLoadModule(path)
}

export async function closeAppModules() {
  if (!serverPromise) return
  const s = await serverPromise
  serverPromise = null
  await s.close()
}
