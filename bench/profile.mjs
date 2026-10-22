#!/usr/bin/env node
/**
 * Finds where the time goes: records a V8 CPU profile (and optionally JS/CSS coverage) of one
 * scenario in the production build, then prints the hottest functions and source files — mapped
 * back to src/ through source maps when the build has them (`--sourcemap` builds one into
 * node_modules/.cache/settle-bench/dist-sm first).
 *
 *   node bench/profile.mjs --scenario cold [--profile low|mid] [--data heavy|empty] [--url /app]
 *   node bench/profile.mjs --scenario "tap:Home → You (tab)"
 *   node bench/profile.mjs --scenario scroll:activity
 *   options: --dist <dir> | --sourcemap, --coverage, --trace, --top 40, --port 4110
 *
 * Writes node_modules/.cache/settle-bench/profiles/<name>.cpuprofile (open it in DevTools → Performance).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { evaluate, launchBrowser, newIsolatedPage } from './lib/cdp.mjs'
import { closeAppModules } from './lib/appModules.mjs'
import { emulate, installProbe, PROFILES, recordRequests, seedStorage, waitInteractive } from './lib/page.mjs'
import { CACHE_DIR, DEFAULT_DIST, ROOT } from './lib/paths.mjs'
import { JOURNEY } from './lib/scenarios.mjs'
import { READY, TAP, OLDEST } from './lib/screens.mjs'
import { startServer } from './lib/server.mjs'
import { startThrottle } from './lib/throttle.mjs'
import { mainThreadBreakdown, startTrace, stopTrace } from './lib/trace.mjs'
import { heavyStorage, payLinkFragment } from './seed.mjs'

const { values: args } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'cold' },
    profile: { type: 'string', default: 'low' },
    data: { type: 'string', default: 'heavy' },
    url: { type: 'string' },
    dist: { type: 'string' },
    sourcemap: { type: 'boolean', default: false },
    coverage: { type: 'boolean', default: false },
    trace: { type: 'boolean', default: false },
    top: { type: 'string', default: '40' },
    port: { type: 'string', default: '4110' },
    name: { type: 'string' },
  },
})

const port = Number(args.port)
const top = Number(args.top)

/** A production build with source maps, in node_modules/.cache/settle-bench/dist-sm (client + the normal server). */
function buildWithSourceMaps() {
  const out = join(CACHE_DIR, 'dist-sm')
  rmSync(out, { recursive: true, force: true })
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--sourcemap', '--outDir', join(out, 'client'), '--emptyOutDir'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  cpSync(join(DEFAULT_DIST, 'server'), join(out, 'server'), { recursive: true })
  return out
}

const dist = args.sourcemap ? buildWithSourceMaps() : resolve(args.dist ?? DEFAULT_DIST)

/* ------------------------------------------------------------------ source maps */

const maps = new Map()
async function mapperFor(url) {
  if (maps.has(url)) return maps.get(url)
  let mapper = null
  try {
    const path = new URL(url).pathname
    const file = join(dist, 'client', path)
    if (existsSync(`${file}.map`)) {
      const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping')
      const map = new TraceMap(JSON.parse(readFileSync(`${file}.map`, 'utf8')))
      mapper = (line, column) => originalPositionFor(map, { line: line + 1, column })
    }
  } catch {
    mapper = null
  }
  maps.set(url, mapper)
  return mapper
}

function shortSource(source) {
  if (!source) return null
  const s = source.replace(/\\/g, '/')
  const i = s.lastIndexOf('/node_modules/')
  if (i !== -1) return s.slice(i + 1)
  const j = s.indexOf('/src/')
  return j !== -1 ? s.slice(j + 1) : s.replace(/^(\.\.\/)+/, '')
}

/* ------------------------------------------------------------------ profile analysis */

