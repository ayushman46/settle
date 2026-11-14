import { describe, expect, it } from 'vitest'
import { fairFare, fareLegs, type FareRider } from './engine'

const A: FareRider = { id: 'a', name: 'Asha' }
const B: FareRider = { id: 'b', name: 'Bilal' }
const C: FareRider = { id: 'c', name: 'Chitra' }
const D: FareRider = { id: 'd', name: 'Dev' }
const sum = (amounts: Record<string, number>) => Object.values(amounts).reduce((s, v) => s + v, 0)

describe('fareLegs', () => {
  it('cuts the ride at each stop; whoever isn’t listed rides to the end', () => {
    const legs = fareLegs([A, B, C], [['a'], ['b']])
    expect(legs.map((l) => [l.riderIds, l.offIds])).toEqual([
      [['a', 'b', 'c'], ['a']],
      [['b', 'c'], ['b']],
      [['c'], ['c']],
    ])
  })

  it('ignores unknown ids, repeats and empty stops', () => {
    const legs = fareLegs([A, B], [[], ['x', 'a'], ['a'], ['b', 'b']])
    expect(legs.map((l) => l.offIds)).toEqual([['a'], ['b']])
  })
})

describe('fairFare', () => {
  it('₹100 among 3 with 3 legs adds up to the paisa, the first off pays least', () => {
    const r = fairFare({ riders: [A, B, C], total: 10_000, stops: [['a'], ['b']] })
    // Leg cost ₹33.33…: Asha 1/3 of leg 1; Bilal 1/3 + 1/2; Chitra 1/3 + 1/2 + 1.
    expect(r.amounts).toEqual({ a: 1_111, b: 2_778, c: 6_111 })
    expect(sum(r.amounts)).toBe(10_000)
    expect(r.people.map((p) => [p.id, p.legsRidden])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    expect(r.equal).toBe(false)
  })

  it('everyone off at the end is an equal split, with the odd paisa going by name', () => {
    const r = fairFare({ riders: [C, B, A], total: 10_000, stops: [] })
    expect(r.equal).toBe(true)
    expect(r.amounts).toEqual({ a: 3_334, b: 3_333, c: 3_333 })
    // All tapped at one stop is the same thing.
    expect(fairFare({ riders: [C, B, A], total: 10_000, stops: [['a', 'b', 'c']] }).amounts).toEqual(r.amounts)
  })

  it('people getting off together share their legs equally', () => {
    const r = fairFare({ riders: [A, B, C, D], total: 40_000, stops: [['a', 'b']] })
    // Leg 1 ₹200 by 4 = ₹50 each; leg 2 ₹200 by 2 = ₹100 each.
    expect(r.amounts).toEqual({ a: 5_000, b: 5_000, c: 15_000, d: 15_000 })
    expect(r.legs).toHaveLength(2)
  })

  it('distances weigh the legs when every leg has one', () => {
    const r = fairFare({ riders: [A, B], total: 60_000, stops: [['a']], km: [4, 8] })
    // 4 km shared (₹200 → ₹100 each), 8 km Bilal alone (₹400).
    expect(r.byKm).toBe(true)
    expect(r.amounts).toEqual({ a: 10_000, b: 50_000 })
    expect(r.people.map((p) => p.kmRidden)).toEqual([4, 12])
  })

  it('decimal km and awkward totals still add up exactly', () => {
    const r = fairFare({ riders: [A, B, C], total: 47_337, stops: [['c'], ['a']], km: [3.7, 2.15, 9.9] })
    expect(sum(r.amounts)).toBe(47_337)
    expect(r.amounts.c).toBeLessThan(r.amounts.a ?? 0)
    expect(r.amounts.a).toBeLessThan(r.amounts.b ?? 0)
  })

  it('a missing distance falls back to equal legs', () => {
    const r = fairFare({ riders: [A, B], total: 60_000, stops: [['a']], km: [4, null] })
    expect(r.byKm).toBe(false)
    expect(r.amounts).toEqual({ a: 15_000, b: 45_000 })
    expect(r.people.every((p) => p.kmRidden === null)).toBe(true)
  })

  it('a single rider pays it all', () => {
    const r = fairFare({ riders: [A], total: 12_345, stops: [['a']] })
    expect(r.amounts).toEqual({ a: 12_345 })
    expect(r.equal).toBe(true)
  })

  it('a zero or broken total pays nothing', () => {
    expect(fairFare({ riders: [A, B], total: 0, stops: [['a']] }).amounts).toEqual({ a: 0, b: 0 })
    expect(fairFare({ riders: [A, B], total: Number.NaN, stops: [] }).amounts).toEqual({ a: 0, b: 0 })
  })

  it('many riders, one off at a time, always sums to the total', () => {
    const riders = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, name: `Rider ${i}` }))
    for (const total of [1, 7, 100, 9_999, 123_457]) {
      const r = fairFare({ riders, total, stops: riders.slice(0, 8).map((x) => [x.id]) })
      expect(sum(r.amounts)).toBe(total)
    }
  })
})
