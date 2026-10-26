import { describe, expect, it } from 'vitest'
import type { Participant } from '../domain/types'
import { MAX_MINOR } from '../lib/money'
import {
  expenseShares,
  FULL_PERCENT_BPS,
  hadSum,
  isMoneyMode,
  isValidTotal,
  roundSharesToWhole,
  splitAmount,
  splitRestEqually,
  uniqueParticipants,
  type AmountSplitInput,
} from './split'

/** Small seeded PRNG (mulberry32) so property tests are reproducible. */
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

const people = (...ids: string[]): Participant[] => ids.map((friendId) => ({ friendId, input: null }))
const withInputs = (inputs: Record<string, number | null>): Participant[] =>
  Object.entries(inputs).map(([friendId, input]) => ({ friendId, input }))
const sum = (shares: Record<string, number>) => Object.values(shares).reduce((a, b) => a + b, 0)

function split(partial: Partial<AmountSplitInput>) {
  return splitAmount({ total: 10000, currency: 'INR', mode: 'equal', participants: people('a', 'b'), payerId: 'a', ...partial })
}

describe('isValidTotal', () => {
  it('accepts positive whole minor amounts within range only', () => {
    expect(isValidTotal(1)).toBe(true)
    expect(isValidTotal(MAX_MINOR)).toBe(true)
    expect(isValidTotal(0)).toBe(false)
    expect(isValidTotal(-5)).toBe(false)
    expect(isValidTotal(1.5)).toBe(false)
    expect(isValidTotal(Number.NaN)).toBe(false)
    expect(isValidTotal(MAX_MINOR + 1)).toBe(false)
    expect(isValidTotal('100')).toBe(false)
  })
})

describe('uniqueParticipants', () => {
  it('keeps the first of each friend and drops unusable ids', () => {
    const list = [
      { friendId: 'a', input: 1 },
      { friendId: '', input: 2 },
      { friendId: 'a', input: 3 },
      { friendId: 'b', input: null },
    ]
    expect(uniqueParticipants(list)).toEqual([
      { friendId: 'a', input: 1 },
      { friendId: 'b', input: null },
    ])
  })
})

describe('splitAmount — equal', () => {
  it('splits evenly', () => {
    const r = split({ total: 84000, participants: people('a', 'b', 'c') })
    expect(r).toEqual({ shares: { a: 28000, b: 28000, c: 28000 }, ok: true, remainder: 0, percentRemainder: 0, issues: [] })
  })

  it('gives the leftover paisa to the payer first', () => {
    expect(split({ total: 100, participants: people('a', 'b', 'c'), payerId: 'b' }).shares).toEqual({ a: 33, b: 34, c: 33 })
    expect(split({ total: 101, participants: people('a', 'b', 'c'), payerId: 'c' }).shares).toEqual({ a: 34, b: 33, c: 34 })
  })

  it('falls back to list order when the payer is not splitting', () => {
    expect(split({ total: 100, participants: people('a', 'b', 'c'), payerId: 'z' }).shares).toEqual({ a: 34, b: 33, c: 33 })
  })

  it('ignores typed inputs and duplicate people', () => {
    const r = split({ total: 900, participants: [...withInputs({ a: 5, b: 99 }), { friendId: 'a', input: 1 }] })
    expect(r.shares).toEqual({ a: 450, b: 450 })
  })
})

describe('splitAmount — exact', () => {
  it('uses the typed amounts when they add up', () => {
    const r = split({ mode: 'exact', total: 1000, participants: withInputs({ a: 250, b: 750 }) })
    expect(r.ok).toBe(true)
    expect(r.shares).toEqual({ a: 250, b: 750 })
    expect(r.remainder).toBe(0)
  })

  it('reports what is left to assign (or over-assigned)', () => {
    const under = split({ mode: 'exact', total: 1000, participants: withInputs({ a: 250, b: null }) })
    expect(under.ok).toBe(false)
    expect(under.issues).toEqual(['exact_mismatch'])
    expect(under.remainder).toBe(750)
    expect(under.shares).toEqual({ a: 250, b: 0 })
    const over = split({ mode: 'exact', total: 1000, participants: withInputs({ a: 800, b: 300 }) })
    expect(over.remainder).toBe(-100)
  })

  it('treats negative, fractional and NaN inputs safely', () => {
    const r = split({ mode: 'exact', total: 1000, participants: withInputs({ a: -50, b: 999.6, c: Number.NaN }) })
    expect(r.shares).toEqual({ a: 0, b: 1000, c: 0 })
    expect(r.ok).toBe(true)
  })
})

