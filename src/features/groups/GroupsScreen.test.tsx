import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, setGroupArchived, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderApp, resetScreens } from './testKit'

let riya: string
let sam: string

beforeEach(() => {
  resetScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetScreens()
})

describe('GroupsScreen — first visit', () => {
  it('invites the first group, with quick starts', async () => {
    const { user } = renderApp('/app/groups')
    expect(screen.getByRole('heading', { level: 1, name: 'Groups' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Split as a group' })).toBeInTheDocument()
    const quick = screen.getByRole('group', { name: 'Quick start' })
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['✈️Trip', '🏠Home', '💑Couple', '🎉Event'])

    await user.click(within(quick).getByRole('button', { name: 'Home' }))
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    expect(within(sheet).getByRole('button', { name: 'Home', pressed: true })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /^Group icon: 🏠/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('textbox', { name: 'Group name' })).toHaveAttribute('placeholder', 'Flat 302')
  })

  it('goes to your people from the header', async () => {
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: 'Your people' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/friends'))
  })
})

describe('CreateGroupSheet', () => {
  it('creates a group end to end and opens it', async () => {
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: 'Create a group' }))
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    const create = within(sheet).getByRole('button', { name: 'Create group' })
    expect(create).toBeDisabled()
    expect(within(sheet).getByText('Give the group a name to create it.')).toBeInTheDocument()

    await user.type(within(sheet).getByRole('textbox', { name: 'Group name' }), 'Flat 302')
    await user.click(within(sheet).getByRole('button', { name: 'Home' }))
    expect(within(sheet).getByRole('button', { name: /^Group icon: 🏠/ })).toBeInTheDocument()

    // Pick people from your list, and add someone new by typing their name.
    await user.click(within(sheet).getByRole('checkbox', { name: /Riya/ }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Add people to the group' }), 'Neha{Enter}')
    expect(within(sheet).getByText('3 people · INR')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: /^Currency:/ }))
    const currencies = await screen.findByRole('dialog', { name: 'Currency' })
    await user.click(within(currencies).getByRole('button', { name: /US Dollar/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Currency' })).not.toBeInTheDocument())
    expect(within(sheet).getByText('3 people · USD')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Create group' }))
    const [group] = groupsStore.get()
    expect(group).toMatchObject({ name: 'Flat 302', emoji: '🏠', kind: 'home', currency: 'USD' })
    expect(group?.memberIds).toHaveLength(3)
    expect(group?.memberIds.slice(0, 2)).toEqual([ME_ID, riya])
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${group!.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 302' })).toBeInTheDocument()
  })

  it('creates with Enter from the name field', async () => {
    createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID] })
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: 'New group' }))
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Group name' }), 'Goa{Enter}')
    expect(groupsStore.get()[0]).toMatchObject({ name: 'Goa', kind: 'trip', emoji: '✈️', memberIds: [ME_ID] })
  })

  it('keeps an icon picked by hand when the kind changes', async () => {
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: 'Create a group' }))
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    const tile = within(sheet).getByRole('button', { name: /^Group icon: ✈️/ })
    expect(tile).toHaveAttribute('aria-expanded', 'false')
    await user.click(tile)
    expect(tile).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(within(sheet).getByRole('radiogroup', { name: 'Group icon' })).getByRole('radio', { name: '🏕️' }))
    expect(within(sheet).queryByRole('radiogroup', { name: 'Group icon' })).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /^Group icon: 🏕️/ })).toHaveFocus()

    await user.click(within(sheet).getByRole('button', { name: 'Event' }))
    expect(within(sheet).getByRole('button', { name: /^Group icon: 🏕️/ })).toBeInTheDocument()
  })

  it('opens from ?new=1 and drops it once closed', async () => {
    const { user } = renderApp('/app/groups?new=1')
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New group' })).not.toBeInTheDocument())
    await waitFor(() => expect(currentUrl()).toBe('/app/groups'))
    expect(groupsStore.get()).toEqual([])
  })

  it('leaves the list (not the sheet) beneath a group made from ?new=1', async () => {
    window.history.replaceState(null, '', '/app')
    const { user } = renderApp('/app')
    // Home's "New group" quick action pushes /app/groups?new=1.
    const { navigate } = await import('../../app/router')
    navigate('/app/groups?new=1')
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Group name' }), 'Goa{Enter}')
    const group = groupsStore.get()[0]!
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${group.id}`))

    window.history.back()
    await waitFor(() => expect(currentUrl()).toBe('/app/groups'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Groups' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'New group' })).not.toBeInTheDocument()
    window.history.back()
    await waitFor(() => expect(currentUrl()).toBe('/app'))
  })
})

describe('GroupsScreen — with groups', () => {
  it('shows where I stand in each group, and across them', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    const flat = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    createGroup({ name: 'Us', emoji: '💑', kind: 'couple', currency: 'INR', memberIds: [ME_ID] })
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ total: 20000, groupId: flat.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    renderApp('/app/groups')

    const across = screen.getByRole('region', { name: 'Across your groups' })
    expect(within(across).getByText('₹600')).toBeInTheDocument()
    expect(within(across).getByText('₹100')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Goa, Trip · 3 people · ₹900 spent, you’re owed ₹600' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flat, Home · 2 people · ₹200 spent, you owe ₹100' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Us, Couple · Just you, no expenses yet' })).toBeInTheDocument()
  })

  it('mentions money in other currencies separately', () => {
    const nyc = createGroup({ name: 'NYC', emoji: '🗽', kind: 'trip', currency: 'USD', memberIds: [ME_ID, sam] })
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 4000, currency: 'USD', groupId: nyc.id, payerId: sam, participants: everyone(ME_ID, sam) }))
    saveExpense(draft({ total: 1000, groupId: goa.id, with: [riya] }))
    renderApp('/app/groups')
    expect(within(screen.getByRole('region', { name: 'Across your groups' })).getByText('Also USD: owe $20')).toBeInTheDocument()
  })

  it('hides the summary when every group is square', () => {
    createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    renderApp('/app/groups')
    expect(screen.queryByRole('region', { name: 'Across your groups' })).not.toBeInTheDocument()
  })

  it('folds archived groups away', async () => {
    createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    const old = createGroup({ name: 'Old flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, sam] })
    setGroupArchived(old.id, true)
    const { user } = renderApp('/app/groups')
    expect(screen.getByRole('heading', { name: 'Archived (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Old flat/ })).not.toBeInTheDocument()
    const fold = screen.getByRole('button', { name: 'Show archived groups' })
    await user.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Old flat/ })).toBeInTheDocument()
  })

  it('says so when every group is archived', () => {
    const old = createGroup({ name: 'Old flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID] })
    setGroupArchived(old.id, true)
    renderApp('/app/groups')
    expect(screen.getByText('Every group is archived. Start a new one any time.')).toBeInTheDocument()
  })

  it('opens a group', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: /^Goa,/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Goa' })).toBeInTheDocument()
  })
})
