import { describe, expect, it } from 'vitest'
import type { Contribution, Pool } from '../domain/types'
import { contributorKey, isIn, paidBy, poolGoal, poolProgress, suggestedContribution, suggestionStep } from './pools'

let seq = 0
function chip(friendId: string | null, amount: number, name = friendId ?? 'Guest'): Contribution {
  seq++
  return { id: `c${seq}`, friendId, name, amount, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null, createdAt: seq }
}

function pool(partial: Partial<Pool> = {}): Pool {
  return {
    id: 'p1',
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: [],
    expectedCount: null,
    deadline: null,
    note: null,
    showAmounts: true,
    contributions: [],
    secret: 'AAAAAAAAAAAAAAAAAAAAAA',
    createdAt: 1,
    updatedAt: 1,
    closedAt: null,
    ...partial,
  }
}

const TEN = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10']
const SEVEN_PAID = TEN.slice(0, 7).map((id) => chip(id, 50000))

describe('poolProgress — spec 05 §4 worked examples', () => {
  it('1. fixed, listed: 7 of 10 paid ₹500', () => {
    const p = poolProgress(pool({ memberIds: TEN, contributions: SEVEN_PAID }))
    expect(p.collected).toBe(350000)
    expect(p.goal).toBe(500000)
    expect(p.remaining).toBe(150000)
    expect(p.over).toBe(0)
    expect(p.percent).toBe(70)
    expect(p.inCount).toBe(7)
    expect(p.expected).toBe(10)
    for (const id of TEN.slice(0, 7)) expect(p.due[id]).toBe(0)
    for (const id of TEN.slice(7)) expect(p.due[id]).toBe(50000)
  })

  it('2. partial: Sam paid ₹300 of ₹500', () => {
    const p = poolProgress(pool({ memberIds: TEN, contributions: [...SEVEN_PAID, chip('f8', 30000)] }))
    expect(p.collected).toBe(380000)
    expect(p.percent).toBe(76)
    expect(p.inCount).toBe(7)
    expect(p.due.f8).toBe(20000)
  })

  it('3. overpaid person: due never negative, counted in', () => {
    const p = poolProgress(pool({ memberIds: ['kabir', 'sam'], contributions: [chip('kabir', 60000)] }))
    expect(p.due.kabir).toBe(0)
    expect(p.due.sam).toBe(50000)
    expect(p.inCount).toBe(1)
  })

  it('4. target: the suggestion is ₹1,300, none without people or once the goal is met', () => {
    expect(suggestedContribution(1000000, 350000, 5, 'INR')).toBe(130000)
    expect(suggestedContribution(1000000, 350000, 0, 'INR')).toBeNull()
    expect(suggestedContribution(1000000, 1000000, 3, 'INR')).toBeNull()
    expect(suggestedContribution(1000000, 1200000, 3, 'INR')).toBeNull()
    expect(suggestedContribution(null, 0, 3, 'INR')).toBeNull()
  })

  it('5. over goal: remaining 0, over ₹500, percent capped at 100', () => {
    const p = poolProgress(
      pool({ mode: 'target', perPerson: null, target: 500000, contributions: [chip(null, 300000, 'A'), chip(null, 250000, 'B')] }),
    )
    expect(p.collected).toBe(550000)
    expect(p.remaining).toBe(0)
    expect(p.over).toBe(50000)
    expect(p.percent).toBe(100)
    expect(p.inCount).toBe(2)
  })

  it('6. open list: no goal without a head count; about 15 people → ₹1,500', () => {
    const open = poolProgress(pool({ perPerson: 10000 }))
    expect(open.goal).toBeNull()
    expect(open.percent).toBeNull()
    expect(open.remaining).toBeNull()
    expect(open.expected).toBeNull()
    const about = poolProgress(pool({ perPerson: 10000, expectedCount: 15 }))
    expect(about.goal).toBe(150000)
    expect(about.expected).toBe(15)
  })

  it('7. guests by name: "Priya" and "priya " are one person', () => {
    const paid = paidBy(pool({ contributions: [chip(null, 10000, 'Priya'), chip(null, 5000, 'priya ')] }))
    expect([...paid.entries()]).toEqual([['priya', 15000]])
  })
})

describe('pool engine details', () => {
  it('target mode: anyone who gave is in; no due list', () => {
    const p = poolProgress(pool({ mode: 'target', perPerson: null, target: null, memberIds: ['a', 'b'], contributions: [chip('a', 100)] }))
    expect(p.inCount).toBe(1)
    expect(p.goal).toBeNull()
    expect(p.due).toEqual({})
    expect(p.expected).toBe(2)
  })

  it('a friend and a guest with the same name stay apart', () => {
    expect(contributorKey({ friendId: 'f1', name: 'Sam' })).toBe('f1')
    expect(contributorKey({ friendId: null, name: '  SAM ' })).toBe('sam')
  })

  it('isIn and poolGoal', () => {
    expect(isIn(pool(), 49999)).toBe(false)
    expect(isIn(pool(), 50000)).toBe(true)
    expect(isIn(pool({ mode: 'target', perPerson: null }), 1)).toBe(true)
    expect(isIn(pool(), 0)).toBe(false)
    expect(poolGoal(pool({ memberIds: ['a', 'b', 'c'] }))).toBe(150000)
    expect(poolGoal(pool({ memberIds: ['a'], expectedCount: 40 }))).toBe(50000)
  })

  it('percent floors (1 paisa short of a third is 33)', () => {
    const p = poolProgress(pool({ memberIds: ['a', 'b', 'c'], perPerson: 100, contributions: [chip('a', 99)] }))
    expect(p.percent).toBe(33)
  })

  it('suggestion rounds up to ₹50 and is at least ₹50', () => {
    expect(suggestionStep('INR')).toBe(5000)
    expect(suggestionStep('JPY')).toBe(50)
    expect(suggestedContribution(100000, 99000, 10, 'INR')).toBe(5000)
    expect(suggestedContribution(100000, 0, 3, 'INR')).toBe(35000)
    expect(suggestedContribution(1000000, 350000, 5.7, 'INR')).toBe(130000)
  })
})
