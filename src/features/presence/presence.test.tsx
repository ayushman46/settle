import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { ToastProvider } from '../../components'
import { renderAt, resetProScreens } from '../pro/testing'
import { NightsCard } from './NightsCard'
import { PresenceBanner } from './PresenceBanner'
import { PresenceSheet } from './PresenceSheet'
import { presenceStore, setStay } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let group: Group

const find = (id: string): Expense => expensesStore.get().find((e) => e.id === id)!
const liveGroup = (): Group => groupsStore.get().find((g) => g.id === group.id)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  group = createGroup({
    name: 'Goa',
    emoji: '🏖️',
    kind: 'trip',
    currency: 'INR',
    memberIds: [ME_ID, riya, sam],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const add = (title: string, total: number, date: string, more: Partial<Parameters<typeof draft>[0]> = {}): Expense =>
  saveExpense(
    draft({
      title,
      total,
      date,
      groupId: group.id,
      participants: everyone(ME_ID, riya, sam),
      ...more,
    }),
  )

describe('PresenceBanner', () => {
  it('says nothing when nobody’s days are set, or nothing is outside them', () => {
    add('Dinner', 90_000, '2026-11-12')
    const { container } = renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(container).toBeEmptyDOMElement()
    act(() => setStay(group.id, sam, { from: '2026-11-12', to: null }))
    expect(container).toBeEmptyDOMElement()
  })

  it('takes someone off what happened before they came, in one tap, and Undo puts it all back exactly', async () => {
    const dinner = add('Dinner', 90_000, '2026-11-10')
    const cab = add('Cab', 60_001, '2026-11-11', { payerId: sam }) // Sam booked it, wasn't there: stays the payer
    const lunch = add('Lunch', 30_000, '2026-11-12')
    const shopping = add('Shopping', 30_000, '2026-11-11', {
      mode: 'exact',
      participants: [
        { friendId: ME_ID, input: 10_000 },
        { friendId: riya, input: 10_000 },
        { friendId: sam, input: 10_000 },
      ],
    })
    // Riya has paid her dinner share back: Undo must bring the tick back too.
    expensesStore.set(expensesStore.get().map((e) => (e.id === dinner.id ? { ...e, paidBack: { [riya]: 123 } } : e)))
    const before = { dinner: find(dinner.id), cab: find(cab.id) }
    setStay(group.id, sam, { from: '2026-11-12', to: null })

    const { user } = renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText(/Sam joined on 12 Nov but is on 3 expenses from before\./)).toBeInTheDocument()
    expect(screen.getByText(/Take Sam off them\?/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Shopping/ })).toHaveAttribute('href', `/app/expense/${shopping.id}`)
    expect(screen.getByText('(split another way)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Take Sam off' }))
    const d = find(dinner.id)
    const c = find(cab.id)
    expect(d.participants.map((p) => p.friendId)).toEqual([ME_ID, riya])
    expect(d.shares).toEqual({ [ME_ID]: 45_000, [riya]: 45_000 })
    expect(c.payerId).toBe(sam)
    expect(Object.values(c.shares).reduce((a, b) => a + b, 0)).toBe(60_001)
    expect(c.shares[sam]).toBeUndefined()
    expect(find(lunch.id).participants).toHaveLength(3)
    expect(find(shopping.id).participants).toHaveLength(3)
    // Only the by-hand one is left.
    expect(screen.queryByRole('button', { name: 'Take Sam off' })).not.toBeInTheDocument()
    expect(screen.getByText(/Sam joined on 12 Nov but is on 1 expense from before\./)).toBeInTheDocument()

    expect(await screen.findByText('Took Sam off 2 expenses')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(find(dinner.id)).toEqual(before.dinner)
    expect(find(cab.id)).toEqual(before.cab)
    expect(find(dinner.id).paidBack).toEqual({ [riya]: 123 })
  })

  it('“Leave them” is remembered, and Undo brings the banner back', async () => {
    add('Dinner', 90_000, '2026-11-16')
    setStay(group.id, riya, { from: null, to: '2026-11-14' })
    const { user, container } = renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText(/Riya was there until 14 Nov but is on 1 expense from after\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave them' }))
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(presenceStore.get().declined[group.id]).toHaveLength(1)
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(await screen.findByRole('button', { name: 'Take Riya off' })).toBeInTheDocument()
  })

  it('speaks to you about yourself', () => {
    add('Dinner', 90_000, '2026-11-10')
    setStay(group.id, ME_ID, { from: '2026-11-12', to: null })
    renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText(/You joined on 12 Nov but you’re on 1 expense from before\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take me off' })).toBeInTheDocument()
  })
})

describe('PresenceSheet', () => {
  it('saves each person’s days as you go, and “Whole trip” clears them', async () => {
    add('Dinner', 90_000, '2026-11-10')
    add('Lunch', 30_000, '2026-11-13')
    const onClose = vi.fn()
    const { user } = renderAt('/app/groups/x', <PresenceSheet group={liveGroup()} open onClose={onClose} />)
    const sheet = await screen.findByRole('dialog', {
      name: 'Who was there when',
    })
    const from = within(sheet).getByLabelText(/Sam: here from/)
    // Starts at the trip's first day.
    expect(from).toHaveValue('2026-11-10')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(from, { target: { value: '2026-11-12' } })
    expect(presenceStore.get().stays[group.id]).toEqual({
      [sam]: { from: '2026-11-12', to: null },
    })
    await waitFor(() => expect(within(sheet).getByText('From 12 Nov')).toBeInTheDocument())
    // "Until" can't be before "Here from".
    expect(within(sheet).getByLabelText(/Sam: until/)).toHaveAttribute('min', '2026-11-12')
    await user.click(
      within(sheet).getByRole('button', {
        name: 'Sam was there the whole trip',
      }),
    )
    expect(presenceStore.get().stays).toEqual({})
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('NightsCard', () => {
  it('offers to split a stay by nights, saves it with shares that add up, and Undo puts it back', async () => {
    add('Train', 30_000, '2026-11-10', { category: 'travel' })
    add('Dinner', 30_000, '2026-11-13')
    const villa = add('Villa in Anjuna', 100_000, '2026-11-10', {
      category: 'travel',
      payerId: riya,
    })
    const before = find(villa.id)
    setStay(group.id, sam, { from: '2026-11-12', to: null })

    const { user, rerender } = renderAt('/app/expense/x', <NightsCard expense={find(villa.id)} />)
    // Trip 10 to 13 Nov: 3 nights for Ayush and Riya, 1 for Sam.
    expect(screen.getByText('You: 3 nights, ₹428.57')).toBeInTheDocument()
    expect(screen.getByText('Riya: 3 nights, ₹428.57')).toBeInTheDocument()
    expect(screen.getByText('Sam: 1 night, ₹142.86')).toBeInTheDocument()
    expect(screen.getByText(/Nights counted from 10 Nov to 13 Nov/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Split by nights' }))
    const saved = find(villa.id)
    expect(saved.mode).toBe('shares')
    expect(saved.participants.map((p) => p.input)).toEqual([3, 3, 1])
    expect(Object.values(saved.shares).reduce((a, b) => a + b, 0)).toBe(100_000)
    expect(saved.shares[sam]).toBe(14_286)
    // Already split that way: nothing more to offer.
    rerender(
      <ToastProvider>
        <NightsCard expense={saved} />
      </ToastProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Split by nights' })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(find(villa.id)).toEqual(before)
  })

  it('shows nothing for a meal, without stays, or outside a group', () => {
    const dinner = add('Dinner', 90_000, '2026-11-10')
    const villa = add('Villa', 90_000, '2026-11-10', { category: 'travel' })
    add('Lunch', 30_000, '2026-11-13')
    const solo = saveExpense(
      draft({
        title: 'Hotel',
        category: 'travel',
        total: 90_000,
        date: '2026-11-10',
        participants: everyone(ME_ID, riya),
      }),
    )
    const { container, rerender } = renderAt('/app/expense/x', <NightsCard expense={villa} />)
    expect(container).toBeEmptyDOMElement()
    act(() => setStay(group.id, sam, { from: '2026-11-12', to: null }))
    rerender(
      <ToastProvider>
        <NightsCard expense={dinner} />
      </ToastProvider>,
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <ToastProvider>
        <NightsCard expense={solo} />
      </ToastProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
