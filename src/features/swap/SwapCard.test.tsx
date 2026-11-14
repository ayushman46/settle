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
    expect(copied).toContain('instead of paying me ₹500, please pay Sam ₹500 directly: I owe Sam the same. That clears both of us.')
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

  it('unequal amounts: I owe more, so the card, the message and the toast say I still owe the rest', async () => {
    // Riya owes me ₹800; I owe Sam ₹1,200.
    saveExpense(draft({ title: 'Dinner', total: 160_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 240_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    const { user } = renderAt('/app', <SwapCard />)
    expect(
      screen.getByText('Ask Riya to pay Sam ₹800 directly. Riya is then cleared with you, and you’ll still owe Sam ₹400.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Both are cleared/)).not.toBeInTheDocument()
    expect(screen.getByText('Asking only sends a message. Once Riya has paid, come back and tap “Riya paid Sam”.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ask Riya' }))
    await screen.findByText('Message copied. Paste it to Riya.')
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain('Hi Riya Sharma, instead of paying me ₹800, please pay Sam ₹800 directly. That clears you with me. I owe Sam ₹1,200, so I’ll still owe them ₹400.')
    expect(copied).not.toMatch(/the same|both of us/)

    await user.click(screen.getByRole('button', { name: 'Mark that Riya paid Sam ₹800' }))
    expect(await screen.findByText('Riya paid Sam ₹800. Riya is cleared; you still owe Sam ₹400.')).toBeInTheDocument()
    expect(nets()).toEqual({ [sam]: -40_000 })
  })

  it('unequal amounts: I’m owed more, so it says I’m cleared with the payee and what is still owed to me', async () => {
    // Riya owes me ₹800; I owe Sam ₹300.
    saveExpense(draft({ title: 'Dinner', total: 160_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 60_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    const { user } = renderAt('/app', <SwapCard />)
    expect(
      screen.getByText('Ask Riya to pay Sam ₹300 directly. You’re then cleared with Sam, and Riya will still owe you ₹500.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask Riya' }))
    await screen.findByText('Message copied. Paste it to Riya.')
    expect(await navigator.clipboard.readText()).toContain(
      'Hi Riya Sharma, you owe me ₹800. Please pay Sam ₹300 of it directly, as I owe Sam that much. You’ll then owe me ₹500.',
    )
    await user.click(screen.getByRole('button', { name: 'Mark that Riya paid Sam ₹300' }))
    expect(await screen.findByText('Riya paid Sam ₹300. You’re cleared with Sam; Riya still owes you ₹500.')).toBeInTheDocument()
    expect(nets()).toEqual({ [riya]: 50_000 })
  })

  it('ignores money in other currencies', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, currency: 'USD', participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 100_000, currency: 'USD', payerId: sam, participants: everyone(ME_ID, sam) }))
    const { container } = renderAt('/app', <SwapCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
