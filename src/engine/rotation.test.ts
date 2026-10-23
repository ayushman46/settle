import { describe, expect, it } from 'vitest'
import { applyRound, nextRound, outstanding, rotationPlan, squaresAt, suggestNextRound, usualRound } from './rotation'

const members = ['ayush', 'riya', 'sam', 'kabir']
const A = { ayush: 120000, riya: 30000, sam: -120000, kabir: -30000 }
const base = { candidateIds: members, sharerIds: members, currency: 'INR' }

describe('outstanding', () => {
  it('is the sum of what people are owed', () => {
    expect(outstanding(A)).toBe(150000)
    expect(outstanding({})).toBe(0)
    expect(outstanding({ a: 0, b: 0 })).toBe(0)
  })
})

describe('worked example A — the story', () => {
  it('picks Sam for a ₹2,400 round', () => {
    const step = nextRound({ ...base, balances: A, amount: 240000 })
    expect(step).toEqual({
      payerId: 'sam',
      before: 150000,
      after: 120000,
      settles: 30000,
      balancesAfter: { ayush: 60000, riya: -30000, sam: 60000, kabir: -90000 },
      squaresAt: 160000,
    })
  })

  it('plans Sam, then Kabir, then a ₹900 transfer', () => {
    const plan = rotationPlan({ ...base, balances: A, amount: 240000 })
    expect(plan.rounds.map((r) => [r.payerId, r.before, r.after, r.settles])).toEqual([
      ['sam', 150000, 120000, 30000],
      ['kabir', 120000, 90000, 30000],
    ])
    expect(plan.rounds[1]?.balancesAfter).toEqual({ ayush: 0, riya: -90000, sam: 0, kabir: 90000 })
    expect(plan.leftover).toBe(90000)
    expect(plan.finish).toEqual([{ fromId: 'riya', toId: 'kabir', amount: 90000 }])
  })

  it('leaves Sam exactly square at ₹1,600', () => {
    expect(applyRound(A, 'sam', 160000, members, 'INR')).toEqual({ ayush: 80000, riya: -10000, sam: 0, kabir: -70000 })
  })

  it('suggests Sam with the usual round', () => {
    const s = suggestNextRound({ ...base, balances: A, usual: 240000 })
    expect(s).not.toBeNull()
    expect(s?.payerId).toBe('sam')
    expect(s?.behind).toBe(120000)
    expect(s?.squaresAt).toBe(160000)
    expect(s?.groupOut).toBe(150000)
    expect(s?.usualStep).toEqual(nextRound({ ...base, balances: A, amount: 240000 }))
  })

  it('falls back to the most behind without a usual round', () => {
    const s = suggestNextRound({ ...base, balances: A, usual: null })
    expect(s).toMatchObject({ payerId: 'sam', behind: 120000, squaresAt: 160000, usual: null, usualStep: null })
  })
})

describe('worked example B — a couple', () => {
  it('squares both exactly at ₹1,000', () => {
    const step = nextRound({ balances: { me: -50000, riya: 50000 }, candidateIds: ['me', 'riya'], sharerIds: ['me', 'riya'], amount: 100000, currency: 'INR' })
    expect(step).toMatchObject({ payerId: 'me', after: 0, settles: 50000, squaresAt: 100000 })
    expect(step?.balancesAfter).toEqual({ me: 0, riya: 0 })
  })
})

describe('worked example C — odd paise', () => {
  const C = { a: 33334, b: -16667, c: -16667 }
  const ids = ['a', 'b', 'c']
  it('returns null when every payer overshoots', () => {
    expect(nextRound({ balances: C, candidateIds: ids, sharerIds: ids, amount: 50001, currency: 'INR' })).toBeNull()
  })
  it('lands b on exactly 0 at ₹250.01', () => {
    const step = nextRound({ balances: C, candidateIds: ids, sharerIds: ids, amount: 25001, currency: 'INR' })
    expect(step).toMatchObject({ payerId: 'b', settles: 8334, squaresAt: 25001 })
    expect(step?.balancesAfter).toEqual({ a: 25000, b: 0, c: -25000 })
    expect(squaresAt(-16667, 3, true)).toBe(25001)
  })
})

describe('worked example D — square', () => {
  it('has no round and no suggestion', () => {
    const input = { balances: { a: 0, b: 0 }, candidateIds: ['a', 'b'], sharerIds: ['a', 'b'], currency: 'INR' }
    expect(nextRound({ ...input, amount: 1000 })).toBeNull()
    expect(suggestNextRound({ ...input, usual: 1000 })).toBeNull()
    expect(suggestNextRound({ ...input, usual: null })).toBeNull()
  })
})