describe('splitAmount — percent', () => {
  it('splits by basis points with largest remainders', () => {
    const r = split({ mode: 'percent', total: 3200000, participants: withInputs({ me: 4000, aditya: 3000, neha: 3000 }), payerId: 'me' })
    expect(r.ok).toBe(true)
    expect(r.shares).toEqual({ me: 1280000, aditya: 960000, neha: 960000 })
  })

  it('is exact even when percentages do not divide the total', () => {
    const r = split({ mode: 'percent', total: 1000, participants: withInputs({ a: 3333, b: 3333, c: 3334 }), payerId: 'a' })
    expect(sum(r.shares)).toBe(1000)
    expect(r.shares).toEqual({ a: 333, b: 333, c: 334 })
  })

  it('reports the missing percentage and previews the typed part', () => {
    const r = split({ mode: 'percent', total: 10000, participants: withInputs({ a: 5000, b: null }) })
    expect(r.ok).toBe(false)
    expect(r.issues).toEqual(['percent_mismatch'])
    expect(r.percentRemainder).toBe(5000)
    expect(r.shares).toEqual({ a: 5000, b: 0 })
    const over = split({ mode: 'percent', total: 10000, participants: withInputs({ a: 6000, b: 6000 }) })
    expect(over.percentRemainder).toBe(-2000)
    expect(over.shares).toEqual({ a: 6000, b: 6000 })
  })

  it('previews zero when nothing has been typed', () => {
    const r = split({ mode: 'percent', participants: withInputs({ a: null, b: null }) })
    expect(r.shares).toEqual({ a: 0, b: 0 })
    expect(r.percentRemainder).toBe(FULL_PERCENT_BPS)
  })
})

describe('splitAmount — shares', () => {
  it('lets someone pay double', () => {
    const r = split({ mode: 'shares', total: 84000, participants: withInputs({ a: 1, b: 1, c: 2 }) })
    expect(r.shares).toEqual({ a: 21000, b: 21000, c: 42000 })
  })

  it('counts an empty weight as one share and zero as left out', () => {
    const r = split({ mode: 'shares', total: 900, participants: withInputs({ a: null, b: 2, c: 0 }) })
    expect(r.shares).toEqual({ a: 300, b: 600, c: 0 })
    expect(r.ok).toBe(true)
  })

  it('supports half shares exactly', () => {
    const r = split({ mode: 'shares', total: 1000, participants: withInputs({ a: 0.5, b: 1, c: 1 }), payerId: 'a' })
    expect(r.shares).toEqual({ a: 200, b: 400, c: 400 })
  })

  it('needs at least one positive weight', () => {
    const r = split({ mode: 'shares', participants: withInputs({ a: 0, b: -1 }) })
    expect(r.ok).toBe(false)
    expect(r.issues).toEqual(['zero_weights'])
    expect(r.shares).toEqual({ a: 0, b: 0 })
  })
})

describe('splitAmount — what each had', () => {
  const had = { a: 40_000, b: 30_000, c: 50_000 }

  it('shares tax and tip in proportion to what each had', () => {
    // ₹400 + ₹300 + ₹500 = ₹1,200 had; ₹1,380 paid with tax and tip.
    const r = split({ mode: 'had', total: 138_000, participants: withInputs(had) })
    expect(r.ok).toBe(true)
    expect(r.shares).toEqual({ a: 46_000, b: 34_500, c: 57_500 })
  })

  it('shares a discount in proportion too', () => {
    const r = split({ mode: 'had', total: 90_000, participants: withInputs(had) })
    expect(r.shares).toEqual({ a: 30_000, b: 22_500, c: 37_500 })
  })

  it('is exactly what each had when that is what was paid', () => {
    expect(split({ mode: 'had', total: 120_000, participants: withInputs(had) }).shares).toEqual(had)
  })

  it('leaves out whoever had nothing', () => {
    const r = split({ mode: 'had', total: 1_100, participants: withInputs({ a: 600, b: null, c: 400 }) })
    expect(r.shares).toEqual({ a: 660, b: 0, c: 440 })
    expect(r.ok).toBe(true)
  })

  it('needs someone to have had something', () => {
    const r = split({ mode: 'had', participants: withInputs({ a: null, b: 0 }) })
    expect(r).toMatchObject({ ok: false, issues: ['nothing_had'], shares: { a: 0, b: 0 } })
  })

  it('gives leftover paise to the payer first', () => {
    const r = split({ mode: 'had', total: 1_000, participants: withInputs({ a: 100, b: 100, c: 100 }), payerId: 'b' })
    expect(r.shares).toEqual({ a: 333, b: 334, c: 333 })
  })

  it('adds up what everyone had, once a person', () => {
    expect(hadSum(withInputs(had))).toBe(120_000)
    expect(hadSum([{ friendId: 'a', input: 500 }, { friendId: 'a', input: 900 }, { friendId: 'b', input: null }, { friendId: 'c', input: -5 }])).toBe(500)
  })

  it('counts exact and had inputs as money', () => {
    expect(['equal', 'exact', 'percent', 'shares', 'had', 'items'].filter((m) => isMoneyMode(m as AmountSplitInput['mode']))).toEqual(['exact', 'had'])
  })
})

