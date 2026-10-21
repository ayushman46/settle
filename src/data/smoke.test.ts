import { beforeEach, describe, expect, it } from 'vitest'
import { ME_ID } from '../domain/types'
import {
  addFriend,
  completeOnboarding,
  createGroup,
  exportBackup,
  expensesStore,
  flushAllStores,
  friendsStore,
  parseBackup,
  profileStore,
  resetDataForTests,
  saveExpense,
  STORAGE_KEYS,
} from './index'

beforeEach(() => {
  resetDataForTests()
})

describe('data layer smoke', () => {
  it('saves an expense end to end and persists it', () => {
    completeOnboarding({ name: 'Ayush', upiId: 'ayush@okaxis', currency: 'INR' })
    const riya = addFriend({ name: 'Riya' })
    const e = saveExpense({
      kind: 'split',
      title: 'Cab',
      category: 'transport',
      currency: 'INR',
      total: 84000,
      date: '2026-10-21',
      payerId: ME_ID,
      mode: 'equal',
      participants: [
        { friendId: ME_ID, input: null },
        { friendId: riya.id, input: null },
      ],
      roundedToWhole: false,
      note: null,
      groupId: null,
      bill: null,
      recurringId: null,
      source: 'manual',
    })
    expect(e.shares).toEqual({ [ME_ID]: 42000, [riya.id]: 42000 })
    flushAllStores()
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.expenses) ?? 'null') as { v: number; data: unknown[] }
    expect(raw.v).toBe(1)
    expect(raw.data).toHaveLength(1)
    expect(friendsStore.get()[0]?.name).toBe('Ayush')
    expect(profileStore.get().upiId).toBe('ayush@okaxis')
    expect(expensesStore.get()).toHaveLength(1)
    createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id] })
    const backup = parseBackup(JSON.parse(JSON.stringify(exportBackup())))
    expect(backup?.expenses).toHaveLength(1)
    expect(backup?.groups[0]?.memberIds).toEqual([ME_ID, riya.id])
  })
})
