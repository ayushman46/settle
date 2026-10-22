import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { currentUrl, renderApp, resetScreens } from './testKit'

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string
let sam: string
let goa: Group

// Whole journeys through real screens: give them room on a busy machine.
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
  resetScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okaxis' })
  riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis', phone: '9876543210' }).id
  sam = addFriend({ name: 'Sam' }).id
  goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetScreens()
})

const path = () => `/app/groups/${goa.id}/settle`
const settlements = () => groupsStore.get().find((g) => g.id === goa.id)?.settlements ?? []

/** Riya paid ₹1,200 for her and me, and ₹600 for her and Sam: I pay Riya ₹600, Sam pays Riya ₹300. */
function iOweRiya() {
  saveExpense(draft({ title: 'Villa', total: 120000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Boat', total: 60000, groupId: goa.id, payerId: riya, participants: everyone(riya, sam) }))
}

describe('SettleUpScreen — payments', () => {
  it('sorts the fewest payments into mine to pay and others’', () => {
    iOweRiya()
    renderApp(path())
    expect(screen.getByRole('heading', { level: 1, name: 'Settle up' })).toBeInTheDocument()
    expect(screen.getByText('2 payments square everyone up — the fewest possible.')).toBeInTheDocument()

    const pay = screen.getByRole('region', { name: 'You pay' })
    const mine = within(pay).getByRole('group', { name: 'You pay Riya ₹600, to riya@okaxis' })
    expect(within(mine).getByRole('button', { name: 'Pay Riya ₹600 via UPI' })).toBeInTheDocument()
    expect(within(mine).getByRole('button', { name: 'Record ₹600 from you to Riya' })).toBeInTheDocument()

    const between = screen.getByRole('region', { name: 'Between others' })
    const theirs = within(between).getByRole('group', { name: 'Sam pays Riya ₹300' })
    expect(within(theirs).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Record ₹300 from Sam to Riya'])
    expect(screen.queryByRole('region', { name: 'Coming to you' })).not.toBeInTheDocument()
  })

  it('pays by UPI and records it once paid', async () => {
    iOweRiya()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Pay Riya ₹600 via UPI' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay Riya' })
    expect(within(sheet).getByText('riya@okaxis')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))

    expect(settlements()).toEqual([expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 60000, method: 'upi', date: '2026-10-22' })])
    const burst = await screen.findByRole('dialog', { name: 'Payment recorded' })
    expect(within(burst).getByText('You paid Riya · UPI')).toBeInTheDocument()
    await user.click(burst)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'You pay' })).not.toBeInTheDocument())
    expect(screen.getByText('1 payment squares everyone up — the fewest possible.')).toBeInTheDocument()
  })

  it('records a part payment in cash', async () => {
    iOweRiya()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹300 from Sam to Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'Record a payment' })
    expect(within(sheet).getByText('The full amount.')).toBeInTheDocument()
    const amount = within(sheet).getByRole('textbox', { name: 'Amount paid' })
    await user.clear(amount)
    expect(within(sheet).getByText('Enter what was paid.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Record payment' })).toBeDisabled()
    await user.type(amount, '100')
    expect(within(sheet).getByText('Part payment — ₹200 still to go.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('radio', { name: 'Cash' }))
    await user.click(within(sheet).getByRole('button', { name: 'Record ₹100' }))

    expect(settlements()).toEqual([expect.objectContaining({ fromId: sam, toId: riya, amount: 10000, method: 'cash' })])
    const burst = await screen.findByRole('dialog', { name: 'Payment recorded' })
    expect(within(burst).getByText('Sam paid Riya · Cash')).toBeInTheDocument()
    await user.click(burst)
    expect(await screen.findByRole('group', { name: 'Sam pays Riya ₹200' })).toBeInTheDocument()
  })

  it('warns when more than is owed was paid', async () => {
    iOweRiya()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹300 from Sam to Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'Record a payment' })
    const amount = within(sheet).getByRole('textbox', { name: 'Amount paid' })
    await user.clear(amount)
    await user.type(amount, '350')
    expect(within(sheet).getByText('₹50 more than owed — that much will be owed back.')).toBeInTheDocument()
  })

  it('celebrates the last payment, then shows everyone square', async () => {
    saveExpense(draft({ total: 60000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹300 from you to Riya' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Record a payment' })).getByRole('button', { name: 'Record ₹300' }))
    const burst = await screen.findByRole('dialog', { name: 'All settled up!' })
    expect(within(burst).getByText('Everyone in Goa is square.')).toBeInTheDocument()
    await user.click(burst)
    expect(await screen.findByRole('heading', { name: 'Everyone’s square' })).toBeInTheDocument()
    expect(screen.getByText('No payments needed in Goa.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share summary' })).toBeInTheDocument()
  })
})

describe('SettleUpScreen — collecting', () => {
  it('reminds whoever owes me', async () => {
    saveExpense(draft({ title: 'Villa', total: 90000, groupId: goa.id, with: [riya, sam] }))
    const { user } = renderApp(path())
    const coming = screen.getByRole('region', { name: 'Coming to you' })
    expect(within(coming).getAllByRole('group')).toHaveLength(2)
    expect(within(coming).queryByRole('button', { name: /via UPI/ })).not.toBeInTheDocument()

    await user.click(within(coming).getByRole('button', { name: 'Remind Riya about ₹300' }))
    const nudge = await screen.findByRole('dialog', { name: 'Nudge Riya' })
    expect(nudge).toHaveTextContent('Goa')
    expect(nudge).toHaveTextContent('₹300')
    expect(nudge).toHaveTextContent('ayush@okaxis')
  })
})

describe('SettleUpScreen — edges', () => {
  it('has nothing to settle before the first expense', async () => {
    const { user } = renderApp(path())
    expect(screen.getByRole('heading', { name: 'Nothing to settle yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share summary' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Goa' }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}`))
  })

  it('leaves UPI out for groups in other currencies', () => {
    const nyc = createGroup({ name: 'NYC', emoji: '🗽', kind: 'trip', currency: 'USD', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 6000, currency: 'USD', groupId: nyc.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    renderApp(`/app/groups/${nyc.id}/settle`)
    const pay = screen.getByRole('region', { name: 'You pay' })
    expect(within(pay).queryByRole('button', { name: /via UPI/ })).not.toBeInTheDocument()
    expect(within(pay).getByRole('button', { name: 'Record $30 from you to Riya' })).toBeInTheDocument()
    expect(within(pay).getByText('Record it once it’s paid.')).toBeInTheDocument()
  })

  it('goes back to the group', async () => {
    iOweRiya()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Goa' })).toBeInTheDocument()
  })

  it('says so when the group is gone', () => {
    renderApp('/app/groups/nope/settle')
    expect(screen.getByRole('heading', { level: 1, name: 'This group is gone' })).toBeInTheDocument()
  })
})
