import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, friendsStore, groupsStore, saveExpense, setPaidBack, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { putShared } from '../groupsync/store'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { applyRefund } from './actions'
import { refundToday } from './index'
import { RefundedCard, RefundedHome } from './RefundedCard'
import { RefundButton, RefundSheet } from './RefundSheet'
import { refundStore } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let groupId: string
let dinner: Expense

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
const find = (id: string): Expense => expensesStore.get().find((e) => e.id === id)!
const everything = (): string => JSON.stringify([expensesStore.get(), friendsStore.get()])
const balances = () => groupBalances(group(), expensesStore.get())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
  dinner = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-10', payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RefundButton', () => {
  it('renders nothing for a loan (not spending) and for an expense that is gone', () => {
    const loan = saveExpense(draft({ kind: 'loan', title: 'Lent Riya', total: 50_000, payerId: ME_ID, participants: everyone(riya) }))
    const first = renderAt('/app/expense/x', <RefundButton expenseId={loan.id} />)
    expect(first.container).toBeEmptyDOMElement()
    first.unmount()
    const second = renderAt('/app/expense/x', <RefundButton expenseId="nope" />)
    expect(second.container).toBeEmptyDOMElement()
    second.unmount()
    const sheet = renderAt('/app/expense/x', <RefundSheet expenseId={loan.id} open onClose={() => undefined} />)
    expect(sheet.container).toBeEmptyDOMElement()
  })

  it('opens the sheet prefilled: all of it, to whoever paid, today', async () => {
    const { user } = renderAt('/app/groups/x', <RefundButton expenseId={dinner.id} />)
    await user.click(screen.getByRole('button', { name: 'Got money back?' }))
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    expect(sheet).toHaveTextContent('Dinner · ₹2,400')
    expect(within(sheet).getByLabelText('How much came back')).toHaveValue('2,400')
    expect(within(sheet).getByRole('button', { name: 'All of it: ₹2,400' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: /Sam \(paid\)/ })).toHaveAttribute('aria-pressed', 'true')
    // The other choices are one tap away: half, or someone else in the group.
    expect(within(sheet).getAllByRole('button', { pressed: false })).toHaveLength(3)
    for (const name of ['Half: ₹1,200', 'Riya', 'You']) expect(within(sheet).getByRole('button', { name, pressed: false })).toBeInTheDocument()
    expect(sheet).toHaveTextContent('All of it came back, so Dinner comes out of the balances.')
    expect(within(sheet).getByRole('button', { name: 'Save refund of ₹2,400' })).toBeEnabled()
  })
})

