import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID, type Expense } from '../domain/types'
import { groupBalances, overallSummary } from '../engine/balances'
import { insights } from '../engine/insights'
import { friendBalance, settleWithFriend } from '../features/friends/friendBalance'
import { groupTotals } from '../features/groups/groupView'
import { DataError, ExpenseError } from './errors'
import { saveExpense } from './expenses'
import { addFriend } from './friends'
import { createGroup } from './groups'
import { isLendEntry, isLoanOpen, LEND_WHAT, LEND_WHATS, lendDraftFromExpense, oneToOnePerson, repayLoanPart, saveLoan, shortDateLabel, type LendDraft } from './loans'
import { expensesStore, groupsStore } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

let riya: string
let sam: string
let kabir: string

const lent = (partial: Partial<LendDraft> = {}): LendDraft => ({
  direction: 'lent',
  friendId: riya,
  amount: 50000,
  currency: 'INR',
  what: 'cash',
  date: '2026-10-21',
  ...partial,
})

const summary = () => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR')
const spending = () => insights(expensesStore.get(), { meId: ME_ID, currency: 'INR' })

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  kabir = addFriend({ name: 'Kabir' }).id
})

afterEach(() => {
  vi.useRealTimers()
  resetDataForTests()
})

describe('saveLoan — worked examples', () => {
  it('1 · cash lent to Riya is a loan she owes, and not spending', () => {
    const e = saveLoan(lent())
    expect(e).toMatchObject({ kind: 'loan', payerId: ME_ID, shares: { [riya]: 50000 }, category: 'other', title: 'Cash', mode: 'equal', total: 50000, source: 'manual' })
    expect(summary().byFriend[riya]).toBe(50000)
    expect(summary().owedToMe).toBe(50000)
    const i = spending()
    expect([i.spent, i.paidOut, i.count]).toEqual([0, 0, 0])
  })

  it('2 · an auto Sam paid for me is a 1:1 split I spent', () => {
    const e = saveLoan({ direction: 'borrowed', friendId: sam, amount: 12000, currency: 'INR', what: 'auto', date: '2026-10-21' })
    expect(e).toMatchObject({ kind: 'split', payerId: sam, shares: { [ME_ID]: 12000 }, category: 'transport', title: 'Auto' })
    expect(summary().byFriend[sam]).toBe(-12000)
    const i = spending()
    expect(i.spent).toBe(12000)
    expect(i.count).toBe(1)
    expect(i.byCategory).toEqual([{ category: 'transport', amount: 12000, count: 1 }])
  })

  it('3 · cash borrowed from Kabir is a loan I owe', () => {
    const e = saveLoan({ direction: 'borrowed', friendId: kabir, amount: 200000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    expect(e.kind).toBe('loan')
    expect(e.shares).toEqual({ [ME_ID]: 200000 })
    expect(summary().byFriend[kabir]).toBe(-200000)
    expect(spending().count).toBe(0)
  })

  it('5 · nets with a dinner Riya paid for, and settles both in one go', () => {
    saveLoan(lent())
    saveExpense(draft({ title: 'Dinner', payerId: riya, total: 30000, participants: [{ friendId: ME_ID, input: null }] }))
    expect(summary().byFriend[riya]).toBe(20000)
    const balance = friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR')
    expect(balance.sources).toHaveLength(1)
    const source = balance.sources[0]
    expect(source).toMatchObject({ kind: 'splits', currency: 'INR', amount: 20000 })
    expect(source?.kind === 'splits' ? source.marks.length : 0).toBe(2)
    settleWithFriend(riya, balance.sources, { method: 'upi', date: '2026-10-23' })
    expect(summary().byFriend[riya]).toBeUndefined()
    expect(expensesStore.get().every((e) => Object.keys(e.paidBack).length === 1)).toBe(true)
  })

  it('6 · in a group, counts in its balances but not its spend', () => {
    const flat = createGroup({ name: 'Flat 302', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const e = saveLoan(lent({ groupId: flat.id }))
    const group = groupsStore.get().find((g) => g.id === flat.id)
    if (!group) throw new Error('group missing')
    expect(e.groupId).toBe(flat.id)
    expect(groupBalances(group, expensesStore.get())).toEqual({ [ME_ID]: 50000, [riya]: -50000 })
    expect(groupTotals(group, expensesStore.get()).spent).toBe(0)
  })

  it('7 · refuses lending to yourself, and nothing at all', () => {
    expect(() => saveLoan(lent({ friendId: ME_ID }))).toThrow(DataError)
    try {
      saveLoan(lent({ friendId: ME_ID }))
    } catch (error) {
      expect((error as DataError).code).toBe('invalid')
    }
    expect(() => saveLoan(lent({ friendId: 'nobody' }))).toThrow(DataError)
    expect(() => saveLoan(lent({ amount: 0 }))).toThrow(ExpenseError)
    try {
      saveLoan(lent({ amount: 0 }))
    } catch (error) {
      expect((error as ExpenseError).code).toBe('bad_total')
    }
    expect(expensesStore.get()).toEqual([])
  })
})

describe('saveLoan — details', () => {
  it('titles "Other" with what was typed (max 80), or "Other"', () => {
    expect(saveLoan(lent({ what: 'other', title: '  Movie   tickets ' })).title).toBe('Movie tickets')
    expect(saveLoan(lent({ what: 'other', title: '' })).title).toBe('Other')
    expect(saveLoan(lent({ what: 'other', title: 'x'.repeat(100) })).title).toHaveLength(80)
  })

  it('maps every chip to its title, category and kind', () => {
    for (const what of LEND_WHATS) {
      const e = saveLoan(lent({ what, title: what === 'other' ? 'Gift' : undefined }))
      expect(e.kind).toBe(LEND_WHAT[what].loan ? 'loan' : 'split')
      expect(e.category).toBe(LEND_WHAT[what].category)
      expect(e.title).toBe(what === 'other' ? 'Gift' : LEND_WHAT[what].label)
    }
  })

  it('keeps a note and the date', () => {
    const e = saveLoan(lent({ note: 'For the tea stall', date: '2026-10-19' }))
    expect(e.note).toBe('For the tea stall')
    expect(e.date).toBe('2026-10-19')
  })

  it('edits in place; changing direction clears who paid back', () => {
    const first = saveLoan(lent())
    expensesStore.set(expensesStore.get().map((e) => (e.id === first.id ? { ...e, paidBack: { [riya]: 1 } } : e)))
    const same = saveLoan(lent({ id: first.id, amount: 40000 }))
    expect(same.id).toBe(first.id)
    expect(same.paidBack).toEqual({ [riya]: 1 })
    const flipped = saveLoan({ ...lent({ id: first.id }), direction: 'borrowed' })
    expect(flipped).toMatchObject({ id: first.id, payerId: riya, shares: { [ME_ID]: 50000 }, paidBack: {} })
    expect(expensesStore.get()).toHaveLength(1)
  })
})

describe('lendDraftFromExpense', () => {
  it('round-trips every chip, both ways', () => {
    for (const what of LEND_WHATS) {
      for (const direction of ['lent', 'borrowed'] as const) {
        const d = lent({ what, direction, friendId: sam, title: what === 'other' ? 'Gift' : undefined, note: 'n', date: '2026-10-20' })
        const e = saveLoan(d)
        expect(lendDraftFromExpense(e)).toEqual({ ...d, id: e.id, groupId: null, ...(what === 'other' ? { title: 'Gift' } : {}) })
      }
    }
  })

  it('reads a titled 1:1 split as "Other"; a chip title in another category too', () => {
    const e = saveExpense(draft({ title: 'Movie', category: 'entertainment', participants: [{ friendId: riya, input: null }] }))
    expect(lendDraftFromExpense(e)).toMatchObject({ what: 'other', title: 'Movie', direction: 'lent', friendId: riya })
    const auto = saveExpense(draft({ title: 'Auto', category: 'food', participants: [{ friendId: riya, input: null }] }))
    expect(lendDraftFromExpense(auto)?.what).toBe('other')
  })

  it('is null for anything that is not 1:1 with me', () => {
    expect(lendDraftFromExpense(saveExpense(draft({ with: [riya] })))).toBeNull()
    expect(lendDraftFromExpense(saveExpense(draft({ payerId: sam, participants: [{ friendId: riya, input: null }] })))).toBeNull()
    expect(lendDraftFromExpense(saveExpense(draft({ participants: [{ friendId: ME_ID, input: null }] })))).toBeNull()
  })
})

describe('repayLoanPart — worked example 4', () => {
  it('keeps the rest open and saves the returned part as paid back, with undo', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T10:00:00+05:30'))
    const loan = saveLoan(lent())
    const { remaining, repaid, undo } = repayLoanPart(loan.id, 20000)
    expect(remaining).toMatchObject({ id: loan.id, kind: 'loan', total: 30000, shares: { [riya]: 30000 }, paidBack: {} })
    expect(isLoanOpen(remaining)).toBe(true)
    expect(repaid).toMatchObject({ kind: 'loan', total: 20000, shares: { [riya]: 20000 }, paidBack: { [riya]: Date.now() }, title: 'Cash', date: '2026-10-21' })
    expect(repaid.note).toBe('Paid back on 23 Oct')
    expect(repaid.id).not.toBe(loan.id)
    expect(summary().byFriend[riya]).toBe(30000)
    undo()
    expect(expensesStore.get()).toHaveLength(1)
    expect(expensesStore.get()[0]).toEqual(loan)
    expect(summary().byFriend[riya]).toBe(50000)
  })

  it('works for what I borrowed too', () => {
    const loan = saveLoan({ direction: 'borrowed', friendId: kabir, amount: 200000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    const { remaining, repaid } = repayLoanPart(loan.id, 50000)
    expect(remaining.shares).toEqual({ [ME_ID]: 150000 })
    expect(repaid.paidBack[ME_ID]).toBeTypeOf('number')
    expect(summary().byFriend[kabir]).toBe(-150000)
  })

  it('refuses amounts outside 1 … total − 1, settled entries, bills and unknown ids', () => {
    const loan = saveLoan(lent())
    for (const amount of [0, -1, 50000, 60000, 1.5, Number.NaN]) {
      expect(() => repayLoanPart(loan.id, amount)).toThrow(DataError)
    }
    expect(() => repayLoanPart('nope', 100)).toThrow(DataError)
    expensesStore.set(expensesStore.get().map((e) => ({ ...e, paidBack: { [riya]: 1 } })))
    expect(() => repayLoanPart(loan.id, 100)).toThrow(DataError)
    const split = saveExpense(draft({ with: [riya] }))
    expect(() => repayLoanPart(split.id, 100)).toThrow(DataError)
    expect(expensesStore.get()).toHaveLength(2)
  })

  it('repays a 1:1 split typed as an exact amount', () => {
    const e = saveExpense(draft({ title: 'Auto', category: 'transport', mode: 'exact', total: 12000, participants: [{ friendId: riya, input: 12000 }] }))
    const { remaining, repaid } = repayLoanPart(e.id, 2000)
    expect(remaining).toMatchObject({ kind: 'split', mode: 'equal', total: 10000, shares: { [riya]: 10000 } })
    expect(repaid).toMatchObject({ kind: 'split', total: 2000, category: 'transport' })
  })
})

describe('helpers', () => {
  it('finds the other person of a 1:1 entry', () => {
    const one = { payerId: ME_ID, participants: [{ friendId: 'riya', input: null }] }
    expect(oneToOnePerson(one)).toBe('riya')
    expect(isLendEntry(one)).toBe(true)
    expect(oneToOnePerson({ payerId: 'riya', participants: [{ friendId: 'riya', input: null }] })).toBeNull()
    expect(isLendEntry({ payerId: 'sam', participants: [{ friendId: 'riya', input: null }] })).toBe(false)
    expect(oneToOnePerson({ payerId: ME_ID, participants: [] } as Pick<Expense, 'participants' | 'payerId'>)).toBeNull()
  })

  it('writes short dates as "21 Oct"', () => {
    expect(shortDateLabel('2026-10-21')).toBe('21 Oct')
    expect(shortDateLabel('2026-01-05')).toBe('5 Jan')
    expect(shortDateLabel('bad')).toBe('bad')
  })
})
