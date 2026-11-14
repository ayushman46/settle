import { describe, expect, it } from 'vitest'
import { MIN_SWAP, swapKey, swapOutcome, swapPlan, type SwapPerson } from './engine'

const p = (id: string, net: number, name = id): SwapPerson => ({ id, name, net })

describe('swapPlan', () => {
  it('pairs the one who owes you with the one you owe, for the same amount', () => {
    expect(swapPlan([p('riya', 50_000, 'Riya'), p('sam', -50_000, 'Sam')])).toEqual({
      swaps: [{ fromId: 'riya', toId: 'sam', amount: 50_000 }],
      saved: 1,
    })
  })

  it('uses the smaller amount and leaves the rest open', () => {
    const plan = swapPlan([p('riya', 80_000), p('sam', -50_000)])
    expect(plan.swaps).toEqual([{ fromId: 'riya', toId: 'sam', amount: 50_000 }])
    // Riya still pays you ₹300: two payments before, two after.
    expect(plan.saved).toBe(0)
  })

  it('takes the largest first and uses each person until their balance runs out', () => {
    const plan = swapPlan([p('riya', 80_000), p('asha', 20_000), p('sam', -50_000), p('dev', -50_000)])
    expect(plan.swaps).toEqual([
      { fromId: 'riya', toId: 'dev', amount: 50_000 },
      { fromId: 'riya', toId: 'sam', amount: 30_000 },
      { fromId: 'asha', toId: 'sam', amount: 20_000 },
    ])
    // Four payments through you become three direct ones.
    expect(plan.saved).toBe(1)
    const moved = plan.swaps.reduce((sum, s) => sum + s.amount, 0)
    expect(moved).toBe(100_000)
  })

  it('stops below the minimum (₹50)', () => {
    expect(MIN_SWAP).toBe(5_000)
    expect(swapPlan([p('riya', 4_999), p('sam', -60_000)]).swaps).toEqual([])
    expect(swapPlan([p('riya', 5_000), p('sam', -60_000)]).swaps).toEqual([{ fromId: 'riya', toId: 'sam', amount: 5_000 }])
    // A leftover under ₹50 isn't suggested.
    const plan = swapPlan([p('riya', 54_000), p('sam', -50_000), p('dev', -30_000)])
    expect(plan.swaps).toEqual([{ fromId: 'riya', toId: 'sam', amount: 50_000 }])
  })

  it('breaks ties by name, not by id', () => {
    const plan = swapPlan([p('z1', 30_000, 'Asha'), p('a1', 30_000, 'Riya'), p('b2', -30_000, 'Sam'), p('y9', -30_000, 'Dev')])
    expect(plan.swaps).toEqual([
      { fromId: 'z1', toId: 'y9', amount: 30_000 },
      { fromId: 'a1', toId: 'b2', amount: 30_000 },
    ])
    // Same answer whatever order the people come in.
    const shuffled = swapPlan([p('b2', -30_000, 'Sam'), p('a1', 30_000, 'Riya'), p('y9', -30_000, 'Dev'), p('z1', 30_000, 'Asha')])
    expect(shuffled).toEqual(plan)
  })

  it('gives nothing when it’s all one way, or empty', () => {
    expect(swapPlan([])).toEqual({ swaps: [], saved: 0 })
    expect(swapPlan([p('riya', 50_000), p('sam', 20_000)])).toEqual({ swaps: [], saved: 0 })
    expect(swapPlan([p('riya', -50_000), p('sam', -20_000)])).toEqual({ swaps: [], saved: 0 })
    expect(swapPlan([p('riya', 0), p('sam', 0)])).toEqual({ swaps: [], saved: 0 })
  })

  it('ignores junk amounts', () => {
    expect(swapPlan([p('riya', Number.NaN), p('sam', -50_000), p('dev', 1.5)]).swaps).toEqual([])
  })

  it('handles a long list exactly, to the paisa', () => {
    const people: SwapPerson[] = []
    for (let i = 0; i < 200; i++) people.push(p(`f${i}`, (i % 2 === 0 ? 1 : -1) * (10_000 + i * 137), `Friend ${String(i).padStart(3, '0')}`))
    const plan = swapPlan(people)
    const left = new Map(people.map((x) => [x.id, x.net]))
    for (const s of plan.swaps) {
      expect(s.amount).toBeGreaterThanOrEqual(MIN_SWAP)
      left.set(s.fromId, (left.get(s.fromId) ?? 0) - s.amount)
      left.set(s.toId, (left.get(s.toId) ?? 0) + s.amount)
    }
    for (const x of people) {
      const now = left.get(x.id) ?? 0
      // Nobody is ever asked to pay more than they owe, or to be paid more than they're owed.
      if (x.net > 0) expect(now).toBeGreaterThanOrEqual(0)
      else expect(now).toBeLessThanOrEqual(0)
    }
  })
})

describe('swapKey', () => {
  it('is the pair and the amount', () => {
    expect(swapKey({ fromId: 'riya', toId: 'sam', amount: 50_000 })).toBe('riya>sam:50000')
  })
})

describe('swapOutcome', () => {
  const swap = { fromId: 'a', toId: 'b', amount: 80_000 }
  it('equal: both cleared', () => {
    expect(swapOutcome(swap, 80_000, 80_000)).toEqual({ cleared: 'both', fromLeft: 0, toLeft: 0 })
  })
  it('I owe more: the payer is cleared, I still owe the rest', () => {
    expect(swapOutcome(swap, 80_000, 120_000)).toEqual({ cleared: 'from', fromLeft: 0, toLeft: 40_000 })
  })
  it('I am owed more: I am cleared with the payee, the payer still owes the rest', () => {
    expect(swapOutcome({ ...swap, amount: 30_000 }, 80_000, 30_000)).toEqual({ cleared: 'to', fromLeft: 50_000, toLeft: 0 })
  })
  it('both open (a later suggestion in a plan), and never below zero', () => {
    expect(swapOutcome({ ...swap, amount: 30_000 }, 80_000, 50_000)).toEqual({ cleared: 'neither', fromLeft: 50_000, toLeft: 20_000 })
    expect(swapOutcome(swap, 10_000, 10_000)).toEqual({ cleared: 'both', fromLeft: 0, toLeft: 0 })
  })
})
