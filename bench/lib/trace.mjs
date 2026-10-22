/**
 * Main-thread breakdown from a DevTools trace: how long the renderer's main thread spent in
 * script, style, layout, paint, parsing… (self time per trace event name), which a V8 CPU
 * profile can't show — it lumps rendering work into "(program)".
 */

const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'v8.execute',
  'blink',
  'loading',
  'blink.user_timing',
  // V8 parsing and compiling (BENCH_TRACE_V8=1): where module evaluation time goes.
  ...(process.env.BENCH_TRACE_V8 ? ['v8', 'disabled-by-default-v8.compile'] : []),
]

export async function startTrace(session) {
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: { includedCategories: CATEGORIES, recordMode: 'recordContinuously' },
  })
}

/** Ends tracing and returns the trace events. */
export async function stopTrace(session) {
  const complete = session.waitFor('Tracing.tracingComplete', { timeout: 120_000 })
  await session.send('Tracing.end')
  const { stream } = await complete
  let data = ''
  for (;;) {
    const chunk = await session.send('IO.read', { handle: stream, size: 1 << 20 })
    data += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data
    if (chunk.eof) break
  }
  await session.send('IO.close', { handle: stream })
  const parsed = JSON.parse(data)
  return Array.isArray(parsed) ? parsed : parsed.traceEvents
}

/** Self time (ms) per event name on the busiest renderer main thread. */
export function mainThreadBreakdown(events) {
  const names = new Map()
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') names.set(`${e.pid}:${e.tid}`, true)
  }
  // The renderer main thread with the most work is the page's.
  const busy = new Map()
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`
    if (e.ph === 'X' && names.has(key)) busy.set(key, (busy.get(key) ?? 0) + (e.dur ?? 0))
  }
  const main = [...busy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!main) return { total: 0, byName: [] }
  const list = events
    .filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === main && typeof e.dur === 'number')
    .sort((a, b) => a.ts - b.ts || b.dur - a.dur)
  const self = new Map()
  const frames = []
  const stack = []
  let total = 0
  for (const e of list) {
    while (stack.length > 0 && stack[stack.length - 1].end <= e.ts) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.child += e.dur
    else total += e.dur
    const frame = { e, end: e.ts + e.dur, child: 0 }
    stack.push(frame)
    frames.push(frame)
  }
  for (const { e, child } of frames) {
    const ms = Math.max(0, e.dur - child) / 1000
    self.set(e.name, (self.get(e.name) ?? 0) + ms)
  }
  return {
    total: total / 1000,
    byName: [...self.entries()].sort((a, b) => b[1] - a[1]),
    main,
  }
}
