import { describe, expect, it } from 'vitest'
import type { Expense } from '../../domain/types'
import { daysHeld, heldInGroup, isHoldReason, looseHeld, overdueHolds, putBack, takeOut, type HeldExpense } from './engine'

const DAY = 86_400_000

function expense(id: string, more: Partial<Expense> = {}): Expense {
  return {
    id,
    kind: 'split',
    title: `Expense ${id}`,
    category: 'food',
    currency: 'INR',
    total: 240_000,
    date: '2026-11-14',
    createdAt: 1,
    updatedAt: 2,
    payerId: 'me',
    mode: 'equal',
    participants: [
      { friendId: 'me', input: null },
      { friendId: 'riya', input: null },
    ],
    shares: { me: 120_000, riya: 120_000 },
    roundedToWhole: false,
    note: null,
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const held = (id: string, heldAt: number, more: Partial<Expense> = {}): HeldExpense => ({ expense: expense(id, more), reason: 'amount', note: null, heldAt, afterId: null })

describe('takeOut and putBack', () => {
  const list = [expense('a'), expense('b'), expense('c')]

  it('an expense put back is the very one taken out, in the same place', () => {
    for (const id of ['a', 'b', 'c']) {
      const taken = takeOut(list, id)!
      expect(taken.list.map((e) => e.id)).toEqual(['a', 'b', 'c'].filter((x) => x !== id))
      const back = putBack(taken.list, taken.expense, taken.afterId)
      expect(back).toEqual(list)
      expect(JSON.stringify(back)).toBe(JSON.stringify(list))
      // The same record, not a copy.
      expect(back.find((e) => e.id === id)).toBe(list.find((e) => e.id === id))
    }
  })

  it('remembers what sat before it', () => {
    expect(takeOut(list, 'a')!.afterId).toBeNull()
    expect(takeOut(list, 'b')!.afterId).toBe('a')
    expect(takeOut(list, 'c')!.afterId).toBe('b')
  })

  it('returns null for an expense that is not there, and leaves the list alone', () => {
    expect(takeOut(list, 'nope')).toBeNull()
    expect(takeOut([], 'a')).toBeNull()
  })

  it('goes to the front when its neighbour is gone, and into an empty list', () => {
    const taken = takeOut(list, 'c')!
    const without = taken.list.filter((e) => e.id !== 'b')
    expect(putBack(without, taken.expense, taken.afterId).map((e) => e.id)).toEqual(['c', 'a'])
    expect(putBack([], taken.expense, taken.afterId)).toEqual([taken.expense])
  })

  it('replaces an expense with the same id in place instead of adding a second one', () => {
    const edited = expense('b', { title: 'Edited meanwhile', total: 1 })
    const original = list[1]!
    const back = putBack([list[0]!, edited, list[2]!], original, 'a')
    expect(back).toEqual(list)
    expect(back).toHaveLength(3)
  })

  it('keeps everything on the expense: bill, ticks, part payments, trip currency', () => {
    const rich = expense('x', {
      kind: 'bill',
      mode: 'items',
      bill: {
        meta: { merchant: 'Cafe', date: '2026-11-14', subtotal: 200_000, tax: 40_000, serviceCharge: null, discount: null, tip: null, total: 240_000 },
        items: [{ id: 'i1', name: 'Thali', quantity: 2, amount: 200_000 }],
        assignments: { i1: { me: 1, riya: 1 } },
        warnings: [],
        feeSplit: 'equal',
      },
      paidBack: { riya: 1_700_000_000_000 },
      partPaid: { sam: 5000 },
      fx: { amount: 1000, currency: 'THB', rate: '2.4', rateDate: '2026-11-13', source: 'ecb' },
      note: 'Line one\nLine two',
    })
    const before = JSON.stringify(rich)
    const taken = takeOut([expense('a'), rich], 'x')!
    const back = putBack(taken.list, taken.expense, taken.afterId)
    expect(JSON.stringify(back[1])).toBe(before)
  })

  it('works on a huge list', () => {
    const many = Array.from({ length: 5000 }, (_, i) => expense(`e${i}`))
    const taken = takeOut(many, 'e2500')!
    expect(taken.list).toHaveLength(4999)
    expect(putBack(taken.list, taken.expense, taken.afterId)).toEqual(many)
  })
})

describe('which holds a card shows', () => {
  const all = [held('a', 5 * DAY), held('b', 9 * DAY, { groupId: 'flat' }), held('c', 7 * DAY, { groupId: null }), held('d', 9 * DAY, { groupId: 'gone', title: 'Auto' })]

  it('a group sees its own, newest hold first', () => {
    expect(heldInGroup(all, 'goa').map((h) => h.expense.id)).toEqual(['a'])
    expect(heldInGroup(all, 'flat').map((h) => h.expense.id)).toEqual(['b'])
    expect(heldInGroup(all, 'nope')).toEqual([])
    const two = [held('old', 1 * DAY), held('new', 3 * DAY)]
    expect(heldInGroup(two, 'goa').map((h) => h.expense.id)).toEqual(['new', 'old'])
  })

  it('loose holds are those outside groups, or whose group no longer exists', () => {
    expect(looseHeld(all, new Set(['goa', 'flat'])).map((h) => h.expense.id)).toEqual(['d', 'c'])
    expect(looseHeld([], new Set())).toEqual([])
  })

  it('ties are listed by title, the same on every reload', () => {
    const tied = [held('2', DAY, { title: 'Zebra' }), held('1', DAY, { title: 'Apple' })]
    expect(heldInGroup(tied, 'goa').map((h) => h.expense.title)).toEqual(['Apple', 'Zebra'])
  })
})

describe('how long it has been on hold', () => {
  it('counts whole days from the moment it was held, not from that day’s start', () => {
    const heldAt = new Date(2026, 10, 14, 23, 30).getTime()
    expect(daysHeld(heldAt, heldAt)).toBe(0)
    expect(daysHeld(heldAt, heldAt + DAY - 1)).toBe(0)
    expect(daysHeld(heldAt, heldAt + DAY)).toBe(1)
    // Half an hour into the next calendar day is still day 0.
    expect(daysHeld(heldAt, new Date(2026, 10, 15, 0, 30).getTime())).toBe(0)
    // A clock set back never gives a negative age.
    expect(daysHeld(heldAt, heldAt - 5 * DAY)).toBe(0)
  })

  it('a hold is overdue at seven full days, oldest first', () => {
    const now = 100 * DAY
    const list = [held('fresh', now - 6 * DAY - (DAY - 1)), held('week', now - 7 * DAY), held('old', now - 20 * DAY)]
    expect(overdueHolds(list, now).map((h) => h.expense.id)).toEqual(['old', 'week'])
    expect(overdueHolds(list, now, 21)).toEqual([])
    expect(overdueHolds([], now)).toEqual([])
  })
})

describe('reasons', () => {
  it('knows the five reasons and nothing else', () => {
    expect(['amount', 'absent', 'twice', 'checking', 'other'].every(isHoldReason)).toBe(true)
    expect(['', 'wrong', null, 3].some(isHoldReason)).toBe(false)
  })
})
