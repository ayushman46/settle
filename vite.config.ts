/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { getRequestListener } from '@hono/node-server'

/** Shape of server/app.ts, declared here so the Vite config doesn't typecheck the server. */
interface DevApiModule {
  loadConfig: (env: Record<string, string | undefined>) => unknown
  createApp: (config: never) => { fetch: (request: Request) => Response | Promise<Response> }
}

type RequestListener = ReturnType<typeof getRequestListener>

/**
 * Serves the real API (server/app.ts) inside the Vite dev server, so `npm run dev`
 * is the only command needed. Edits to server/ files are picked up on the next request.
 */
function devApi(env: Record<string, string>): Plugin {
  // One app per loaded version of server/app.ts, so in-memory state (the rate limiter) lives
  // across requests; an edit reloads the module and gets a fresh app.
  const apps = new WeakMap<object, RequestListener>()
  return {
    name: 'billsplit-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        server
          .ssrLoadModule('/server/app.ts')
          .then((mod) => {
            let listener = apps.get(mod)
            if (!listener) {
              const { createApp, loadConfig } = mod as DevApiModule
              listener = getRequestListener(createApp(loadConfig({ ...process.env, ...env }) as never).fetch)
              apps.set(mod, listener)
            }
            return listener(req, res)
          })
          .catch((error: unknown) => next(error))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env)],
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      target: 'es2022',
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'client',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
          },
        },
      ],
    },
  }
})
