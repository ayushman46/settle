/**
 * One run of each benchmark scenario. Every function takes the shared `env`
 * ({ cdp, origin, proxy, heavy, payFragment }) and a profile, and returns plain numbers.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { evaluate, newIsolatedPage, openPage } from './cdp.mjs'
import {
  blockingTime,
  bytesByType,
  emulate,
  installProbe,
  pageTimings,
  recordRequests,
  seedStorage,
  waitInteractive,
} from './page.mjs'
import { OLDEST, READY, TAP } from './screens.mjs'

/* ------------------------------------------------------------------ shared steps */

/** A fresh isolated page with the profile applied, the probe installed and (optionally) data seeded. */
async function freshPage(env, profile, { data, watchers }) {
  const page = await newIsolatedPage(env.cdp)
  const s = page.session
  await emulate(s, profile)
  await installProbe(s, watchers)
  if (data === 'heavy') {
    await seedStorage(s, env.origin, env.heavy)
    // The browser may have preconnected while seeding: start from cold connections.
    env.proxy?.reset()
  }
  return page
}

/** Waits until no request is in flight and no long task has run for `quiet` ms. */
async function waitSettled(session, requests, { quiet = 1000, timeout = 45_000 } = {}) {
  const started = Date.now()
  let calmSince = Date.now()
  for (;;) {
    if (Date.now() - started > timeout) return false
    const busyNet = requests.inFlight() > 0
    let busyCpu = false
    try {
      busyCpu = await evaluate(
        session,
        `(() => { const t = (window.__bench?.longTasks ?? []).at(-1); return !!t && performance.now() - (t[0] + t[1]) < ${quiet} })()`,
        { timeout: 10_000 },
      )
    } catch {
      busyCpu = true
    }
    if (busyNet || busyCpu) calmSince = Date.now()
    else if (Date.now() - calmSince >= quiet) return true
    await sleep(100)
  }
}

/** Navigates and waits until `watch` has painted and the page is interactive. */
async function load(session, url, watch, opts) {
  await session.send('Page.navigate', { url })
  const state = await waitInteractive(session, watch, opts)
  return { state, timings: await pageTimings(session) }
}

/* ------------------------------------------------------------------ 1. cold first visit */

/**
 * A first visit with an empty HTTP cache and no service worker: to `/app` (the welcome slides
 * when there's no data, Home with heavy data) or to a friend's `/pay#…` link.
 */
export async function coldVisit(env, profile, { data, target }) {
  const watch = target === 'pay' ? 'pay' : data === 'heavy' ? 'home' : 'welcome'
  const page = await freshPage(env, profile, { data, watchers: { [watch]: READY[watch] } })
  const s = page.session
  try {
    const requests = recordRequests(s)
    const url = target === 'pay' ? `${env.origin}/pay#${env.payFragment}` : `${env.origin}/app`
    const { state, timings } = await load(s, url, watch)
    const bytes = bytesByType(requests.list(), timings.timeOrigin + state.interactive)
    requests.stop()
    return {
      ttfb: timings.ttfb,
      fcp: timings.fcp,
      lcp: timings.lcp,
      content: state.painted,
      interactive: state.interactive,
      tbt: blockingTime(timings.longTasks, 0, state.interactive),
      longTaskMs: timings.longTasks.reduce((sum, [, d]) => sum + d, 0),
      jsKb: bytes.js / 1024,
      cssKb: bytes.css / 1024,
      fontKb: bytes.font / 1024,
      totalKb: (bytes.js + bytes.css + bytes.font + bytes.html + bytes.other) / 1024,
      requests: bytes.requests,
      jsFiles: bytes.jsFiles,
      domNodes: timings.nodes,
      _files: requests
        .list()
        .filter((r) => r.wallTime <= timings.timeOrigin + state.interactive)
        .map((r) => ({ url: new URL(r.url).pathname, type: r.type, kb: +(r.bytes / 1024).toFixed(1) })),
    }
  } finally {
    await page.dispose()
  }
}

/* ------------------------------------------------------------------ 2. warm repeat visit */

/**
 * A returning user (heavy data) opening Settle again: everything from the first visit is in
 * the HTTP cache and the service worker's caches, and the worker itself has been stopped (as
 * it is after a while on a phone).
 */
