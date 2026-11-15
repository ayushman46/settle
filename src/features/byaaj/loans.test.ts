import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { addFriend, createGroup, expensesStore, groupsStore, recordPartPayment, resetDataForTests, saveExpense, setPaidBack, updateProfile } from '../../data'
import { repayLoanPart, saveLoan } from '../../data/loans'
import { draft } from '../../data/testKit'
import { ME_ID, type Expense } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { byaajToday } from './index'
import { loanFacts, loanView, recordLoanPayment, type LoanView } from './loans'
import { addByaajPayment, byaajPlanFor, byaajSchema, byaajStore, MAX_PAYMENTS, removeByaaj, setByaaj, setByaajDueOn, setByaajRate } from './store'

const TODAY = '2026-11-15'
const rupees = (n: number): number => n * 100
const owes = (friendId: string): number => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend[friendId] ?? 0
const loanNow = (id: string): Expense | undefined => expensesStore.get().find((e) => e.id === id)

let riya: string
let loan: Expense

/** The loan as interest sees it right now. */
function view(id: string = loan.id, today: string = TODAY): LoanView {
  const plan = byaajPlanFor(id)
  const facts = loanFacts(loanNow(id), groupsStore.get())
  if (!plan || !facts) throw new Error('no loan with interest')
  return loanView(plan, facts, expensesStore.get(), today)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 12))
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  // ₹50,000 lent to Riya on 15 Aug, at 1% a month from then.
  loan = saveLoan({ direction: 'lent', friendId: riya, amount: rupees(50_000), currency: 'INR', what: 'cash', date: '2026-08-15' })
})

afterEach(() => {
  vi.useRealTimers()
})

const addInterest = (): (() => void) => setByaaj(loan.id, { rate: { bp: 100, per: 'month' }, principal: rupees(50_000), now: Date.now() })

describe('which entries interest can go on', () => {
  it('cash lent or borrowed between you and one person', () => {
    expect(loanFacts(loan, [])).toMatchObject({ friendId: riya, lent: true, lenderId: ME_ID, borrowerId: riya, currency: 'INR', group: null, open: rupees(50_000) })
    const borrowed = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(2_000), currency: 'INR', what: 'cash', date: '2026-10-01' })
    expect(loanFacts(borrowed, [])).toMatchObject({ friendId: riya, lent: false, lenderId: riya, borrowerId: ME_ID, open: rupees(2_000) })
  })

  it('not a split, not "Sam paid for my auto", not nothing', () => {
    expect(loanFacts(saveExpense(draft({ with: [riya] })), [])).toBeNull()
    expect(loanFacts(saveLoan({ direction: 'lent', friendId: riya, amount: rupees(120), currency: 'INR', what: 'auto', date: '2026-10-01' }), [])).toBeNull()
    expect(loanFacts(undefined, [])).toBeNull()
    expect(loanFacts(null, [])).toBeNull()
  })

  it('a loan inside a group is settled by the group, so the app cannot say what is still out on it', () => {
    const flat = createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const inGroup = saveLoan({ direction: 'lent', friendId: riya, amount: rupees(9_000), currency: 'INR', what: 'cash', date: '2026-10-01', groupId: flat.id })
    expect(loanFacts(inGroup, groupsStore.get())).toMatchObject({ open: null, group: { id: flat.id } })
    // The group is gone: person to person again.
    expect(loanFacts(inGroup, [])).toMatchObject({ open: rupees(9_000), group: null })
  })
})

