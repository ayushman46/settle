/** v4 list words: loans and 1:1 entries ("You lent Riya · cash") and money paid abroad. */
import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, resetDataForTests } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { expenseRowView, oneToOneOther } from './expenseLabels'

const base: Expense = {
  id: 'e1',
  kind: 'split',
  title: 'Auto',
  category: 'transport',
  currency: 'INR',
  total: 12_000,
  date: '2026-10-21',
  createdAt: 1,
  updatedAt: 1,
  payerId: ME_ID,
  mode: 'equal',
  participants: [{ friendId: 'riya', input: null }],
  shares: { riya: 12_000 },
  roundedToWhole: false,
  note: null,
  groupId: null,
  bill: null,
  paidBack: {},
  recurringId: null,
  source: 'manual',
}

const view = (e: Expense, extra: Partial<Parameters<typeof expenseRowView>[1]> = {}) =>
  expenseRowView(e, { payerName: 'Kabir', group: null, otherName: 'Riya', ...extra })

beforeEach(resetDataForTests)

describe('oneToOneOther', () => {
  it('finds the one participant who is not the payer', () => {
    expect(oneToOneOther(base)).toBe('riya')
    expect(oneToOneOther({ ...base, participants: [{ friendId: 'riya', input: null }, { friendId: 'riya', input: 1 }] })).toBe('riya')
    expect(oneToOneOther({ ...base, participants: [{ friendId: ME_ID, input: null }] })).toBeNull()
    expect(oneToOneOther({ ...base, participants: [{ friendId: ME_ID, input: null }, { friendId: 'riya', input: null }] })).toBeNull()
  })
})

describe('expenseRowView — loans (spec 07 §2.4)', () => {
  it('I lent: "You lent Riya · cash", +₹500, 1 pending', () => {
    const v = view({ ...base, kind: 'loan', title: 'Cash', category: 'other', total: 50_000, shares: { riya: 50_000 } })
    expect(v.subtitle).toBe('You lent Riya · cash')
    expect(v.amount).toBe(50_000)
    expect(v.tone).toBe('positive')
    expect(v.status).toEqual({ tone: 'warning', label: '1 pending' })
    expect(v.spoken).toBe("You lent Riya · cash, you're owed ₹500, 1 pending")
  })

  it('I lent and got it back: Settled', () => {
    const v = view({ ...base, kind: 'loan', total: 50_000, shares: { riya: 50_000 }, paidBack: { riya: 5 } })
    expect(v.status).toEqual({ tone: 'positive', label: 'Settled' })
  })

  it('I borrowed: "Kabir lent you · cash", −₹2,000, you owe', () => {
    const v = view({ ...base, kind: 'loan', payerId: 'kabir', participants: [{ friendId: ME_ID, input: null }], total: 200_000, shares: { [ME_ID]: 200_000 } })
    expect(v.subtitle).toBe('Kabir lent you · cash')
    expect(v.amount).toBe(-200_000)
    expect(v.caption).toBe('you owe')
  })
})

describe('expenseRowView — 1:1 splits', () => {
  it('I paid for them: "You paid for Riya · Auto", +₹120', () => {
    const v = view(base)
    expect(v.subtitle).toBe('You paid for Riya · Auto')
    expect(v.amount).toBe(12_000)
    expect(v.tone).toBe('positive')
  })

  it('they paid for me: "Sam paid for you · Auto", −₹120', () => {
    const v = view({ ...base, payerId: 'sam', participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 12_000 } }, { payerName: 'Sam' })
    expect(v.subtitle).toBe('Sam paid for you · Auto')
    expect(v.amount).toBe(-12_000)
    expect(v.caption).toBe('you owe')
  })

  it('names the group instead of the title when it is shown', () => {
    const group = createGroup({ name: 'Flat 302', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: ['riya'] })
    expect(view({ ...base, groupId: group.id }, { group }).subtitle).toBe('You paid for Riya · Flat 302')
    expect(view({ ...base, groupId: group.id }, { group, showGroup: false }).subtitle).toBe('You paid for Riya · Auto')
  })

  it('looks the name up in your people when the caller does not pass it', () => {
    const riya = addFriend({ name: 'Riya Sharma' })
    const v = expenseRowView({ ...base, participants: [{ friendId: riya.id, input: null }], shares: { [riya.id]: 12_000 } }, { payerName: 'You', group: null })
    expect(v.subtitle).toBe('You paid for Riya Sharma · Auto')
    const gone = expenseRowView(base, { payerName: 'You', group: null })
    expect(gone.subtitle).toBe('You paid for Someone · Auto')
  })
})

describe('expenseRowView — paid abroad (spec 06 §2.4)', () => {
  const abroad: Expense = {
    ...base,
    title: 'Dinner',
    total: 301_344,
    participants: ['me', 'riya', 'sam', 'neha'].map((friendId) => ({ friendId: friendId === 'me' ? ME_ID : friendId, input: null })),
    shares: { [ME_ID]: 75_336, riya: 75_336, sam: 75_336, neha: 75_336 },
    fx: { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' },
  }

  it('shows what was paid and the rough rupee amount: "You paid ฿1,250 (₹3,013) · 4 people"', () => {
    expect(view(abroad).subtitle).toBe('You paid ฿1,250 (₹3,013) · 4 people')
  })

  it('keeps paise below ₹100', () => {
    const small = { ...abroad, total: 9_950, shares: { [ME_ID]: 2_489, riya: 2_487, sam: 2_487, neha: 2_487 }, fx: { ...abroad.fx!, amount: 4_100 } }
    expect(view(small).subtitle).toBe('You paid ฿41 (₹99.50) · 4 people')
  })

  it('reads plain expenses exactly as before', () => {
    const { fx: _fx, ...plain } = abroad
    expect(view(plain).subtitle).toBe('You paid ₹3,013.44 · 4 people')
  })
})