async function analyze(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const selfMs = new Map()
  const deltas = profile.timeDeltas
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i]
    const dt = (deltas[i + 1] ?? deltas[i] ?? 0) / 1000
    selfMs.set(id, (selfMs.get(id) ?? 0) + dt)
  }
  const parent = new Map()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)

  const nameOf = async (frame) => {
    let fn = frame.functionName || '(anonymous)'
    let where = frame.url ? new URL(frame.url, 'http://x').pathname.split('/').pop() : ''
    if (frame.url) {
      const mapper = await mapperFor(frame.url)
      if (mapper) {
        const pos = mapper(frame.lineNumber, frame.columnNumber)
        if (pos?.source) {
          where = `${shortSource(pos.source)}:${pos.line}`
          if (pos.name && (fn === '(anonymous)' || fn.length <= 2)) fn = pos.name
        }
      }
    }
    return { fn, where, file: where.replace(/:\d+$/, '') }
  }

  const fnSelf = new Map()
  const fileSelf = new Map()
  const fnTotal = new Map()
  let total = 0
  const labels = new Map()
  for (const n of profile.nodes) labels.set(n.id, await nameOf(n.callFrame))
  for (const n of profile.nodes) {
    const ms = selfMs.get(n.id) ?? 0
    if (ms === 0) continue
    total += ms
    const { fn, where, file } = labels.get(n.id)
    const key = `${fn}  ${where}`
    fnSelf.set(key, (fnSelf.get(key) ?? 0) + ms)
    fileSelf.set(file || n.callFrame.functionName, (fileSelf.get(file || n.callFrame.functionName) ?? 0) + ms)
    // Inclusive time: credit every distinct ancestor frame once.
    const seen = new Set()
    let id = n.id
    while (id !== undefined) {
      const l = labels.get(id)
      const k = `${l.fn}  ${l.where}`
      if (!seen.has(k)) {
        seen.add(k)
        fnTotal.set(k, (fnTotal.get(k) ?? 0) + ms)
      }
      id = parent.get(id)
    }
  }
  const topOf = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([k, v]) => `${v.toFixed(1).padStart(9)} ms  ${k}`)
      .join('\n')
  const idle = fnSelf.get('(idle)  ') ?? 0
  console.log(`\nSampled ${total.toFixed(0)} ms (idle ${idle.toFixed(0)} ms, program ${(fnSelf.get('(program)  ') ?? 0).toFixed(0)} ms, GC ${(fnSelf.get('(garbage collector)  ') ?? 0).toFixed(0)} ms)`)
  console.log(`\n--- self time by source file ---\n${topOf(fileSelf)}`)
  console.log(`\n--- self time by function ---\n${topOf(fnSelf)}`)
  console.log(`\n--- total (inclusive) time by function ---\n${topOf(fnTotal)}`)
}

/* ------------------------------------------------------------------ run */

