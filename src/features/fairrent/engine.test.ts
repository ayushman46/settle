import { describe, expect, it } from 'vitest'
import {
  COMMON_DEFAULT,
  DEFAULT_FACTORS,
  dealWhole,
  fairRent,
  nameRank,
  roomArea,
  roomMultiplier,
  roomPoints,
  unplaced,
  wholeUnit,
  type FairPlan,
  type Room,
} from './engine'

let n = 0
function room(people: string[], patch: Partial<Room> = {}): Room {
  n += 1
  return { id: `r${n}`, size: 'medium', sqft: null, bath: false, balcony: false, ac: false, tweak: 0, people, ...patch }
}

function plan(rent: number, rooms: Room[], patch: Partial<FairPlan> = {}): FairPlan {
  return { rent, currency: 'INR', commonPct: COMMON_DEFAULT, factors: DEFAULT_FACTORS, rooms, ...patch }
}

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0)
const amounts = (p: FairPlan): Record<string, number> => Object.fromEntries(fairRent(p).people.map((x) => [x.friendId, x.amount]))

describe('room points', () => {
  it('goes by the typed area, else by what the size chip stands for', () => {
    expect(roomArea({ size: 'small', sqft: null })).toBe(90)
    expect(roomArea({ size: 'medium', sqft: null })).toBe(120)
    expect(roomArea({ size: 'large', sqft: null })).toBe(160)
    expect(roomArea({ size: 'small', sqft: 142 })).toBe(142)
    expect(roomArea({ size: 'large', sqft: 0 })).toBe(160)
    expect(roomArea({ size: 'large', sqft: Number.NaN })).toBe(160)
  })

  it('adds each extra the room has, and the manual nudge', () => {
    const bare = { bath: false, balcony: false, ac: false, tweak: 0 }
    expect(roomMultiplier(bare, DEFAULT_FACTORS)).toBe(100)
    expect(roomMultiplier({ ...bare, bath: true }, DEFAULT_FACTORS)).toBe(115)
    expect(roomMultiplier({ ...bare, balcony: true }, DEFAULT_FACTORS)).toBe(110)
    expect(roomMultiplier({ ...bare, ac: true }, DEFAULT_FACTORS)).toBe(110)
    expect(roomMultiplier({ bath: true, balcony: true, ac: true, tweak: 5 }, DEFAULT_FACTORS)).toBe(140)
    expect(roomMultiplier({ ...bare, tweak: -10 }, DEFAULT_FACTORS)).toBe(90)
    expect(roomMultiplier({ ...bare, bath: true }, { bath: 30, balcony: 0, ac: 0 })).toBe(130)
  })

  it('keeps junk factors and nudges inside their limits', () => {
    const bare = { bath: true, balcony: false, ac: false, tweak: 0 }
    expect(roomMultiplier(bare, { bath: 900, balcony: 0, ac: 0 })).toBe(150)
    expect(roomMultiplier(bare, { bath: -40, balcony: 0, ac: 0 })).toBe(100)
    expect(roomMultiplier({ ...bare, bath: false, tweak: -500 }, DEFAULT_FACTORS)).toBe(80)
    expect(roomMultiplier({ ...bare, bath: false, tweak: Number.NaN }, DEFAULT_FACTORS)).toBe(100)
    expect(roomPoints(room([], { sqft: 200, bath: true }), DEFAULT_FACTORS)).toBeCloseTo(230)
  })
})

