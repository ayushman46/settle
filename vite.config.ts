/// <reference types="vitest/config" />
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { brotliCompressSync, constants as zlib } from 'node:zlib'
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

/** Built files worth compressing ahead of time (fonts and images already are). */
const PRECOMPRESSIBLE = /\.(?:js|mjs|css|svg|json|txt)$/

/**
 * Writes `<file>.br` (brotli at its best quality) beside each compressible file in the client
 * build's assets, which the Node server sends as is (server/web.ts) instead of gzip made per
 * request: about 13% fewer bytes on a first visit. Not for the server build, nor on Cloudflare
 * Pages (`CF_PAGES`) or Vercel (`VERCEL`), which compress by themselves.
 */
function precompress(): Plugin {
  let assetsDir = ''
  let skip = true
  return {
    name: 'settle-precompress',
    apply: 'build',
    configResolved(config) {
      assetsDir = resolve(config.root, config.build.outDir, config.build.assetsDir)
      skip = Boolean(config.build.ssr) || Boolean(process.env.CF_PAGES) || Boolean(process.env.VERCEL)
    },
    closeBundle() {
      if (skip || !existsSync(assetsDir)) return
      for (const name of readdirSync(assetsDir)) {
        if (!PRECOMPRESSIBLE.test(name)) continue
        const file = join(assetsDir, name)
        const raw = readFileSync(file)
        if (raw.length < 1024) continue
        const br = brotliCompressSync(raw, {
          params: { [zlib.BROTLI_PARAM_QUALITY]: zlib.BROTLI_MAX_QUALITY, [zlib.BROTLI_PARAM_SIZE_HINT]: raw.length },
        })
        if (br.length < raw.length) writeFileSync(`${file}.br`, br)
      }
    },
  }
}

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env), precompress()],
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      target: 'es2022',
      // dist/client/.vite/manifest.json: the server preloads a link page's own code with it.
      manifest: !isSsrBuild,
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
