import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, updateProfile } from '../../data'
import { expensesStore, friendsStore, groupsStore } from '../../data/stores'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { groupCover } from '../paidfor/engine'
import { applyImport, undoImport } from './apply'
import { planSplitwise, readSplitwise } from './splitwise'

const GOA = [
  'Date,Description,Category,Cost,Currency,Ayush Kumar,Riya,Sam',
  '2026-10-01,Villa,Hotel,24000.00,INR,16000.00,-8000.00,-8000.00',
  '2026-10-02,"Dinner, beach shack",Dining out,3000.00,INR,-1000.00,2000.00,-1000.00',
  '2026-10-03,Riya paid Ayush Kumar,Payment,6000.00,INR,-6000.00,6000.00,0.00',
  '2026-10-04,Cab,Taxi,1500.00,INR,-1000.00,750.00,250.00',
  '2026-10-31,Total balance, , ,INR,8000.00,750.00,-8750.00',
].join('\n')

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
})

describe('applyImport', () => {
  it('brings the group over with its people, and every balance matches Splitwise', () => {
    const riya = addFriend({ name: 'Riya Sharma' }).id
    const file = readSplitwise(GOA)
    const plan = planSplitwise(file, categoryFromText)
    const result = applyImport(file, plan, { groupName: 'Goa trip', me: 'Ayush Kumar', people: { Riya: riya, Sam: null } })
    expect(result.mismatches).toEqual([])
    expect(result).toMatchObject({ bills: 4, payments: 1, currency: 'INR' })
    const sam = friendsStore.get().find((f) => f.name === 'Sam')
    expect(sam).toBeDefined()
    expect(result.madeFriends).toEqual([sam?.id])
    const group = groupsStore.get().find((g) => g.id === result.groupId)
    expect(group).toMatchObject({ name: 'Goa trip', currency: 'INR', memberIds: [ME_ID, riya, sam?.id] })
    expect(expensesStore.get().filter((e) => e.groupId === result.groupId)).toHaveLength(4)

    // And straight away, "Paid for what": Riya's 6,000 paid the villa part she owed.
    const cover = groupCover(group!, expensesStore.get())
    const villa = expensesStore.get().find((e) => e.title === 'Villa')!
    expect(cover.bills[villa.id]?.parts.find((p) => p.personId === riya)?.status).toBe('paid')
  })

  it('undo takes back the group, its bills and only the people it added', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const file = readSplitwise(GOA)
    const result = applyImport(file, planSplitwise(file, categoryFromText), { groupName: 'Goa', me: 'Ayush Kumar', people: { Riya: riya, Sam: null } })
    undoImport(result)
    expect(groupsStore.get()).toEqual([])
    expect(expensesStore.get()).toEqual([])
    expect(friendsStore.get().map((f) => f.name).sort()).toEqual(['Ayush', 'Riya'])
  })
})
