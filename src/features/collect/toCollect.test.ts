import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, friendsStore, groupsStore, saveExpense, setPaidBack } from '../../data'
import type { Reminder } from '../../data/stores'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { toCollect } from './toCollect'

beforeEach(() => {
  resetDataForTests()
})

const NOW = new Date(2026, 9, 27, 12).getTime()
const list = (reminders: Reminder[] = []) => toCollect(friendsStore.get(), expensesStore.get(), groupsStore.get(), 'INR', reminders, NOW)

describe('toCollect', () => {
  it('lists who owes you, the longest wait first, with what it’s for', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const sam = addFriend({ name: 'Sam' }).id
    const asha = addFriend({ name: 'Asha' }).id
    saveExpense(draft({ title: 'Cab', total: 60_000, date: '2026-10-20', participants: everyone(ME_ID, sam) }))
    saveExpense(draft({ title: 'Dinner', total: 90_000, date: '2026-10-10', participants: everyone(ME_ID, riya, sam) }))
    // Asha paid for something you shared: you owe her, so she isn't on the list.
    saveExpense(draft({ title: 'Movie', total: 50_000, date: '2026-10-01', payerId: asha, participants: everyone(ME_ID, asha) }))

    const rows = list()
    expect(rows.map((r) => [r.friend.name, r.amount, r.since, r.title])).toEqual([
      ['Sam', 60_000, '2026-10-10', 'our splits'],
      ['Riya', 30_000, '2026-10-10', 'Dinner'],
    ])
  })

  it('nets what you owe them, and drops someone who paid', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-10-10', participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Snacks', total: 40_000, date: '2026-10-12', payerId: riya, participants: everyone(ME_ID, riya) }))
    expect(list().map((r) => r.amount)).toEqual([30_000])
    setPaidBack(dinner.id, riya, true)
    expect(list()).toEqual([])
  })

  it('counts only the reminders since the oldest unpaid split', () => {
    const riya = addFriend({ name: 'Riya' }).id
    saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-10-20', participants: everyone(ME_ID, riya) }))
    const reminders: Reminder[] = [
      // About an older split she has since paid.
      { friendId: riya, at: new Date(2026, 9, 5, 18).getTime(), tone: 'firm' },
      { friendId: riya, at: new Date(2026, 9, 22, 18).getTime(), tone: 'friendly' },
    ]
    expect(list(reminders)[0]?.reminders.map((r) => r.tone)).toEqual(['friendly'])
  })

  it('includes money owed in groups, after the dated splits', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const sam = addFriend({ name: 'Sam' }).id
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya] })
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 200_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 20_000, date: '2026-10-25', participants: everyone(ME_ID, sam) }))
    expect(list().map((r) => [r.friend.name, r.amount, r.since, r.title])).toEqual([
      ['Sam', 10_000, '2026-10-25', 'Cab'],
      ['Riya', 100_000, null, 'Goa'],
    ])
  })
})
