import { describe, expect, it } from 'vitest'
import type { Expense, Group, Participant, Settlement } from '../domain/types'
import { collectProgress, expenseNet, groupBalances, isSettledInGroup, overallSummary, simplifyDebts } from './balances'
import { expenseShares } from './split'

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

let seq = 0
function expense(partial: Partial<Expense> & { people?: string[] }): Expense {
  const participants: Participant[] = partial.participants ?? (partial.people ?? ['me', 'a']).map((friendId) => ({ friendId, input: null }))
  const base = {
    total: partial.total ?? 1000,
    currency: partial.currency ?? 'INR',
    mode: partial.mode ?? 'equal',
    participants,
    payerId: partial.payerId ?? 'me',
    roundedToWhole: partial.roundedToWhole ?? false,
    bill: partial.bill ?? null,
  }
  seq += 1
  return {
    id: partial.id ?? `e${seq}`,
    kind: 'split',
    title: 'Test',
    category: partial.category ?? 'food',
    date: partial.date ?? '2026-10-01',
    createdAt: seq,
    updatedAt: seq,
    shares: partial.shares ?? expenseShares(base),
    note: null,
    groupId: partial.groupId ?? null,
    paidBack: partial.paidBack ?? {},
    recurringId: null,
    source: 'manual',
    ...base,
  }
}

function group(partial: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Goa',
    emoji: '🏖️',
    kind: 'trip',
    currency: 'INR',
    memberIds: ['me', 'a', 'b'],
    settlements: [],
    createdAt: 1,
    updatedAt: 1,
    archived: false,
    ...partial,
  }
}

const settlement = (fromId: string, toId: string, amount: number): Settlement => ({
  id: `s-${fromId}-${toId}-${amount}`,
  fromId,
  toId,
  amount,
  date: '2026-10-02',
  createdAt: 2,
  method: 'upi',
})

const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

describe('expenseNet', () => {
  it('credits the payer with what the others owe', () => {
    expect(expenseNet(expense({ total: 900, people: ['me', 'a', 'b'] }))).toEqual({ me: 600, a: -300, b: -300 })
  })

  it('handles a payer who is not part of the split', () => {
    expect(expenseNet(expense({ total: 900, people: ['a', 'b'], payerId: 'me' }))).toEqual({ me: 900, a: -450, b: -450 })
  })

  it('is zero for an expense only the payer shares', () => {
    expect(expenseNet(expense({ total: 900, people: ['me'] }))).toEqual({ me: 0 })
  })
})

describe('groupBalances', () => {
  it('lists every member and sums to zero', () => {
    const g = group({ memberIds: ['me', 'a', 'b', 'c'] })
    const b = groupBalances(g, [expense({ groupId: 'g1', total: 900, people: ['me', 'a', 'b'] })])
    expect(b).toEqual({ me: 600, a: -300, b: -300, c: 0 })
    expect(total(b)).toBe(0)
  })

  it('applies settlements: the sender goes up, the receiver down', () => {
    const g = group({ settlements: [settlement('a', 'me', 300)] })
    const b = groupBalances(g, [expense({ groupId: 'g1', total: 900, people: ['me', 'a', 'b'] })])
    expect(b).toEqual({ me: 300, a: 0, b: -300 })
  })

  it('ignores other groups, standalone expenses, other currencies and bad settlements', () => {
    const g = group({ settlements: [settlement('a', 'a', 50), { ...settlement('a', 'me', 10), amount: Number.NaN }] })
    const b = groupBalances(g, [
      expense({ groupId: 'g2', total: 900 }),
      expense({ groupId: null, total: 900 }),
      expense({ groupId: 'g1', total: 900, currency: 'USD' }),
    ])
    expect(b).toEqual({ me: 0, a: 0, b: 0 })
  })

  it('keeps former members who still have a balance', () => {
    const g = group({ memberIds: ['me', 'a'] })
    expect(groupBalances(g, [expense({ groupId: 'g1', total: 600, people: ['me', 'a', 'gone'] })])).toEqual({ me: 400, a: -200, gone: -200 })
  })
})