describe('splitAmount — problems', () => {
  it('needs people', () => {
    const r = split({ participants: [] })
    expect(r).toMatchObject({ ok: false, issues: ['no_people'], shares: {} })
  })

  it('needs a positive whole total', () => {
    for (const total of [0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_MINOR + 1]) {
      const r = split({ total })
      expect(r.ok).toBe(false)
      expect(r.issues).toContain('bad_total')
      for (const v of Object.values(r.shares)) expect(Number.isInteger(v) && v >= 0).toBe(true)
    }
  })

  it('reports every problem at once', () => {
    expect(split({ total: 0, mode: 'exact', participants: withInputs({ a: 5 }) }).issues).toEqual(['bad_total', 'exact_mismatch'])
  })
})

describe('round to whole units', () => {
  it('rounds friends down and lets the payer absorb the paise', () => {
    const r = split({ total: 100001, participants: people('a', 'b', 'c'), payerId: 'a', roundToWhole: true })
    expect(r.shares).toEqual({ a: 33401, b: 33300, c: 33300 })
    expect(sum(r.shares)).toBe(100001)
  })

  it('adds the payer when they are not splitting but absorb paise', () => {
    const r = split({ total: 10050, participants: people('b', 'c'), payerId: 'me', roundToWhole: true })
    expect(r.shares).toEqual({ b: 5000, c: 5000, me: 50 })
  })

  it('does not add a zero payer entry and is a no-op without minor units', () => {
    expect(split({ total: 10000, participants: people('b', 'c'), payerId: 'me', roundToWhole: true }).shares).toEqual({ b: 5000, c: 5000 })
    expect(split({ total: 1001, currency: 'JPY', participants: people('a', 'b'), roundToWhole: true }).shares).toEqual({ a: 501, b: 500 })
  })

  it('is only applied to complete splits', () => {
    const r = split({ mode: 'exact', total: 1000, participants: withInputs({ a: 150, b: 350 }), roundToWhole: true })
    expect(r.shares).toEqual({ a: 150, b: 350 })
  })

  it('roundSharesToWhole works on any shares and keeps the sum', () => {
    expect(roundSharesToWhole({ a: 199, b: 299, c: 2 }, 'c', 'USD')).toEqual({ a: 100, b: 200, c: 200 })
    expect(roundSharesToWhole({ a: 1999, b: 1 }, 'a', 'KWD')).toEqual({ a: 2000, b: 0 })
  })
})

