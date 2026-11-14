import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, groupsStore, saveExpense, updateFriend, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { renderAt, resetProScreens } from '../pro/testing'
import { swapStore } from './store'
import { SwapCard } from './SwapCard'

vi.setConfig({ testTimeout: 30_000 })

const nets = () => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend

let riya: string
let sam: string

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
})

function riyaOwesMeIOweSam(): void {
  saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 100_000, payerId: sam, participants: everyone(ME_ID, sam) }))
}

describe('SwapCard', () => {
  it('shows nothing when there’s nothing to pair', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const { container } = renderAt('/app', <SwapCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('suggests one payment instead of two, and says plainly when there’s no UPI ID', () => {
    riyaOwesMeIOweSam()
    renderAt('/app', <SwapCard />)
    const card = screen.getByRole('region', { name: 'Pay it forward' })
    expect(within(card).getByText('Ask Riya to pay Sam ₹500 directly. Both are cleared with you.')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Riya pays Sam ₹500, skipping you' })).toBeInTheDocument()
    expect(within(card).getByText(/Sam has no UPI ID saved/)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Ask Riya' })).toBeInTheDocument()
  })

  it('Ask shares the message (copied on a computer)', async () => {
    riyaOwesMeIOweSam()
    updateFriend(sam, { upiId: 'sam@okaxis' })
    const { user } = renderAt('/app', <SwapCard />)
    expect(screen.queryByText(/no UPI ID saved/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask Riya' }))
    expect(await screen.findByText('Message copied. Paste it to Riya.')).toBeInTheDocument()
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain('instead of paying me ₹500, please pay Sam ₹500 directly')
    expect(copied).toContain('sam@okaxis')
    expect(copied).toMatch(/Pay Sam here: \S+\/pay#/)
  })

  it('“Riya paid Sam” clears both, and Undo puts both back', async () => {
    riyaOwesMeIOweSam()
    const { user, container } = renderAt('/app', <SwapCard />)
    await user.click(screen.getByRole('button', { name: 'Mark that Riya paid Sam ₹500' }))
    expect(nets()).toEqual({})
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(nets()).toEqual({ [riya]: 50_000, [sam]: -50_000 })
    expect(screen.getByRole('region', { name: 'Pay it forward' })).toBeInTheDocument()
  })

  it('“1 more” opens the others in place; “Not now” puts one away, with Undo', async () => {
    const asha = addFriend({ name: 'Asha' }).id
    const dev = addFriend({ name: 'Dev' }).id
    riyaOwesMeIOweSam()
    saveExpense(draft({ title: 'Snacks', total: 20_000, participants: everyone(ME_ID, asha) }))
    saveExpense(draft({ title: 'Auto', total: 20_000, payerId: dev, participants: everyone(ME_ID, dev) }))
    const { user } = renderAt('/app', <SwapCard />)
    expect(screen.getByText('Ask Riya to pay Sam ₹500 directly. Both are cleared with you.')).toBeInTheDocument()
    expect(screen.queryByText(/Ask Asha/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 more' }))
    expect(screen.getByText('Ask Asha to pay Dev ₹100 directly. Both are cleared with you.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Put away the suggestion that Riya pays Sam' }))
    expect(swapStore.get().dismissed).toEqual([`${riya}>${sam}:50000`])
    expect(screen.queryByText(/Ask Riya to pay Sam/)).not.toBeInTheDocument()
    expect(screen.getByText('Ask Asha to pay Dev ₹100 directly. Both are cleared with you.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(swapStore.get().dismissed).toEqual([])
    expect(screen.getByText(/Ask Riya to pay Sam/)).toBeInTheDocument()
  })

  it('ignores money in other currencies', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, currency: 'USD', participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 100_000, currency: 'USD', payerId: sam, participants: everyone(ME_ID, sam) }))
    const { container } = renderAt('/app', <SwapCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
