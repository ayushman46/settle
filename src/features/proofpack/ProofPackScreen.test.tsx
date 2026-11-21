import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, recordSettlement, saveExpense, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { BillPaidCard, PaymentPaidFor } from '../paidfor/PaidFor'
import { renderAt, resetProScreens } from '../pro/testing'
import { ProofPackScreen } from './ProofPackScreen'

vi.setConfig({ testTimeout: 30_000 })

let riya = ''
let sam = ''
let groupId = ''

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
  const day = today()
  saveExpense({
    kind: 'split',
    title: 'Villa',
    category: 'travel',
    currency: 'INR',
    total: 1440000,
    date: day,
    payerId: ME_ID,
    mode: 'equal',
    participants: [ME_ID, riya, sam].map((friendId) => ({ friendId, input: null })),
    roundedToWhole: false,
    note: null,
    groupId,
    bill: null,
    recurringId: null,
    source: 'manual',
  })
  recordSettlement(groupId, { fromId: riya, toId: ME_ID, amount: 300000, date: day, method: 'upi' })
})

describe('Paid for what', () => {
  it('shows on a group bill who has paid their part', async () => {
    const { expensesStore } = await import('../../data/stores')
    const villa = expensesStore.get().find((e) => e.title === 'Villa')!
    render(<BillPaidCard expense={villa} />)
    const card = screen.getByRole('region', { name: 'Who’s paid their part' })
    expect(card).toHaveTextContent('0 of 2 paid')
    const rows = within(card).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(/Riya₹3,000 of ₹4,800/)
    expect(rows[1]).toHaveTextContent(/SamOwes ₹4,800/)
  })

  it('shows in a payment what it paid for', async () => {
    const { groupsStore } = await import('../../data/stores')
    const group = groupsStore.get().find((g) => g.id === groupId)!
    render(<PaymentPaidFor group={group} settlement={group.settlements[0]!} />)
    expect(screen.getByRole('region', { name: 'This paid for' })).toHaveTextContent(/Villa₹3,000/)
  })
})

describe('ProofPackScreen', () => {
  it('lists what friends paid back and what for, and filters by person', async () => {
    const user = userEvent.setup()
    renderAt('/app/proof-of-repayments', <ProofPackScreen />)
    const sheet = screen.getByRole('article', { name: 'The statement' })
    expect(sheet).toHaveTextContent('Money paid back to Ayush')
    expect(sheet).toHaveTextContent(/Paid back for shared bills₹3,000/)
    expect(sheet).toHaveTextContent(/For Villa/)
    expect(sheet).toHaveTextContent('UPI')
    expect(sheet).toHaveTextContent('Not a bank statement, and not tax or legal advice.')
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Last financial year' }))
    expect(sheet).toHaveTextContent('Nothing paid back to you in these dates yet.')
  })
})
