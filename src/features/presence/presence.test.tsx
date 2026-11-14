import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { ToastProvider } from '../../components'
import { renderAt, resetProScreens } from '../pro/testing'
import { splitByNights } from './actions'
import { nightsPlan } from './engine'
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
    // Names what it will change before the tap.
    expect(screen.getByText('Take Sam off Shopping (₹300), Cab (₹600.01) and Dinner (₹900)? The people who were there share them instead.')).toBeInTheDocument()
    expect(screen.getByText(/On Shopping, that part is spread over the others/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Take Sam off' }))
    const d = find(dinner.id)
    const c = find(cab.id)
    expect(d.participants.map((p) => p.friendId)).toEqual([ME_ID, riya])
    expect(d.shares).toEqual({ [ME_ID]: 45_000, [riya]: 45_000 })
    expect(c.payerId).toBe(sam)
    expect(Object.values(c.shares).reduce((a, b) => a + b, 0)).toBe(60_001)
    expect(c.shares[sam]).toBeUndefined()
    expect(find(lunch.id).participants).toHaveLength(3)
    // The exact split: Sam's ₹100 spread over the others in proportion, still ₹300 in all.
    expect(find(shopping.id).participants).toEqual([
      { friendId: ME_ID, input: 15_000 },
      { friendId: riya, input: 15_000 },
    ])
    expect(find(shopping.id).shares).toEqual({ [ME_ID]: 15_000, [riya]: 15_000 })
    expect(screen.queryByRole('button', { name: 'Take Sam off' })).not.toBeInTheDocument()

    expect(await screen.findByText('Took Sam off Shopping (₹300), Cab (₹600.01) and Dinner (₹900)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(find(dinner.id)).toEqual(before.dinner)
    expect(find(cab.id)).toEqual(before.cab)
    expect(find(dinner.id).paidBack).toEqual({ [riya]: 123 })
  })

  it('never takes anyone off a stay: points to Split by nights instead, and leaves a stay split by nights alone', async () => {
    // p10: the villa is dated on the first night; Sam came on the 12th and slept there 2 nights.
    const villa = add('Villa', 1_200_000, '2026-11-10', { category: 'other', payerId: riya })
    const breakfast = add('Breakfast', 60_000, '2026-11-11')
    add('Brunch', 30_000, '2026-11-14')
    setStay(group.id, sam, { from: '2026-11-12', to: null })
    const { user } = renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText(/Sam joined on 12 Nov but is on 1 expense from before\./)).toBeInTheDocument()
    expect(screen.getByText(/^Take Sam off Breakfast \(₹600\)\?/)).toBeInTheDocument()
    expect(screen.getByText(/Split this stay by nights instead, so Sam pays only for the nights they were there/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Villa (₹12,000)' })).toHaveAttribute('href', `/app/expense/${villa.id}`)

    await user.click(screen.getByRole('button', { name: 'Take Sam off' }))
    expect(find(villa.id).participants).toHaveLength(3)
    expect(find(villa.id).mode).toBe('equal')
    expect(find(breakfast.id).participants).toHaveLength(2)
    // Only the stay is left, under its own words.
    expect(screen.getByText('Sam wasn’t there every night.')).toBeInTheDocument()

    // Split by nights: then Take off has nothing to change and the banner goes.
    const plan = nightsPlan(find(villa.id), liveGroup(), expensesStore.get(), presenceStore.get().stays[group.id] ?? {})!
    act(() => {
      splitByNights(find(villa.id), plan.participants, plan.range)
    })
    expect(find(villa.id).participants.map((p) => p.input)).toEqual([2, 2, 1])
    expect(screen.queryByText('Sam wasn’t there every night.')).not.toBeInTheDocument()
    // A later expense doesn't bring it back or move its nights.
    act(() => {
      add('Dinner', 30_000, '2026-11-16')
    })
    expect(screen.queryByText(/Villa/)).not.toBeInTheDocument()
    expect(find(villa.id).shares[sam]).toBe(240_000)
  })

  it('a percent split is one tap too: their part spread over the others in proportion, adding up to the paisa', async () => {
    const fireworks = add('Fireworks', 100_000, '2026-11-11', {
      mode: 'percent',
      participants: [
        { friendId: ME_ID, input: 4500 },
        { friendId: riya, input: 4500 },
        { friendId: sam, input: 1000 },
      ],
    })
    setStay(group.id, sam, { from: '2026-11-12', to: null })
    const { user } = renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText('On Fireworks, that part is spread over the others in proportion to what they already pay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Take Sam off' }))
    const f = find(fireworks.id)
    expect(f.mode).toBe('percent')
    expect(f.participants).toEqual([
      { friendId: ME_ID, input: 5000 },
      { friendId: riya, input: 5000 },
    ])
    expect(f.shares).toEqual({ [ME_ID]: 50_000, [riya]: 50_000 })
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(find(fireworks.id).shares[sam]).toBe(10_000)
  })

  it('what needs a person says what to do, and its button says it leaves them as they are', () => {
    const dinner = add('Dinner', 90_000, '2026-11-10')
    expensesStore.set(expensesStore.get().map((e) => (e.id === dinner.id ? { ...e, paidBack: { [sam]: 5 } } : e)))
    setStay(group.id, sam, { from: '2026-11-12', to: null })
    renderAt('/app/groups/x', <PresenceBanner group={liveGroup()} />)
    expect(screen.getByText('(already paid back, so open it and change who’s on it)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave them as they are' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take Sam off' })).not.toBeInTheDocument()
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

  it('speaks to you in your own grammar, says how nights count, and shows a set stay’s nights', async () => {
    add('Dinner', 90_000, '2026-11-10')
    setStay(group.id, riya, { from: '2026-11-10', to: '2026-11-13' })
    renderAt('/app/groups/x', <PresenceSheet group={liveGroup()} open onClose={() => {}} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who was there when' })
    expect(within(sheet).getByRole('button', { name: 'You were there the whole trip' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /You was there/ })).not.toBeInTheDocument()
    expect(within(sheet).getByText('10 Nov to 13 Nov, 3 nights')).toBeInTheDocument()
    expect(within(sheet).getByText(/the day they leave isn’t one: from 10 Nov until 13 Nov is 3 nights/)).toBeInTheDocument()
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
    expect(screen.getByText(/The last day isn’t a night/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Split by nights' }))
    // The range is remembered, so a later expense can't move these nights.
    expect(presenceStore.get().anchors).toEqual({ [villa.id]: { from: '2026-11-10', to: '2026-11-13' } })
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
    expect(presenceStore.get().anchors).toBeUndefined()
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