describe('byaajStore', () => {
  it('adds interest, changes the rate and the date, and each undo puts back exactly what was there', () => {
    const undoAdd = addInterest()
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 100, per: 'month', principal: rupees(50_000), dueOn: null, payments: [] })
    const undoRate = setByaajRate(loan.id, { bp: 1200, per: 'year' })
    const undoDue = setByaajDueOn(loan.id, '2026-12-31')
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 1200, per: 'year', dueOn: '2026-12-31' })
    undoRate()
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 100, per: 'month', dueOn: '2026-12-31' })
    undoDue()
    expect(byaajPlanFor(loan.id)?.dueOn).toBeNull()
    undoAdd()
    expect(byaajPlanFor(loan.id)).toBeNull()
  })

  it('removing interest keeps nothing; undo brings it back with its payments', () => {
    addInterest()
    addByaajPayment(loan.id, { id: 'p1', date: '2026-09-15', interest: rupees(500), principal: 0, createdAt: 1, repaidExpenseId: null, settlementId: null })
    const before = byaajPlanFor(loan.id)
    const undo = removeByaaj(loan.id)
    expect(byaajStore.get().plans).toEqual({})
    undo()
    expect(byaajPlanFor(loan.id)).toEqual(before)
  })

  it('ignores a rate or an amount that cannot be kept, and a payment of nothing', () => {
    setByaaj(loan.id, { rate: { bp: 0, per: 'month' }, principal: rupees(50_000), now: 1 })
    setByaaj(loan.id, { rate: { bp: 100, per: 'month' }, principal: 0, now: 1 })
    setByaaj('', { rate: { bp: 100, per: 'month' }, principal: 100, now: 1 })
    expect(byaajStore.get().plans).toEqual({})
    addInterest()
    expect(addByaajPayment(loan.id, { id: 'p0', date: '2026-09-15', interest: 0, principal: 0, createdAt: 1, repaidExpenseId: null, settlementId: null })).toBe(false)
    expect(addByaajPayment(loan.id, { id: 'p0', date: 'someday', interest: 100, principal: 0, createdAt: 1, repaidExpenseId: null, settlementId: null })).toBe(false)
    expect(addByaajPayment('nope', { id: 'p0', date: '2026-09-15', interest: 100, principal: 0, createdAt: 1, repaidExpenseId: null, settlementId: null })).toBe(false)
    expect(byaajPlanFor(loan.id)?.payments).toEqual([])
    setByaajRate(loan.id, { bp: 20_000, per: 'month' })
    setByaajDueOn(loan.id, '2026-02-30')
    expect(byaajPlanFor(loan.id)).toMatchObject({ bp: 100, dueOn: null })
  })

  it('reads junk without losing the loans that are good, and never grows without end', () => {
    const good = { expenseId: 'a', bp: 100, per: 'month', principal: 500, dueOn: 'never', createdAt: 5, payments: [{ id: 'p', date: '2026-09-15', interest: 10, principal: 0 }, { id: 'bad', date: 'x', interest: 1, principal: 0 }, 7] }
    const read = z.parse(byaajSchema, { plans: { a: good, b: { ...good, expenseId: 'b', bp: 0 }, c: { ...good, expenseId: 'not-c' }, d: 'nonsense' } })
    expect(Object.keys(read.plans)).toEqual(['a'])
    expect(read.plans.a).toMatchObject({ dueOn: null, payments: [{ id: 'p', interest: 10, principal: 0, repaidExpenseId: null, settlementId: null }] })
    expect(z.parse(byaajSchema, { plans: 12 })).toEqual({ plans: {} })

    addInterest()
    for (let i = 0; i < MAX_PAYMENTS + 5; i++) addByaajPayment(loan.id, { id: `p${i}`, date: '2026-09-15', interest: 1, principal: 0, createdAt: i, repaidExpenseId: null, settlementId: null })
    expect(byaajPlanFor(loan.id)?.payments).toHaveLength(MAX_PAYMENTS)
  })
})