describe('simplifyDebts', () => {
  it('settles a simple chain in the fewest payments', () => {
    expect(simplifyDebts({ a: -500, b: 0, c: 500 })).toEqual([{ fromId: 'a', toId: 'c', amount: 500 }])
    expect(simplifyDebts({ a: -300, b: -200, c: 500 })).toEqual([
      { fromId: 'a', toId: 'c', amount: 300 },
      { fromId: 'b', toId: 'c', amount: 200 },
    ])
  })

  it('pairs the largest debtor with the largest creditor', () => {
    expect(simplifyDebts({ a: 700, b: 300, c: -600, d: -400 })).toEqual([
      { fromId: 'c', toId: 'a', amount: 600 },
      { fromId: 'd', toId: 'b', amount: 300 },
      { fromId: 'd', toId: 'a', amount: 100 },
    ])
  })

  it('is deterministic regardless of key order, breaking ties by id', () => {
    const one = simplifyDebts({ x: -100, y: -100, p: 100, q: 100 })
    const two = simplifyDebts({ q: 100, p: 100, y: -100, x: -100 })
    expect(one).toEqual(two)
    expect(one).toEqual([
      { fromId: 'x', toId: 'p', amount: 100 },
      { fromId: 'y', toId: 'q', amount: 100 },
    ])
  })

  it('returns nothing when everyone is square, and skips junk', () => {
    expect(simplifyDebts({})).toEqual([])
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([])
    expect(simplifyDebts({ a: Number.NaN, b: 100, c: -100 })).toEqual([{ fromId: 'c', toId: 'b', amount: 100 }])
  })

  it('property: settles random balances exactly with at most n − 1 transfers', () => {
    const next = rng(99)
    for (let run = 0; run < 2000; run++) {
      const n = 2 + Math.floor(next() * 14)
      const balances: Record<string, number> = {}
      let rest = 0
      for (let i = 0; i < n - 1; i++) {
        const v = Math.floor((next() - 0.5) * 2_000_000)
        balances[`f${i}`] = v
        rest -= v
      }
      balances[`f${n - 1}`] = rest
      const transfers = simplifyDebts(balances)
      const nonZero = Object.values(balances).filter((v) => v !== 0).length
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
      const after = { ...balances }
      for (const t of transfers) {
        expect(t.amount).toBeGreaterThan(0)
        expect(Number.isSafeInteger(t.amount)).toBe(true)
        expect(t.fromId).not.toBe(t.toId)
        // A debtor pays: their balance rises toward zero; a creditor's falls toward zero.
        expect(after[t.fromId]).toBeLessThan(0)
        expect(after[t.toId]).toBeGreaterThan(0)
        after[t.fromId] = (after[t.fromId] ?? 0) + t.amount
        after[t.toId] = (after[t.toId] ?? 0) - t.amount
      }
      for (const v of Object.values(after)) expect(v).toBe(0)
      expect(simplifyDebts({ ...balances })).toEqual(transfers)
    }
  })
})

describe('groupBalances — properties (seeded)', () => {
  it('always sums to zero and simplifies to exact settlement', () => {
    const next = rng(1234)
    const modes = ['equal', 'shares', 'percent', 'exact'] as const
    for (let run = 0; run < 400; run++) {
      const members = Array.from({ length: 2 + Math.floor(next() * 8) }, (_, i) => (i === 0 ? 'me' : `m${i}`))
      const g = group({ memberIds: members })
      const expenses: Expense[] = []
      for (let k = 0; k < 1 + Math.floor(next() * 12); k++) {
        const people = members.filter(() => next() < 0.7)
        if (people.length === 0) people.push(members[0] ?? 'me')
        const t = 1 + Math.floor(next() * 5_000_000)
        const mode = modes[Math.floor(next() * modes.length)] ?? 'equal'
        let participants: Participant[]
        if (mode === 'exact') {
          const parts = people.map(() => 0)
          parts[0] = t
          participants = people.map((friendId, i) => ({ friendId, input: parts[i] ?? 0 }))
        } else if (mode === 'percent') {
          participants = people.map((friendId, i) => ({ friendId, input: i === 0 ? 10000 - (people.length - 1) * Math.floor(10000 / people.length) : Math.floor(10000 / people.length) }))
        } else {
          participants = people.map((friendId) => ({ friendId, input: mode === 'shares' ? 1 + Math.floor(next() * 3) : null }))
        }
        const payerId = members[Math.floor(next() * members.length)] ?? 'me'
        expenses.push(expense({ groupId: 'g1', total: t, mode, participants, payerId, roundedToWhole: next() < 0.3 }))
      }
      const settlements = Array.from({ length: Math.floor(next() * 4) }, (_, i) =>
        ({ ...settlement(members[i % members.length] ?? 'me', members[(i + 1) % members.length] ?? 'm1', 1 + Math.floor(next() * 100000)), id: `s${i}` }),
      ).filter((s) => s.fromId !== s.toId)
      const balances = groupBalances({ ...g, settlements }, expenses)
      expect(total(balances)).toBe(0)
      const after = { ...balances }
      for (const t of simplifyDebts(balances)) {
        after[t.fromId] = (after[t.fromId] ?? 0) + t.amount
        after[t.toId] = (after[t.toId] ?? 0) - t.amount
      }
      for (const v of Object.values(after)) expect(v).toBe(0)
    }
  })
})