export async function warmVisit(env, profile) {
  const watchers = { home: READY.home, homeFinal: READY.homeFinal }
  const first = await freshPage(env, profile, { data: 'heavy', watchers })
  const { browserContextId } = first
  let second = null
  try {
    const s1 = first.session
    const requests1 = recordRequests(s1)
    await load(s1, `${env.origin}/app`, 'home')
    // The worker installs after load and caches the shell; idle preloading fetches the screens.
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      const controlled = await evaluate(s1, `!!navigator.serviceWorker?.controller`).catch(() => false)
      if (controlled) break
      await sleep(200)
    }
    await waitSettled(s1, requests1, { quiet: 1500 })
    requests1.stop()
    await s1.send('ServiceWorker.enable').catch(() => {})
    await first.close()
    await env.cdp.send('Target.getTargets').catch(() => {})

    second = await openPage(env.cdp, browserContextId)
    const s2 = second.session
    await s2.send('ServiceWorker.enable').catch(() => {})
    await s2.send('ServiceWorker.stopAllWorkers').catch(() => {})
    await emulate(s2, profile)
    await installProbe(s2, watchers)
    const requests2 = recordRequests(s2)
    const { state, timings } = await load(s2, `${env.origin}/app`, 'home')
    // The count-up finishes ~640 ms after Home appears.
    const finalDeadline = Date.now() + 10_000
    let final = timings.painted.homeFinal ?? null
    while (final === null && Date.now() < finalDeadline) {
      await sleep(100)
      final = await evaluate(s2, `window.__bench.painted.homeFinal ?? null`).catch(() => null)
    }
    const after = await pageTimings(s2)
    const bytes = bytesByType(
      requests2.list().filter((r) => !r.fromServiceWorker && !r.fromCache),
      timings.timeOrigin + state.interactive,
    )
    requests2.stop()
    const data = dataMeasures(after.measures)
    return {
      ttfb: timings.ttfb,
      fcp: timings.fcp,
      content: state.painted,
      balanceFinal: final,
      interactive: state.interactive,
      tbt: blockingTime(timings.longTasks, 0, state.interactive),
      networkKb: (bytes.js + bytes.css + bytes.font + bytes.html + bytes.other) / 1024,
      ...data,
    }
  } finally {
    await second?.close()
    await first.dispose()
  }
}

/** The data layer's own performance measures (see src/lib/perfMarks.ts), summed by phase. */
export function dataMeasures(measures) {
  const out = {}
  for (const m of measures) {
    if (!m.name.startsWith('settle:')) continue
    const key = m.name.replace(/^settle:/, '')
    out[`data:${key}`] = (out[`data:${key}`] ?? 0) + m.duration
    // When the data layer starts (ms after navigation start): everything before it is loading
    // and evaluating the app's code, so this isolates module-evaluation cost from the rest.
    if (out['data:start'] === undefined || m.start < out['data:start']) out['data:start'] = m.start
  }
  const loads = Object.entries(out)
    .filter(([k]) => k.startsWith('data:load:'))
    .reduce((sum, [, v]) => sum + v, 0)
  if (loads > 0) out['data:load:total'] = loads
  return out
}

/* ------------------------------------------------------------------ 3. screen opens */

/** Taps `tap` (an in-page expression for the element) and times until `ready` has painted. */
async function timeTap(session, tap, ready, { timeout = 30_000 } = {}) {
  return evaluate(
    session,
    `(async () => {
      const el = ${tap}
      if (!el) throw new Error('Nothing to tap: ' + ${JSON.stringify(tap)})
      const ready = ${ready}
      const firstTask = (window.__bench?.longTasks ?? []).length
      let t0 = 0
      const done = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Screen did not appear: ' + ${JSON.stringify(ready)})), ${timeout})
        const tick = () => {
          let ok = false
          try { ok = !!ready() } catch {}
          if (!ok) return requestAnimationFrame(tick)
          const found = performance.now()
          const channel = new MessageChannel()
          channel.port1.onmessage = () => { clearTimeout(timer); resolve({ found, painted: performance.now() }) }
          channel.port2.postMessage(0)
        }
        requestAnimationFrame(tick)
      })
      t0 = performance.now()
      el.click()
      const r = await done
      const tasks = (window.__bench?.longTasks ?? []).slice(firstTask)
      return { found: r.found - t0, painted: r.painted - t0, longTasks: tasks.length, longTaskMs: tasks.reduce((s, t) => s + t[1], 0) }
    })()`,
    { timeout: timeout + 5000 },
  )
}

/** Goes Back in history and waits for `ready`. */
async function back(session, ready) {
  await evaluate(
    session,
    `(async () => {
      const ready = ${ready}
      history.back()
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => requestAnimationFrame(r))
        try { if (ready()) return true } catch {}
      }
      throw new Error('Back did not land')
    })()`,
  )
}

/** The screen-open journey: each step is [label, tap, ready]. */
export const JOURNEY = [
  ['Home → Activity (tab)', TAP.tab('/app/activity'), READY.activity],
  ['Activity → Expense (bill)', TAP.ariaPrefix('Dinner at Toit Brewpub,'), READY.expenseBill],
  ['back', null, READY.activity],
  ['Activity → Groups (tab)', TAP.tab('/app/groups'), READY.groups],
  ['Groups → Group detail (300)', TAP.ariaPrefix('Flat 302, Koramangala,'), READY.groupDetail],
  ['back', null, READY.groups],
  ['Groups → Home (tab)', TAP.tab('/app'), READY.home],
  ['Home → New split', TAP.button('Split amount'), READY.newSplit],
  ['back', null, READY.home],
  ['Home → Bill flow', TAP.button('Scan bill'), READY.billFlow],
  ['back', null, READY.home],
  ['Home → You (tab)', TAP.tab('/app/you'), READY.you],
  ['You → Home (tab)', TAP.tab('/app'), READY.home],
]