describe('recording a payment', () => {
  beforeEach(() => {
    addInterest()
  })

  it('as of today: ₹50,000 lent, ₹1,500 interest for 3 months, ₹51,500 in all', () => {
    expect(view().statement).toMatchObject({ principal: rupees(50_000), interestDue: rupees(1_500), due: rupees(51_500), span: { months: 3, days: 0 } })
  })

  it('a part payment: interest first, the rest comes off the loan through the app’s own paid-back record, so every balance stays right', () => {
    const outcome = recordLoanPayment(view(), { amount: rupees(5_000), date: TODAY, now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(1_500), principal: rupees(3_500), extra: 0 } })
    // The loan itself now stands at ₹46,500 and Riya's page says the same; the ₹3,500 is its own paid-back record.
    expect(loanNow(loan.id)?.total).toBe(rupees(46_500))
    expect(owes(riya)).toBe(rupees(46_500))
    const copy = expensesStore.get().find((e) => e.id !== loan.id)
    expect(copy).toMatchObject({ kind: 'loan', total: rupees(3_500) })
    expect(copy?.paidBack[riya]).toBeDefined()
    expect(byaajPlanFor(loan.id)?.payments).toMatchObject([{ date: TODAY, interest: rupees(1_500), principal: rupees(3_500), repaidExpenseId: copy?.id }])
    // Interest is not money owed in the app's balances: it lives with the loan's interest only.
    expect(view().statement).toMatchObject({ principal: rupees(46_500), interestPaid: rupees(1_500), interestDue: 0, due: rupees(46_500) })
    expect(view().payments.some((p) => p.outside)).toBe(false)

    // Undo puts the loan, the balance and the interest back exactly.
    if (outcome.ok) outcome.undo()
    expect(expensesStore.get()).toHaveLength(1)
    expect(loanNow(loan.id)).toMatchObject({ total: rupees(50_000), paidBack: {} })
    expect(owes(riya)).toBe(rupees(50_000))
    expect(byaajPlanFor(loan.id)?.payments).toEqual([])
    expect(view().statement.due).toBe(rupees(51_500))
  })

  it('less than the interest: nothing comes off the loan, and the app’s balance does not move', () => {
    const outcome = recordLoanPayment(view(), { amount: rupees(1_000), date: TODAY, now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(1_000), principal: 0 } })
    expect(expensesStore.get()).toHaveLength(1)
    expect(owes(riya)).toBe(rupees(50_000))
    expect(view().statement).toMatchObject({ principal: rupees(50_000), interestDue: rupees(500), due: rupees(50_500) })
  })

  it('everything: the loan is ticked off as paid back, and undo unticks it', () => {
    const outcome = recordLoanPayment(view(), { amount: rupees(51_500), date: TODAY, now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(1_500), principal: rupees(50_000) } })
    expect(loanNow(loan.id)?.paidBack[riya]).toBeDefined()
    expect(owes(riya)).toBe(0)
    expect(view().statement).toMatchObject({ due: 0, cleared: true })
    if (outcome.ok) outcome.undo()
    expect(loanNow(loan.id)?.paidBack).toEqual({})
    expect(owes(riya)).toBe(rupees(50_000))
    expect(view().statement.due).toBe(rupees(51_500))
  })

  it('never takes more than is due, or nothing: says which, and changes nothing', () => {
    expect(recordLoanPayment(view(), { amount: rupees(51_501), date: TODAY, now: 1 })).toEqual({ ok: false, reason: 'tooMuch' })
    expect(recordLoanPayment(view(), { amount: 0, date: TODAY, now: 1 })).toEqual({ ok: false, reason: 'empty' })
    expect(recordLoanPayment(view(), { amount: 10.5, date: TODAY, now: 1 })).toEqual({ ok: false, reason: 'empty' })
    expect(recordLoanPayment(view(), { amount: rupees(100), date: 'someday', now: 1 })).toEqual({ ok: false, reason: 'empty' })
    expect(byaajPlanFor(loan.id)?.payments).toEqual([])
    expect(owes(riya)).toBe(rupees(50_000))
  })

  it('a payment dated earlier is divided as things stood that day', () => {
    // On 15 Sep one month's interest (₹500) was due.
    const outcome = recordLoanPayment(view(), { amount: rupees(10_500), date: '2026-09-15', now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(500), principal: rupees(10_000) } })
    // Two more months on ₹40,000: ₹800.
    expect(view().statement).toMatchObject({ principal: rupees(40_000), interestDue: rupees(800), due: rupees(40_800) })
    expect(owes(riya)).toBe(rupees(40_000))
  })

  it('two part payments, then the rest', () => {
    recordLoanPayment(view(), { amount: rupees(10_500), date: '2026-09-15', now: Date.now() })
    recordLoanPayment(view(), { amount: rupees(20_400), date: '2026-10-15', now: Date.now() })
    // 15 Oct: ₹400 interest on ₹40,000, ₹20,000 off. Then a month on ₹20,000: ₹200.
    expect(view().statement).toMatchObject({ principal: rupees(20_000), interestDue: rupees(200), due: rupees(20_200) })
    expect(owes(riya)).toBe(rupees(20_000))
    expect(recordLoanPayment(view(), { amount: rupees(20_200), date: TODAY, now: Date.now() })).toMatchObject({ ok: true })
    expect(owes(riya)).toBe(0)
    expect(view().statement).toMatchObject({ cleared: true, interestTotal: rupees(1_100), interestPaid: rupees(1_100), principalPaid: rupees(50_000) })
  })

  it('a loan with a part already paid in To collect keeps that record: the next part is added to it', () => {
    recordPartPayment(loan.id, riya, rupees(10_000))
    // Marked outside the interest page: read as ₹10,000 off the amount today.
    expect(view().statement).toMatchObject({ principal: rupees(40_000), interestDue: rupees(1_500) })
    const outcome = recordLoanPayment(view(), { amount: rupees(6_500), date: TODAY, now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(1_500), principal: rupees(5_000) } })
    expect(loanNow(loan.id)?.partPaid?.[riya]).toBe(rupees(15_000))
    expect(owes(riya)).toBe(rupees(35_000))
    expect(view().statement.principal).toBe(rupees(35_000))
    if (outcome.ok) outcome.undo()
    expect(loanNow(loan.id)?.partPaid?.[riya]).toBe(rupees(10_000))
    expect(owes(riya)).toBe(rupees(40_000))
  })
})

