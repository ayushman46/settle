import { beforeEach, describe, expect, it } from 'vitest'
import { ME_ID } from '../domain/types'
import { ExpenseError } from './errors'
import { addFriend } from './friends'
import { createGroup, deleteGroup } from './groups'
import { createExpenseFromRecurring, deleteRecurring, restoreRecurring, saveRecurring, type RecurringDraft } from './recurring'
import { expensesStore, recurringStore } from './stores'
import { everyone } from './testKit'
import { resetDataForTests } from './testing'

let aditya: string
let neha: string

beforeEach(() => {
  resetDataForTests()
  aditya = addFriend({ name: 'Aditya' }).id
  neha = addFriend({ name: 'Neha' }).id
})

function rent(patch: Partial<RecurringDraft> = {}): RecurringDraft {
  return {
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 3200000,
    payerId: ME_ID,
    mode: 'percent',
    participants: [
      { friendId: ME_ID, input: 4000 },
      { friendId: aditya, input: 3000 },
      { friendId: neha, input: 3000 },
    ],
    dayOfMonth: 5,
    groupId: null,
    active: true,
    ...patch,
  }
}

describe('saveRecurring', () => {
  it('creates and updates a template', () => {
    const t = saveRecurring(rent())
    expect(t).toMatchObject({ title: 'Rent', dayOfMonth: 5, lastCreatedPeriod: null, active: true })
    const edited = saveRecurring({ ...rent({ total: 3300000, dayOfMonth: 31, title: '' }), id: t.id })
    expect(edited).toMatchObject({ id: t.id, createdAt: t.createdAt, total: 3300000, dayOfMonth: 28, title: 'Rent' })
    expect(recurringStore.get()).toHaveLength(1)
  })

  it('validates like an expense', () => {
    expect(() => saveRecurring(rent({ participants: [] }))).toThrow(expect.objectContaining({ code: 'no_people' }))
    expect(() => saveRecurring(rent({ total: -1 }))).toThrow(expect.objectContaining({ code: 'bad_total' }))
    expect(() => saveRecurring(rent({ payerId: 'ghost' }))).toThrow(expect.objectContaining({ code: 'payer_missing' }))
    expect(() => saveRecurring(rent({ participants: [{ friendId: ME_ID, input: 5000 }] }))).toThrow(
      expect.objectContaining({ code: 'percent_mismatch' }),
    )
  })

  it('normalises odd values', () => {
    const t = saveRecurring(rent({ mode: 'items' as never, participants: everyone(ME_ID, neha), dayOfMonth: 0, groupId: 'gone', category: 'x' as never, active: undefined as never }))
    expect(t).toMatchObject({ mode: 'equal', dayOfMonth: 1, groupId: null, category: 'other', active: true })
  })
})

describe('createExpenseFromRecurring', () => {
  it('splits the month on its due day, once', () => {
    const t = saveRecurring(rent())
    const e = createExpenseFromRecurring(t.id, '2026-11')
    expect(e).toMatchObject({ date: '2026-11-05', source: 'recurring', recurringId: t.id, total: 3200000, mode: 'percent' })
    expect(e.shares).toEqual({ [ME_ID]: 1280000, [aditya]: 960000, [neha]: 960000 })
    expect(recurringStore.get()[0]?.lastCreatedPeriod).toBe('2026-11')
    expect(createExpenseFromRecurring(t.id, '2026-11').id).toBe(e.id)
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('never moves lastCreatedPeriod backwards and accepts a bad period as this month', () => {
    const t = saveRecurring(rent())
    createExpenseFromRecurring(t.id, '2026-12')
    createExpenseFromRecurring(t.id, '2026-10')
    expect(recurringStore.get()[0]?.lastCreatedPeriod).toBe('2026-12')
    const now = createExpenseFromRecurring(t.id, 'soon')
    expect(now.date.slice(0, 7)).toMatch(/^\d{4}-\d{2}$/)
  })

  it('files the expense in the template group while it exists', () => {
    const g = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [aditya, neha] })
    const t = saveRecurring(rent({ groupId: g.id }))
    expect(createExpenseFromRecurring(t.id, '2026-11').groupId).toBe(g.id)
    deleteGroup(g.id)
    expect(createExpenseFromRecurring(t.id, '2026-12').groupId).toBeNull()
  })

  it('throws for a missing template', () => {
    expect(() => createExpenseFromRecurring('missing', '2026-10')).toThrow(ExpenseError)
  })
})

describe('deleteRecurring', () => {
  it('deletes for undo and restores', () => {
    const t = saveRecurring(rent())
    const e = createExpenseFromRecurring(t.id, '2026-11')
    expect(deleteRecurring('nope')).toBeNull()
    expect(deleteRecurring(t.id)).toEqual({ ...t, lastCreatedPeriod: '2026-11' })
    expect(recurringStore.get()).toEqual([])
    expect(expensesStore.get().map((x) => x.id)).toEqual([e.id])
    restoreRecurring({ ...t, lastCreatedPeriod: '2026-11' })
    expect(recurringStore.get()).toHaveLength(1)
  })
})
