#!/usr/bin/env node
/**
 * Settle's performance harness: headless Edge/Chrome over the DevTools protocol against the
 * production build (`npm run build` → dist/), on a low-end and a mid phone profile, with an
 * empty (first visit) and a heavy (two years of use) data set. Each metric is the median of
 * several runs, with the spread.
 *
 *   node bench/run.mjs [--profile low|mid|all] [--data empty|heavy|all]
 *                      [--only cold,warm,nav,scroll,bundle] [--runs 5] [--dist dist]
 *                      [--label name] [--port 4100] [--headed]
 *
 * Results print as tables and are saved to bench/results/<label>.json.
 * Ports: server <port>, browser debugging <port>+1, throttling proxy <port>+2.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { bundleReport } from './lib/bundle.mjs'
import { launchBrowser } from './lib/cdp.mjs'
import { closeAppModules } from './lib/appModules.mjs'
import { PROFILES } from './lib/page.mjs'
import { BENCH_DIR, DEFAULT_DIST } from './lib/paths.mjs'
import { coldVisit, navigationRun, scrollRun, warmVisit } from './lib/scenarios.mjs'
import { startServer } from './lib/server.mjs'
import { fmtKb, fmtMs, fmtSpread, summarizeRuns } from './lib/stats.mjs'
import { startThrottle } from './lib/throttle.mjs'
import { heavyStorage, payLinkFragment } from './seed.mjs'

const METRICS = ['cold', 'warm', 'nav', 'scroll', 'bundle']

const { values: args } = parseArgs({
  options: {
    profile: { type: 'string', default: 'all' },
    data: { type: 'string', default: 'all' },
    only: { type: 'string', default: METRICS.join(',') },
    runs: { type: 'string', default: '5' },
    dist: { type: 'string', default: DEFAULT_DIST },
    label: { type: 'string' },
    port: { type: 'string', default: '4100' },
    headed: { type: 'boolean', default: false },
    scroll: { type: 'string', default: 'activity:fling,activity:jump,group:fling,group:jump' },
  },
})

const profiles = args.profile === 'all' ? ['low', 'mid'] : args.profile.split(',')
const datasets = args.data === 'all' ? ['empty', 'heavy'] : args.data.split(',')
const only = new Set(args.only.split(',').map((m) => (m === 'data' ? 'warm' : m)))
const runs = Math.max(1, Number(args.runs) || 5)
const dist = resolve(args.dist)
const port = Number(args.port)
const label = args.label ?? new Date().toISOString().replace(/[:.]/g, '-')
for (const m of only) if (!METRICS.includes(m)) throw new Error(`Unknown metric "${m}" (use ${METRICS.join(', ')})`)

const results = { label, date: new Date().toISOString(), dist, runs, profiles: {}, bundle: null }

function log(line) {
  process.stdout.write(`${line}\n`)
}

/** Runs `fn` `runs` times, logging progress; failed runs are reported and skipped. */
async function repeat(name, fn) {
  const records = []
  for (let i = 0; i < runs; i++) {
    const started = Date.now()
    try {
      records.push(await fn(i))
      process.stdout.write(`  ${name} ${i + 1}/${runs} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`)
    } catch (error) {
      process.stdout.write(`  ${name} ${i + 1}/${runs} FAILED: ${error.message}\n`)
    }
  }
  return records
}

function table(title, rows, columns) {
  log(`\n### ${title}\n`)
  log(`| ${columns.map((c) => c.label).join(' | ')} |`)
  log(`| ${columns.map(() => '---').join(' | ')} |`)
  for (const row of rows) log(`| ${columns.map((c) => c.value(row)).join(' | ')} |`)
}