describe('money marked paid back elsewhere in the app', () => {
  beforeEach(() => {
    // Interest was added the day the loan was given; the tests then move through the months.
    vi.setSystemTime(new Date(2026, 7, 15, 13))
    addInterest()
    vi.setSystemTime(new Date(2026, 10, 15, 12))
  })

  it('"Got some back" on the loan card: that part comes off the amount on the day it was marked, with no interest part', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    repayLoanPart(loan.id, rupees(20_000))
    vi.setSystemTime(new Date(2026, 10, 15, 12))
    const v = view()
    expect(v.payments).toEqual([{ id: 'outside:0', date: '2026-10-15', interest: 0, principal: rupees(20_000), outside: true }])
    // ₹1,000 for two months on ₹50,000, then ₹300 for one on ₹30,000.
    expect(v.statement).toMatchObject({ principal: rupees(30_000), interestDue: rupees(1_300), due: rupees(31_300) })
    expect(v.statement.principal).toBe(owes(riya))
  })

  it('ticked off as all paid back: the amount is cleared from that day, the interest till then is still due', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    setPaidBack(loan.id, riya, true)
    vi.setSystemTime(new Date(2026, 10, 15, 12))
    const v = view()
    expect(v.payments).toMatchObject([{ date: '2026-10-15', principal: rupees(50_000), outside: true }])
    expect(v.statement).toMatchObject({ principal: 0, interestDue: rupees(1_000), due: rupees(1_000), cleared: false })
    // The interest can still be recorded; nothing more goes through the app's balances.
    expect(recordLoanPayment(v, { amount: rupees(1_000), date: TODAY, now: Date.now() })).toMatchObject({ ok: true, parts: { interest: rupees(1_000), principal: 0 } })
    expect(view().statement.cleared).toBe(true)
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('a part recorded here and a part marked elsewhere are not mixed up', () => {
    recordLoanPayment(view('' + loan.id, '2026-09-15'), { amount: rupees(10_500), date: '2026-09-15', now: Date.now() })
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    repayLoanPart(loan.id, rupees(5_000))
    vi.setSystemTime(new Date(2026, 10, 15, 12))
    const v = view()
    expect(v.payments.map((p) => [p.date, p.interest, p.principal, p.outside === true])).toEqual([
      ['2026-09-15', rupees(500), rupees(10_000), false],
      ['2026-10-15', 0, rupees(5_000), true],
    ])
    expect(v.statement.principal).toBe(rupees(35_000))
    expect(owes(riya)).toBe(rupees(35_000))
  })

  it('part repayments from before interest was added are not counted again', () => {
    removeByaaj(loan.id)
    repayLoanPart(loan.id, rupees(20_000))
    vi.setSystemTime(new Date(2026, 10, 15, 13))
    setByaaj(loan.id, { rate: { bp: 100, per: 'month' }, principal: rupees(30_000), now: Date.now() })
    const v = view()
    expect(v.payments).toEqual([])
    expect(v.statement).toMatchObject({ principalStart: rupees(30_000), principal: rupees(30_000), interestDue: rupees(900) })
  })

  it('the loan edited to a larger amount: interest follows the loan', () => {
    saveLoan({ id: loan.id, direction: 'lent', friendId: riya, amount: rupees(60_000), currency: 'INR', what: 'cash', date: '2026-08-15' })
    expect(view().statement).toMatchObject({ principalStart: rupees(60_000), interestDue: rupees(1_800), due: rupees(61_800) })
  })

  it('the loan’s date edited: interest runs from the new date', () => {
    saveLoan({ id: loan.id, direction: 'lent', friendId: riya, amount: rupees(50_000), currency: 'INR', what: 'cash', date: '2026-10-15' })
    expect(view().statement).toMatchObject({ from: '2026-10-15', interestDue: rupees(500) })
  })
})

