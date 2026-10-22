import { describe, expect, it } from 'vitest'
import type { BillItem, Person, Shares } from '../types'
import { computeSplit, itemShareAmounts, shareLabel, validShares, type SplitLine } from './split'

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const person = (id: string, color = 0): Person => ({ id, name: id.toUpperCase(), color })
const item = (id: string, amount: number, name = id): BillItem => ({ id, name, quantity: 1, amount })

const A = person('a')
const B = person('b')
const C = person('c')
const D = person('d')

/** The sample bill (Saffron Table) in paise. */
const SAMPLE_ITEMS: BillItem[] = [
  item('paneer', 34500, 'Paneer Tikka'),
  item('chicken', 49500, 'Butter Chicken'),
  item('dal', 32500, 'Dal Makhani'),
  item('naan', 30000, 'Garlic Naan'),
  item('rice', 24500, 'Jeera Rice'),
  item('soda', 24000, 'Fresh Lime Soda'),
  item('lassi', 16500, 'Mango Lassi'),
  item('jamun', 19000, 'Gulab Jamun'),
]

const SAMPLE_ASSIGNMENTS: Record<string, Shares> = {
  paneer: { a: 1, b: 1 },
  chicken: { a: 1, c: 1 },
  dal: { b: 1, d: 1 },
  naan: { a: 1, b: 1, c: 1, d: 1 },
  rice: { c: 1, d: 1 },
  soda: { a: 2, d: 1 },
  lassi: { c: 1 },
  // jamun unassigned → everyone
}

