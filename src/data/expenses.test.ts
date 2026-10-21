import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID, type BillSnapshot } from '../domain/types'
import { ExpenseError } from './errors'
import {
  deleteExpense,
  duplicateExpenseDraft,
  expenseDraftIssue,
  restoreExpense,
  saveExpense,
  setAllPaidBack,
  setPaidBack,
} from './expenses'
import { addFriend } from './friends'
import { createGroup } from './groups'
import { updateProfile } from './profile'
import { expensesStore, friendsStore, groupsStore } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

describe('saveExpense', () => {
  it('computes shares with the engine and stores the expense first', () => {
    const e = saveExpense(draft({ total: 100000, with: [riya, sam] }))
    expect(e.shares).toEqual({ [ME_ID]: 33334, [riya]: 33333, [sam]: 33333 })
    expect(sum(e.shares)).toBe(100000)
    expect(e.paidBack).toEqual({})
    expect(e.createdAt).toBe(e.updatedAt)
    const older = saveExpense(draft({ title: 'Second' }))
    expect(expensesStore.get().map((x) => x.id)).toEqual([older.id, e.id])
  })

  it.each([
    [{ participants: [] }, 'no_people'],
    [{ total: 0 }, 'bad_total'],
    [{ total: 12.5 }, 'bad_total'],
    [{ payerId: '' }, 'payer_missing'],
    [{ payerId: 'stranger' }, 'payer_missing'],
    [{ mode: 'exact' as const, participants: [{ friendId: ME_ID, input: 500 }] }, 'exact_mismatch'],
    [{ mode: 'percent' as const, participants: [{ friendId: ME_ID, input: 5000 }] }, 'percent_mismatch'],
    [{ mode: 'shares' as const, participants: [{ friendId: ME_ID, input: 0 }] }, 'zero_weights'],
  ])('rejects %o with %s', (patch, code) => {
    const bad = draft(patch)
    expect(() => saveExpense(bad)).toThrow(ExpenseError)
    expect(() => saveExpense(bad)).toThrow(expect.objectContaining({ code }))
    expect(expenseDraftIssue(bad)).toBe(code)
    expect(expensesStore.get()).toEqual([])
  })

  it('says a valid draft has no issue', () => {
    expect(expenseDraftIssue(draft())).toBeNull()
  })

  it('tidies text, infers a missing category and fills a missing title', () => {
    const e = saveExpense(draft({ title: '  Uber   to   airport ', category: 'nope' as never, note: '   ' }))
    expect(e).toMatchObject({ title: 'Uber to airport', category: 'transport', note: null })
    expect(saveExpense(draft({ title: '', category: 'rent' })).title).toBe('Rent')
    expect(saveExpense(draft({ title: '', category: 'other' })).title).toBe('Expense')
    expect(saveExpense(draft({ title: 'Stuff', category: 'nope' as never })).category).toBe('other')
    expect(saveExpense(draft({ note: ' Paid in cash ' })).note).toBe('Paid in cash')
  })

  it('falls back to today, the profile currency, and no group when those are invalid', () => {
    updateProfile({ currency: 'USD' })
    const e = saveExpense(draft({ date: '2026-02-30', currency: 'usd', groupId: 'deleted' }))
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(e.date).not.toBe('2026-02-30')
    expect(e.currency).toBe('USD')
    expect(e.groupId).toBeNull()
  })

  it('rounds to whole units when asked, the payer absorbing the paise', () => {
    const e = saveExpense(draft({ total: 100001, with: [riya, sam], roundedToWhole: true }))
    expect(e.shares).toEqual({ [ME_ID]: 33401, [riya]: 33300, [sam]: 33300 })
  })

  it('saves itemized bills from their snapshot, and degrades to equal without one', () => {
    const bill: BillSnapshot = {
      meta: { merchant: 'Toit', date: null, subtotal: 80000, tax: null, serviceCharge: null, discount: null, tip: null, total: 88000 },
      items: [
        { id: 'pizza', name: 'Pizza', quantity: 1, amount: 60000 },
        { id: 'beer', name: 'Beer', quantity: 2, amount: 20000 },
      ],
      assignments: { pizza: { [ME_ID]: 1, [riya]: 1 }, beer: { [riya]: 1 } },
      warnings: [],
    }
    const e = saveExpense(draft({ kind: 'bill', mode: 'items', bill, total: 88000, with: [riya], source: 'scan' }))
    expect(e.kind).toBe('bill')
    expect(e.shares).toEqual({ [ME_ID]: 33000, [riya]: 55000 })
    const loose = saveExpense(draft({ kind: 'bill', mode: 'items', bill: null, total: 1000, with: [riya] }))
    expect(loose).toMatchObject({ kind: 'split', mode: 'equal', shares: { [ME_ID]: 500, [riya]: 500 } })
  })

  it('updates in place, keeping createdAt and who already paid back', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1000)
    const e = saveExpense(draft({ with: [riya, sam] }))
    now.mockReturnValue(2000)
    setPaidBack(e.id, riya, true)
    now.mockReturnValue(3000)
    const edited = saveExpense({ ...draft({ with: [riya, sam], total: 90000 }), id: e.id })
    expect(edited).toMatchObject({ id: e.id, createdAt: 1000, updatedAt: 3000, total: 90000, paidBack: { [riya]: 2000 } })
    expect(expensesStore.get()).toHaveLength(1)
    // Removing Riya from the split drops her tick.
    const without = saveExpense({ ...draft({ with: [sam] }), id: e.id })
    expect(without.paidBack).toEqual({})
    now.mockRestore()
  })

  it('creates with a given id (e.g. restoring a draft) and honours explicit ticks', () => {
    const e = saveExpense({ ...draft({ with: [riya] }), id: 'fixed-id', paidBack: { [riya]: 5, [ME_ID]: 6, stranger: 7 } })
    expect(e.id).toBe('fixed-id')
    expect(e.paidBack).toEqual({ [riya]: 5 })
  })

  it('bumps everyone involved to the front, and the group to the top', () => {
    const g = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya] })
    const before = groupsStore.get()[0]?.updatedAt ?? 0
    vi.spyOn(Date, 'now').mockReturnValue(before + 5000)
    saveExpense(draft({ with: [riya], groupId: g.id }))
    expect(friendsStore.get().find((f) => f.id === riya)?.lastUsedAt).toBe(before + 5000)
    expect(groupsStore.get()[0]?.updatedAt).toBe(before + 5000)
    vi.restoreAllMocks()
  })
})

