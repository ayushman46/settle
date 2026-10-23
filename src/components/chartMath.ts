/** Pure maths behind DonutChart and BarChart (kept apart so it's easy to test and component files only export components). */
import { t } from '../i18n'

/**
 * Whole percentages that always add up to exactly 100 (largest remainder), so a legend never
 * reads "33% + 33% + 33%". Non-positive or non-finite values count as 0. All zeros → all 0.
 */
export function wholePercents(values: readonly number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = clean.reduce((a, b) => a + b, 0)
  if (total <= 0) return clean.map(() => 0)
  const raw = clean.map((v) => (v / total) * 100)
  const floors = raw.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .filter(({ i }) => (clean[i] ?? 0) > 0)
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = (floors[i] ?? 0) + 1
    left -= 1
  }
  return floors
}

export interface DonutSegment {
  index: number
  /** Dash length along a circle of `ARC_UNITS` units. */
  length: number
  /** Where the dash starts (units from 12 o'clock, clockwise). */
  start: number
  /** Share of the total, 0..1. */
  fraction: number
}

/** The circumference every segment is measured in (`pathLength`). */
export const ARC_UNITS = 1000

/**
 * Dash geometry for the donut's segments. Round caps add half the stroke at each end, so each
 * dash is shortened by one stroke-width (`capUnits`) plus `gapUnits`, keeping visible gaps even;
 * tiny slices become dots instead of disappearing. Non-positive values get no segment.
 */
export function donutSegments(values: readonly number[], capUnits: number, gapUnits: number): DonutSegment[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = clean.reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const live = clean.filter((v) => v > 0).length
  const segments: DonutSegment[] = []
  let at = 0
  clean.forEach((v, index) => {
    if (v <= 0) return
    const span = (v / total) * ARC_UNITS
    const trim = live > 1 ? capUnits + gapUnits : 0
    const length = Math.max(0.001, span - trim)
    segments.push({ index, length, start: at + (live > 1 ? (capUnits + gapUnits) / 2 : 0), fraction: v / total })
    at += span
  })
  return segments
}

/** "Food 42%, Travel 30% and 2 more" — a short spoken summary of the biggest parts. */
export function summarize(parts: ReadonlyArray<{ label: string; percent: number }>, shown = 3): string {
  const sorted = [...parts].filter((p) => p.percent > 0).sort((a, b) => b.percent - a.percent)
  if (sorted.length === 0) return t('ui.chart.summary.empty')
  const head = sorted.slice(0, shown).map((p) => `${p.label} ${p.percent}%`)
  const rest = sorted.length - head.length
  if (rest > 0) return t('ui.chart.summary.more', { list: head.join(', '), count: rest })
  if (head.length === 1) return head[0] ?? ''
  return t('ui.list.last', { list: head.slice(0, -1).join(', '), last: head[head.length - 1] ?? '' })
}

/** Bar heights as fractions of the tallest bar (0..1); a non-zero bar is never thinner than `min`. */
export function barHeights(values: readonly number[], min = 0.02): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const max = Math.max(0, ...clean)
  if (max <= 0) return clean.map(() => 0)
  return clean.map((v) => (v <= 0 ? 0 : Math.max(min, v / max)))
}
