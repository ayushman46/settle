/** Small, dependency-free statistics for benchmark samples. */

export function sorted(values) {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
}

/** Linear-interpolated quantile (q in 0..1). */
export function quantile(values, q) {
  const s = sorted(values)
  if (s.length === 0) return null
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

export const median = (values) => quantile(values, 0.5)

/** { p50, min, max, q1, q3, n } for a sample. */
export function summarize(values) {
  const s = sorted(values)
  if (s.length === 0) return { p50: null, min: null, max: null, q1: null, q3: null, n: 0 }
  return { p50: quantile(s, 0.5), min: s[0], max: s[s.length - 1], q1: quantile(s, 0.25), q3: quantile(s, 0.75), n: s.length }
}

/** Summarizes each numeric key across an array of run records. */
export function summarizeRuns(runs) {
  const keys = new Set()
  for (const run of runs) for (const [k, v] of Object.entries(run)) if (typeof v === 'number') keys.add(k)
  const out = {}
  for (const key of keys) out[key] = summarize(runs.map((r) => r[key]))
  return out
}

export function fmtMs(v) {
  if (v === null || v === undefined) return '—'
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`
}

export function fmtKb(bytes) {
  if (bytes === null || bytes === undefined) return '—'
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** "1.23 s (1.10–1.40)" style: median with the min–max spread. */
export function fmtSpread(stat, fmt = fmtMs) {
  if (!stat || stat.p50 === null) return '—'
  if (stat.n <= 1) return fmt(stat.p50)
  return `${fmt(stat.p50)} (${fmt(stat.min)}–${fmt(stat.max)})`
}
