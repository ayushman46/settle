import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataForTests } from '../data'
import { ME_ID } from '../domain/types'
import { TransferRow } from './TransferRow'
import { seedPeople } from './testPeople'

beforeEach(() => {
  resetDataForTests()
  seedPeople()
})

afterEach(() => {
  resetDataForTests()
})

describe('TransferRow', () => {
  it('reads as one sentence: who pays whom, how much', () => {
    render(<TransferRow transfer={{ fromId: 'riya', toId: ME_ID, amount: 54_000 }} currency="INR" />)
    const row = screen.getByRole('group', { name: 'Riya pays you ₹540' })
    expect(row).toHaveAttribute('data-direction', 'in')
    // The visual chain ("Riya → You") is hidden from screen readers, which get the sentence.
    expect(within(row).getByText('Riya pays you').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(within(row).getByText('You')).toBeInTheDocument()
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers Remind and Record for money coming to you', async () => {
    const onRemind = vi.fn()
    const onRecord = vi.fn()
    render(<TransferRow transfer={{ fromId: 'sam', toId: ME_ID, amount: 120_050 }} currency="INR" onRemind={onRemind} onRecord={onRecord} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remind Sam about ₹1,200.50' }))
    expect(onRemind).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Record ₹1,200.50 from Sam to you' }))
    expect(onRecord).toHaveBeenCalledOnce()
  })

  it('offers Pay via UPI for a payment you make', async () => {
    const onPay = vi.fn()
    render(<TransferRow transfer={{ fromId: ME_ID, toId: 'riya', amount: 54_000 }} currency="INR" onPay={onPay} onRecord={() => {}} />)
    expect(screen.getByRole('group', { name: 'You pay Riya ₹540' })).toHaveAttribute('data-direction', 'out')
    await userEvent.click(screen.getByRole('button', { name: 'Pay Riya ₹540 via UPI' }))
    expect(onPay).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Record ₹540 from you to Riya' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remind/ })).not.toBeInTheDocument()
  })

  it('handles payments between two other people, and removed people', () => {
    render(<TransferRow transfer={{ fromId: 'neha', toId: 'gone', amount: 999 }} currency="USD" onRecord={() => {}} />)
    const row = screen.getByRole('group', { name: 'Neha Sharma pays Someone $9.99' })
    expect(row).toHaveAttribute('data-direction', 'between')
    expect(within(row).getByRole('button', { name: 'Record $9.99 from Neha Sharma to Someone' })).toBeInTheDocument()
  })
})