describe('dealWhole', () => {
  it('gives the units left over to the largest fractions, ties by rank', () => {
    expect(dealWhole(100, [1, 1, 1], [0, 1, 2])).toEqual([34, 33, 33])
    expect(dealWhole(100, [1, 1, 1], [2, 0, 1])).toEqual([33, 34, 33])
    expect(dealWhole(101, [1, 1, 1], [2, 0, 1])).toEqual([33, 34, 34])
    expect(dealWhole(10, [3, 1], [0, 1])).toEqual([8, 2])
    expect(dealWhole(7, [0.6, 0.4], [0, 1])).toEqual([4, 3])
  })

  it('copes with nothing, zero weights and junk', () => {
    expect(dealWhole(100, [], [])).toEqual([])
    expect(dealWhole(0, [1, 2], [0, 1])).toEqual([0, 0])
    expect(dealWhole(9, [0, 0, 0], [0, 1, 2])).toEqual([3, 3, 3])
    expect(dealWhole(9, [Number.NaN, -4, 1], [0, 1, 2])).toEqual([0, 0, 9])
    expect(dealWhole(-5, [1, 1], [0, 1])).toEqual([0, 0])
  })

  it('always adds up, whatever the weights', () => {
    let seed = 7
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let round = 0; round < 300; round += 1) {
      const count = 1 + Math.floor(rnd() * 12)
      const weights = Array.from({ length: count }, () => rnd() * 3 + 0.01)
      const units = Math.floor(rnd() * 500_000)
      const out = dealWhole(units, weights, weights.map((_, i) => i))
      expect(sum(out)).toBe(units)
      expect(out.every((v) => Number.isInteger(v) && v >= 0)).toBe(true)
    }
  })
})

describe('wholeUnit and nameRank', () => {
  it('deals whole rupees when the rent is whole rupees, else paise', () => {
    expect(wholeUnit(30_000_00, 'INR')).toBe(100)
    expect(wholeUnit(30_000_50, 'INR')).toBe(1)
    expect(wholeUnit(90_000, 'JPY')).toBe(1)
    expect(wholeUnit(1_200_00, 'USD')).toBe(100)
  })

  it('ranks by name, not by id, whatever the letter case', () => {
    expect(nameRank(['z1', 'a2', 'm3'], (id) => ({ z1: 'asha', a2: 'Riya', m3: 'Kabir' })[id] ?? '')).toEqual([0, 2, 1])
    expect(nameRank(['b', 'a'], () => 'Same')).toEqual([1, 0])
  })
})

