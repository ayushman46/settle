#!/usr/bin/env node
/**
 * First-paint JavaScript and CSS of the two entry routes, from a production build (no browser):
 * what the HTML shell loads up front for /app, and for /pay also the link-page preloads the
 * server sends with the page (server/web.ts `linkPagePreloads`). Brotli bytes, as sent.
 *
 *   node bench/firstpaint.mjs --dist node_modules/.cache/settle-bench/dist-final [--json out.json]
 *   node bench/firstpaint.mjs --dist A --dist B     (several builds, one table)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants } from 'node:zlib'

const { values } = parseArgs({ options: { dist: { type: 'string', multiple: true }, json: { type: 'string' } } })
const dists = values.dist ?? []
if (dists.length === 0) throw new Error('give --dist <build dir> (one or more)')

const LINK_PAGE_MODULES = { '/pay': 'src/features/pay/PayPage.tsx' }
const brotli = (buffer) => brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length

function measure(dist) {
  const client = join(resolve(dist), 'client')
  const manifest = JSON.parse(readFileSync(join(client, '.vite', 'manifest.json'), 'utf8'))
  const size = (file) => brotli(readFileSync(join(client, file)))
  const list = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [])
  const closure = (key, into) => {
    if (into.has(key) || !Object.hasOwn(manifest, key)) return into
    into.add(key)
    for (const next of list(manifest[key]?.imports)) closure(next, into)
    return into
  }
  const shellKeys = new Set()
  for (const [key, chunk] of Object.entries(manifest)) if (chunk?.isEntry === true) closure(key, shellKeys)
  const shell = { js: new Set(), css: new Set() }
  for (const key of shellKeys) {
    const chunk = manifest[key]
    if (typeof chunk?.file === 'string') shell.js.add(chunk.file)
    for (const css of list(chunk?.css)) shell.css.add(css)
  }
  // The HTML's own links (modulepreloads the build adds to index.html) count too.
  const html = readFileSync(join(client, 'index.html'), 'utf8')
  for (const m of html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)) (m[1].endsWith('.js') ? shell.js : shell.css).add(m[1])
  const total = (set) => [...set].reduce((n, f) => n + size(f), 0)
  const app = { js: total(shell.js), css: total(shell.css), files: shell.js.size + shell.css.size }
  const pay = { js: app.js, css: app.css, files: app.files }
  for (const module of Object.values(LINK_PAGE_MODULES)) {
    const key = Object.keys(manifest).find((k) => k === module)
    if (!key) continue
    for (const k of closure(key, new Set())) {
      if (shellKeys.has(k)) continue
      const { file, css } = manifest[k] ?? {}
      for (const style of list(css)) if (!shell.css.has(style)) { pay.css += size(style); pay.files += 1 }
      if (typeof file === 'string') { pay.js += size(file); pay.files += 1 }
    }
  }
  return { dist: resolve(dist), app, pay }
}

const rows = dists.map(measure)
console.log('| build | /app JS (br) | /app CSS (br) | /app files | /pay JS (br) | /pay CSS (br) | /pay files |')
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const r of rows) {
  const kb = (n) => `${(n / 1024).toFixed(2)} KB`
  console.log(`| ${r.dist.split(/[\/]/).pop()} | ${kb(r.app.js)} | ${kb(r.app.css)} | ${r.app.files} | ${kb(r.pay.js)} | ${kb(r.pay.css)} | ${r.pay.files} |`)
}
if (values.json) writeFileSync(values.json, JSON.stringify(rows, null, 2))