describe('worked example E — the usual round', () => {
  it('is the median, in whole rupees', () => {
    expect(usualRound([240000, 84000, 120050, 99900, 64900], 'INR')).toBe(99900)
    expect(usualRound([1000, 3000], 'INR')).toBe(2000)
    expect(usualRound([120050], 'INR')).toBe(120100)
  })
  it('only looks at the last 10 valid totals', () => {
    expect(usualRound([], 'INR')).toBeNull()
    expect(usualRound([0, -5, Number.NaN, 1.5], 'INR')).toBeNull()
    expect(usualRound([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 900000, 900000, 900000], 'INR')).toBe(100)
  })
  it('never rounds below one unit', () => {
    expect(usualRound([49], 'INR')).toBe(100)
  })
  it('respects the currency’s digits', () => {
    expect(usualRound([1234, 1240, 1301], 'JPY')).toBe(1240)
    expect(usualRound([12345], 'KWD')).toBe(12000)
  })
})

describe('worked example F — a former member', () => {
  it('suggests nobody; the plan settles them by transfer', () => {
    const input = { balances: { a: 500, b: 0, x: -500 }, candidateIds: ['a', 'b'], sharerIds: ['a', 'b'], currency: 'INR' }
    expect(suggestNextRound({ ...input, usual: 1000 })).toBeNull()
    const plan = rotationPlan({ ...input, amount: 1000 })
    expect(plan.rounds).toEqual([])
    expect(plan.leftover).toBe(500)
    expect(plan.finish).toEqual([{ fromId: 'x', toId: 'a', amount: 500 }])
  })
})

describe('squaresAt', () => {
  it('is null for anyone not behind, or a party of one', () => {
    expect(squaresAt(0, 4, true)).toBeNull()
    expect(squaresAt(500, 4, true)).toBeNull()
    expect(squaresAt(-500, 1, true)).toBeNull()
  })
  it('is the debt itself for someone outside the round', () => {
    expect(squaresAt(-500, 4, false)).toBe(500)
  })
})

describe('properties (3,000 random groups)', () => {
  it('keeps Σ = 0, strictly lowers outstanding, picks an optimal payer and squares exactly', () => {
    let seed = 42
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    let rounds = 0
    const failures: string[] = []
    const check = (cond: boolean, msg: string) => {
      if (!cond && failures.length < 10) failures.push(msg)
    }
    for (let t = 0; t < 3000; t++) {
      const n = 2 + Math.floor(rand() * 7)
      const ids = Array.from({ length: n }, (_, i) => `p${i}`)
      const bal: Record<string, number> = {}
      let sum = 0
      for (let i = 0; i < n - 1; i++) {
        const v = Math.round((rand() - 0.5) * 2 * 500000)
        bal[ids[i] as string] = v
        sum += v
      }
      bal[ids[n - 1] as string] = -sum
      const amount = 100 + Math.floor(rand() * 600000)
      const plan = rotationPlan({ balances: bal, candidateIds: ids, sharerIds: ids, amount, currency: 'INR', maxRounds: 8 })
      let prev = outstanding(bal)
      let current: Record<string, number> = bal
      for (const r of plan.rounds) {
        rounds++
        const total = Object.values(r.balancesAfter).reduce((x, y) => x + y, 0)
        check(total === 0, `Σ = 0 after a round (${total})`)
        check(r.after < prev, 'each round strictly lowers outstanding')
        check(r.before === prev, 'before matches')
        check(r.settles === r.before - r.after, 'settles = before − after')
        for (const id of ids) {
          const alt = outstanding(applyRound(current, id, amount, ids, 'INR'))
          check(alt >= r.after, `payer optimal (${id} → ${alt} < ${r.after})`)
        }
        prev = r.after
        current = r.balancesAfter
      }
      check(plan.leftover === outstanding(current), 'leftover = outstanding')
      const end = { ...current }
      for (const tr of plan.finish) {
        end[tr.fromId] = (end[tr.fromId] ?? 0) + tr.amount
        end[tr.toId] = (end[tr.toId] ?? 0) - tr.amount
      }
      check(Object.values(end).every((v) => v === 0), 'finish squares all')
      const debtor = ids.reduce((m, id) => ((bal[id] ?? 0) < (bal[m] ?? 0) ? id : m), ids[0] as string)
      const at = squaresAt(bal[debtor] ?? 0, n, true)
      if (at !== null) {
        check(applyRound(bal, debtor, at, ids, 'INR')[debtor] === 0, `squaresAt exact (${debtor} ${bal[debtor]} at ${at})`)
        if (at > 1) check((applyRound(bal, debtor, at - 1, ids, 'INR')[debtor] ?? 0) < 0, 'squaresAt is the smallest such amount')
      }
    }
    expect(failures).toEqual([])
    expect(rounds).toBeGreaterThan(10000)
  })
})
