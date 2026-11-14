import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, groupsStore, saveExpense, updateFriend, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { QueueCard } from './QueueCard'
import { QueueScreen } from './QueueScreen'

vi.setConfig({ testTimeout: 30_000 })

// The real sheet hands off to a UPI app; here "paid" is one button that calls back as it would.
vi.mock('../../kit/UpiPaySheet', () => ({
  UpiPaySheet: ({ open, onClose, payee, amount, onMarkPaid }: UpiPaySheetProps) =>
    open ? (
      <div role="dialog" aria-label={`Pay ${payee.name}`}>
        <span>{amount}</span>
        <button
          type="button"
          onClick={() => {
            onMarkPaid?.()
            onClose()
          }}
        >
          I’ve paid
        </button>
      </div>
    ) : null,
}))

const nets = () => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend

let sam: string
let riya: string
let asha: string

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  sam = addFriend({ name: 'Sam' }).id
  riya = addFriend({ name: 'Riya' }).id
  asha = addFriend({ name: 'Asha' }).id
  updateFriend(riya, { upiId: 'riya@okicici' })
  // You owe Riya ₹1,200, Sam ₹800 and Asha ₹340.
  saveExpense(draft({ title: 'Hotel', total: 240_000, payerId: riya, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 160_000, payerId: sam, participants: everyone(ME_ID, sam) }))
  saveExpense(draft({ title: 'Chai', total: 68_000, payerId: asha, participants: everyone(ME_ID, asha) }))
})

const now = () => screen.getByRole('region', { name: 'Paying now' })
const burstGone = () => waitFor(() => expect(screen.queryByRole('dialog', { name: /^Paid / })).not.toBeInTheDocument(), { timeout: 4000 })

describe('QueueScreen', () => {
  it('goes through everyone you owe, the largest first, moving on by itself once a payment is recorded', async () => {
    const { user } = renderAt('/app/pay-all', <QueueScreen />)
    expect(screen.getByText('You owe 3 people ₹2,340')).toBeInTheDocument()
    expect(within(now()).getByRole('heading', { name: 'Riya' })).toBeInTheDocument()
    expect(within(now()).getByText('Pays to riya@okicici')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    await user.click(within(now()).getByRole('button', { name: 'Pay ₹1,200' }))
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))
    expect(nets()[riya]).toBeUndefined()
    expect(expensesStore.get().find((e) => e.title === 'Hotel')?.paidBack[ME_ID]).toBeDefined()
    expect(screen.getByRole('dialog', { name: 'Paid Riya' })).toHaveTextContent('Next: Sam')
    await burstGone()

    // Next up by itself: Sam, with no UPI ID.
    expect(within(now()).getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
    expect(within(now()).getByText('No UPI ID saved for Sam. You can add it when you pay.')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Paid so far' })).getByText('Riya')).toBeInTheDocument()

    // Skip moves on without recording.
    await user.click(screen.getByRole('button', { name: 'Skip Sam for now' }))
    expect(nets()[sam]).toBe(-80_000)
    expect(within(now()).getByRole('heading', { name: 'Asha' })).toBeInTheDocument()
    expect(screen.getByText('3 of 3')).toBeInTheDocument()

    // Paid in cash records it as cash.
    await user.click(screen.getByRole('button', { name: 'Mark ₹340 to Asha as paid in cash' }))
    expect(nets()[asha]).toBeUndefined()
    await burstGone()

    // Only the skipped one is left.
    expect(screen.getByText('You skipped 1 person')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go through them again' }))
    expect(within(now()).getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark ₹800 to Sam as paid in cash' }))
    await burstGone()

    expect(screen.getByRole('heading', { name: 'You owe nobody' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(currentUrl()).toBe('/app')
  })

  it('Undo brings the person back to the queue', async () => {
    const { user } = renderAt('/app/pay-all', <QueueScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark ₹1,200 to Riya as paid in cash' }))
    await burstGone()
    expect(within(now()).getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(nets()[riya]).toBe(-120_000)
    expect(within(now()).getByRole('heading', { name: 'Riya' })).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('picks up where you are when reopened: whoever you still owe is what’s left', () => {
    // Riya was paid in another visit (e.g. before the UPI app came back).
    expensesStore.update((list) => list.map((e) => (e.title === 'Hotel' ? { ...e, paidBack: { [ME_ID]: Date.now() } } : e)))
    renderAt('/app/pay-all', <QueueScreen />)
    expect(screen.getByText('You owe 2 people ₹1,140')).toBeInTheDocument()
    expect(within(now()).getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
  })

  it('says you owe nobody when there’s nothing to pay', () => {
    resetProScreens()
    renderAt('/app/pay-all', <QueueScreen />)
    expect(screen.getByRole('heading', { name: 'You owe nobody' })).toBeInTheDocument()
  })
})

describe('QueueCard', () => {
  it('invites you to clear it in one go when you owe two or more people', async () => {
    const { user } = renderAt('/app', <QueueCard />)
    expect(screen.getByRole('heading', { name: 'You owe 3 people ₹2,340' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear it in one go' }))
    expect(currentUrl()).toBe('/app/pay-all')
  })

  it('shows nothing when you owe one person or nobody', () => {
    resetProScreens()
    const one = addFriend({ name: 'Sam' }).id
    saveExpense(draft({ title: 'Cab', total: 160_000, payerId: one, participants: everyone(ME_ID, one) }))
    const { container } = renderAt('/app', <QueueCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