describe('isSettledInGroup', () => {
  const groups = [group()]
  it('is true only for expenses in an existing group, in its currency', () => {
    expect(isSettledInGroup({ groupId: 'g1', currency: 'INR' }, groups)).toBe(true)
    expect(isSettledInGroup({ groupId: 'g1', currency: 'USD' }, groups)).toBe(false)
    expect(isSettledInGroup({ groupId: 'gone', currency: 'INR' }, groups)).toBe(false)
    expect(isSettledInGroup({ groupId: null, currency: 'INR' }, groups)).toBe(false)
  })
})

describe('overallSummary', () => {
  it('counts unpaid shares of standalone expenses I paid for', () => {
    const s = overallSummary([expense({ total: 900, people: ['me', 'a', 'b'], paidBack: { b: 5 } })], [], 'me', 'INR')
    expect(s).toEqual({ currency: 'INR', owedToMe: 300, iOwe: 0, byFriend: { a: 300 }, otherCurrencies: {} })
  })

  it('counts my unpaid share when someone else paid', () => {
    const s = overallSummary([expense({ total: 900, people: ['me', 'a', 'b'], payerId: 'a' })], [], 'me', 'INR')
    expect(s.iOwe).toBe(300)
    expect(s.byFriend).toEqual({ a: -300 })
    const paid = overallSummary([expense({ total: 900, people: ['me', 'a'], payerId: 'a', paidBack: { me: 1 } })], [], 'me', 'INR')
    expect(paid.iOwe).toBe(0)
    expect(paid.byFriend).toEqual({})
  })

  it('ignores expenses between other people', () => {
    expect(overallSummary([expense({ total: 900, people: ['a', 'b'], payerId: 'a' })], [], 'me', 'INR').byFriend).toEqual({})
  })

  it('nets what we owe each other per friend', () => {
    const s = overallSummary(
      [expense({ total: 1000, people: ['me', 'a'] }), expense({ total: 400, people: ['me', 'a'], payerId: 'a' }), expense({ total: 600, people: ['me', 'b'], payerId: 'b' })],
      [],
      'me',
      'INR',
    )
    expect(s.byFriend).toEqual({ a: 300, b: -300 })
    expect(s.owedToMe).toBe(300)
    expect(s.iOwe).toBe(300)
  })

  it('uses simplified group debts for group expenses', () => {
    const g = group({ memberIds: ['me', 'a', 'b'] })
    const s = overallSummary(
      [expense({ groupId: 'g1', total: 900, people: ['me', 'a', 'b'], payerId: 'a' }), expense({ groupId: 'g1', total: 300, people: ['b'], payerId: 'me' })],
      [g],
      'me',
      'INR',
    )
    // Balances: me −300 + 300 = 0 … a +600, b −300 −300 = −600 → b pays a; I'm square.
    expect(s.byFriend).toEqual({})
    expect(s.owedToMe + s.iOwe).toBe(0)
  })

  it('treats expenses of deleted groups or another currency as standalone', () => {
    const g = group({ memberIds: ['me', 'a'] })
    const s = overallSummary([expense({ groupId: 'gone', total: 500, people: ['me', 'a'] }), expense({ groupId: 'g1', total: 800, people: ['me', 'a'], currency: 'USD' })], [g], 'me', 'INR')
    expect(s.byFriend).toEqual({ a: 250 })
    expect(s.otherCurrencies).toEqual({ USD: { owedToMe: 400, iOwe: 0 } })
  })

  it('keeps other currencies apart and sorted', () => {
    const s = overallSummary(
      [expense({ currency: 'USD', total: 1000 }), expense({ currency: 'EUR', total: 400, payerId: 'a' }), expense({ total: 200 })],
      [],
      'me',
      'INR',
    )
    expect(s.owedToMe).toBe(100)
    expect(Object.keys(s.otherCurrencies)).toEqual(['EUR', 'USD'])
    expect(s.otherCurrencies).toEqual({ EUR: { owedToMe: 0, iOwe: 200 }, USD: { owedToMe: 500, iOwe: 0 } })
  })

  it('includes archived groups (the money is still owed)', () => {
    const g = group({ archived: true, memberIds: ['me', 'a'] })
    expect(overallSummary([expense({ groupId: 'g1', total: 1000, people: ['me', 'a'] })], [g], 'me', 'INR').owedToMe).toBe(500)
  })
})

describe('collectProgress', () => {
  it('tracks what the payer has collected', () => {
    const e = expense({ total: 276600, people: ['me', 'a', 'b', 'c'], paidBack: { a: 1 } })
    expect(collectProgress(e)).toEqual({ collected: 69150, outstanding: 138300, total: 207450, paidCount: 1, peopleCount: 3 })
  })

  it('leaves out people with nothing to pay', () => {
    const e = expense({ total: 1000, mode: 'shares', participants: [{ friendId: 'me', input: 1 }, { friendId: 'a', input: 0 }] })
    expect(collectProgress(e)).toEqual({ collected: 0, outstanding: 0, total: 0, paidCount: 0, peopleCount: 0 })
  })
})