describe('expenseShares', () => {
  const bill = {
    meta: { merchant: 'Cafe', date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: null },
    items: [
      { id: 'i1', name: 'Pizza', quantity: 1, amount: 60000 },
      { id: 'i2', name: 'Cola', quantity: 2, amount: 20000 },
    ],
    assignments: { i1: { a: 1, b: 1 }, i2: { b: 1 } },
    warnings: [],
  }

  it('splits itemized bills item by item, scaling to what was paid', () => {
    const shares = expenseShares({ total: 88000, currency: 'INR', mode: 'items', participants: people('a', 'b'), payerId: 'a', roundedToWhole: false, bill })
    // a had 300 of 800 in items; b had 500. 880 paid → 330 / 550.
    expect(shares).toEqual({ a: 33000, b: 55000 })
  })

  it('rounds bills to whole units when asked', () => {
    const shares = expenseShares({ total: 88099, currency: 'INR', mode: 'items', participants: people('a', 'b'), payerId: 'a', roundedToWhole: true, bill })
    expect(shares.b).toBe(55000)
    expect(sum(shares)).toBe(88099)
  })

  it('falls back to an equal split for a bill without a snapshot', () => {
    expect(expenseShares({ total: 100, currency: 'INR', mode: 'items', participants: people('a', 'b'), payerId: 'a', roundedToWhole: false, bill: null })).toEqual({ a: 50, b: 50 })
  })

  it('shares delivery fees by the bill’s fee split', () => {
    // a had ₹300 and b ₹500 of items; ₹100 of fees; ₹900 paid.
    const fees = [
      { id: 'f1', kind: 'delivery' as const, label: 'Delivery fee', amount: 6000 },
      { id: 'f2', kind: 'platform' as const, label: 'Platform fee', amount: 4000 },
    ]
    const withFees = { ...bill, meta: { ...bill.meta, fees } }
    const input = { total: 90000, currency: 'INR', mode: 'items' as const, participants: people('a', 'b'), payerId: 'a', roundedToWhole: false }
    // Proportional (and older bills without a fee split): 900 × 3/8, 900 × 5/8.
    expect(expenseShares({ ...input, bill: withFees })).toEqual({ a: 33750, b: 56250 })
    expect(expenseShares({ ...input, bill: { ...withFees, feeSplit: 'proportional' } })).toEqual({ a: 33750, b: 56250 })
    // Equal: ₹50 of fees each, the other ₹800 by items (300 / 500).
    expect(expenseShares({ ...input, bill: { ...withFees, feeSplit: 'equal' } })).toEqual({ a: 35000, b: 55000 })
  })

  it('uses splitAmount for amount modes', () => {
    expect(expenseShares({ total: 300, currency: 'INR', mode: 'shares', participants: withInputs({ a: 2, b: 1 }), payerId: 'a', roundedToWhole: false, bill: null })).toEqual({ a: 200, b: 100 })
  })
})

describe('splitRestEqually', () => {
  const rest = (partial: Partial<AmountSplitInput>) =>
    splitRestEqually({ total: 1000, currency: 'INR', mode: 'exact', participants: people('a', 'b', 'c'), payerId: 'a', ...partial })

  it('gives what is left to the people with nothing entered', () => {
    expect(rest({ participants: withInputs({ a: 400, b: null, c: 0 }) })).toEqual(withInputs({ a: 400, b: 300, c: 300 }))
  })

  it('spreads the rest over everyone when all have something, payer first for leftovers', () => {
    expect(rest({ total: 1001, participants: withInputs({ a: 100, b: 100, c: 100 }), payerId: 'c' })).toEqual(
      withInputs({ a: 334, b: 333, c: 334 }),
    )
  })

  it('works on percentages', () => {
    const next = rest({ mode: 'percent', participants: withInputs({ a: 4000, b: null, c: null }) })
    expect(next).toEqual(withInputs({ a: 4000, b: 3000, c: 3000 }))
    expect(splitAmount({ total: 3200000, currency: 'INR', mode: 'percent', participants: next, payerId: 'a' }).ok).toBe(true)
  })

  it('always leaves an exact split that adds up', () => {
    const next = rest({ total: 999, participants: withInputs({ a: 1, b: null, c: null }) })
    expect(splitAmount({ total: 999, currency: 'INR', mode: 'exact', participants: next, payerId: 'a' }).ok).toBe(true)
  })

  it('changes nothing when nothing is left, too much is entered, or the mode has no remainder', () => {
    expect(rest({ participants: withInputs({ a: 1000, b: null }) })).toEqual(withInputs({ a: 1000, b: null }))
    expect(rest({ participants: withInputs({ a: 1200, b: null }) })).toEqual(withInputs({ a: 1200, b: null }))
    expect(rest({ mode: 'shares', participants: withInputs({ a: 2, b: null }) })).toEqual(withInputs({ a: 2, b: null }))
    expect(rest({ total: 0, participants: withInputs({ a: null }) })).toEqual(withInputs({ a: null }))
    expect(rest({ participants: [] })).toEqual([])
  })
})

