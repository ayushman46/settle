#!/usr/bin/env node
/**
 * Finishes the client build for Cloudflare Pages (`npm run build:pages` = `vite build` + this).
 *
 * - 404.html: a copy of the app shell. With it, Pages answers a path that is neither a file nor
 *   an app route (see public/_redirects) with the shell and a real 404 — like the Node server —
 *   instead of its single-page fallback that would answer a missing /assets/ file with a page.
 * - Checks that the Pages config files made it into the build, so a broken deploy fails here
 *   rather than in front of users.
 *
 *   node scripts/pages-build.mjs [client build folder, default dist/client]
 */
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, process.argv[2] ?? join('dist', 'client'))

function fail(message) {
  console.error(`[pages-build] ${message}`)
  process.exit(1)
}

const shell = join(OUT, 'index.html')
if (!existsSync(shell)) fail(`No ${shell}: run "vite build" first.`)
if (!/<script type="module"[^>]+src="\/assets\//.test(readFileSync(shell, 'utf8'))) fail('index.html has no built script: is this a production build?')

for (const file of ['_headers', '_redirects', 'sw.js', 'manifest.webmanifest']) {
  if (!existsSync(join(OUT, file))) fail(`${file} is missing from ${OUT} (it should come from public/).`)
}

copyFileSync(shell, join(OUT, '404.html'))

const kb = (path) => `${(statSync(path).size / 1024).toFixed(1)} KB`
console.log(`[pages-build] ${OUT} is ready for Cloudflare Pages: index.html ${kb(shell)}, 404.html, _headers, _redirects.`)
