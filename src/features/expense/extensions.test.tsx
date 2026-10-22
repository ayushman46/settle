import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ME_ID, type Expense } from '../../domain/types'
import { extensionEditPath, extraExpenseActions, isOneToOneEntry } from './extensionActions'
import { ExpenseExtensions } from './extensions'

const expense: Expense = {
  id: 'e1',
  kind: 'loan',
  title: 'Cash',
  category: 'other',
  currency: 'INR',
  total: 50_000,
  date: '2026-10-21',
  createdAt: 1,
  updatedAt: 1,
  payerId: ME_ID,
  mode: 'equal',
  participants: [{ friendId: 'riya', input: null }],
  shares: { riya: 50_000 },
  roundedToWhole: false,
  note: null,
  groupId: null,
  bill: null,
  paidBack: {},
  recurringId: null,
  source: 'manual',
  fx: { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' },
}

describe('expense extensions (all feature flags off)', () => {
  it('render nothing and add no menu entries', () => {
    const { container } = render(<ExpenseExtensions expense={expense} />)
    expect(container).toBeEmptyDOMElement()
    expect(extraExpenseActions(expense, { close: () => {} })).toEqual([])
  })

  it('leave Edit where it always went', () => {
    expect(extensionEditPath(expense)).toBeNull()
  })

  it('know a 1:1 entry: a loan, or one person who is not the payer', () => {
    expect(isOneToOneEntry(expense)).toBe(true)
    expect(isOneToOneEntry({ ...expense, kind: 'split' })).toBe(true)
    expect(isOneToOneEntry({ ...expense, kind: 'split', participants: [{ friendId: ME_ID, input: null }, { friendId: 'riya', input: null }] })).toBe(false)
    expect(isOneToOneEntry({ ...expense, kind: 'split', participants: [{ friendId: ME_ID, input: null }] })).toBe(false)
  })
})
