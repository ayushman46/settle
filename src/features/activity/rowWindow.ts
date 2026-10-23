/**
 * Windowing for Activity's long list: which rows of a month are near the screen, so only those
 * are in the DOM — the rest are blank space of the same height. Two years of history (1,500
 * rows, ~26,000 elements) cost a budget phone a long task per page of rows and a minute to scroll
 * to the oldest; windowed, any part of the history is one small render away.
 *
 * Heights: a row is measured once it has been on screen (remembered for the visit, per screen
 * width, so coming Back lands on the same pixel); rows never seen use the typical row height.
 */

/** Rendered ranges snap to blocks of this many rows: a scroll re-renders a month every ~10 rows. */
export const BLOCK = 10
/** An expense row's height before it is measured (the row's min-height at the default text size). */
export const DEFAULT_ROW_HEIGHT = 72

/** [start, end) — rows `start` to `end - 1` of a list. */
export type Range = readonly [number, number]

export const EMPTY_RANGE: Range = [0, 0]

/* ------------------------------------------------------------------ measured heights */

const measured = new Map<string, number>()
let measuredWidth = -1
/** Typical row height for rows not measured yet: the first rows measured at this width. */
let typical = DEFAULT_ROW_HEIGHT
let typicalSamples = 0

function sameWidth(width: number): void {
  if (width === measuredWidth) return
  measured.clear()
  measuredWidth = width
  typical = DEFAULT_ROW_HEIGHT
  typicalSamples = 0
}

/** The height a row takes (measured, else the typical row height). */
export function rowHeight(id: string): number {
  return measured.get(id) ?? typical
}

/**
 * Records rows' measured heights at the current screen width (a new width forgets the old ones).
 * Zero heights (not laid out, e.g. a hidden screen) are ignored. Returns whether any height changed.
 */
export function noteRowHeights(width: number, rows: Iterable<readonly [string, number]>): boolean {
  sameWidth(width)
  let changed = false
  for (const [id, height] of rows) {
    if (!(height > 0)) continue
    if (measured.get(id) !== height) {
      measured.set(id, height)
      changed = true
    }
    // The typical height settles on the first screenful measured, then stays put, so blank
    // space for rows never seen doesn't change size under the reader as more rows are measured.
    if (typicalSamples < 2 * BLOCK) {
      typical = (typical * typicalSamples + height) / (typicalSamples + 1)
      typicalSamples += 1
    }
  }
  return changed
}

/** Forgets every measurement (between tests). */
export function forgetRowHeights(): void {
  measured.clear()
  measuredWidth = -1
  typical = DEFAULT_ROW_HEIGHT
  typicalSamples = 0
}

/* ------------------------------------------------------------------ which rows to render */

/** Offsets of each row's top from the list's top, plus the total height at the end (`n + 1` values). */
export function rowOffsets(heights: readonly number[]): number[] {
  const offsets = new Array<number>(heights.length + 1)
  offsets[0] = 0
  for (let i = 0; i < heights.length; i += 1) offsets[i + 1] = (offsets[i] ?? 0) + (heights[i] ?? 0)
  return offsets
}

/** Rows that overlap the band [from, to] (pixels relative to the list's top); empty when none do. */
export function rowsIn(offsets: readonly number[], from: number, to: number): Range {
  const n = offsets.length - 1
  if (n <= 0) return EMPTY_RANGE
  const total = offsets[n] ?? 0
  if (to < 0 || from > total) return EMPTY_RANGE
  // First row whose bottom is below `from`; last row whose top is above `to`.
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((offsets[mid + 1] ?? 0) <= from) lo = mid + 1
    else hi = mid
  }
  const start = lo
  lo = start
  hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((offsets[mid] ?? 0) < to) lo = mid + 1
    else hi = mid
  }
  const end = Math.max(start, lo)
  return start < end ? [start, end] : EMPTY_RANGE
}

function snap(range: Range, n: number): Range {
  if (range[0] >= range[1]) return EMPTY_RANGE
  return [Math.floor(range[0] / BLOCK) * BLOCK, Math.min(n, Math.ceil(range[1] / BLOCK) * BLOCK)]
}

function covers(outer: Range, inner: Range): boolean {
  return inner[0] >= inner[1] || (outer[0] <= inner[0] && inner[1] <= outer[1])
}

/**
 * The rows to render, given the rows rendered now: kept while they still cover what is (nearly)
 * on screen and aren't far off it — so a scroll re-renders only every half screen or so — else
 * moved to the screen plus one screen either way, snapped to blocks.
 *
 * `listTop` is the list's top relative to the top of the viewport (`getBoundingClientRect().top`).
 */
export function nextRange(current: Range, offsets: readonly number[], listTop: number, viewport: number): Range {
  const n = offsets.length - 1
  const band = (above: number, below: number): Range => rowsIn(offsets, -listTop - above * viewport, -listTop + (1 + below) * viewport)
  const need = band(0.5, 0.5)
  const keep = snap(band(2.5, 2.5), n)
  if (covers(current, need) && covers(keep, current)) return current
  const want = snap(band(1, 1), n)
  return want[0] === current[0] && want[1] === current[1] ? current : want
}

/** The first screen's rows of a list starting at row `first` of the whole list (before anything is measured). */
export function initialRange(first: number, n: number, rows: number): Range {
  const end = Math.min(n, rows - first)
  return end > 0 ? [0, end] : EMPTY_RANGE
}

/* ------------------------------------------------------------------ the viewport */

const listeners = new Set<() => void>()
let frame: number | null = null

function run(): void {
  frame = null
  for (const listener of [...listeners]) listener()
}

/** Asks every windowed list to check its rows on the next frame (after a scroll, a resize or a render that moved things). */
export function requestWindowCheck(): void {
  if (frame !== null || listeners.size === 0) return
  frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : (setTimeout(run, 16) as unknown as number)
}

function onViewport(): void {
  requestWindowCheck()
}

/** Calls `listener` (once per frame at most) whenever the page scrolls or the window resizes. Returns the unsubscribe. */
export function watchViewport(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('scroll', onViewport, { passive: true })
    window.addEventListener('resize', onViewport, { passive: true })
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('scroll', onViewport)
      window.removeEventListener('resize', onViewport)
      if (frame !== null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
        else clearTimeout(frame)
        frame = null
      }
    }
  }
}
