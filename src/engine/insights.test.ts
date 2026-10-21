import { describe, expect, it } from 'vitest'
import type { CategoryId, Expense } from '../domain/types'
import { insights } from './insights'
import { expenseShares } from './split'

let seq = 0
function expense(total: number, people: string[], payerId: string, date: string, category: CategoryId = 'food', currency = 'INR'): Expense {
  const participants = people.map((friendId) => ({ friendId, input: null }))
  seq += 1
  return {
    id: `e${seq}`,
    kind: 'split',
    title: 'x',
    category,
    currency,
    total,
    date,
    createdAt: seq,
    updatedAt: seq,
    payerId,
    mode: 'equal',
    participants,
    shares: expenseShares({ total, currency, mode: 'equal', participants, payerId, roundedToWhole: false, bill: null }),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

describe('insights', () => {
  const data = [
    expense(1000, ['me', 'a'], 'me', '2026-08-03', 'food'),
    expense(3000, ['me', 'a', 'b'], 'a', '2026-08-20', 'travel'),
    expense(600, ['me', 'b'], 'b', '2026-10-01', 'food'),
    expense(900, ['a', 'b'], 'me', '2026-10-05', 'gift'),
    expense(5000, ['a', 'b'], 'a', '2026-10-06', 'rent'),
    expense(400, ['me', 'a'], 'me', '2026-10-07', 'food', 'USD'),
  ]

  it('adds up my shares, what I paid out, and how many I was part of', () => {
    const r = insights(data, { meId: 'me', currency: 'INR' })
    expect(r.spent).toBe(500 + 1000 + 300)
    expect(r.paidOut).toBe(1000 + 900)
    expect(r.count).toBe(4)
  })

  it('groups my spend by category, largest first', () => {
    expect(insights(data, { meId: 'me', currency: 'INR' }).byCategory).toEqual([
      { category: 'travel', amount: 1000, count: 1 },
      { category: 'food', amount: 800, count: 2 },
    ])
  })

  it('fills every month between the first and last', () => {
    expect(insights(data, { meId: 'me', currency: 'INR' }).byMonth).toEqual([
      { month: '2026-08', amount: 1500 },
      { month: '2026-09', amount: 0 },
      { month: '2026-10', amount: 300 },
    ])
  })

  it('ranks the friends I share with by my spend', () => {
    expect(insights(data, { meId: 'me', currency: 'INR' }).topFriends).toEqual([
      { friendId: 'a', amount: 1500, count: 2 },
      { friendId: 'b', amount: 1300, count: 2 },
    ])
  })

  it('respects an inclusive date range and fills the whole range', () => {
    const r = insights(data, { meId: 'me', currency: 'INR', from: '2026-08-20', to: '2026-11-30' })
    expect(r.spent).toBe(1300)
    expect(r.byMonth.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
  })

  it('counts only the chosen currency', () => {
    const r = insights(data, { meId: 'me', currency: 'USD' })
    expect(r).toMatchObject({ spent: 200, paidOut: 400, count: 1 })
  })

  it('is empty without data', () => {
    expect(insights([], { meId: 'me', currency: 'INR' })).toEqual({ spent: 0, paidOut: 0, byCategory: [], byMonth: [], topFriends: [], count: 0 })
    expect(insights([], { meId: 'me', currency: 'INR', from: '2026-01-01', to: '2026-03-31' }).byMonth).toHaveLength(3)
  })

  it('ignores invalid range bounds', () => {
    expect(insights(data, { meId: 'me', currency: 'INR', from: 'yesterday' }).spent).toBe(1800)
  })
})
