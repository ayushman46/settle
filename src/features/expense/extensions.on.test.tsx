import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { addFriend, resetDataForTests } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { extensionEditPath } from './extensionActions'
import { ExpenseExtensions } from './extensions'

vi.mock('../claim/enabled', () => ({ CLAIMS_ENABLED: true }))
vi.mock('../lend/enabled', () => ({ LEND_ENABLED: true }))
vi.mock('../trip/enabled', () => ({ TRIP_ENABLED: true }))

function loan(riya: string): Expense {
  return {
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
    participants: [{ friendId: riya, input: null }],
    shares: { [riya]: 50_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

describe('expense extensions (feature flags on)', () => {
  beforeEach(() => resetDataForTests())
  afterEach(() => resetDataForTests())

  it('show the loan card on a 1:1 entry, and edit it on the lend screen', () => {
    const riya = addFriend({ name: 'Riya' })
    const e = loan(riya.id)
    render(
      <ToastProvider>
        <ExpenseExtensions expense={e} />
      </ToastProvider>,
    )
    expect(screen.getByText('₹500 still to come')).toBeInTheDocument()
    expect(extensionEditPath(e)).toBe('/app/lend/e1/edit')
  })

  it('leave a group split to the usual editor', () => {
    const riya = addFriend({ name: 'Riya' })
    const e: Expense = {
      ...loan(riya.id),
      kind: 'split',
      participants: [{ friendId: ME_ID, input: null }, { friendId: riya.id, input: null }],
      shares: { [ME_ID]: 25_000, [riya.id]: 25_000 },
    }
    expect(extensionEditPath(e)).toBeNull()
  })
})