describe('RefundSheet: part of it came back', () => {
  it('shows what each share becomes, saves it, and Undo restores everything byte for byte', async () => {
    const before = everything()
    const was = balances()
    const onClose = vi.fn()
    const { user } = renderAt('/app/groups/x', <RefundSheet expenseId={dinner.id} open onClose={onClose} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    const field = within(sheet).getByLabelText('How much came back')
    await user.clear(field)
    await user.type(field, '300')
    expect(sheet).toHaveTextContent('Dinner becomes ₹2,100, down from ₹2,400.')
    expect(within(sheet).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Sam₹700, was ₹800', 'Riya₹700, was ₹800', 'You₹700, was ₹800'])
    // Nothing extra to explain: the money went to the payer, in a group.
    expect(sheet).not.toHaveTextContent('own entry')

    await user.click(within(sheet).getByRole('button', { name: 'Save refund of ₹300' }))
    expect(onClose).toHaveBeenCalled()
    expect(find(dinner.id)).toMatchObject({ title: 'Dinner', total: 210_000, shares: { [sam]: 70_000, [riya]: 70_000, [ME_ID]: 70_000 }, note: '₹300 refunded on 14 Nov 2026' })
    expect(balances()[ME_ID]).toBe(was[ME_ID]! + 10_000)
    expect(screen.getByText('₹300 refund saved. Dinner is now ₹2,100.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(everything()).toBe(before)
    expect(find(dinner.id)).toBe(dinner)
    expect(refundStore.get().refunds).toEqual([])
  })

  it('a half-filled sheet keeps you there and says what is missing', async () => {
    const { user } = renderAt('/app/groups/x', <RefundSheet expenseId={dinner.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    const field = within(sheet).getByLabelText('How much came back')
    await user.clear(field)
    expect(within(sheet).getByRole('button', { name: 'Enter how much came back' })).toBeDisabled()
    await user.type(field, '2500')
    expect(within(sheet).getByRole('button', { name: 'That’s more than the ₹2,400 paid' })).toBeDisabled()
    expect(sheet).not.toHaveTextContent('What changes')
    expect(find(dinner.id)).toBe(dinner)
    await user.click(within(sheet).getByRole('button', { name: 'Half: ₹1,200' }))
    expect(within(sheet).getByRole('button', { name: 'Save refund of ₹1,200' })).toBeEnabled()
  })

  it('the money went to someone else: says they owe the payer, and adds that as its own entry', async () => {
    const { user } = renderAt('/app/groups/x', <RefundSheet expenseId={dinner.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    const field = within(sheet).getByLabelText('How much came back')
    await user.clear(field)
    await user.type(field, '300')
    await user.click(within(sheet).getByRole('button', { name: 'Riya' }))
    expect(sheet).toHaveTextContent('Riya got money Sam paid, so Riya owes Sam ₹300. It’s added as its own entry.')
    await user.click(within(sheet).getByRole('button', { name: 'You' }))
    expect(sheet).toHaveTextContent('You got money Sam paid, so you owe Sam ₹300. It’s added as its own entry.')
    await user.click(within(sheet).getByRole('button', { name: 'Save refund of ₹300' }))
    const entry = expensesStore.get().find((e) => e.title === 'Refund on Dinner')!
    expect(entry).toMatchObject({ kind: 'loan', payerId: sam, total: 30_000, groupId, shares: { [ME_ID]: 30_000 } })
    expect(find(dinner.id).note).toBe('₹300 refunded on 14 Nov 2026, to Ayush')
  })

  it('outside a group, someone had already paid: says the payer owes them the difference', async () => {
    const movie = saveExpense(draft({ title: 'Movie', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya, sam) }))
    setPaidBack(movie.id, riya, true)
    const { user } = renderAt('/app/expense/x', <RefundSheet expenseId={movie.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    const field = within(sheet).getByLabelText('How much came back')
    await user.clear(field)
    await user.type(field, '600')
    expect(sheet).toHaveTextContent('Riya had already paid you back, so you owe Riya ₹200. It’s added as its own entry.')
    // Only this expense's own people can have got it (no group to add others from).
    const who = within(sheet).getByRole('group', { name: 'Who got the money' })
    expect(within(who).getAllByRole('button')).toHaveLength(3)
    for (const name of ['You (paid)', 'Riya', 'Sam']) expect(within(who).getByRole('button', { name })).toBeInTheDocument()
  })

  it('lists refunds already on it; “Take it off” restores the expense, and Undo puts the refund back', async () => {
    const result = applyRefund(dinner.id, { amount: 30_000, toId: sam, date: '2026-11-12' })
    expect(result.ok).toBe(true)
    const refunded = JSON.stringify(expensesStore.get())
    const { user } = renderAt('/app/groups/x', <RefundSheet expenseId={dinner.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    expect(sheet).toHaveTextContent('Dinner · ₹2,100')
    expect(within(sheet).getByRole('region', { name: 'Already refunded' })).toHaveTextContent('₹300 on 12 Nov 2026')
    await user.click(within(sheet).getByRole('button', { name: 'Take off the refund of ₹300' }))
    expect(find(dinner.id)).toBe(dinner)
    expect(refundStore.get().refunds).toEqual([])
    expect(screen.getByText('Refund taken off. Dinner is ₹2,400 again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(JSON.stringify(expensesStore.get())).toBe(refunded)
    expect(refundStore.get().refunds).toHaveLength(1)
  })

  it('a refund on an expense changed since says to edit the expense instead', async () => {
    const movie = saveExpense(draft({ title: 'Movie', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    applyRefund(movie.id, { amount: 40_000, toId: ME_ID, date: '2026-11-14' })
    vi.setSystemTime(new Date(2026, 10, 15, 9))
    setPaidBack(movie.id, riya, true)
    renderAt('/app/expense/x', <RefundSheet expenseId={movie.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    expect(within(sheet).queryByRole('button', { name: /Take off/ })).not.toBeInTheDocument()
    expect(sheet).toHaveTextContent('The expense was changed after this refund. To change it now, edit the expense.')
  })
})

describe('RefundSheet: all of it came back', () => {
  it('takes the expense out, leaves its page, lists it as refunded in full, and Undo restores it byte for byte', async () => {
    const before = everything()
    const removing = vi.fn()
    const { user } = renderAt(
      `/app/expense/${dinner.id}`,
      <>
        <RefundSheet expenseId={dinner.id} open onClose={() => undefined} onRemoving={removing} />
        <RefundedCard group={group()} />
      </>,
    )
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    expect(screen.queryByRole('region', { name: /refunded in full/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save refund of ₹2,400' }))
    expect(removing).toHaveBeenCalledWith(expect.objectContaining({ id: dinner.id }))
    expect(expensesStore.get()).toEqual([])
    expect(Object.values(balances()).every((v) => v === 0)).toBe(true)
    expect(screen.getByText('Dinner was refunded in full. It’s out of the balances.')).toBeInTheDocument()
    expect(currentUrl()).toBe(`/app/groups/${groupId}`)
    const card = screen.getByRole('region', { name: '1 expense refunded in full' })
    expect(within(card).getByRole('listitem', { name: 'Dinner, ₹2,400' })).toHaveTextContent('Came back on 14 Nov 2026')

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(everything()).toBe(before)
    expect(screen.queryByRole('region', { name: /refunded in full/ })).not.toBeInTheDocument()
  })

  it('in a shared group, says everyone stops seeing it', async () => {
    putShared({ groupId, id: 'shared-1', key: 'k'.repeat(22), me: 'm-me', members: {}, seen: {}, meta: { n: 'Goa', e: '🏖️', k: 'trip', u: 1 }, gone: {}, revived: {}, known: [], by: {}, createdAt: 1, sent: null, synced: null })
    const { user } = renderAt('/app/groups/x', <RefundSheet expenseId={dinner.id} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Got money back on this?' })
    expect(sheet).toHaveTextContent('This group is shared. Everyone in the group stops seeing Dinner once it’s out.')
    // A part refund keeps the expense for everyone: no warning.
    const field = within(sheet).getByLabelText('How much came back')
    await user.clear(field)
    await user.type(field, '300')
    expect(sheet).not.toHaveTextContent('This group is shared')
  })
})

describe('RefundedCard and RefundedHome', () => {
  it('render nothing when no expense was refunded in full', () => {
    applyRefund(dinner.id, { amount: 30_000, toId: sam, date: '2026-11-14' })
    const card = renderAt('/app/groups/x', <RefundedCard group={group()} />)
    expect(card.container).toBeEmptyDOMElement()
    card.unmount()
    const home = renderAt('/app', <RefundedHome />)
    expect(home.container).toBeEmptyDOMElement()
  })

  it('“Put it back” returns the expense exactly as it was; Undo takes it out again', async () => {
    const before = JSON.stringify(expensesStore.get())
    applyRefund(dinner.id, { amount: 240_000, toId: riya, date: '2026-11-13' })
    const { user } = renderAt('/app/groups/x', <RefundedCard group={group()} />)
    const card = screen.getByRole('region', { name: '1 expense refunded in full' })
    expect(card).toHaveTextContent('All the money came back, so it’s out of the balances.')
    expect(within(card).getByRole('listitem', { name: 'Dinner, ₹2,400' })).toHaveTextContent('Came back on 13 Nov 2026, to Riya')
    // Riya holds Sam's money meanwhile.
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Refund on Dinner'])

    await user.click(within(card).getByRole('button', { name: 'Put Dinner back' }))
    expect(JSON.stringify(expensesStore.get())).toBe(before)
    expect(screen.getByText('Dinner is back in the balances, as it was')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /refunded in full/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Refund on Dinner'])
    expect(screen.getByRole('region', { name: '1 expense refunded in full' })).toBeInTheDocument()
  })

  it('“Clear” forgets one, with Undo; loose expenses show on RefundedHome only', async () => {
    const movie = saveExpense(draft({ title: 'Movie', total: 50_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    applyRefund(movie.id, { amount: 50_000, toId: ME_ID, date: '2026-11-14' })
    const inGroup = renderAt('/app/groups/x', <RefundedCard group={group()} />)
    expect(inGroup.container).toBeEmptyDOMElement()
    inGroup.unmount()
    const { user } = renderAt('/app', <RefundedHome />)
    await user.click(screen.getByRole('button', { name: 'Clear Movie from this list' }))
    expect(refundStore.get().refunds).toEqual([])
    expect(screen.getByText('Cleared Movie')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByRole('listitem', { name: 'Movie, ₹500' })).toBeInTheDocument()
  })
})

describe('refundToday', () => {
  it('never has anything due', () => {
    applyRefund(dinner.id, { amount: 240_000, toId: sam, date: '2026-11-14' })
    expect(refundToday(new Date(2026, 10, 14))).toEqual([])
  })
})
