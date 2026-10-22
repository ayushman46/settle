import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, friendsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderApp, resetScreens, type ScreenTable } from '../groups/testKit'
import { FriendDetailScreen } from './FriendDetailScreen'
import { FriendsScreen } from './FriendsScreen'
import { PHONE_ERROR } from './FriendSheet'

const SCREENS: ScreenTable = { '/app/friends': FriendsScreen, '/app/friends/:id': FriendDetailScreen }

// Whole journeys through real screens: give them room on a busy machine.
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
  resetScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetScreens()
})

const people = () => friendsStore.get().filter((f) => f.id !== ME_ID)

describe('FriendsScreen', () => {
  it('invites the first person', async () => {
    const { user } = renderApp('/app/friends', SCREENS)
    expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No people yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a person' }))
    expect(await screen.findByRole('dialog', { name: 'Add a person' })).toBeInTheDocument()
  })

  it('lists everyone A–Z with where I stand', () => {
    addFriend({ name: 'Sam', upiId: 'sam@oksbi' })
    const riya = addFriend({ name: 'riya' }).id
    const neha = addFriend({ name: 'Neha' }).id
    saveExpense(draft({ total: 60000, with: [riya] }))
    saveExpense(draft({ total: 40000, payerId: neha, participants: everyone(ME_ID, neha) }))
    renderApp('/app/friends', SCREENS)
    const list = screen.getByRole('list', { name: 'Your people' })
    const rows = within(list).getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Neha you owe ₹200')
    expect(rows[1]).toHaveTextContent('riya owes you ₹300')
    expect(rows[2]).toHaveTextContent('Sam sam@oksbi')
    expect(screen.getByText('3 people')).toBeInTheDocument()
  })

  it('searches, and offers to add a name that isn’t there', async () => {
    addFriend({ name: 'Riya' })
    addFriend({ name: 'Sam' })
    const { user } = renderApp('/app/friends', SCREENS)
    const search = screen.getByRole('searchbox', { name: 'Search people' })
    await user.type(search, 'ri')
    const results = within(screen.getByRole('list', { name: 'Search results' })).getAllByRole('button')
    expect(results).toHaveLength(2)
    expect(results[0]).toHaveTextContent('Add “ri”')
    expect(results[1]).toHaveTextContent('Riya')

    await user.clear(search)
    await user.type(search, 'Zoya')
    expect(screen.queryByRole('button', { name: /Riya/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Add “Zoya”/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a person' })
    expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveValue('Zoya')
    await user.click(within(sheet).getByRole('button', { name: 'Add person' }))
    expect(people().map((f) => f.name)).toContain('Zoya')
    expect(await screen.findByText('Zoya added')).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveValue(''))
  })

  it('opens a person', async () => {
    const riya = addFriend({ name: 'Riya' }).id
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: /Riya/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/friends/${riya}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Riya' })).toBeInTheDocument()
  })

  it('goes back to You', async () => {
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/you'))
  })
})

describe('FriendSheet', () => {
  it('adds someone with a UPI ID, phone and colour', async () => {
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a person' })
    expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveFocus()
    expect(within(sheet).getByRole('button', { name: 'Add person' })).toBeDisabled()
    await user.type(within(sheet).getByRole('textbox', { name: 'Name' }), 'Riya')
    await user.type(within(sheet).getByRole('textbox', { name: 'UPI ID' }), 'Riya@OkAxis')
    await user.type(within(sheet).getByRole('textbox', { name: 'Phone' }), '+91 98765-43210')
    await user.click(within(sheet).getByRole('radio', { name: 'Lilac' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add person' }))
    expect(people()).toEqual([expect.objectContaining({ name: 'Riya', upiId: 'riya@okaxis', phone: '+919876543210', color: 3 })])
  })

  it('checks the UPI ID and phone, and won’t save a clash', async () => {
    addFriend({ name: 'Sam' })
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a person' })
    const name = within(sheet).getByRole('textbox', { name: 'Name' })
    await user.type(name, 'sam')
    expect(within(sheet).getByText('Sam is already in your people.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Add person' })).toBeDisabled()

    await user.clear(name)
    await user.type(name, 'Riya')
    await user.type(within(sheet).getByRole('textbox', { name: 'UPI ID' }), 'riya')
    await user.type(within(sheet).getByRole('textbox', { name: 'Phone' }), '12')
    await user.click(within(sheet).getByRole('button', { name: 'Add person' }))
    expect(within(sheet).getByText(/doesn’t look like a UPI ID/)).toBeInTheDocument()
    expect(within(sheet).getByText(PHONE_ERROR)).toBeInTheDocument()
    expect(people().map((f) => f.name)).toEqual(['Sam'])
  })

  it('moves through the fields with Enter and saves from the last', async () => {
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a person' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Name' }), 'Neha{Enter}')
    expect(within(sheet).getByRole('textbox', { name: 'UPI ID' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(within(sheet).getByRole('textbox', { name: 'Phone' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(people().map((f) => f.name)).toEqual(['Neha'])
  })

  it('picks colours from the keyboard', async () => {
    const { user } = renderApp('/app/friends', SCREENS)
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a person' })
    const colours = within(sheet).getByRole('radiogroup', { name: 'Avatar colour' })
    within(colours).getByRole('radio', { checked: true }).focus()
    await user.keyboard('{End}')
    expect(within(colours).getByRole('radio', { name: 'Sand' })).toHaveAttribute('aria-checked', 'true')
    expect(within(colours).getByRole('radio', { name: 'Sand' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(within(colours).getByRole('radio', { name: 'Peach' })).toHaveAttribute('aria-checked', 'true')
  })
})