describe('delete & restore', () => {
  it('returns the deleted expense for undo and puts it back', () => {
    const e = saveExpense(draft({ with: [riya] }))
    expect(deleteExpense('nope')).toBeNull()
    expect(deleteExpense(e.id)).toEqual(e)
    expect(expensesStore.get()).toEqual([])
    restoreExpense(e)
    restoreExpense(e)
    expect(expensesStore.get()).toEqual([e])
  })
})

describe('paid back', () => {
  it('ticks and un-ticks people, never the payer or someone with nothing to pay', () => {
    const e = saveExpense(draft({ with: [riya], mode: 'shares', participants: [{ friendId: ME_ID, input: 1 }, { friendId: riya, input: 1 }, { friendId: sam, input: 0 }] }))
    const ticked = setPaidBack(e.id, riya, true)
    expect(Object.keys(ticked.paidBack)).toEqual([riya])
    expect(setPaidBack(e.id, riya, true)).toBe(ticked)
    expect(setPaidBack(e.id, ME_ID, true)).toBe(ticked)
    expect(setPaidBack(e.id, sam, true)).toBe(ticked)
    expect(setPaidBack(e.id, riya, false).paidBack).toEqual({})
    expect(() => setPaidBack('missing', riya, true)).toThrow(expect.objectContaining({ code: 'not_found' }))
  })

  it('ticks everyone at once and clears all', () => {
    const e = saveExpense(draft({ with: [riya, sam] }))
    const all = setAllPaidBack(e.id, true)
    expect(Object.keys(all.paidBack).sort()).toEqual([riya, sam].sort())
    expect(setAllPaidBack(e.id, true)).toBe(all)
    expect(setAllPaidBack(e.id, false).paidBack).toEqual({})
  })
})

describe('duplicateExpenseDraft', () => {
  it('copies the expense as a fresh draft for today', () => {
    const e = saveExpense(draft({ with: [riya], date: '2026-01-05', source: 'scan', note: 'Window seat' }))
    setPaidBack(e.id, riya, true)
    const copy = duplicateExpenseDraft(e.id)
    expect(copy).not.toHaveProperty('id')
    expect(copy).not.toHaveProperty('paidBack')
    expect(copy).toMatchObject({ title: e.title, total: e.total, note: 'Window seat', source: 'manual', recurringId: null })
    expect(copy.date).not.toBe('2026-01-05')
    expect(saveExpense(copy).id).not.toBe(e.id)
    expect(() => duplicateExpenseDraft('missing')).toThrow(ExpenseError)
  })
})