describe('fairRent', () => {
  it('three rooms, one of each kind: whole rupees that add up to the rent', () => {
    const p = plan(30_000_00, [room(['riya'], { size: 'large', bath: true }), room(['kabir']), room(['me'], { size: 'small' })])
    const result = fairRent(p)
    // Common: 40% = 12,000, so 4,000 each. Rooms: 18,000 over 184 + 120 + 90 = 394 points.
    expect(result.commonPool).toBe(12_000_00)
    expect(result.roomPool).toBe(18_000_00)
    expect(amounts(p)).toEqual({ riya: 12_406_00, kabir: 9_482_00, me: 8_112_00 })
    expect(sum(result.people.map((x) => x.amount))).toBe(30_000_00)
    expect(result.total).toBe(30_000_00)
    expect(result.unit).toBe(100)
    expect(result.people.every((x) => x.amount % 100 === 0)).toBe(true)
  })

  it('compares with a plain equal split', () => {
    const p = plan(30_000_00, [room(['riya'], { size: 'large', bath: true }), room(['kabir']), room(['me'], { size: 'small' })])
    const result = fairRent(p)
    expect(result.people.map((x) => x.equal)).toEqual([10_000_00, 10_000_00, 10_000_00])
    expect(result.people.map((x) => x.diff)).toEqual([2_406_00, -518_00, -1_888_00])
    expect(sum(result.people.map((x) => x.diff))).toBe(0)
  })

  it('identical rooms pay the same; an odd rupee goes by name', () => {
    const p = plan(10_000_00, [room(['b']), room(['a']), room(['c'])])
    const names: Record<string, string> = { a: 'Zoya', b: 'Asha', c: 'Meera' }
    const result = fairRent(p, (id) => names[id] ?? '')
    expect(Object.fromEntries(result.people.map((x) => [x.friendId, x.amount]))).toEqual({ b: 3_334_00, a: 3_333_00, c: 3_333_00 })
    expect(result.people.map((x) => x.diff)).toEqual([0, 0, 0])
    const spread = Math.max(...result.people.map((x) => x.amount)) - Math.min(...result.people.map((x) => x.amount))
    expect(spread).toBeLessThanOrEqual(100)
  })

  it('two people sharing a room split its part between them', () => {
    // Common 40% of 24,000 = 9,600: 3,200 each. Rooms 14,400: the large room 160 points, the medium 120.
    const p = plan(24_000_00, [room(['asha', 'meera'], { size: 'large' }), room(['kabir'])])
    const result = fairRent(p)
    expect(amounts(p)).toEqual({ asha: 7_314_00, meera: 7_314_00, kabir: 9_372_00 })
    expect(sum(result.people.map((x) => x.amount))).toBe(24_000_00)
    expect(result.people[0]?.mates).toEqual(['meera'])
    expect(result.people[2]?.mates).toEqual([])
  })

  it('sharing the same room as someone alone in an identical one costs less each', () => {
    const p = plan(20_000_00, [room(['a', 'b']), room(['c'])])
    const got = amounts(p)
    expect(got.a).toBe(got.b)
    expect(got.c).toBeGreaterThan(got.a ?? 0)
    // Common 8,000 over three (2,666.67 each), rooms 12,000 half and half: all three end in .67, and the two spare rupees go by name.
    expect(got).toEqual({ a: 5_667_00, b: 5_667_00, c: 8_666_00 })
  })

  it('each extra raises that room and lowers the others, never the total', () => {
    const base = amounts(plan(30_000_00, [room(['a']), room(['b']), room(['c'])]))
    for (const extra of [{ bath: true }, { balcony: true }, { ac: true }, { tweak: 10 }, { size: 'large' as const }, { sqft: 200 }]) {
      const p = plan(30_000_00, [room(['a'], extra), room(['b']), room(['c'])])
      const got = amounts(p)
      expect(got.a).toBeGreaterThan(base.a ?? 0)
      expect(got.b).toBeLessThan(base.b ?? 0)
      expect(sum(Object.values(got))).toBe(30_000_00)
    }
    const less = amounts(plan(30_000_00, [room(['a'], { tweak: -10 }), room(['b']), room(['c'])]))
    expect(less.a).toBeLessThan(base.a ?? 0)
  })

  it('a bigger factor means a bigger gap; a factor of zero means none', () => {
    const rooms = (): Room[] => [room(['a'], { bath: true }), room(['b'])]
    const none = amounts(plan(20_000_00, rooms(), { factors: { bath: 0, balcony: 10, ac: 10 } }))
    const usual = amounts(plan(20_000_00, rooms()))
    const more = amounts(plan(20_000_00, rooms(), { factors: { bath: 30, balcony: 10, ac: 10 } }))
    expect(none).toEqual({ a: 10_000_00, b: 10_000_00 })
    expect((usual.a ?? 0) - (usual.b ?? 0)).toBeGreaterThan(0)
    expect((more.a ?? 0) - (more.b ?? 0)).toBeGreaterThan((usual.a ?? 0) - (usual.b ?? 0))
  })

  it('more common space pulls everyone towards equal', () => {
    const rooms = (): Room[] => [room(['a'], { size: 'large', bath: true, ac: true }), room(['b'], { size: 'small' })]
    const at20 = amounts(plan(20_000_00, rooms(), { commonPct: 20 }))
    const at60 = amounts(plan(20_000_00, rooms(), { commonPct: 60 }))
    expect((at20.a ?? 0) - (at20.b ?? 0)).toBeGreaterThan((at60.a ?? 0) - (at60.b ?? 0))
    expect(sum(Object.values(at20))).toBe(20_000_00)
    expect(sum(Object.values(at60))).toBe(20_000_00)
    expect(amounts(plan(20_000_00, rooms(), { commonPct: 100 }))).toEqual({ a: 10_000_00, b: 10_000_00 })
  })

  it('typed areas are used as they are', () => {
    // No common part: 300 and 100 sq ft split 3 to 1.
    const p = plan(20_000_00, [room(['a'], { sqft: 300 }), room(['b'], { sqft: 100 })], { commonPct: 0 })
    expect(amounts(p)).toEqual({ a: 15_000_00, b: 5_000_00 })
  })

  it('one person pays all of it; nobody in a room means nothing to show', () => {
    const solo = fairRent(plan(18_500_00, [room(['me'], { size: 'large', bath: true })]))
    expect(solo.people).toHaveLength(1)
    expect(solo.people[0]).toMatchObject({ friendId: 'me', amount: 18_500_00, equal: 18_500_00, diff: 0 })
    const empty = fairRent(plan(18_500_00, [room([]), room([])]))
    expect(empty.people).toEqual([])
    expect(empty.total).toBe(0)
    expect(fairRent(plan(18_500_00, [])).people).toEqual([])
  })

  it('an empty room is left out: the people who live there pay the whole rent', () => {
    const p = plan(20_000_00, [room(['a']), room([], { size: 'large', bath: true }), room(['b'])])
    expect(amounts(p)).toEqual({ a: 10_000_00, b: 10_000_00 })
    expect(fairRent(p).people.map((x) => x.roomIndex)).toEqual([0, 2])
  })

  it('a person listed in two rooms counts in the first only', () => {
    const p = plan(20_000_00, [room(['a']), room(['a', 'b'])])
    const result = fairRent(p)
    expect(result.people.map((x) => x.friendId)).toEqual(['a', 'b'])
    expect(result.people[1]?.mates).toEqual([])
    expect(sum(result.people.map((x) => x.amount))).toBe(20_000_00)
  })

  it('no rent, or a junk rent, gives zeros and never NaN', () => {
    for (const rent of [0, -500, Number.NaN, 12.5]) {
      const result = fairRent(plan(rent, [room(['a']), room(['b'])]))
      expect(result.people.map((x) => x.amount)).toEqual([0, 0])
      expect(result.total).toBe(0)
    }
  })

  it('a rent with paise still adds up to the paisa', () => {
    const p = plan(25_000_50, [room(['a'], { size: 'large' }), room(['b']), room(['c'], { ac: true })])
    const result = fairRent(p)
    expect(result.unit).toBe(1)
    expect(sum(result.people.map((x) => x.amount))).toBe(25_000_50)
    expect(sum(result.people.map((x) => x.equal))).toBe(25_000_50)
  })

  it('a currency without paise is dealt in whole units', () => {
    const p = plan(90_001, [room(['a'], { size: 'large' }), room(['b'])], { currency: 'JPY' })
    const result = fairRent(p)
    expect(sum(result.people.map((x) => x.amount))).toBe(90_001)
    expect(result.people.map((x) => x.equal)).toEqual([45_001, 45_000])
  })

  it('twelve people in odd rooms: whole rupees, exact total, the same answer every time', () => {
    const sizes = ['small', 'medium', 'large'] as const
    const rooms = Array.from({ length: 8 }, (_, i) =>
      room(i < 4 ? [`p${i}a`, `p${i}b`] : [`p${i}`], { size: sizes[i % 3] ?? 'medium', bath: i % 2 === 0, ac: i % 3 === 0, balcony: i === 5, tweak: (i % 5) * 5 - 10 }),
    )
    const p = plan(87_777_00, rooms, { commonPct: 35 })
    const first = fairRent(p)
    expect(first.people).toHaveLength(12)
    expect(sum(first.people.map((x) => x.amount))).toBe(87_777_00)
    expect(sum(first.people.map((x) => x.equal))).toBe(87_777_00)
    expect(first.people.every((x) => x.amount % 100 === 0 && x.amount > 0)).toBe(true)
    expect(fairRent(p)).toEqual(first)
    // Two people in one room never differ by more than a rupee.
    for (let i = 0; i < 4; i += 1) {
      const pair = first.people.filter((x) => x.roomIndex === i).map((x) => x.amount)
      expect(Math.abs((pair[0] ?? 0) - (pair[1] ?? 0))).toBeLessThanOrEqual(100)
    }
  })
})

describe('unplaced', () => {
  it('lists the people who are in no room', () => {
    expect(unplaced(['a', 'b', 'c'], [room(['a']), room(['c'])])).toEqual(['b'])
    expect(unplaced([], [room(['a'])])).toEqual([])
  })
})