describe('splitAmount — properties (seeded)', () => {
  const modes = ['equal', 'exact', 'percent', 'shares', 'had'] as const

  function randomInput(next: () => number): AmountSplitInput {
    const n = 1 + Math.floor(next() * 12)
    const ids = Array.from({ length: n }, (_, i) => `p${i}`)
    const scale = [10, 1000, 100000, 10000000, MAX_MINOR][Math.floor(next() * 5)] ?? 1000
    const total = 1 + Math.floor(next() * scale)
    const mode = modes[Math.floor(next() * modes.length)] ?? 'equal'
    let inputs: Array<number | null>
    if (mode === 'exact') {
      // Cut the total at random points so the parts add up exactly.
      const cuts = ids.slice(1).map(() => Math.floor(next() * (total + 1))).sort((a, b) => a - b)
      const bounds = [0, ...cuts, total]
      inputs = ids.map((_, i) => (bounds[i + 1] ?? 0) - (bounds[i] ?? 0))
    } else if (mode === 'percent') {
      const cuts = ids.slice(1).map(() => Math.floor(next() * (FULL_PERCENT_BPS + 1))).sort((a, b) => a - b)
      const bounds = [0, ...cuts, FULL_PERCENT_BPS]
      inputs = ids.map((_, i) => (bounds[i + 1] ?? 0) - (bounds[i] ?? 0))
    } else if (mode === 'shares') {
      inputs = ids.map((_, i) => (i === 0 ? 1 + Math.floor(next() * 5) : next() < 0.2 ? null : Math.floor(next() * 6)))
    } else if (mode === 'had') {
      // What each had, unrelated to the total (tax and tip on top, or a discount off).
      inputs = ids.map((_, i) => (i === 0 ? 1 + Math.floor(next() * scale) : next() < 0.2 ? null : Math.floor(next() * scale)))
    } else {
      inputs = ids.map(() => null)
    }
    const payerId = next() < 0.8 ? (ids[Math.floor(next() * n)] ?? 'p0') : 'outsider'
    const currency = ['INR', 'USD', 'JPY', 'KWD'][Math.floor(next() * 4)] ?? 'INR'
    return {
      total,
      currency,
      mode,
      payerId,
      roundToWhole: next() < 0.3,
      participants: ids.map((friendId, i) => ({ friendId, input: inputs[i] ?? null })),
    }
  }

  it('always adds up to the total, in whole non-negative units, deterministically', () => {
    const next = rng(20261021)
    for (let run = 0; run < 3000; run++) {
      const input = randomInput(next)
      const r = splitAmount(input)
      expect(r.ok, JSON.stringify(input)).toBe(true)
      expect(sum(r.shares)).toBe(input.total)
      for (const v of Object.values(r.shares)) {
        expect(Number.isSafeInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
      expect(splitAmount(structuredClone(input))).toEqual(r)
    }
  })

  it('stays within one minor unit of the exact proportional share', () => {
    const next = rng(42)
    for (let run = 0; run < 2000; run++) {
      const input = { ...randomInput(next), roundToWhole: false }
      if (input.mode === 'exact') continue
      const r = splitAmount(input)
      const weights = input.participants.map((p) =>
        input.mode === 'equal' ? 1 : input.mode === 'shares' ? (p.input === null ? 1 : Math.max(0, p.input)) : (p.input ?? 0),
      )
      const W = weights.reduce((a, b) => a + b, 0)
      input.participants.forEach((p, i) => {
        const ideal = (input.total * (weights[i] ?? 0)) / W
        expect(Math.abs((r.shares[p.friendId] ?? 0) - ideal)).toBeLessThan(1)
      })
    }
  })

  it('rounding to whole units only ever lowers what friends pay', () => {
    const next = rng(7)
    for (let run = 0; run < 2000; run++) {
      const base = randomInput(next)
      const exact = splitAmount({ ...base, roundToWhole: false })
      const rounded = splitAmount({ ...base, roundToWhole: true })
      const unit = base.currency === 'JPY' ? 1 : base.currency === 'KWD' ? 1000 : 100
      expect(sum(rounded.shares)).toBe(base.total)
      for (const [id, share] of Object.entries(rounded.shares)) {
        if (id === base.payerId) {
          expect(share).toBeGreaterThanOrEqual(exact.shares[id] ?? 0)
        } else {
          expect(share % unit).toBe(0)
          expect(share).toBeLessThanOrEqual(exact.shares[id] ?? 0)
          expect((exact.shares[id] ?? 0) - share).toBeLessThan(unit)
        }
      }
    }
  })
})
