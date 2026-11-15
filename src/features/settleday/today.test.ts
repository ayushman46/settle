import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, recordSettlement, resetDataForTests, saveExpense, setGroupArchived, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { setSettleDay } from './store'
import { settledayToday } from './today'

/** 15 Nov 2026, mid-morning. */
const NOW = new Date(2026, 10, 15, 10)
const EARLIER = new Date(2026, 9, 1).getTime()

let riya: string
let sam: string

function flat(name = 'Flat 4B'): string {
  const group = createGroup({ name, emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya, sam] })
  // You owe Riya ₹200; Sam owes Riya ₹400.
  saveExpense(draft({ title: 'Hotel', total: 120_000, payerId: riya, groupId: group.id, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 80_000, payerId: ME_ID, groupId: group.id, participants: everyone(ME_ID, sam) }))
  return group.id
}

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

describe('settledayToday', () => {
  it('has nothing when no group has a settle day', () => {
    flat()
    expect(settledayToday(NOW)).toEqual([])
  })

  it('has an item on the day for a group with money open, about your side of it', () => {
    const id = flat()
    setSettleDay(id, 15, EARLIER)
    expect(settledayToday(NOW)).toEqual([
      {
        id: `settleday:${id}:2026-11-15`,
        title: 'Settle day in Flat 4B',
        body: 'You pay ₹200. 2 payments in all.',
        path: `/app/groups/${id}/settle-day`,
        amount: 20_000,
        currency: 'INR',
      },
    ])
  })

  it('says what is coming to you, or that it is between the others (then with no amount)', () => {
    const id = flat()
    setSettleDay(id, 15, EARLIER)
    // You pay Riya: now only Sam → Riya is left.
    recordSettlement(id, { fromId: ME_ID, toId: riya, amount: 20_000, date: '2026-11-15', method: 'upi' })
    const [item] = settledayToday(NOW)
    expect(item).toMatchObject({ body: '1 payment between the others.' })
    expect(item).not.toHaveProperty('amount')

    const second = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, sam] })
    saveExpense(draft({ title: 'Ferry', total: 90_000, payerId: ME_ID, groupId: second.id, participants: everyone(ME_ID, sam) }))
    setSettleDay(second.id, 15, EARLIER)
    const items = settledayToday(NOW)
    // By group name: Flat 4B, then Goa.
    expect(items.map((i) => i.title)).toEqual(['Settle day in Flat 4B', 'Settle day in Goa'])
    expect(items[1]).toMatchObject({ body: '₹450 is coming to you. 1 payment in all.', amount: 45_000, currency: 'INR' })
  })

  it('has nothing once everyone is square, before the day, or for an archived group', () => {
    const id = flat()
    setSettleDay(id, 16, EARLIER)
    expect(settledayToday(NOW)).toEqual([])
    setSettleDay(id, 15, EARLIER)
    setGroupArchived(id, true)
    expect(settledayToday(NOW)).toEqual([])
    setGroupArchived(id, false)
    recordSettlement(id, { fromId: ME_ID, toId: riya, amount: 20_000, date: '2026-11-15', method: 'upi' })
    recordSettlement(id, { fromId: sam, toId: riya, amount: 40_000, date: '2026-11-15', method: 'upi' })
    expect(settledayToday(NOW)).toEqual([])
  })

  it('stays for the day after while money is open, and not if the day was only picked today', () => {
    const id = flat()
    setSettleDay(id, 14, EARLIER)
    expect(settledayToday(NOW)).toMatchObject([{ id: `settleday:${id}:2026-11-14`, title: 'Settle day in Flat 4B was yesterday', amount: 20_000 }])
    expect(settledayToday(new Date(2026, 10, 16, 10))).toEqual([])
    setSettleDay(id, 14, NOW.getTime())
    expect(settledayToday(NOW)).toEqual([])
  })

  it('“last day” lands on the month’s real last day', () => {
    const id = flat()
    setSettleDay(id, 'last', EARLIER)
    expect(settledayToday(new Date(2026, 10, 29, 10))).toEqual([])
    expect(settledayToday(new Date(2026, 10, 30, 10))).toHaveLength(1)
    expect(settledayToday(new Date(2027, 1, 28, 23, 59))).toHaveLength(1)
    expect(settledayToday(new Date(2028, 1, 28, 10))).toEqual([])
    expect(settledayToday(new Date(2028, 1, 29, 10))).toHaveLength(1)
  })
})
