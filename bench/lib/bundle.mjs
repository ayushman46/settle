/**
 * Bundle report: every built JS/CSS file with raw, gzip and brotli sizes, and what the HTML
 * shell loads up front (entry script, modulepreloads, stylesheets).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'

function sizes(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  }
}

/** Per-file sizes plus the shell's up-front set. */
export function bundleReport(dist) {
  const client = join(dist, 'client')
  const assets = join(client, 'assets')
  const files = []
  for (const name of readdirSync(assets)) {
    const ext = extname(name)
    if (!['.js', '.css', '.woff2'].includes(ext)) continue
    const path = join(assets, name)
    if (!statSync(path).isFile()) continue
    const buffer = readFileSync(path)
    files.push({ file: `/assets/${name}`, kind: ext.slice(1), ...(ext === '.woff2' ? { raw: buffer.length, gzip: buffer.length, brotli: buffer.length } : sizes(buffer)) })
  }
  files.sort((a, b) => b.raw - a.raw)

  const html = readFileSync(join(client, 'index.html'), 'utf8')
  const upfront = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
  const byFile = new Map(files.map((f) => [f.file, f]))
  const sum = (list, kind, key) => list.filter((f) => f && f.kind === kind).reduce((s, f) => s + f[key], 0)
  const shell = upfront.map((f) => byFile.get(f)).filter(Boolean)
  const total = (kind, key) => sum(files, kind, key)
  const sw = existsSync(join(client, 'sw.js')) ? sizes(readFileSync(join(client, 'sw.js'))) : null
  return {
    files,
    upfront,
    shell: {
      jsRaw: sum(shell, 'js', 'raw'),
      jsGzip: sum(shell, 'js', 'gzip'),
      jsBrotli: sum(shell, 'js', 'brotli'),
      cssRaw: sum(shell, 'css', 'raw'),
      cssGzip: sum(shell, 'css', 'gzip'),
      cssBrotli: sum(shell, 'css', 'brotli'),
    },
    all: {
      jsFiles: files.filter((f) => f.kind === 'js').length,
      cssFiles: files.filter((f) => f.kind === 'css').length,
      jsRaw: total('js', 'raw'),
      jsGzip: total('js', 'gzip'),
      cssRaw: total('css', 'raw'),
      cssGzip: total('css', 'gzip'),
      fontFiles: files.filter((f) => f.kind === 'woff2').length,
      fontBytes: total('woff2', 'raw'),
    },
    sw,
  }
}
