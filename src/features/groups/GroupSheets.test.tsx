import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { groupsStore, resetDataForTests, updateProfile } from '../../data'
import type { Group } from '../../domain/types'
import { seedGroup, seedPeople } from '../../kit/testPeople'
import { CreateGroupSheet, EditGroupSheet } from './GroupSheets'

// Trip currency is on in these tests (as it ships).
vi.mock('../trip/enabled', () => ({ TRIP_ENABLED: true }))

/** Whole-sheet tests type a lot; give them room on a busy machine. */
const SHEET = { timeout: 30_000 }

beforeEach(() => {
  resetDataForTests()
  seedPeople()
  updateProfile({ currency: 'INR' })
})

afterEach(() => {
  resetDataForTests()
})

function renderCreate() {
  const created: Group[] = []
  function Host() {
    const [open, setOpen] = useState(true)
    return (
      <CreateGroupSheet
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(g) => {
          created.push(g)
          setOpen(false)
        }}
      />
    )
  }
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <Host />
    </ToastProvider>,
  )
  return { user, created }
}

function renderEdit(group: Group) {
  function Host() {
    const [open, setOpen] = useState(true)
    return <EditGroupSheet group={group} open={open} onClose={() => setOpen(false)} section="details" />
  }
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <Host />
    </ToastProvider>,
  )
  return { user }
}

const spendingRow = (name: RegExp) => screen.getByRole('button', { name })

describe('CreateGroupSheet — Spending in', SHEET, () => {
  it('offers “Spending in” on a trip and saves the pick as the trip currency', async () => {
    const { user, created } = renderCreate()
    const sheet = await screen.findByRole('dialog', { name: 'New group' })
    expect(within(sheet).getByText('Each expense is converted to ₹ at that day’s rate.')).toBeInTheDocument()
    await user.click(spendingRow(/^Spending in: Same as the group \(₹\)\. Change$/))

    const picker = await screen.findByRole('dialog', { name: 'Spending in' })
    expect(
      within(picker).getByText(
        'Pick the currency you’ll pay in on this trip. Expenses are converted to ₹ (the group’s currency) at that day’s rate — balances stay in ₹.',
      ),
    ).toBeInTheDocument()
    const options = within(picker).getAllByRole('button').filter((b) => b.closest('ul'))
    expect(options[0]).toHaveTextContent('Same as the group (₹)')
    expect(within(picker).queryByRole('button', { name: /Indian Rupee/ })).not.toBeInTheDocument()
    await user.click(within(picker).getByRole('button', { name: /Thai Baht/ }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spending in' })).not.toBeInTheDocument())
    expect(spendingRow(/^Spending in: Thai baht · THB\. Change$/)).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Group name'), 'Bangkok')
    await user.click(within(sheet).getByRole('button', { name: 'Create group' }))
    expect(created[0]).toMatchObject({ name: 'Bangkok', kind: 'trip', currency: 'INR', travelCurrency: 'THB' })
  })

  it('turns it off again with “Same as the group”', async () => {
    const { user, created } = renderCreate()
    await user.click(spendingRow(/^Spending in:/))
    await user.click(within(await screen.findByRole('dialog', { name: 'Spending in' })).getByRole('button', { name: /Thai Baht/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spending in' })).not.toBeInTheDocument())
    await user.click(spendingRow(/^Spending in: Thai baht/))
    await user.click(within(await screen.findByRole('dialog', { name: 'Spending in' })).getByRole('button', { name: /Same as the group/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spending in' })).not.toBeInTheDocument())
    await user.type(screen.getByLabelText('Group name'), 'Goa')
    await user.click(screen.getByRole('button', { name: 'Create group' }))
    expect(created[0]?.travelCurrency).toBeNull()
  })

  it('leaves it out for groups that aren’t trips', async () => {
    const { user } = renderCreate()
    await user.click(screen.getByRole('button', { name: /Home/ }))
    expect(screen.queryByRole('button', { name: /^Spending in:/ })).not.toBeInTheDocument()
  })
})

describe('EditGroupSheet — Spending in', SHEET, () => {
  it('shows a trip’s currency and clears it', async () => {
    const group = seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    const { user } = renderEdit(group)
    await user.click(await screen.findByRole('button', { name: /^Spending in: Thai baht · THB\. Change$/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Spending in' })).getByRole('button', { name: /Same as the group/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spending in' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(groupsStore.get().find((g) => g.id === group.id)?.travelCurrency).toBeNull()
  })

  it('keeps it under “More” for other groups', async () => {
    const group = seedGroup({ name: 'Flat 4B', kind: 'home' })
    const { user } = renderEdit(group)
    expect(screen.queryByRole('button', { name: /^Spending in:/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'More group settings' }))
    await user.click(screen.getByRole('button', { name: /^Spending in: Same as the group/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Spending in' })).getByRole('button', { name: /US Dollar/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spending in' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(groupsStore.get().find((g) => g.id === group.id)).toMatchObject({ kind: 'home', currency: 'INR', travelCurrency: 'USD' })
  })
})
