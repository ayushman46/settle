/**
 * Startup timings for the benchmarks (`bench/`): `measured('load:parse:…', work)` runs `work` and
 * records a `performance.measure` named `settle:load:parse:…`. Each name is recorded once per
 * page load — the startup cost is what matters, and the timeline never grows with use.
 */
const recorded = new Set<string>()

export function measured<T>(name: string, work: () => T): T {
  if (recorded.has(name) || typeof performance === 'undefined' || typeof performance.measure !== 'function') return work()
  const start = performance.now()
  try {
    return work()
  } finally {
    recorded.add(name)
    try {
      performance.measure(`settle:${name}`, { start, end: performance.now() })
    } catch {
      // An older browser without measure options: no timing, same result.
    }
  }
}