describe('a loan inside a group', () => {
  it('the part that comes off the amount is recorded as a group payment between the two, and undo removes it', () => {
    const flat = createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const inGroup = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(12_000), currency: 'INR', what: 'cash', date: '2026-09-15', groupId: flat.id })
    setByaaj(inGroup.id, { rate: { bp: 200, per: 'month' }, principal: rupees(12_000), now: Date.now() })
    setPaidBack(loan.id, riya, true)
    expect(owes(riya)).toBe(-rupees(12_000))
    // Two months at 2%: ₹480 interest. ₹5,480 paid: ₹5,000 off the amount.
    const outcome = recordLoanPayment(view(inGroup.id), { amount: rupees(5_480), date: TODAY, now: Date.now() })
    expect(outcome).toMatchObject({ ok: true, parts: { interest: rupees(480), principal: rupees(5_000) } })
    expect(groupsStore.get()[0]?.settlements).toMatchObject([{ fromId: ME_ID, toId: riya, amount: rupees(5_000), date: TODAY }])
    expect(owes(riya)).toBe(-rupees(7_000))
    expect(view(inGroup.id).statement).toMatchObject({ principal: rupees(7_000), interestDue: 0 })
    if (outcome.ok) outcome.undo()
    expect(groupsStore.get()[0]?.settlements).toEqual([])
    expect(owes(riya)).toBe(-rupees(12_000))
  })
})

describe('byaajToday', () => {
  it('has nothing unless a loan has a date to be paid back by', () => {
    expect(byaajToday(new Date(2026, 10, 15, 9))).toEqual([])
    addInterest()
    expect(byaajToday(new Date(2026, 10, 15, 9))).toEqual([])
    setByaajDueOn(loan.id, '2026-11-16')
    expect(byaajToday(new Date(2026, 10, 15, 9))).toEqual([])
  })

  it('on the day: one row with the amount due, straight to the loan', () => {
    addInterest()
    setByaajDueOn(loan.id, TODAY)
    expect(byaajToday(new Date(2026, 10, 15, 9))).toEqual([
      { id: `byaaj:${loan.id}`, title: 'Riya is to pay back the loan today', body: 'With interest at 1% a month', path: `/app/byaaj/${loan.id}`, amount: rupees(51_500), currency: 'INR' },
    ])
  })

  it('after the day it says so, the longest overdue first; a loan that is cleared or deleted drops off', () => {
    addInterest()
    setByaajDueOn(loan.id, '2026-11-10')
    const mine = saveLoan({ direction: 'borrowed', friendId: riya, amount: rupees(2_000), currency: 'INR', what: 'cash', date: '2026-10-15' })
    setByaaj(mine.id, { rate: { bp: 1200, per: 'year' }, principal: rupees(2_000), dueOn: '2026-11-01', now: Date.now() })
    const items = byaajToday(new Date(2026, 10, 15, 9))
    expect(items.map((i) => i.title)).toEqual(['Your loan from Riya was to be paid back by 1 Nov 2026', 'Riya’s loan was to be paid back by 10 Nov 2026'])
    // 31 days at 12% a year on ₹2,000: ₹20.38 → ₹20.
    expect(items[0]).toMatchObject({ amount: rupees(2_020), body: 'With interest at 12% a year' })

    recordLoanPayment(view(), { amount: rupees(51_500), date: TODAY, now: Date.now() })
    expensesStore.set(expensesStore.get().filter((e) => e.id !== mine.id))
    expect(byaajToday(new Date(2026, 10, 15, 9))).toEqual([])
  })
})
