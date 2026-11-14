import { describe, expect, it } from 'vitest'
import type { Expense, Group } from '../../domain/types'
import { FAIR_EQUAL_PART, MIN_LABEL_DEGREES, groupSpinSlices, percentText, seededRandom, spin, spinSlices, wheelLabels, wheelNames } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha' }
const nameOf = (id: string): string => NAMES[id] ?? id
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

describe('spinSlices', () => {
  it('pure luck: equal slices, the same percentage each, ordered by name', () => {
    const s = spinSlices(['sam', 'me', 'riya'], { sam: -5000, me: 5000 }, 'luck', nameOf)
    expect(s.map((x) => x.id)).toEqual(['me', 'riya', 'sam'])
    expect(s.map((x) => x.percent)).toEqual([33.3, 33.3, 33.3])
    expect(sum(s.map((x) => x.weight))).toBeCloseTo(1, 12)
    expect(s[0]!.start).toBe(0)
    expect(s[2]!.end).toBe(360)
  })

  it('fair: whoever is behind gets a bigger slice, everyone keeps half an equal slice', () => {
    // Sam is ₹600 behind, Neha ₹200 behind, Ayush and Riya ahead.
    const s = spinSlices(['me', 'riya', 'sam', 'neha'], { me: 50_000, riya: 30_000, sam: -60_000, neha: -20_000 }, 'fair', nameOf)
    const by = Object.fromEntries(s.map((x) => [x.id, x]))
    expect(by.sam!.weight).toBeCloseTo(FAIR_EQUAL_PART / 4 + 0.5 * 0.75, 12)
    expect(by.neha!.weight).toBeCloseTo(FAIR_EQUAL_PART / 4 + 0.5 * 0.25, 12)
    expect(by.me!.weight).toBeCloseTo(FAIR_EQUAL_PART / 4, 12)
    expect(by.riya!.weight).toBe(by.me!.weight)
    expect(by.sam!.behind).toBe(60_000)
    expect(sum(s.map((x) => x.percent))).toBe(100)
    expect(s.map((x) => [x.id, x.percent])).toEqual([
      ['me', 12.5],
      ['neha', 25],
      ['riya', 12.5],
      ['sam', 50],
    ])
  })

  it('fair falls back to equal when nobody is behind', () => {
    const s = spinSlices(['me', 'riya'], { me: 0, riya: 0 }, 'fair', nameOf)
    expect(s.map((x) => x.percent)).toEqual([50, 50])
    expect(spinSlices(['me', 'riya'], {}, 'fair', nameOf).map((x) => x.weight)).toEqual([0.5, 0.5])
  })

  it('ties get the same slice', () => {
    const s = spinSlices(['me', 'riya', 'sam'], { me: 20_000, riya: -10_000, sam: -10_000 }, 'fair', nameOf)
    expect(s[1]!.weight).toBe(s[2]!.weight)
  })

  it('works for one, none, and a hundred people', () => {
    expect(spinSlices([], {}, 'fair', nameOf)).toEqual([])
    const one = spinSlices(['me'], { me: -100 }, 'fair', nameOf)
    expect(one).toMatchObject([{ id: 'me', percent: 100, start: 0, end: 360 }])
    const ids = Array.from({ length: 100 }, (_, i) => `p${String(i).padStart(3, '0')}`)
    const balances = Object.fromEntries(ids.map((id, i) => [id, i % 2 === 0 ? -(i + 1) * 100 : (i + 1) * 100]))
    const many = spinSlices(ids, balances, 'fair', nameOf)
    expect(many).toHaveLength(100)
    expect(Math.abs(sum(many.map((x) => x.percent)) - 100)).toBeLessThanOrEqual(0.05 * 100)
    expect(sum(many.map((x) => x.weight))).toBeCloseTo(1, 10)
    for (const x of many) expect(x.weight).toBeGreaterThanOrEqual(FAIR_EQUAL_PART / 100 - 1e-15)
    for (let i = 1; i < many.length; i++) expect(many[i]!.start).toBeCloseTo(many[i - 1]!.end, 9)
  })

  it('ignores junk balances and duplicate ids', () => {
    const s = spinSlices(['me', 'me', 'riya'], { me: Number.NaN, riya: -100 }, 'fair', nameOf)
    expect(s).toHaveLength(2)
    expect(s.find((x) => x.id === 'riya')!.weight).toBeCloseTo(0.75, 12)
  })
})

describe('spin', () => {
  const slices = spinSlices(['me', 'riya', 'sam', 'neha'], { sam: -60_000, neha: -20_000, me: 80_000 }, 'fair', nameOf)

  it('is deterministic with a seeded generator', () => {
    const run = (seed: number): string[] => {
      const r = seededRandom(seed)
      return Array.from({ length: 20 }, () => spin(slices, r)!.id)
    }
    expect(run(42)).toEqual(run(42))
    expect(run(42)).not.toEqual(run(43))
  })

  it('lands inside the winner’s slice', () => {
    const r = seededRandom(7)
    for (let i = 0; i < 200; i++) {
      const result = spin(slices, r)!
      const slice = slices.find((s) => s.id === result.id)!
      expect(result.angle).toBeGreaterThanOrEqual(slice.start)
      expect(result.angle).toBeLessThan(slice.end)
    }
  })

  it('picks in proportion to the slices over many spins', () => {
    const r = seededRandom(123)
    const counts: Record<string, number> = {}
    const N = 20_000
    for (let i = 0; i < N; i++) {
      const id = spin(slices, r)!.id
      counts[id] = (counts[id] ?? 0) + 1
    }
    for (const s of slices) expect(Math.abs((counts[s.id] ?? 0) / N - s.weight)).toBeLessThan(0.02)
  })

  it('handles the edges of the random range and an empty wheel', () => {
    expect(spin(slices, () => 0)!.id).toBe(slices[0]!.id)
    expect(spin(slices, () => 0.9999999999)!.id).toBe(slices[slices.length - 1]!.id)
    expect(spin(slices, () => 1)!.id).toBe(slices[slices.length - 1]!.id)
    expect(spin(slices, () => Number.NaN)!.id).toBe(slices[0]!.id)
    expect(spin([], () => 0.5)).toBeNull()
  })
})