/**
 * Shorter journeys for checking one fix quickly (`bench/ab.mjs --journey group`): the same steps
 * and readiness checks as the full journey, from Home.
 */
export const JOURNEYS = {
  full: JOURNEY,
  group: [
    ['Home → Groups (tab)', TAP.tab('/app/groups'), READY.groups],
    ['Groups → Group detail (300)', TAP.ariaPrefix('Flat 302, Koramangala,'), READY.groupDetail],
  ],
  activity: [
    ['Home → Activity (tab)', TAP.tab('/app/activity'), READY.activity],
    ['Activity → Expense (bill)', TAP.ariaPrefix('Dinner at Toit Brewpub,'), READY.expenseBill],
    ['back', null, READY.activity],
  ],
}

/** One pass through the journey on a freshly opened app (heavy data), after it settles. */
export async function navigationRun(env, profile, { journey = JOURNEY } = {}) {
  const page = await freshPage(env, profile, { data: 'heavy', watchers: { home: READY.home } })
  const s = page.session
  try {
    const requests = recordRequests(s)
    await load(s, `${env.origin}/app`, 'home')
    await waitSettled(s, requests, { quiet: 1000 })
    const out = {}
    for (const [label, tap, ready] of journey) {
      if (label === 'back') {
        await back(s, ready)
      } else {
        const r = await timeTap(s, tap, ready)
        out[label] = r.painted
        out[`${label} · long tasks ms`] = r.longTaskMs
      }
      await waitSettled(s, requests, { quiet: 500 })
    }
    requests.stop()
    return out
  } finally {
    await page.dispose()
  }
}

/* ------------------------------------------------------------------ 4. scrolling */

/**
 * Scrolls a list to its oldest row. `mode`:
 * - fling: scrolls at `speed` px/s (time-based, like repeated flings) — frame times and jank;
 * - jump: jumps to the bottom every frame — how fast the older rows can load at all.
 */
async function scrollToOldest(session, target, { mode, speed = 10_000, timeout = 240_000 }) {
  return evaluate(
    session,
    `(async () => {
      const find = () => ${target}
      window.scrollTo(0, 0)
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r))
      const firstTask = (window.__bench?.longTasks ?? []).length
      const frames = []
      let stalledMs = 0
      const t0 = performance.now()
      let last = t0
      const visible = () => {
        const el = find()
        if (!el) return false
        const r = el.getBoundingClientRect()
        return r.bottom > 0 && r.top < innerHeight
      }
      const result = await new Promise((resolve) => {
        const step = (now) => {
          const dt = now - last
          last = now
          frames.push(dt)
          if (visible()) return resolve({ reached: true, ms: now - t0 })
          if (now - t0 > ${timeout}) return resolve({ reached: false, ms: now - t0 })
          const max = document.documentElement.scrollHeight - innerHeight
          if (window.scrollY >= max - 1) stalledMs += dt
          if (${JSON.stringify(mode)} === 'jump') window.scrollTo(0, max)
          else window.scrollBy(0, Math.max(1, (${speed} * dt) / 1000))
          requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })
      const tasks = (window.__bench?.longTasks ?? []).slice(firstTask)
      const sorted = frames.slice(1).sort((a, b) => a - b)
      const p = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null
      return {
        reached: result.reached,
        timeToOldest: result.ms,
        frames: sorted.length,
        longFrames: sorted.filter((d) => d > 16.7 + 2).length,
        droppedFrames: sorted.reduce((n, d) => n + Math.max(0, Math.round(d / 16.667) - 1), 0),
        p50Frame: p(0.5),
        p95Frame: p(0.95),
        maxFrame: sorted.at(-1) ?? null,
        longTasks: tasks.length,
        longTaskMs: tasks.reduce((s, t) => s + t[1], 0),
        stalledMs,
        domNodes: document.getElementsByTagName('*').length,
      }
    })()`,
    { timeout: timeout + 10_000 },
  )
}

/**
 * Opens the list (Activity, or the 300-expense group) on a freshly loaded app with heavy data
 * and scrolls to its oldest row.
 */
export async function scrollRun(env, profile, { list, mode }) {
  const page = await freshPage(env, profile, { data: 'heavy', watchers: { home: READY.home } })
  const s = page.session
  try {
    const requests = recordRequests(s)
    await load(s, `${env.origin}/app`, 'home')
    await waitSettled(s, requests, { quiet: 1000 })
    if (list === 'activity') {
      await timeTap(s, TAP.tab('/app/activity'), READY.activity)
    } else {
      await timeTap(s, TAP.tab('/app/groups'), READY.groups)
      await waitSettled(s, requests, { quiet: 500 })
      await timeTap(s, TAP.ariaPrefix('Flat 302, Koramangala,'), READY.groupDetail)
    }
    await waitSettled(s, requests, { quiet: 1000 })
    const r = await scrollToOldest(s, list === 'activity' ? OLDEST.activity : OLDEST.group, { mode })
    requests.stop()
    if (!r.reached) r.timeToOldest = null
    return r
  } finally {
    await page.dispose()
  }
}