async function main() {
  if (only.has('bundle')) {
    results.bundle = bundleReport(dist)
    const b = results.bundle
    log(`\n### Bundle (${b.all.jsFiles} JS + ${b.all.cssFiles} CSS files, ${b.all.fontFiles} fonts)\n`)
    log(`Up front in the HTML shell: JS ${fmtKb(b.shell.jsRaw)} raw / ${fmtKb(b.shell.jsGzip)} gzip / ${fmtKb(b.shell.jsBrotli)} br; CSS ${fmtKb(b.shell.cssRaw)} raw / ${fmtKb(b.shell.cssGzip)} gzip / ${fmtKb(b.shell.cssBrotli)} br`)
    log(`All: JS ${fmtKb(b.all.jsRaw)} raw / ${fmtKb(b.all.jsGzip)} gzip; CSS ${fmtKb(b.all.cssRaw)} raw / ${fmtKb(b.all.cssGzip)} gzip; fonts ${fmtKb(b.all.fontBytes)}`)
    table('Largest files', b.files.slice(0, 15), [
      { label: 'file', value: (f) => f.file },
      { label: 'raw', value: (f) => fmtKb(f.raw) },
      { label: 'gzip', value: (f) => fmtKb(f.gzip) },
      { label: 'brotli', value: (f) => fmtKb(f.brotli) },
    ])
  }
  const browserMetrics = [...only].filter((m) => m !== 'bundle')
  if (browserMetrics.length === 0) return

  const server = await startServer({ dist, port })
  const { cdp, close } = await launchBrowser({ port: port + 1, headless: !args.headed })
  try {
    const heavy = await heavyStorage()
    const payFragment = await payLinkFragment()
    await closeAppModules()

    for (const name of profiles) {
      const profile = PROFILES[name]
      if (!profile) throw new Error(`Unknown profile "${name}"`)
      const proxy = profile.network ? await startThrottle({ port: port + 2, targetPort: port, ...profile.network }) : null
      const env = { cdp, origin: proxy ? `http://127.0.0.1:${proxy.port}` : server.origin, proxy, heavy, payFragment }
      const out = (results.profiles[name] = {})
      log(`\n## Profile: ${name}${profile.cpu > 1 ? ` (CPU ${profile.cpu}× slower` : ' (no CPU throttling'}${profile.network ? `, ${profile.network.downKbps / 1000} Mbps / ${profile.network.rttMs} ms RTT)` : ', no network throttling)'}`)
      try {
        if (only.has('cold')) {
          out.cold = {}
          const targets = []
          if (datasets.includes('empty')) targets.push(['app (empty)', { data: 'empty', target: 'app' }], ['pay link', { data: 'empty', target: 'pay' }])
          if (datasets.includes('heavy')) targets.push(['app (heavy)', { data: 'heavy', target: 'app' }])
          for (const [key, opts] of targets) {
            const records = await repeat(`cold ${key}`, () => coldVisit(env, profile, opts))
            out.cold[key] = { runs: records, summary: summarizeRuns(records), files: records[0]?._files ?? [] }
            for (const r of records) delete r._files
          }
          table(`Cold first visit — ${name}`, Object.entries(out.cold), [
            { label: 'page', value: ([k]) => k },
            { label: 'TTFB', value: ([, v]) => fmtSpread(v.summary.ttfb) },
            { label: 'FCP', value: ([, v]) => fmtSpread(v.summary.fcp) },
            { label: 'LCP', value: ([, v]) => fmtSpread(v.summary.lcp) },
            { label: 'content', value: ([, v]) => fmtSpread(v.summary.content) },
            { label: 'interactive', value: ([, v]) => fmtSpread(v.summary.interactive) },
            { label: 'TBT', value: ([, v]) => fmtMs(v.summary.tbt?.p50) },
            { label: 'JS', value: ([, v]) => fmtKb((v.summary.jsKb?.p50 ?? 0) * 1024) },
            { label: 'CSS', value: ([, v]) => fmtKb((v.summary.cssKb?.p50 ?? 0) * 1024) },
            { label: 'fonts', value: ([, v]) => fmtKb((v.summary.fontKb?.p50 ?? 0) * 1024) },
            { label: 'requests', value: ([, v]) => v.summary.requests?.p50 ?? '—' },
          ])
        }
        if (only.has('warm') && datasets.includes('heavy')) {
          const records = await repeat('warm', () => warmVisit(env, profile))
          out.warm = { runs: records, summary: summarizeRuns(records) }
          const s = out.warm.summary
          table(`Warm repeat visit, heavy data — ${name}`, [s], [
            { label: 'TTFB', value: (v) => fmtSpread(v.ttfb) },
            { label: 'FCP', value: (v) => fmtSpread(v.fcp) },
            { label: 'Home content', value: (v) => fmtSpread(v.content) },
            { label: 'balance final', value: (v) => fmtSpread(v.balanceFinal) },
            { label: 'interactive', value: (v) => fmtSpread(v.interactive) },
            { label: 'TBT', value: (v) => fmtMs(v.tbt?.p50) },
            { label: 'network', value: (v) => fmtKb((v.networkKb?.p50 ?? 0) * 1024) },
          ])
          const dataKeys = Object.keys(s).filter((k) => k.startsWith('data:')).sort()
          table(`Data layer startup (performance marks), heavy data — ${name}`, dataKeys, [
            { label: 'phase', value: (k) => k.slice(5) },
            { label: 'p50 (min–max)', value: (k) => fmtSpread(s[k], (v) => `${v.toFixed(1)} ms`) },
          ])
        }
        if (only.has('nav') && datasets.includes('heavy')) {
          const records = await repeat('screen opens', () => navigationRun(env, profile))
          out.nav = { runs: records, summary: summarizeRuns(records) }
          const keys = Object.keys(out.nav.summary).filter((k) => !k.includes('·'))
          table(`Screen opens (tap → content painted), heavy data — ${name}`, keys, [
            { label: 'transition', value: (k) => k },
            { label: 'p50 (min–max)', value: (k) => fmtSpread(out.nav.summary[k]) },
            { label: 'long tasks', value: (k) => fmtMs(out.nav.summary[`${k} · long tasks ms`]?.p50) },
          ])
        }
        if (only.has('scroll') && datasets.includes('heavy')) {
          out.scroll = {}
          for (const spec of args.scroll.split(',')) {
            const [list, mode] = spec.split(':')
            const records = await repeat(`scroll ${list} (${mode})`, () => scrollRun(env, profile, { list, mode }))
            out.scroll[spec] = { runs: records, summary: summarizeRuns(records) }
          }
          table(`Scrolling to the oldest item, heavy data — ${name}`, Object.entries(out.scroll), [
            { label: 'list (mode)', value: ([k]) => k },
            { label: 'time to oldest', value: ([, v]) => fmtSpread(v.summary.timeToOldest) },
            { label: 'frames >16.7 ms', value: ([, v]) => v.summary.longFrames?.p50 ?? '—' },
            { label: 'dropped frames', value: ([, v]) => v.summary.droppedFrames?.p50 ?? '—' },
            { label: 'p95 frame', value: ([, v]) => fmtMs(v.summary.p95Frame?.p50) },
            { label: 'long tasks', value: ([, v]) => `${v.summary.longTasks?.p50 ?? '—'} (${fmtMs(v.summary.longTaskMs?.p50)})` },
            { label: 'stalled', value: ([, v]) => fmtMs(v.summary.stalledMs?.p50) },
            { label: 'DOM nodes', value: ([, v]) => v.summary.domNodes?.p50 ?? '—' },
          ])
        }
      } finally {
        await proxy?.close()
      }
    }
  } finally {
    await close()
    await server.stop()
  }
}

try {
  await main()
} finally {
  const dir = join(BENCH_DIR, 'results')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${label}.json`)
  writeFileSync(file, JSON.stringify(results, null, 1))
  log(`\nSaved ${file}`)
}