describe('computeSplit — the sample bill', () => {
  const result = computeSplit({ items: SAMPLE_ITEMS, people: [A, B, C, D], assignments: SAMPLE_ASSIGNMENTS, paid: 229900 })

  it('splits items exactly and spreads the difference proportionally', () => {
    expect(result.itemsTotal).toBe(230500)
    expect(result.paid).toBe(229900)
    expect(result.adjustment).toBe(-600)
    expect(result.adjustmentRate).toBeCloseTo(-600 / 230500, 12)
    expect(result.people.map((p) => p.itemsSubtotal)).toEqual([70250, 45750, 65750, 48750])
    expect(result.people.map((p) => p.total)).toEqual([70067, 45631, 65579, 48623])
    expect(result.people.map((p) => p.adjustment)).toEqual([-183, -119, -171, -127])
    expect(result.check).toBe(229900)
  })

  it('reports unassigned items as shared by everyone', () => {
    expect(result.unassignedItemIds).toEqual(['jamun'])
    for (const split of result.people) {
      const jamun = split.lines.find((l) => l.itemId === 'jamun')
      expect(jamun).toMatchObject({ amount: 4750, everyone: true, sharedWith: 4, even: true })
    }
  })

  it('keeps lines in item order and people in input order', () => {
    expect(result.people.map((p) => p.person.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(result.people[0]?.lines.map((l) => l.itemId)).toEqual(['paneer', 'chicken', 'naan', 'soda', 'jamun'])
  })

  it('records uneven weights on lines', () => {
    const soda = result.people[0]?.lines.find((l) => l.itemId === 'soda')
    expect(soda).toMatchObject({ amount: 16000, shares: 2, totalShares: 3, sharedWith: 2, even: false, everyone: false })
    const sodaD = result.people[3]?.lines.find((l) => l.itemId === 'soda')
    expect(sodaD).toMatchObject({ amount: 8000, shares: 1, totalShares: 3 })
  })
})

describe('computeSplit — edge cases', () => {
  it('splits evenly with remainders to the earliest people', () => {
    const r = computeSplit({ items: [item('x', 100)], people: [A, B, C], assignments: { x: { a: 1, b: 1, c: 1 } }, paid: 100 })
    expect(r.people.map((p) => p.total)).toEqual([34, 33, 33])
  })

  it('handles uneven weights', () => {
    const r = computeSplit({ items: [item('beer', 900)], people: [A, B], assignments: { beer: { a: 2, b: 1 } }, paid: 900 })
    expect(r.people.map((p) => p.total)).toEqual([600, 300])
  })

  it('adds tax/charges in proportion when paid > items', () => {
    const r = computeSplit({
      items: [item('x', 1000), item('y', 3000)],
      people: [A, B],
      assignments: { x: { a: 1 }, y: { b: 1 } },
      paid: 4400,
    })
    expect(r.people.map((p) => p.total)).toEqual([1100, 3300])
    expect(r.people.map((p) => p.adjustment)).toEqual([100, 300])
    expect(r.adjustmentRate).toBeCloseTo(0.1)
  })

  it('applies discounts in proportion when paid < items', () => {
    const r = computeSplit({
      items: [item('x', 1000), item('y', 3000)],
      people: [A, B],
      assignments: { x: { a: 1 }, y: { b: 1 } },
      paid: 3000,
    })
    expect(r.people.map((p) => p.total)).toEqual([750, 2250])
  })

  it('gives nothing to someone who only had free items', () => {
    const r = computeSplit({
      items: [item('water', 0), item('meal', 5000)],
      people: [A, B],
      assignments: { water: { a: 1 }, meal: { b: 1 } },
      paid: 5500,
    })
    expect(r.people.map((p) => p.total)).toEqual([0, 5500])
  })

  it('splits equally when every item is free', () => {
    const r = computeSplit({ items: [item('w', 0)], people: [A, B, C], assignments: { w: { a: 1 } }, paid: 300 })
    expect(r.people.map((p) => p.total)).toEqual([100, 100, 100])
    expect(r.adjustmentRate).toBe(0)
  })

  it('handles paid = 0', () => {
    const r = computeSplit({ items: [item('x', 1000)], people: [A, B], assignments: { x: { a: 1 } }, paid: 0 })
    expect(r.people.map((p) => p.total)).toEqual([0, 0])
    expect(r.check).toBe(0)
  })

  it('returns an empty result with no people', () => {
    const r = computeSplit({ items: [item('x', 1000)], people: [], assignments: {}, paid: 1000 })
    expect(r.people).toEqual([])
    expect(r.check).toBe(0)
    expect(r.unassignedItemIds).toEqual(['x'])
    expect(r.itemsTotal).toBe(1000)
  })

  it('handles no items', () => {
    const r = computeSplit({ items: [], people: [A, B], assignments: {}, paid: 1000 })
    expect(r.people.map((p) => p.total)).toEqual([500, 500])
    expect(r.itemsTotal).toBe(0)
  })

  it('ignores shares for people who are gone and bad weights', () => {
    const r = computeSplit({
      items: [item('x', 1000)],
      people: [A, B],
      assignments: { x: { ghost: 5, a: 0, b: 1.9 } },
      paid: 1000,
    })
    expect(r.people.map((p) => p.total)).toEqual([0, 1000])
    expect(r.unassignedItemIds).toEqual([])
  })

  it('treats an item with only invalid shares as unassigned', () => {
    const r = computeSplit({ items: [item('x', 1000)], people: [A, B], assignments: { x: { ghost: 1, a: -1 } }, paid: 1000 })
    expect(r.unassignedItemIds).toEqual(['x'])
    expect(r.people.map((p) => p.total)).toEqual([500, 500])
  })

  it('works with zero-digit currencies like JPY (whole units only)', () => {
    const r = computeSplit({ items: [item('x', 1000)], people: [A, B, C], assignments: {}, paid: 1001 })
    expect(r.people.map((p) => p.itemsSubtotal)).toEqual([334, 333, 333])
    expect(r.people.map((p) => p.total)).toEqual([335, 333, 333])
  })

  it('handles huge counts', () => {
    const people = Array.from({ length: 20 }, (_, i) => person(`p${i}`))
    const items = Array.from({ length: 300 }, (_, i) => item(`i${i}`, 99_999 + i))
    const assignments: Record<string, Shares> = {}
    items.forEach((it, i) => {
      assignments[it.id] = { [`p${i % 20}`]: 1 + (i % 3), [`p${(i * 7) % 20}`]: 1 }
    })
    const paid = 31_234_567
    const r = computeSplit({ items, people, assignments, paid })
    expect(r.check).toBe(paid)
  })

  it('is pure: does not mutate inputs', () => {
    const items = [item('x', 1000)]
    const assignments = { x: { a: 1 } }
    const frozen = { items: Object.freeze(items), people: Object.freeze([A, B]), assignments: Object.freeze(assignments), paid: 1000 }
    expect(() => computeSplit(frozen)).not.toThrow()
  })
})

describe('validShares', () => {
  it('keeps existing people with positive whole weights, in people order', () => {
    expect(validShares({ b: 2.7, a: 1, ghost: 3, c: 0.5 }, [A, B, C])).toEqual({ a: 1, b: 2 })
    expect(Object.keys(validShares({ b: 1, a: 1 }, [A, B]))).toEqual(['a', 'b'])
    expect(validShares(undefined, [A])).toEqual({})
    expect(validShares({ a: Number.NaN, b: Number.POSITIVE_INFINITY }, [A, B])).toEqual({})
  })
})

describe('itemShareAmounts', () => {
  it('previews what computeSplit gives each person for an item', () => {
    expect(itemShareAmounts(49500, { a: 1, b: 1 }, [A, B, C])).toEqual({ a: 24750, b: 24750 })
    expect(itemShareAmounts(100, { a: 1, b: 1, c: 1 }, [A, B, C])).toEqual({ a: 34, b: 33, c: 33 })
    expect(itemShareAmounts(100, {}, [A, B])).toEqual({})
  })
})

describe('shareLabel', () => {
  const line = (overrides: Partial<SplitLine>): SplitLine => ({
    itemId: 'x',
    name: 'X',
    amount: 100,
    shares: 1,
    totalShares: 1,
    sharedWith: 1,
    even: true,
    everyone: false,
    ...overrides,
  })

  it('labels shares', () => {
    expect(shareLabel(line({}))).toBeNull()
    expect(shareLabel(line({ sharedWith: 2, totalShares: 2 }))).toBe('½')
    expect(shareLabel(line({ sharedWith: 3, totalShares: 3 }))).toBe('⅓')
    expect(shareLabel(line({ sharedWith: 4, totalShares: 4 }))).toBe('¼')
    expect(shareLabel(line({ sharedWith: 7, totalShares: 7 }))).toBe('1/7')
    expect(shareLabel(line({ sharedWith: 2, shares: 2, totalShares: 3, even: false }))).toBe('2 of 3 shares')
  })

  it('treats equal weights > 1 as an even split', () => {
    expect(shareLabel(line({ sharedWith: 2, shares: 2, totalShares: 4, even: true }))).toBe('½')
  })
})

describe('computeSplit — properties', () => {
  it('holds for 800 seeded random bills', () => {
    const random = rng(1337)
    const int = (max: number) => Math.floor(random() * max)

    for (let run = 0; run < 800; run++) {
      const peopleCount = 1 + int(12)
      const people = Array.from({ length: peopleCount }, (_, i) => person(`p${i}`, i % 8))
      const items = Array.from({ length: int(25) }, (_, i) => item(`i${i}`, random() < 0.08 ? 0 : int(10 ** (1 + int(6)))))
      const assignments: Record<string, Shares> = {}
      for (const it of items) {
        if (random() < 0.15) continue // unassigned
        const shares: Shares = {}
        for (const p of people) if (random() < 0.4) shares[p.id] = random() < 0.7 ? 1 : 1 + int(5)
        if (random() < 0.05) shares.ghost = 3
        if (random() < 0.05 && people[0]) shares[people[0].id] = 0
        assignments[it.id] = shares
      }
      const itemsTotal = items.reduce((s, it) => s + it.amount, 0)
      const mode = random()
      const paid =
        mode < 0.1 ? 0 : mode < 0.4 ? itemsTotal : Math.max(0, Math.round(itemsTotal * (0.6 + random() * 0.8)) + int(1000))
      const input = { items, people, assignments, paid }
      const label = `bill #${run}`

      const result = computeSplit(input)
      // Totals add up to exactly what was paid.
      expect(result.check, label).toBe(paid)
      expect(result.people.reduce((s, p) => s + p.total, 0), label).toBe(paid)
      // Each item's lines add up to the item, and every item lands on someone.
      for (const it of items) {
        const lines = result.people.flatMap((p) => p.lines.filter((l) => l.itemId === it.id))
        expect(lines.reduce((s, l) => s + l.amount, 0), label).toBe(it.amount)
        expect(lines.length, label).toBeGreaterThan(0)
      }
      // Subtotals add up to the items; adjustments are consistent; nothing negative.
      expect(result.people.reduce((s, p) => s + p.itemsSubtotal, 0), label).toBe(itemsTotal)
      for (const p of result.people) {
        expect(p.total, label).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(p.total), label).toBe(true)
        expect(p.adjustment, label).toBe(p.total - p.itemsSubtotal)
      }
      // Deterministic.
      expect(computeSplit(input), label).toEqual(result)
    }
  })
})

describe('computeSplit — delivery fees (spec 08 §4.1)', () => {
  const people = ['riya', 'sam', 'ayush', 'kabir'].map((id) => person(id))
  const items: BillItem[] = [
    item('biryani', 34900, 'Chicken Biryani'),
    item('pbm', 28900, 'Paneer Butter Masala'),
    { ...item('naan', 12000, 'Garlic Naan'), quantity: 2 },
    item('gj', 9900, 'Gulab Jamun (2 pcs)'),
  ]
  const assignments: Record<string, Shares> = { biryani: { riya: 1 }, pbm: { sam: 1 }, naan: { riya: 1, sam: 1 }, gj: { ayush: 1 } }
  // Items 85700 + tax 4285 + fees 9000 − coupon 10000.
  const paid = 88985
  const fees = 3500 + 1000 + 2500 + 2000
  const totals = (r: ReturnType<typeof computeSplit>) => r.people.map((p) => p.total)
  const feeParts = (r: ReturnType<typeof computeSplit>) => r.people.map((p) => p.fees)

  it('proportional: the same totals as before, with each person’s fees shown', () => {
    const r = computeSplit({ items, people, assignments, paid, fees, feeSplit: 'proportional' })
    expect(r.people.map((p) => p.itemsSubtotal)).toEqual([40900, 34900, 9900, 0])
    expect(totals(r)).toEqual([42468, 36238, 10279, 0])
    expect(feeParts(r)).toEqual([4295, 3665, 1040, 0])
    expect(r.check).toBe(paid)
    expect(r.fees).toBe(9000)
    expect(totals(r)).toEqual(totals(computeSplit({ items, people, assignments, paid })))
  })

  it('equal: fees shared by the three who had something, the rest by what they had', () => {
    const r = computeSplit({ items, people, assignments, paid, fees, feeSplit: 'equal' })
    expect(totals(r)).toEqual([41172, 35573, 12240, 0])
    expect(feeParts(r)).toEqual([3000, 3000, 3000, 0])
    // Tax, charges & offers: total − items − fees.
    expect(r.people.map((p) => p.total - p.itemsSubtotal - p.fees)).toEqual([-2728, -2327, -660, 0])
    expect(r.people.map((p) => p.adjustment)).toEqual([41172 - 40900, 35573 - 34900, 12240 - 9900, 0])
    expect(r.check).toBe(paid)
  })

  it('caps fees at what was paid (a huge coupon)', () => {
    const r = computeSplit({ items, people, assignments, paid: 5000, fees, feeSplit: 'equal' })
    expect(r.fees).toBe(5000)
    expect(totals(r)).toEqual([1667, 1667, 1666, 0])
    expect(r.check).toBe(5000)
  })

  it('without fees both policies match the old split', () => {
    const old = computeSplit({ items, people, assignments, paid })
    for (const feeSplit of ['proportional', 'equal'] as const) {
      const r = computeSplit({ items, people, assignments, paid, fees: 0, feeSplit })
      expect(totals(r)).toEqual(totals(old))
      expect(feeParts(r)).toEqual([0, 0, 0, 0])
    }
    expect(old.fees).toBe(0)
  })

  it('ignores negative or fractional fee totals safely', () => {
    expect(computeSplit({ items, people, assignments, paid, fees: -500, feeSplit: 'equal' }).fees).toBe(0)
    expect(computeSplit({ items, people, assignments, paid, fees: 1000.4, feeSplit: 'equal' }).fees).toBe(1000)
    expect(computeSplit({ items, people, assignments, paid: -100, fees: 1000, feeSplit: 'equal' }).fees).toBe(0)
  })

  it('makes everyone a fee sharer when an item is unassigned (it goes to everyone)', () => {
    const r = computeSplit({ items, people, assignments: { ...assignments, gj: {} }, paid, fees, feeSplit: 'equal' })
    expect(feeParts(r)).toEqual([2250, 2250, 2250, 2250])
    expect(r.check).toBe(paid)
  })

  it('holds on 1,000 random bills: totals add up, people with nothing pay nothing (equal), proportional unchanged', () => {
    const rand = rng(808)
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
    for (let n = 0; n < 1000; n++) {
      const crowd = Array.from({ length: int(2, 8) }, (_, i) => person(`p${i}`))
      const bill = Array.from({ length: int(1, 12) }, (_, i) => item(`i${i}`, int(0, 60000)))
      const assign: Record<string, Shares> = {}
      for (const it of bill) {
        const shares: Shares = {}
        for (const p of crowd) if (rand() < 0.4) shares[p.id] = int(1, 3)
        assign[it.id] = shares
      }
      const itemsTotal = bill.reduce((s, it) => s + it.amount, 0)
      const feeTotal = int(0, 20000)
      const discount = int(0, 30000)
      const paidOut = rand() < 0.1 ? int(0, 5000) : Math.max(0, itemsTotal + feeTotal + int(0, 5000) - discount)
      const label = `bill ${n}`
      const equal = computeSplit({ items: bill, people: crowd, assignments: assign, paid: paidOut, fees: feeTotal, feeSplit: 'equal' })
      const proportional = computeSplit({ items: bill, people: crowd, assignments: assign, paid: paidOut, fees: feeTotal, feeSplit: 'proportional' })
      const old = computeSplit({ items: bill, people: crowd, assignments: assign, paid: paidOut })
      expect(equal.check, label).toBe(paidOut)
      expect(proportional.check, label).toBe(paidOut)
      expect(totals(proportional), label).toEqual(totals(old))
      expect(equal.people.reduce((s, p) => s + p.fees, 0), label).toBe(equal.fees)
      expect(proportional.people.reduce((s, p) => s + p.fees, 0), label).toBe(proportional.fees)
      expect(equal.fees, label).toBe(Math.min(feeTotal, paidOut))
      if (equal.people.some((p) => p.itemsSubtotal > 0)) {
        for (const p of equal.people) if (p.itemsSubtotal === 0) expect(p.total, label).toBe(0)
      }
      for (const p of equal.people) expect(p.total, label).toBeGreaterThanOrEqual(0)
    }
  })
})