describe('groupSpinSlices', () => {
  const group: Group = { id: 'g', name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: ['me', 'riya', 'sam'], settlements: [], createdAt: 1, updatedAt: 1, archived: false }
  const dinner = (payerId: string, currency = 'INR'): Expense => ({
    id: `d-${payerId}-${currency}`,
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency,
    total: 90_000,
    date: '2026-11-10',
    createdAt: 1,
    updatedAt: 1,
    payerId,
    mode: 'equal',
    participants: [],
    shares: { me: 30_000, riya: 30_000, sam: 30_000 },
    roundedToWhole: false,
    note: null,
    groupId: 'g',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  })

  it('uses the group’s balances, without anyone left out', () => {
    const s = groupSpinSlices(group, [dinner('me')], 'fair', new Set(['riya']), nameOf)
    expect(s.map((x) => x.id)).toEqual(['me', 'sam'])
    expect(s.find((x) => x.id === 'sam')!.percent).toBe(75)
  })

  it('other currencies don’t count', () => {
    const s = groupSpinSlices(group, [dinner('me', 'USD')], 'fair', new Set(), nameOf)
    expect(s.map((x) => x.percent)).toEqual([33.3, 33.3, 33.3])
  })
})

describe('chances people can trust', () => {
  it('people with the same standing show the same chance, to one decimal', () => {
    // Aman left out: Sana, Tej and Vikram are equal on a wheel where You are behind.
    const names: Record<string, string> = { me: 'Ayush', sana: 'Sana', tej: 'Tej', vik: 'Vikram' }
    const s = spinSlices(['me', 'sana', 'tej', 'vik'], { me: -98_000, sana: 10_000, tej: 10_000, vik: 10_000 }, 'fair', (id) => names[id] ?? id)
    expect(s.map((x) => percentText(x.percent))).toEqual(['62.5', '12.5', '12.5', '12.5'])
    const luck = spinSlices(['me', 'sana', 'tej', 'vik', 'riya', 'sam', 'neha', 'x'], {}, 'luck', nameOf)
    expect(new Set(luck.map((x) => x.percent))).toEqual(new Set([12.5]))
  })

  it('reads whole chances without a decimal', () => {
    expect(percentText(50)).toBe('50')
    expect(percentText(12.5)).toBe('12.5')
    expect(percentText(33.3)).toBe('33.3')
  })
})

describe('the names on the wheel', () => {
  it('writes first names, cut with an ellipsis, and an initial when first names clash', () => {
    expect(wheelNames(['Priyanka Raghunathan', 'Riya', 'You', 'Venkataraghavan S'])).toEqual(['Priyanka', 'Riya', 'You', 'Venkatar…'])
    expect(wheelNames(['Rahul Sharma', 'Rahul Verma', 'Rahul'])).toEqual(['Rahul S.', 'Rahul V.', 'Rahul'])
    expect(wheelNames(['  ', 'Sam'])).toEqual(['', 'Sam'])
  })

  it('never draws a name upside down where the wheel stops, at any turn', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`)
    const s = spinSlices(ids, {}, 'luck', (id) => id)
    for (const rotation of [0, 37, 180, 1890, 3605, -45]) {
      const labels = wheelLabels(s, (id) => id, rotation)
      expect(labels).toHaveLength(12)
      for (const l of labels) {
        const resting = (((l.angle + rotation) % 360) + 360) % 360
        // Read from the centre out on the right half, turned round on the left half.
        expect(l.flip).toBe(resting > 180)
      }
    }
  })

  it('labels every slice of an even wheel of 2 to 20, and skips slices too thin for a name', () => {
    for (let n = 2; n <= 20; n++) {
      const ids = Array.from({ length: n }, (_, i) => `p${String(i).padStart(2, '0')}`)
      expect(wheelLabels(spinSlices(ids, {}, 'luck', (id) => id), (id) => id, 0)).toHaveLength(n)
    }
    // Twenty people, one far behind: the others' slices are thinner than a line of text.
    const ids = Array.from({ length: 20 }, (_, i) => `p${String(i).padStart(2, '0')}`)
    const s = spinSlices(ids, { p00: -1_000_000 }, 'fair', (id) => id)
    const labels = wheelLabels(s, (id) => id, 0)
    expect(labels.map((l) => l.id)).toEqual(['p00'])
    for (const x of s.slice(1)) expect(x.end - x.start).toBeLessThan(MIN_LABEL_DEGREES)
    expect(wheelLabels(spinSlices(['me'], {}, 'luck', nameOf), nameOf, 0)).toEqual([])
  })
})
