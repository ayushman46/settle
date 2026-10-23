import { afterEach, describe, expect, it } from 'vitest'
import {
  BLOCK,
  DEFAULT_ROW_HEIGHT,
  EMPTY_RANGE,
  forgetRowHeights,
  initialRange,
  nextRange,
  noteRowHeights,
  rowHeight,
  rowOffsets,
  rowsIn,
  type Range,
} from './rowWindow'

afterEach(() => forgetRowHeights())

/** `n` rows of `h` px. */
const even = (n: number, h = 72) => rowOffsets(Array.from({ length: n }, () => h))

describe('rowOffsets', () => {
  it('gives each row its top and the total at the end', () => {
    expect(rowOffsets([10, 20, 30])).toEqual([0, 10, 30, 60])
    expect(rowOffsets([])).toEqual([0])
  })
})

describe('rowsIn', () => {
  it('finds the rows overlapping a band, edges excluded', () => {
    const offsets = even(10, 100)
    expect(rowsIn(offsets, 0, 100)).toEqual([0, 1])
    expect(rowsIn(offsets, 50, 250)).toEqual([0, 3])
    expect(rowsIn(offsets, 100, 200)).toEqual([1, 2])
    expect(rowsIn(offsets, 950, 5000)).toEqual([9, 10])
  })

  it('is empty above, below, or for an empty list', () => {
    const offsets = even(10, 100)
    expect(rowsIn(offsets, -500, -1)).toEqual(EMPTY_RANGE)
    expect(rowsIn(offsets, 1001, 2000)).toEqual(EMPTY_RANGE)
    expect(rowsIn(offsets, 1000, 2000)).toEqual(EMPTY_RANGE)
    expect(rowsIn(rowOffsets([]), 0, 100)).toEqual(EMPTY_RANGE)
  })

  it('agrees with a linear scan for every band over uneven rows', () => {
    const heights = [72, 96, 72, 72, 120, 72, 1, 72, 96, 72, 72, 72]
    const offsets = rowOffsets(heights)
    for (let from = -100; from < 1000; from += 37) {
      for (let to = from; to < 1100; to += 53) {
        const hits = heights.map((_, i) => (offsets[i + 1] ?? 0) > from && (offsets[i] ?? 0) < to)
        const start = hits.indexOf(true)
        const expected: Range = start === -1 ? EMPTY_RANGE : [start, hits.lastIndexOf(true) + 1]
        expect(rowsIn(offsets, from, to), `${from}..${to}`).toEqual(expected)
      }
    }
  })
})

describe('nextRange', () => {
  // 100 rows of 72px; a 800px screen.
  const offsets = even(100)
  const at = (scroll: number, current: Range) => nextRange(current, offsets, 200 - scroll, 800)

  it('moves to the screen plus a screen either way, snapped to blocks', () => {
    const range = at(3000, EMPTY_RANGE)
    // The screen shows rows 38–49; a screen above and below reaches rows 27–61.
    expect(range).toEqual([20, 70])
    expect(range[0] % BLOCK).toBe(0)
  })

  it('keeps the same range (same object) while it still covers the screen', () => {
    const range = at(3000, EMPTY_RANGE)
    expect(at(3200, range)).toBe(range)
    expect(at(2800, range)).toBe(range)
  })

  it('moves once the screen nears its edge, or it is far from the screen', () => {
    const range = at(3000, EMPTY_RANGE)
    expect(at(4200, range)).not.toEqual(range)
    expect(at(0, [60, 100])).toEqual([0, 20])
  })

  it('renders nothing for a list far below or above the screen', () => {
    expect(nextRange([0, 20], offsets, 20_000, 800)).toEqual(EMPTY_RANGE)
    expect(nextRange([80, 100], offsets, -20_000, 800)).toEqual(EMPTY_RANGE)
    const none = EMPTY_RANGE
    expect(nextRange(none, offsets, 20_000, 800)).toBe(none)
  })

  it('reaches the last row at the bottom of the list', () => {
    const range = at(100 * 72 - 600, EMPTY_RANGE)
    expect(range[1]).toBe(100)
  })
})

describe('initialRange', () => {
  it('renders the list’s first rows, across months', () => {
    expect(initialRange(0, 62, 20)).toEqual([0, 20])
    expect(initialRange(15, 62, 20)).toEqual([0, 5])
    expect(initialRange(0, 3, 20)).toEqual([0, 3])
    expect(initialRange(20, 62, 20)).toEqual(EMPTY_RANGE)
    expect(initialRange(80, 62, 20)).toEqual(EMPTY_RANGE)
  })
})

describe('row heights', () => {
  it('uses the typical height until a row is measured', () => {
    expect(rowHeight('e1')).toBe(DEFAULT_ROW_HEIGHT)
    expect(noteRowHeights(360, [['e1', 96]])).toBe(true)
    expect(rowHeight('e1')).toBe(96)
    expect(noteRowHeights(360, [['e1', 96]])).toBe(false)
  })

  it('settles the typical height on the first rows measured, then keeps it', () => {
    noteRowHeights(360, Array.from({ length: 2 * BLOCK }, (_, i) => [`a${i}`, 80] as const))
    expect(rowHeight('never-seen')).toBe(80)
    noteRowHeights(360, Array.from({ length: 50 }, (_, i) => [`b${i}`, 200] as const))
    expect(rowHeight('never-seen')).toBe(80)
  })

  it('ignores rows that are not laid out, and forgets everything at a new width', () => {
    expect(noteRowHeights(360, [['e1', 0]])).toBe(false)
    expect(rowHeight('e1')).toBe(DEFAULT_ROW_HEIGHT)
    noteRowHeights(360, [['e1', 96]])
    noteRowHeights(412, [['e2', 72]])
    expect(rowHeight('e1')).toBe(DEFAULT_ROW_HEIGHT)
    expect(rowHeight('e2')).toBe(72)
  })
})
