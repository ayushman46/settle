import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentUrl } from '../pro/testing'
import { resetNavForTests } from '../../app/router'
import { groupsStore, resetDataForTests } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { seedPeople } from '../../kit/testPeople'
import { makeExpense, makeGroup } from '../../share/testing'
import { EMPTY_META } from '../../types'
import { BillBreakdown } from '../expense/BillBreakdown'
import { ConvertCard } from './ConvertCard'
import { FxNote } from './FxNote'

beforeEach(() => {
  resetDataForTests()
  resetNavForTests()
  seedPeople()
  groupsStore.set([makeGroup({ name: 'Bangkok trip', travelCurrency: 'THB' })])
})

const THB_FX = { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' } as const

describe('FxNote', () => {
  it('says what was paid and the frozen rate', () => {
    render(<FxNote expense={makeExpense({ groupId: 'g1', total: 301_344, fx: THB_FX })} />)
    expect(screen.getByText('Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)')).toBeInTheDocument()
  })

  it('is nothing for an expense paid in its own currency', () => {
    const { container } = render(<FxNote expense={makeExpense()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ConvertCard', () => {
  it('offers to convert a group expense left in another currency', async () => {
    const user = userEvent.setup()
    render(<ConvertCard expense={makeExpense({ id: 'e9', groupId: 'g1', currency: 'THB', total: 125_000 })} />)
    expect(screen.getByText('This is in THB, so it isn’t in Bangkok trip’s ₹ balances.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Convert to ₹' }))
    expect(currentUrl()).toBe('/app/split/e9/edit?convert=1')
  })

  it('stays away from converted expenses, the group’s own currency and expenses outside groups', () => {
    const { container, rerender } = render(<ConvertCard expense={makeExpense({ groupId: 'g1', total: 301_344, fx: THB_FX })} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ConvertCard expense={makeExpense({ groupId: 'g1' })} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ConvertCard expense={makeExpense({ currency: 'THB' })} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BillBreakdown — paid abroad', () => {
  it('lists the bill in baht as printed and what it settled at in rupees', () => {
    const bill: Expense['bill'] = {
      meta: { ...EMPTY_META, merchant: 'Jay Fai', subtotal: 120_000, tax: 5_000, total: 125_000 },
      items: [
        { id: 'i1', name: 'Crab omelette', quantity: 1, amount: 80_000 },
        { id: 'i2', name: 'Drunken noodles', quantity: 1, amount: 40_000 },
      ],
      assignments: { i1: { [ME_ID]: 1, riya: 1 }, i2: { riya: 1 } },
      warnings: [],
    }
    render(
      <BillBreakdown
        expense={makeExpense({ kind: 'bill', mode: 'items', groupId: 'g1', total: 301_344, fx: THB_FX, bill, participants: [ME_ID, 'riya'].map((friendId) => ({ friendId, input: null })) })}
      />,
    )
    const items = screen.getByRole('list', { name: 'Items' })
    expect(within(items).getByText('฿800')).toBeInTheDocument()
    expect(within(items).getByText('฿400')).toBeInTheDocument()
    expect(screen.getByText('Tax').parentElement).toHaveTextContent('+฿50')
    expect(screen.getByText('Total paid').parentElement).toHaveTextContent('฿1,250')
    expect(screen.getByText('Settled in ₹').parentElement).toHaveTextContent('₹3,013.44')
    expect(screen.queryByText('Round-off')).not.toBeInTheDocument()
  })
})
