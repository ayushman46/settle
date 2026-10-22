/**
 * Page-level helpers: device profiles (low-end / mid phone), emulation, storage seeding, the
 * in-page probe (long tasks, LCP, "content painted" watchers) and the interactive check.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { evaluate } from './cdp.mjs'

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

/**
 * low: a budget Android phone on a weak 4G/3G-like connection (CPU 4× slower, 1.6 Mbps down,
 * 750 Kbps up, 150 ms RTT, 360×800 @2x). mid: a decent phone on good Wi-Fi (no throttling,
 * 375×812 @3x). The network is shaped by the bench's own proxy (lib/throttle.mjs).
 */
export const PROFILES = {
  low: {
    name: 'low',
    cpu: 4,
    network: { downKbps: 1600, upKbps: 750, rttMs: 150 },
    viewport: { width: 360, height: 800, deviceScaleFactor: 2 },
  },
  mid: {
    name: 'mid',
    cpu: 1,
    network: null,
    viewport: { width: 375, height: 812, deviceScaleFactor: 3 },
  },
}

/** Applies a profile's CPU and screen emulation to a page session (and turns on network events). */
export async function emulate(session, profile) {
  await session.send('Network.enable')
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  await session.send('Emulation.setDeviceMetricsOverride', { ...profile.viewport, mobile: true })
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await session.send('Emulation.setUserAgentOverride', { userAgent: ANDROID_UA, platform: 'Android' })
  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'no-preference' },
    ],
  })
}

/**
 * Writes localStorage entries for `origin` before the app ever loads there: opens a blank page
 * on the origin that DevTools serves itself (the request never reaches the server, so no
 * connection, cache entry or service worker is created), writes the entries, then leaves.
 */
export async function seedStorage(session, origin, entries) {
  const url = `${origin}/__bench_seed`
  await session.send('Fetch.enable', { patterns: [{ urlPattern: url, requestStage: 'Request' }] })
  const off = session.on('Fetch.requestPaused', ({ requestId }) => {
    session
      .send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }],
        body: Buffer.from('<!doctype html><title>seed</title>').toString('base64'),
      })
      .catch(() => {})
  })
  try {
    await session.send('Page.enable')
    const loaded = session.waitFor('Page.loadEventFired', { timeout: 30_000 })
    await session.send('Page.navigate', { url })
    await loaded
    await evaluate(
      session,
      `(() => { const e = ${JSON.stringify(entries)}; localStorage.clear(); for (const k in e) localStorage.setItem(k, e[k]); return localStorage.length })()`,
    )
  } finally {
    off()
    await session.send('Fetch.disable').catch(() => {})
  }
  // Leave the origin so the next navigation starts a fresh document.
  const blank = session.waitFor('Page.loadEventFired', { timeout: 30_000 })
  await session.send('Page.navigate', { url: 'about:blank' })
  await blank
}

/**
 * The in-page probe, installed before any page script: long tasks, LCP, and named watchers —
 * each a predicate checked once per animation frame; the first frame it holds records `found`
 * (that frame's time) and `painted` (a task right after that frame rendered).
 */
export function probeScript(watchers = {}) {
  const entries = Object.entries(watchers)
    .map(([name, predicate]) => `[${JSON.stringify(name)}, ${predicate}]`)
    .join(',')
  return `(() => {
  if (window.__bench) return
  const B = (window.__bench = { longTasks: [], lcp: null, lcpSize: 0, lcpNode: null, cls: 0, found: {}, painted: {} })
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) B.longTasks.push([e.startTime, e.duration]) })
      .observe({ type: 'longtask', buffered: true })
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        B.lcp = e.startTime
        B.lcpSize = e.size
        const el = e.element
        B.lcpNode = el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') : null
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) B.cls += e.value })
      .observe({ type: 'layout-shift', buffered: true })
  } catch {}
  B.watch = (name, test) => {
    const tick = () => {
      let ok = false
      try { ok = !!test() } catch {}
      if (!ok) return requestAnimationFrame(tick)
      B.found[name] = performance.now()
      const channel = new MessageChannel()
      channel.port1.onmessage = () => { B.painted[name] = performance.now() }
      channel.port2.postMessage(0)
    }
    requestAnimationFrame(tick)
  }
  for (const [name, test] of [${entries}]) B.watch(name, test)
})()`
}

/** Installs the probe for every new document in this page. */
export async function installProbe(session, watchers) {
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Page.addScriptToEvaluateOnNewDocument', { source: probeScript(watchers) })
}

/**
 * The time the page became interactive: the first moment at or after `start` (ms since
 * navigation) followed by `quiet` ms with no long task — i.e. after the last long task that
 * overlaps the window from `start`.
 */
