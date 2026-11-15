import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { friendBalance, netIn } from '../friends/friendBalance'
import { renderAt, resetProScreens } from '../pro/testing'
import { kindToday } from './index'
import { KindButton } from './KindButton'
import { KindNoteLine } from './KindNoteLine'
import { KindSheet } from './KindSheet'
import { recordKind } from './record'
import { kindStore } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string

const net = (friendId: string, currency = 'INR'): number => netIn(friendBalance(friendId, expensesStore.get(), groupsStore.get(), 'INR'), currency)

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
})

describe('KindSheet', () => {
  it('they owe you: all of it is prefilled; pick what it was, settle, and Undo puts it back exactly', async () => {
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const before = expensesStore.get()
    const onClose = vi.fn()
    const { user } = renderAt('/app', <KindSheet friendId={riya} open onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Settle without money' })
    expect(within(sheet).getByText('Riya owes you ₹500. If they made it up some other way, say how and it’s settled.')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('How much it settles')).toHaveValue('500')
    expect(within(sheet).getByText('All of it. Type less if it covers only a part.')).toBeInTheDocument()
    // Worded from your side: she bought *my* ticket.
    const chips = within(sheet).getByRole('group', { name: 'What it was' })
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Bought my ticket',
      'Paid my share somewhere else',
      'Gave it in cash earlier',
      'Did me a favour',
      'Something else',
    ])

    await user.click(within(chips).getByRole('button', { name: 'Bought my ticket' }))
    await user.click(within(sheet).getByRole('button', { name: 'Settle ₹500' }))
    expect(net(riya)).toBe(0)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Settled ₹500 with Riya, without money.')).toBeInTheDocument()
    expect(kindStore.get().entries).toHaveLength(1)
    expect(kindStore.get().entries[0]).toMatchObject({ friendId: riya, direction: 'in', what: 'ticket', amount: 50_000, date: today() })
    expect(kindStore.get().entries[0]?.refs[0]).toMatchObject({ type: 'share', expenseId: dinner.id, debtorId: riya })

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(net(riya)).toBe(50_000)
    expect(kindStore.get().entries).toEqual([])
    expect(expensesStore.get().map((e) => [e.id, e.paidBack, e.partPaid])).toEqual(before.map((e) => [e.id, e.paidBack, e.partPaid]))
  })

  it('you owe them: worded the other way, and recorded in the group as a payment marked Other', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [sam] })
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 240_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    const { user } = renderAt('/app', <KindSheet friendId={sam} open onClose={() => undefined} />)
    expect(screen.getByText('You owe Sam ₹1,200. If you made it up some other way, say how and it’s settled.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bought their ticket' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Paid their share somewhere else' }))
    await user.click(screen.getByRole('button', { name: 'Settle ₹1,200' }))
    const payments = groupsStore.get().find((g) => g.id === goa.id)?.settlements ?? []
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ fromId: ME_ID, toId: sam, amount: 120_000, method: 'other', date: today() })
    expect(net(sam)).toBe(0)

    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(groupsStore.get().find((g) => g.id === goa.id)?.settlements).toEqual([])
    expect(net(sam)).toBe(-120_000)
  })

  it('a part: says what is left, settles only that much', async () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt('/app', <KindSheet friendId={riya} open onClose={() => undefined} />)
    const field = screen.getByLabelText('How much it settles')
    await user.clear(field)
    await user.type(field, '200')
    expect(screen.getByText('Leaves ₹300 still to settle.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gave it in cash earlier' }))
    await user.click(screen.getByRole('button', { name: 'Settle ₹200' }))
    expect(net(riya)).toBe(30_000)
    expect(await screen.findByText('Settled ₹200 with Riya, without money. ₹300 is still open.')).toBeInTheDocument()
  })

  it('a half-filled form stays put and says what is missing; nothing is recorded', async () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const onClose = vi.fn()
    const { user } = renderAt('/app', <KindSheet friendId={riya} open onClose={onClose} />)
    // Nothing picked yet.
    await user.click(screen.getByRole('button', { name: 'Settle ₹500' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick what it was.')
    expect(onClose).not.toHaveBeenCalled()
    expect(net(riya)).toBe(50_000)

    // "Something else" needs a few words.
    await user.click(screen.getByRole('button', { name: 'Something else' }))
    await user.click(screen.getByRole('button', { name: 'Settle ₹500' }))
    expect(screen.getByText('Say what it was, in a few words.')).toBeInTheDocument()
    expect(net(riya)).toBe(50_000)

    // More than is owed is refused at once, in words.
    const field = screen.getByLabelText('How much it settles')
    await user.clear(field)
    await user.type(field, '900')
    expect(screen.getByText('Only ₹500 is open, so that is the most this can settle.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Settle' }))
    expect(net(riya)).toBe(50_000)

    // No amount at all.
    await user.clear(field)
    await user.click(screen.getByRole('button', { name: 'Settle' }))
    expect(screen.getByText('Type how much this settles.')).toBeInTheDocument()
    expect(kindStore.get().entries).toEqual([])
    expect(onClose).not.toHaveBeenCalled()

    // Fixed: it goes through, with the person's own words.
    await user.type(field, '500')
    await user.type(screen.getByLabelText('In your words'), 'Next dinner’s on her')
    await user.click(screen.getByRole('button', { name: 'Settle ₹500' }))
    expect(net(riya)).toBe(0)
    expect(kindStore.get().entries[0]).toMatchObject({ what: 'other', text: 'Next dinner’s on her' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('money open in two currencies: pick which one to settle', async () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Museum', currency: 'USD', total: 4_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt('/app', <KindSheet friendId={riya} open onClose={() => undefined} />)
    const which = screen.getByRole('group', { name: 'Which money to settle' })
    expect(within(which).getByRole('button', { name: '₹500 owed to you' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(which).getByRole('button', { name: '$20 you owe' }))
    expect(screen.getByText('You owe Riya $20. If you made it up some other way, say how and it’s settled.')).toBeInTheDocument()
    expect(screen.getByLabelText('How much it settles')).toHaveValue('20')
    await user.click(screen.getByRole('button', { name: 'Did them a favour' }))
    await user.click(screen.getByRole('button', { name: 'Settle $20' }))
    expect(net(riya, 'USD')).toBe(0)
    expect(net(riya)).toBe(50_000)
    expect(kindStore.get().entries[0]).toMatchObject({ currency: 'USD', amount: 2_000, direction: 'out', what: 'favour' })
  })

  it('nothing open between you, or yourself: nothing is shown', () => {
    const none = renderAt('/app', <KindSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(none.container).toBeEmptyDOMElement()
    none.unmount()
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const me = renderAt('/app', <KindSheet friendId={ME_ID} open onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(me.container).toBeEmptyDOMElement()
  })
})

describe('KindButton', () => {
  it('is there only while something is open, opens the sheet, and goes once it is settled', async () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt('/app', <KindButton friendId={riya} />)
    await user.click(screen.getByRole('button', { name: 'Settle with Riya without money' }))
    const sheet = await screen.findByRole('dialog', { name: 'Settle without money' })
    await user.click(within(sheet).getByRole('button', { name: 'Did me a favour' }))
    await user.click(within(sheet).getByRole('button', { name: 'Settle ₹500' }))
    expect(net(riya)).toBe(0)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Settle with Riya without money' })).not.toBeInTheDocument())

    // Undo brings the due, and the button, back.
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(net(riya)).toBe(50_000)
    expect(await screen.findByRole('button', { name: 'Settle with Riya without money' })).toBeInTheDocument()
  })

  it('shows nothing when you are even, or for yourself', () => {
    const even = renderAt('/app', <KindButton friendId={riya} />)
    expect(even.container).toBeEmptyDOMElement()
    even.unmount()
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const me = renderAt('/app', <KindButton friendId={ME_ID} />)
    expect(me.container).toBeEmptyDOMElement()
  })
})

describe('KindNoteLine', () => {
  it('says what it was beside the payment, and nothing for a payment that was not in kind', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya, sam] })
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 100_000, participants: everyone(ME_ID, riya) }))
    recordKind({ friendId: riya, direction: 'in', amount: 50_000, currency: 'INR', what: 'ticket', text: '', date: '2026-11-14' })
    const paymentId = groupsStore.get().find((g) => g.id === goa.id)?.settlements[0]?.id ?? ''
    expect(paymentId).not.toBe('')
    const line = renderAt('/app', <KindNoteLine id={paymentId} />)
    expect(screen.getByText('Settled without money: Riya bought your ticket')).toBeInTheDocument()
    line.unmount()
    const none = renderAt('/app', <KindNoteLine id="some-other-payment" />)
    expect(none.container).toBeEmptyDOMElement()
  })

  it('uses the person’s own words for “something else”, and your side when you settled', () => {
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const cab = saveExpense(draft({ title: 'Cab', total: 60_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    recordKind({ friendId: riya, direction: 'in', amount: 50_000, currency: 'INR', what: 'other', text: 'Next dinner’s on her', date: '2026-11-14' })
    recordKind({ friendId: sam, direction: 'out', amount: 30_000, currency: 'INR', what: 'elsewhere', text: '', date: '2026-11-14' })
    const first = renderAt('/app', <KindNoteLine id={dinner.id} debtorId={riya} />)
    expect(screen.getByText('Settled without money: “Next dinner’s on her”')).toBeInTheDocument()
    first.unmount()
    renderAt('/app', <KindNoteLine id={cab.id} debtorId={ME_ID} />)
    expect(screen.getByText('Settled without money: you paid for Sam somewhere else')).toBeInTheDocument()
  })
})

describe('kindToday', () => {
  it('never has anything due', () => {
    expect(kindToday(new Date(2026, 10, 15))).toEqual([])
  })
})
