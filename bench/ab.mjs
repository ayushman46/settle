#!/usr/bin/env node
/**
 * Before/after comparison of two production builds, run interleaved (A B B A …) in one browser
 * so machine noise hits both sides alike. Used to decide whether a fix stays.
 *
 *   node bench/ab.mjs --a node_modules/.cache/settle-bench/dist-baseline --b dist --only warm,cold --profile low
 *                     [--data heavy|empty|all] [--runs 5] [--label fix-name] [--port 4100]
 *   scenarios: cold, warm, nav, scroll (with --scroll activity:jump,…)
 *
 * Ports: A server <port>, B server <port>+3, browser <port>+1, proxies <port>+2 and <port>+4.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { launchBrowser } from './lib/cdp.mjs'
import { closeAppModules } from './lib/appModules.mjs'
import { PROFILES } from './lib/page.mjs'
import { BENCH_DIR, CACHE_DIR } from './lib/paths.mjs'
import { coldVisit, navigationRun, scrollRun, warmVisit } from './lib/scenarios.mjs'
import { startServer } from './lib/server.mjs'
import { fmtMs, summarize } from './lib/stats.mjs'
import { startThrottle } from './lib/throttle.mjs'
import { heavyStorage, payLinkFragment } from './seed.mjs'

const { values: args } = parseArgs({
  options: {
    a: { type: 'string', default: join(CACHE_DIR, 'dist-baseline') },
    b: { type: 'string', default: 'dist' },
    only: { type: 'string', default: 'cold,warm' },
    profile: { type: 'string', default: 'low' },
    data: { type: 'string', default: 'all' },
    runs: { type: 'string', default: '5' },
    label: { type: 'string', default: 'ab' },
    port: { type: 'string', default: '4100' },
    scroll: { type: 'string', default: 'activity:jump,group:fling' },
  },
})

const runs = Math.max(1, Number(args.runs))
const port = Number(args.port)
const only = args.only.split(',')
const datasets = args.data === 'all' ? ['empty', 'heavy'] : args.data.split(',')
const profiles = args.profile.split(',')

/** name → (env, profile) => record */
function scenarios() {
  const list = []
  for (const m of only) {
    if (m === 'cold') {
      if (datasets.includes('empty')) {
        list.push(['cold /app (empty)', (env, p) => coldVisit(env, p, { data: 'empty', target: 'app' })])
        list.push(['cold /pay', (env, p) => coldVisit(env, p, { data: 'empty', target: 'pay' })])
      }
      if (datasets.includes('heavy')) list.push(['cold /app (heavy)', (env, p) => coldVisit(env, p, { data: 'heavy', target: 'app' })])
    } else if (m === 'warm') list.push(['warm Home (heavy)', (env, p) => warmVisit(env, p)])
    else if (m === 'nav') list.push(['screen opens', (env, p) => navigationRun(env, p)])
    else if (m === 'scroll') {
      for (const spec of args.scroll.split(',')) {
        const [which, mode] = spec.split(':')
        list.push([`scroll ${spec}`, (env, p) => scrollRun(env, p, { list: which, mode })])
      }
    } else throw new Error(`Unknown scenario ${m}`)
  }
  return list
}

/** The headline numbers worth comparing, per record. */
const KEYS = [
  'interactive',
  'content',
  'balanceFinal',
  'fcp',
  'lcp',
  'ttfb',
  'tbt',
  'jsKb',
  'cssKb',
  'fontKb',
  'networkKb',
  'data:load:total',
  'data:derive:summary',
  'timeToOldest',
  'longFrames',
  'droppedFrames',
  'p95Frame',
  'longTaskMs',
  'stalledMs',
  'domNodes',
]

const servers = []
const proxies = []
const { cdp, close } = await launchBrowser({ port: port + 1 })
const out = { label: args.label, date: new Date().toISOString(), a: resolve(args.a), b: resolve(args.b), runs, results: {} }
try {
  const heavy = await heavyStorage()
  const payFragment = await payLinkFragment()
  await closeAppModules()
  const sides = {}
  for (const [side, dist, serverPort] of [
    ['A', args.a, port],
    ['B', args.b, port + 3],
  ]) {
    const server = await startServer({ dist: resolve(dist), port: serverPort })
    servers.push(server)
    sides[side] = { server, serverPort }
  }

  for (const profileName of profiles) {
    const profile = PROFILES[profileName]
    const envs = {}
    for (const [side, proxyPort] of [
      ['A', port + 2],
      ['B', port + 4],
    ]) {
      const proxy = profile.network ? await startThrottle({ port: proxyPort, targetPort: sides[side].serverPort, ...profile.network }) : null
      if (proxy) proxies.push(proxy)
      envs[side] = { cdp, origin: proxy ? `http://127.0.0.1:${proxy.port}` : sides[side].server.origin, proxy, heavy, payFragment }
    }
    for (const [name, run] of scenarios()) {
      const records = { A: [], B: [] }
      for (let i = 0; i < runs; i++) {
        const order = i % 2 === 0 ? ['A', 'B'] : ['B', 'A']
        for (const side of order) {
          try {
            records[side].push(await run(envs[side], profile))
          } catch (error) {
            process.stdout.write(`  ${name} ${side} run ${i + 1} FAILED: ${error.message}\n`)
          }
        }
        process.stdout.write(`  ${profileName} ${name} ${i + 1}/${runs}\n`)
      }
      const key = `${profileName} · ${name}`
      out.results[key] = records
      for (const r of [...records.A, ...records.B]) delete r._files
      // Print the comparison.
      const keys = new Set()
      for (const r of [...records.A, ...records.B]) for (const k of Object.keys(r)) if (typeof r[k] === 'number') keys.add(k)
      const shown = [...keys].filter((k) => KEYS.includes(k) || (name === 'screen opens' && !k.includes('·')))
      console.log(`\n### ${key}\n\n| metric | A (before) | B (after) | change |\n| --- | --- | --- | --- |`)
      for (const k of shown) {
        const a = summarize(records.A.map((r) => r[k]))
        const b = summarize(records.B.map((r) => r[k]))
        if (a.p50 === null && b.p50 === null) continue
        const isMs = !/Kb$|Frames|domNodes/.test(k)
        const f = (s) => (s.p50 === null ? '—' : isMs ? `${fmtMs(s.p50)} (${fmtMs(s.min)}–${fmtMs(s.max)})` : `${s.p50.toFixed(1)} (${s.min.toFixed(1)}–${s.max.toFixed(1)})`)
        const delta = a.p50 && b.p50 !== null ? `${b.p50 - a.p50 > 0 ? '+' : ''}${(((b.p50 - a.p50) / a.p50) * 100).toFixed(0)}%` : '—'
        console.log(`| ${k} | ${f(a)} | ${f(b)} | ${delta} |`)
      }
    }
    for (const p of proxies.splice(0)) await p.close()
  }
} finally {
  await close()
  for (const s of servers) await s.stop()
  for (const p of proxies) await p.close()
  const dir = join(BENCH_DIR, 'results')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `ab-${args.label}.json`), JSON.stringify(out, null, 1))
  console.log(`\nSaved ${join(dir, `ab-${args.label}.json`)}`)
}