const server = await startServer({ dist, port })
const { cdp, close } = await launchBrowser({ port: port + 1 })
const profile = PROFILES[args.profile]
const proxy = profile.network ? await startThrottle({ port: port + 2, targetPort: port, ...profile.network }) : null
const origin = proxy ? `http://127.0.0.1:${proxy.port}` : server.origin
try {
  const heavy = args.data === 'heavy' ? await heavyStorage() : null
  const payFragment = await payLinkFragment()
  await closeAppModules()
  const page = await newIsolatedPage(cdp)
  const s = page.session
  await emulate(s, profile)
  const watch = args.url?.startsWith('/pay') ? 'pay' : heavy ? 'home' : 'welcome'
  await installProbe(s, { [watch]: READY[watch] })
  if (heavy) {
    await seedStorage(s, origin, heavy)
    proxy?.reset()
  }
  await s.send('Profiler.enable')
  await s.send('Profiler.setSamplingInterval', { interval: 200 })
  if (args.coverage) {
    await s.send('Debugger.enable')
    await s.send('Profiler.startPreciseCoverage', { callCount: false, detailed: true })
    await s.send('DOM.enable')
    await s.send('CSS.enable')
    await s.send('CSS.startRuleUsageTracking')
  }
  const path = args.url ?? '/app'
  const url = `${origin}${path === '/pay' ? `/pay#${payFragment}` : path}`
  const requests = recordRequests(s)

  const scenario = args.scenario
  const begin = async () => {
    await s.send('Profiler.start')
    if (args.trace) await startTrace(cdp)
  }
  if (scenario === 'cold') await begin()
  await s.send('Page.navigate', { url })
  const state = await waitInteractive(s, watch)
  console.log(`${watch} painted at ${state.painted.toFixed(0)} ms, interactive at ${state.interactive.toFixed(0)} ms`)

  if (scenario !== 'cold') {
    // Let idle preloading finish first.
    for (let i = 0; i < 100 && requests.inFlight() > 0; i++) await new Promise((r) => setTimeout(r, 100))
    await new Promise((r) => setTimeout(r, 2000))
    if (scenario.startsWith('tap:')) {
      const label = scenario.slice(4)
      const index = JOURNEY.findIndex(([l]) => l === label)
      if (index === -1) throw new Error(`No journey step "${label}"`)
      // Walk the journey up to the step, then profile just that tap.
      for (let i = 0; i <= index; i++) {
        const [l, tap, ready] = JOURNEY[i]
        if (i === index) await begin()
        if (l === 'back') {
          await evaluate(s, `(async () => { history.back(); const ready = ${ready}; for (let i = 0; i < 600; i++) { await new Promise((r) => requestAnimationFrame(r)); try { if (ready()) return } catch {} } })()`)
        } else {
          const ms = await evaluate(
            s,
            `(async () => { const el = ${tap}; const ready = ${ready}; const t0 = performance.now(); el.click(); for (;;) { await new Promise((r) => requestAnimationFrame(r)); try { if (ready()) break } catch {} } return performance.now() - t0 })()`,
          )
          if (i === index) console.log(`${l}: ${ms.toFixed(0)} ms`)
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    } else if (scenario.startsWith('scroll:')) {
      const list = scenario.slice(7)
      const tapList = list === 'activity' ? [[TAP.tab('/app/activity'), READY.activity]] : [[TAP.tab('/app/groups'), READY.groups], [TAP.ariaPrefix('Flat 302, Koramangala,'), READY.groupDetail]]
      for (const [tap, ready] of tapList) {
        await evaluate(s, `(async () => { const el = ${tap}; const ready = ${ready}; el.click(); for (;;) { await new Promise((r) => requestAnimationFrame(r)); try { if (ready()) break } catch {} } })()`)
        await new Promise((r) => setTimeout(r, 1500))
      }
      await begin()
      const target = list === 'activity' ? OLDEST.activity : OLDEST.group
      const ms = await evaluate(
        s,
        `(async () => { const t0 = performance.now(); for (;;) { await new Promise((r) => requestAnimationFrame(r)); const el = ${target}; if (el) { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) break } window.scrollTo(0, document.documentElement.scrollHeight) ; if (performance.now() - t0 > 200000) break } return performance.now() - t0 })()`,
        { timeout: 240_000 },
      )
      console.log(`scrolled to the oldest ${list} row in ${ms.toFixed(0)} ms`)
    }
  }

  const { profile: cpu } = await s.send('Profiler.stop')
  let traceEvents = null
  if (args.trace) {
    traceEvents = await stopTrace(cdp)
    const { total, byName } = mainThreadBreakdown(traceEvents)
    console.log(`
--- main thread (trace), busy ${total.toFixed(0)} ms ---`)
    for (const [name, ms] of byName.slice(0, 25)) console.log(`${ms.toFixed(1).padStart(9)} ms  ${name}`)
  }
  const name = args.name ?? `${args.profile}-${args.data}-${scenario.replace(/[^a-z0-9]+/gi, '_')}`
  const dir = join(CACHE_DIR, 'profiles')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.cpuprofile`), JSON.stringify(cpu))
  if (traceEvents) writeFileSync(join(dir, `${name}.trace.json`), JSON.stringify({ traceEvents }))
  console.log(`Saved ${join(dir, `${name}.cpuprofile`)}`)
  await analyze(cpu)

  if (args.coverage) {
    const { result } = await s.send('Profiler.takePreciseCoverage')
    const { ruleUsage } = await s.send('CSS.stopRuleUsageTracking')
    console.log('\n--- JS coverage (bytes used / size) ---')
    for (const script of result) {
      if (!script.url.includes('/assets/')) continue
      const source = await s.send('Debugger.getScriptSource', { scriptId: script.scriptId }).catch(() => null)
      const size = source?.scriptSource?.length ?? 0
      let unused = 0
      for (const fn of script.functions) for (const r of fn.ranges) if (r.count === 0) unused += r.endOffset - r.startOffset
      console.log(`${new URL(script.url).pathname.padEnd(48)} ${(size / 1024).toFixed(1).padStart(7)} KB, ~${size ? Math.max(0, 100 - (unused / size) * 100).toFixed(0) : '?'}% used`)
    }
    const sheets = new Map()
    for (const rule of ruleUsage) {
      const entry = sheets.get(rule.styleSheetId) ?? { used: 0, unused: 0 }
      entry[rule.used ? 'used' : 'unused'] += rule.endOffset - rule.startOffset
      sheets.set(rule.styleSheetId, entry)
    }
    console.log('\n--- CSS rule usage (by stylesheet) ---')
    for (const [id, { used, unused }] of sheets) console.log(`${id.padEnd(20)} ${((used + unused) / 1024).toFixed(1)} KB of rules, ${((used / (used + unused)) * 100).toFixed(0)}% used`)
  }
  await page.dispose()
} finally {
  await proxy?.close()
  await close()
  await server.stop()
}
