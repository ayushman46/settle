import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  friendsStore,
  groupsStore,
  saveExpense,
  saveRecurring,
  updateProfile,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, GROUP_SCREENS, renderApp, resetScreens, type ScreenTable } from '../groups/testKit'
import { FriendDetailScreen } from './FriendDetailScreen'
import { FriendsScreen } from './FriendsScreen'

const SCREENS: ScreenTable = { ...GROUP_SCREENS, '/app/friends': FriendsScreen, '/app/friends/:id': FriendDetailScreen }
const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string
let sam: string

beforeEach(() => {
  resetScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okaxis' })
  riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis', phone: '+919876543210' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetScreens()
})

const open = (id: string) => renderApp(`/app/friends/${id}`, SCREENS)
const paidBack = (expenseId: string, who: string) => expensesStore.get().find((e) => e.id === expenseId)?.paidBack[who]

describe('FriendDetailScreen — who they are', () => {
  it('shows their name, UPI ID and phone', async () => {
    const { user } = open(riya)
    expect(screen.getByRole('heading', { level: 1, name: 'Riya' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call Riya on +919876543210' })).toHaveAttribute('href', 'tel:+919876543210')
    await user.click(screen.getByRole('button', { name: 'UPI ID riya@okaxis. Copy' }))
    expect(await navigator.clipboard.readText()).toBe('riya@okaxis')
    expect(await screen.findByText('UPI ID copied')).toBeInTheDocument()
  })

  it('asks for a missing UPI ID, and edits them', async () => {
    const { user } = open(sam)
    await user.click(screen.getByRole('button', { name: 'Add UPI ID' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit Sam' })
    const name = within(sheet).getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Samir')
    await user.type(within(sheet).getByRole('textbox', { name: 'UPI ID' }), 'samir@oksbi')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(friendsStore.get().find((f) => f.id === sam)).toMatchObject({ name: 'Samir', upiId: 'samir@oksbi' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Samir' })).toBeInTheDocument()
  })

  it('splits something new with them', async () => {
    const { user } = open(riya)
    await user.click(screen.getByRole('button', { name: 'Split with Riya' }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/new?friend=${riya}`))
  })

  it('sends you to your own page for yourself', async () => {
    open(ME_ID)
    await waitFor(() => expect(currentUrl()).toBe('/app/you'))
  })

  it('says so when they’ve been removed', async () => {
    const { user } = open('gone')
    expect(screen.getByRole('heading', { level: 1, name: 'This person isn’t here' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See your people' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/friends'))
  })
})

describe('FriendDetailScreen — where you stand', () => {
  it('is calm when you’re square', () => {
    open(riya)
    const card = screen.getByRole('region', { name: 'You and Riya are square' })
    expect(within(card).getByText('Nothing to settle — nice.')).toBeInTheDocument()
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing split yet' })).toBeInTheDocument()
  })

  it('totals what they owe, says where from, and reminds them', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    saveExpense(draft({ title: 'Villa', total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ title: 'Dinner', total: 40000, with: [riya] }))
    saveExpense(draft({ title: 'Cab', total: 6000, currency: 'USD', with: [riya] }))
    const { user } = open(riya)

    const card = screen.getByRole('region', { name: 'Riya owes you' })
    expect(within(card).getByText('₹500')).toBeInTheDocument()
    expect(within(card).getByText('Also owes you $30')).toBeInTheDocument()

    const sources = screen.getByRole('region', { name: 'Where it’s from' })
    const rows = within(sources).getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('1 split outside groups Riya pays you ₹200')
    expect(rows[1]).toHaveTextContent('Goa Riya pays you ₹300')
    expect(rows[2]).toHaveTextContent('1 split outside groups Riya pays you $30')

    await user.click(within(card).getByRole('button', { name: 'Remind' }))
    const nudge = await screen.findByRole('dialog', { name: 'Nudge Riya' })
    expect(nudge).toHaveTextContent('₹500')
    expect(nudge).toHaveTextContent('our splits')
  })

  it('opens the group’s settle up from where it’s from', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya] }))
    const { user } = open(riya)
    await user.click(within(screen.getByRole('region', { name: 'Where it’s from' })).getByRole('button', { name: /Goa/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}/settle`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settle up' })).toBeInTheDocument()
  })

  it('pays them by UPI and settles everything in rupees', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 60000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    const cab = saveExpense(draft({ title: 'Cab', total: 20000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const { user } = open(riya)
    const card = screen.getByRole('region', { name: 'You owe Riya' })
    expect(within(card).getByText('₹400')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Pay via UPI' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay Riya' })
    expect(sheet).toHaveTextContent('riya@okaxis')
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))

    expect(paidBack(cab.id, ME_ID)).toBeTypeOf('number')
    expect(groupsStore.get()[0]?.settlements).toEqual([expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 30000, method: 'upi' })])
    const burst = await screen.findByRole('dialog', { name: 'All square with Riya' })
    await user.click(burst)
    expect(await screen.findByRole('region', { name: 'You and Riya are square' })).toBeInTheDocument()
  })
})

describe('FriendDetailScreen — settle up sheet', () => {
  it('ticks off splits outside groups, with an undo', async () => {
    const dinner = saveExpense(draft({ title: 'Dinner', total: 40000, with: [riya] }))
    const { user } = open(riya)
    await user.click(within(screen.getByRole('region', { name: 'Riya owes you' })).getByRole('button', { name: 'Settle up' }))
    const sheet = await screen.findByRole('dialog', { name: 'Settle up with Riya' })
    expect(within(sheet).getByText('Riya owes you ₹200 in all.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark as settled' }))
    expect(paidBack(dinner.id, riya)).toBeTypeOf('number')
    expect(await screen.findByRole('region', { name: 'You and Riya are square' })).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /^Undo: 1 split marked as settled/ }))
    expect(paidBack(dinner.id, riya)).toBeUndefined()
    expect(await screen.findByRole('region', { name: 'Riya owes you' })).toBeInTheDocument()
  })

  it('settles everything at once', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 60000, groupId: goa.id, with: [riya] }))
    const dinner = saveExpense(draft({ title: 'Dinner', total: 40000, with: [riya] }))
    const { user } = open(riya)
    await user.click(screen.getByRole('button', { name: 'Settle up' }))
    const sheet = await screen.findByRole('dialog', { name: 'Settle up with Riya' })
    expect(within(sheet).getByRole('button', { name: 'Settle up in Goa' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Settle everything' }))

    expect(paidBack(dinner.id, riya)).toBeTypeOf('number')
    expect(groupsStore.get()[0]?.settlements).toEqual([expect.objectContaining({ fromId: riya, toId: ME_ID, amount: 30000, method: 'other' })])
    await user.click(await screen.findByRole('dialog', { name: 'All square with Riya' }))
    await user.click(await screen.findByRole('button', { name: /^Undo: All square with Riya/ }))
    expect(paidBack(dinner.id, riya)).toBeUndefined()
    expect(groupsStore.get()[0]?.settlements).toEqual([])
  })
})

describe('FriendDetailScreen — together', () => {
  it('lists the groups you share', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, sam] })
    const { user } = open(riya)
    const groups = screen.getByRole('region', { name: 'Groups together' })
    expect(within(groups).getAllByRole('button').map((b) => b.textContent)).toEqual(['🏖️Goa'])
    await user.click(within(groups).getByRole('button', { name: /Goa/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}`))
  })

  it('lists expenses together, ten at a time', async () => {
    for (let day = 1; day <= 12; day++) {
      saveExpense(draft({ title: `Chai ${day}`, total: 2000, date: `2026-10-${String(day).padStart(2, '0')}`, with: [riya] }))
    }
    saveExpense(draft({ title: 'Not with Riya', total: 2000, with: [sam] }))
    const { user } = open(riya)
    const section = screen.getByRole('region', { name: 'Expenses with Riya' })
    expect(within(section).getAllByRole('listitem')).toHaveLength(10)
    expect(within(section).getAllByRole('button')[0]).toHaveAccessibleName(/^Chai 12,/)
    await user.click(within(section).getByRole('button', { name: 'Show all 12' }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(section).getByRole('button', { name: 'Show fewer' }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(10)

    await user.click(within(section).getByRole('button', { name: /^Chai 12,/ }))
    await waitFor(() => expect(currentUrl()).toMatch(/^\/app\/expense\//))
  })
})

describe('FriendDetailScreen — removing', () => {
  it('removes someone with nothing to settle', async () => {
    window.history.replaceState(null, '', '/app/friends')
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: /Sam/ }))
    await screen.findByRole('heading', { level: 1, name: 'Sam' })
    await user.click(screen.getByRole('button', { name: 'Remove from your people' }))
    const sheet = await screen.findByRole('dialog', { name: 'Remove Sam?' })
    await user.click(within(sheet).getByRole('button', { name: 'Remove Sam' }))
    expect(friendsStore.get().some((f) => f.id === sam)).toBe(false)
    await waitFor(() => expect(currentUrl()).toBe('/app/friends'))
    expect(await screen.findByText('Sam removed from your people')).toBeInTheDocument()
  })

  it('explains why someone can’t be removed yet', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 60000, groupId: goa.id, with: [riya] }))
    saveRecurring({
      title: 'Rent',
      category: 'rent',
      currency: 'INR',
      total: 3000000,
      payerId: ME_ID,
      mode: 'equal',
      participants: everyone(ME_ID, riya),
      dayOfMonth: 5,
      groupId: null,
      active: true,
    })
    const { user } = open(riya)
    await user.click(screen.getByRole('button', { name: 'Remove from your people' }))
    const sheet = await screen.findByRole('dialog', { name: 'Riya can’t be removed yet' })
    expect(sheet).toHaveTextContent('Riya still has money to settle in Goa. Riya is in your recurring split “Rent”. Settle up first, then they can go.')
    await user.click(within(sheet).getByRole('button', { name: 'Settle up' }))
    expect(await screen.findByRole('dialog', { name: 'Settle up with Riya' })).toBeInTheDocument()
    expect(friendsStore.get().some((f) => f.id === riya)).toBe(true)
  })
})
