import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, resetDataForTests, saveExpense, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Expense } from '../../domain/types'
import { initialRange, insightsView, longMonth, shortMonth } from './insightsView'

const TODAY = '2026-10-22'

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  updateProfile({ currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

function view(expenses: Expense[], range: Parameters<typeof insightsView>[1]['range'] = 'all') {
  return insightsView(expenses, { meId: ME_ID, currency: 'INR', range, today: TODAY })
}

describe('insightsView', () => {
  it('counts my share, names the biggest category and lists people', () => {
    const dinner = saveExpense(draft({ title: 'Dinner', category: 'food', total: 300000, date: '2026-10-20', with: [riya, sam] }))
    const cab = saveExpense(draft({ title: 'Cab', category: 'transport', total: 60000, date: '2026-10-21', payerId: riya, with: [riya] }))
    const v = view([dinner, cab], 'this_month')
    expect(v.spent).toBe(100000 + 30000)
    expect(v.paidOut).toBe(300000)
    expect(v.count).toBe(2)
    expect(v.top).toEqual({ category: 'food', percent: 77 })
    expect(v.people.map((p) => p.friendId)).toEqual([riya, sam])
    expect(v.perMonth).toBeNull()
    expect(v.otherCurrencyCount).toBe(0)
  })

  it('rounds the biggest category the way the chart legend does', () => {
    // 84.497% of the spend: plain rounding says 84, but the legend's percents must add up to 100 → 85.
    const rent = saveExpense(draft({ category: 'rent', total: 1066667, date: '2026-10-02' }))
    const food = saveExpense(draft({ category: 'food', total: 92200, date: '2026-10-03' }))
    const groceries = saveExpense(draft({ category: 'groceries', total: 61500, date: '2026-10-04' }))
    const cab = saveExpense(draft({ category: 'transport', total: 42000, date: '2026-10-05' }))
    expect(view([rent, food, groceries, cab], 'this_month').top).toEqual({ category: 'rent', percent: 85 })
  })

  it('averages longer ranges per month in whole rupees, empty months included', () => {
    const july = saveExpense(draft({ total: 100000, date: '2026-07-10', with: [riya] }))
    const oct = saveExpense(draft({ total: 50001, date: '2026-10-01', with: [riya] }))
    const v = view([july, oct], 'this_year')
    // Spent 50000 + 25001 = 75001 over Jan–Oct (10 months) → ₹75.001 → "about ₹75".
    expect(v.spent).toBe(75001)
    expect(v.byMonth).toHaveLength(10)
    expect(v.perMonth).toBe(7500)
  })

  it('keeps only the latest 12 months for the chart and the top 5 people', () => {
    const people = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => addFriend({ name }).id)
    const old = saveExpense(draft({ total: 10000, date: '2024-01-15', with: people }))
    const now = saveExpense(draft({ total: 10000, date: '2026-10-15', with: people }))
    const v = view([old, now])
    expect(v.byMonth.length).toBeGreaterThan(12)
    expect(v.months).toHaveLength(12)
    expect(v.months.at(-1)?.month).toBe('2026-10')
    expect(v.people).toHaveLength(5)
  })

  it('leaves other currencies out, and says how many', () => {
    const inr = saveExpense(draft({ total: 10000, date: '2026-10-02' }))
    const usd = saveExpense(draft({ total: 2000, currency: 'USD', date: '2026-10-03', with: [riya] }))
    const notMine = saveExpense(draft({ total: 2000, currency: 'USD', date: '2026-10-03', payerId: riya, participants: [{ friendId: riya, input: null }] }))
    const v = view([inr, usd, notMine], 'this_month')
    expect(v.spent).toBe(10000)
    expect(v.otherCurrencyCount).toBe(1)
  })

  it('is empty without data', () => {
    const v = view([])
    expect(v).toMatchObject({ spent: 0, count: 0, top: null, perMonth: null, months: [], people: [] })
  })
})

describe('initialRange', () => {
  const opts = { meId: ME_ID, currency: 'INR', today: TODAY }

  it('opens on the shortest range with spending in it', () => {
    const thisMonth = saveExpense(draft({ date: '2026-10-05' }))
    expect(initialRange([thisMonth], opts)).toBe('this_month')
    const august = saveExpense(draft({ date: '2026-08-05' }))
    expect(initialRange([august], opts)).toBe('last_3_months')
    const march = saveExpense(draft({ date: '2026-03-05' }))
    expect(initialRange([march], opts)).toBe('this_year')
    const lastYear = saveExpense(draft({ date: '2025-03-05' }))
    expect(initialRange([lastYear], opts)).toBe('all')
  })

  it('defaults to this month with nothing at all', () => {
    expect(initialRange([], opts)).toBe('this_month')
  })
})

describe('month labels', () => {
  it('names months short and long', () => {
    expect(shortMonth('2026-10')).toMatch(/Oct/)
    expect(longMonth('2026-10')).toMatch(/October.*2026/)
  })
})