export function interactiveAt(start, longTasks, quiet = 500) {
  let t = start
  const tasks = [...longTasks].sort((a, b) => a[0] - b[0])
  for (const [taskStart, duration] of tasks) {
    const end = taskStart + duration
    if (end <= t) continue
    if (taskStart < t + quiet) t = end
    else break
  }
  return t
}

/**
 * Waits until watcher `name` has painted and the main thread has then been free of long tasks
 * for `quiet` ms. Returns the probe's data plus `interactive` (ms since navigation start).
 */
export async function waitInteractive(session, name, { quiet = 500, timeout = 60_000 } = {}) {
  const started = Date.now()
  for (;;) {
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for "${name}" to be interactive`)
    let state = null
    try {
      state = await evaluate(
        session,
        `(() => { const B = window.__bench; if (!B || B.painted[${JSON.stringify(name)}] === undefined) return null;
          return { now: performance.now(), painted: B.painted[${JSON.stringify(name)}], longTasks: B.longTasks } })()`,
        { timeout: 10_000 },
      )
    } catch {
      // Navigating: the old document is gone and the new one isn't ready yet.
    }
    if (state) {
      const interactive = interactiveAt(state.painted, state.longTasks, quiet)
      if (state.now >= interactive + quiet) return { ...state, interactive }
    }
    await sleep(100)
  }
}

/** Navigation + paint timings and the probe's data, as numbers relative to navigation start. */
export async function pageTimings(session) {
  return evaluate(
    session,
    `(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const B = window.__bench || {}
      return {
        ttfb: nav ? nav.responseStart - nav.startTime : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        load: nav ? nav.loadEventEnd : null,
        fcp: fcp ? fcp.startTime : null,
        lcp: B.lcp ?? null,
        lcpNode: B.lcpNode ?? null,
        cls: B.cls ?? 0,
        found: B.found ?? {},
        painted: B.painted ?? {},
        longTasks: B.longTasks ?? [],
        timeOrigin: performance.timeOrigin,
        measures: performance.getEntriesByType('measure').map((m) => ({ name: m.name, start: m.startTime, duration: m.duration })),
        nodes: document.getElementsByTagName('*').length,
      }
    })()`,
  )
}

/** Total blocking time between two moments: Σ (long task − 50 ms), clipped to the window. */
export function blockingTime(longTasks, from, to) {
  let total = 0
  for (const [start, duration] of longTasks) {
    const s = Math.max(start, from)
    const e = Math.min(start + duration, to)
    if (e - s > 0 && duration > 50) total += Math.max(0, Math.min(duration - 50, e - s))
  }
  return total
}

/**
 * Records every response the page (and its auto-attached workers, if passed) loads:
 * `{ url, type, bytes, fromCache, fromServiceWorker, wallTime }`.
 */
export function recordRequests(session) {
  const requests = new Map()
  const open = new Set()
  const offs = [
    session.on('Network.requestWillBeSent', ({ requestId, request, type, wallTime }) => {
      open.add(requestId)
      requests.set(requestId, { url: request.url, type: type ?? 'Other', bytes: 0, wallTime: wallTime * 1000, fromCache: false, fromServiceWorker: false, status: 0 })
    }),
    session.on('Network.loadingFailed', ({ requestId }) => {
      open.delete(requestId)
    }),
    session.on('Network.responseReceived', ({ requestId, type, response }) => {
      const r = requests.get(requestId)
      if (!r) return
      r.type = type ?? r.type
      r.status = response.status
      r.fromCache = Boolean(response.fromDiskCache || response.fromPrefetchCache)
      r.fromServiceWorker = Boolean(response.fromServiceWorker)
      r.encoding = response.headers?.['content-encoding'] ?? response.headers?.['Content-Encoding'] ?? null
    }),
    session.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
      open.delete(requestId)
      const r = requests.get(requestId)
      if (r) r.bytes = encodedDataLength
    }),
  ]
  return {
    list: () => [...requests.values()],
    inFlight: () => [...open].filter((id) => !requests.get(id)?.url.startsWith('data:')).length,
    stop: () => offs.forEach((off) => off()),
  }
}

/** Sums transferred bytes by kind for requests started before `untilEpochMs`. */
export function bytesByType(requests, untilEpochMs = Infinity) {
  const out = { js: 0, css: 0, font: 0, html: 0, other: 0, requests: 0, jsFiles: 0 }
  for (const r of requests) {
    if (r.wallTime > untilEpochMs || r.url.startsWith('data:')) continue
    out.requests += 1
    const kind = r.type === 'Script' ? 'js' : r.type === 'Stylesheet' ? 'css' : r.type === 'Font' ? 'font' : r.type === 'Document' ? 'html' : 'other'
    out[kind] += r.bytes
    if (kind === 'js') out.jsFiles += 1
  }
  return out
}
