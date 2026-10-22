import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  groupsStore,
  recordSettlement,
  saveExpense,
  updateProfile,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { fullDateLabel } from '../../kit/index-a'
import type * as ShareKit from '../../share'
import { currentUrl, renderApp, resetScreens } from './testKit'

const mocks = vi.hoisted(() => ({
  renderGroupCard: vi.fn<(input: unknown, opts: unknown) => Promise<Blob>>(),
}))

vi.mock('../../share', async (importOriginal) => ({
  ...(await importOriginal<typeof ShareKit>()),
  renderGroupCard: mocks.renderGroupCard,
}))

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
  mocks.renderGroupCard.mockReset().mockRejectedValue(new Error('no canvas here'))
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis' }).id
  sam = addFriend({ name: 'Sam' }).id
  goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetScreens()
})

const path = () => `/app/groups/${goa.id}`
const group = () => groupsStore.get().find((g) => g.id === goa.id)

/** Villa (I paid ₹900 for three) today, lunch (Riya paid ₹300 for three) yesterday. */
function seedTrip() {
  const villa = saveExpense(draft({ title: 'Villa', category: 'travel', total: 90000, date: '2026-10-22', groupId: goa.id, with: [riya, sam] }))
  const lunch = saveExpense(
    draft({ title: 'Lunch', category: 'food', total: 30000, date: '2026-10-21', groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya, sam) }),
  )
  return { villa, lunch }
}

describe('GroupDetailScreen — header and standing', () => {
  it('shows the group, its people and where I stand', async () => {
    seedTrip()
    const { user } = renderApp(path())
    expect(screen.getByRole('heading', { level: 1, name: 'Goa' })).toBeInTheDocument()
    expect(screen.getByText('Trip · 3 people')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Members: You, Riya, Sam. Manage members' })).toBeInTheDocument()

    const standing = screen.getByRole('region', { name: 'You’re owed' })
    expect(within(standing).getByText('₹500')).toBeInTheDocument()
    expect(within(standing).getByText('₹1,200 spent · 2 expenses')).toBeInTheDocument()
    await user.click(within(standing).getByRole('button', { name: 'Settle up: 2 payments' }))
    await waitFor(() => expect(currentUrl()).toBe(`${path()}/settle`))
  })

  it('invites the first expense in a new group', async () => {
    const { user } = renderApp(path())
    const standing = screen.getByRole('region', { name: 'Nothing spent yet' })
    expect(within(standing).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No expenses yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add the first expense' }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/new?group=${goa.id}`))
  })

  it('adds an expense from the floating button', async () => {
    seedTrip()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/new?group=${goa.id}`))
  })

  it('offers the summary once everyone is square', () => {
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    recordSettlement(goa.id, { fromId: riya, toId: ME_ID, amount: 30000, date: '2026-10-22', method: 'upi' })
    recordSettlement(goa.id, { fromId: sam, toId: ME_ID, amount: 30000, date: '2026-10-22', method: 'cash' })
    renderApp(path())
    const standing = screen.getByRole('region', { name: 'You’re all square' })
    expect(within(standing).getByRole('button', { name: 'Share summary' })).toBeInTheDocument()
  })

  it('says when I am square but others still owe each other', () => {
    saveExpense(draft({ total: 20000, groupId: goa.id, payerId: riya, participants: everyone(riya, sam) }))
    renderApp(path())
    const standing = screen.getByRole('region', { name: 'You’re all square' })
    expect(within(standing).getByText(/others still settling/)).toBeInTheDocument()
    expect(within(standing).getByRole('button', { name: 'Settle up: 1 payment' })).toBeInTheDocument()
  })

  it('says so when the group is gone', async () => {
    const { user } = renderApp('/app/groups/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'This group is gone' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See your groups' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/groups'))
  })
})

describe('GroupDetailScreen — expenses', () => {
  it('lists expenses and payments by day', async () => {
    const { villa } = seedTrip()
    recordSettlement(goa.id, { fromId: sam, toId: ME_ID, amount: 20000, date: '2026-10-22', method: 'upi' })
    const { user } = renderApp(path())
    const panel = screen.getByRole('region', { name: 'Expenses' })
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Today', 'Yesterday'])
    expect(within(panel).getByRole('button', { name: 'Sam paid you ₹200, UPI payment' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /^Lunch, Riya paid ₹300 · 3 people/ })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /^Villa,/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/expense/${villa.id}`))
  })

  it('removes a payment recorded by mistake, with an undo', async () => {
    seedTrip()
    recordSettlement(goa.id, { fromId: sam, toId: ME_ID, amount: 20000, date: '2026-10-22', method: 'cash' })
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Sam paid you ₹200, Cash payment' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sam paid you' })
    expect(within(sheet).getByText('Cash')).toBeInTheDocument()
    expect(within(sheet).getByText(fullDateLabel('2026-10-22'))).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Remove payment' }))
    expect(group()?.settlements).toEqual([])
    await waitFor(() => expect(screen.queryByRole('button', { name: /Sam paid you/ })).not.toBeInTheDocument())

    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(group()?.settlements).toEqual([expect.objectContaining({ fromId: sam, toId: ME_ID, amount: 20000, method: 'cash', date: '2026-10-22' })])
  })
})

describe('GroupDetailScreen — balances and totals', () => {
  it('shows everyone’s balance and the way to settle', async () => {
    seedTrip()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('radio', { name: 'Balances' }))
    const list = screen.getByRole('list', { name: 'Balances' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent(/You get back \+₹500$/)
    expect(rows[1]).toHaveTextContent(/Riya owes .₹100$/)
    expect(rows[2]).toHaveTextContent(/Sam owes .₹400$/)
    await user.click(screen.getByRole('button', { name: /^Settle up · 2 payments/ }))
    await waitFor(() => expect(currentUrl()).toBe(`${path()}/settle`))
  })

  it('opens on a tab from the address', () => {
    seedTrip()
    renderApp(`${path()}?tab=balances`)
    expect(screen.getByRole('radio', { name: 'Balances' })).toBeChecked()
    expect(screen.getByRole('region', { name: 'Balances' })).toBeInTheDocument()
  })

  it('keeps someone who left but is still owed in the balances', () => {
    saveExpense(draft({ total: 30000, groupId: goa.id, with: [riya, sam] }))
    groupsStore.update((list) => list.map((g) => (g.id === goa.id ? { ...g, memberIds: [ME_ID, riya] } : g)))
    renderApp(`${path()}?tab=balances`)
    expect(screen.getByText('owes · left the group')).toBeInTheDocument()
  })

  it('breaks the spend down by category and by person', async () => {
    seedTrip()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('radio', { name: 'Totals' }))
    const legend = screen.getByRole('list', { name: 'Spending by category' })
    expect(within(legend).getAllByRole('button').map((b) => b.textContent)).toEqual(['Travel & stays₹90075%', 'Food & drinks₹30025%'])
    const people = screen.getByRole('region', { name: 'By person' })
    expect(within(people).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('You₹400Share ₹400, Paid ₹900'),
      expect.stringContaining('Riya₹400Share ₹400, Paid ₹300'),
      expect.stringContaining('Sam₹400Share ₹400, Paid ₹0'),
    ])
  })

  it('notes expenses in other currencies, and waits for the first expense', async () => {
    const { user } = renderApp(path())
    await user.click(screen.getByRole('radio', { name: 'Totals' }))
    expect(screen.getByRole('heading', { name: 'Totals appear here' })).toBeInTheDocument()

    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ total: 5000, currency: 'USD', groupId: goa.id, with: [riya] }))
    expect(await screen.findByText('Plus 1 expense in another currency, settled person to person.')).toBeInTheDocument()
  })
})

describe('GroupDetailScreen — options', () => {
  it('edits the group’s details', async () => {
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Group options' })).getByRole('button', { name: /^Edit group/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit group' })
    const name = within(sheet).getByRole('textbox', { name: 'Group name' })
    await user.clear(name)
    expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(name, 'Goa 2026')
    await user.click(within(sheet).getByRole('button', { name: 'Couple' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(group()).toMatchObject({ name: 'Goa 2026', kind: 'couple', emoji: '🏖️' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Goa 2026' })).toBeInTheDocument()
    expect(await screen.findByText('Group updated')).toBeInTheDocument()
  })

  it('warns that a new currency relabels the amounts', async () => {
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Group options' })).getByRole('button', { name: /^Edit group/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit group' })
    await user.click(within(sheet).getByRole('button', { name: /^Currency:/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Currency' })).getByRole('button', { name: /Euro/ }))
    expect(within(sheet).getByText('Amounts keep their numbers — only the currency changes.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(group()?.currency).toBe('EUR')
    expect(expensesStore.get()[0]).toMatchObject({ currency: 'EUR', total: 90000 })
  })

  it('manages members, keeping anyone still owed', async () => {
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    const neha = addFriend({ name: 'Neha' }).id
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: /^Members:/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Members' })
    await user.click(within(sheet).getByRole('button', { name: 'Remove Sam' }))
    await user.click(within(sheet).getByRole('checkbox', { name: /Neha/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(group()?.memberIds).toEqual([ME_ID, riya, neha, sam])
    expect(await screen.findByText('Sam stays in until they’re settled up')).toBeInTheDocument()
  })

  it('archives and unarchives', async () => {
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Group options' })).getByRole('button', { name: /^Archive/ }))
    expect(group()?.archived).toBe(true)
    expect(await screen.findByText('It’s tucked away from your groups list. Everything is still here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unarchive' }))
    expect(group()?.archived).toBe(false)
    expect(await screen.findByRole('button', { name: 'Add expense' })).toBeInTheDocument()
  })

  it('deletes the group with its expenses, with an undo', async () => {
    seedTrip()
    window.history.replaceState(null, '', '/app/groups')
    const { user } = renderApp('/app/groups')
    await user.click(screen.getByRole('button', { name: /^Goa,/ }))
    await screen.findByRole('heading', { level: 1, name: 'Goa' })
    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Group options' })).getByRole('button', { name: /^Delete group/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Goa?' })
    expect(within(confirm).getByText('Its 2 expenses go too. You can undo straight after.')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Delete group' }))

    expect(groupsStore.get()).toEqual([])
    expect(expensesStore.get()).toEqual([])
    await waitFor(() => expect(currentUrl()).toBe('/app/groups'))
    await user.click(await screen.findByRole('button', { name: /^Undo: Goa deleted with 2 expenses/ }))
    expect(groupsStore.get()).toHaveLength(1)
    expect(expensesStore.get()).toHaveLength(2)
    expect(await screen.findByRole('button', { name: /^Goa,/ })).toBeInTheDocument()
  })

  it('keeps the group when deleting is cancelled', async () => {
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Group options' })).getByRole('button', { name: /^Delete group/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete Goa?' })).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete Goa?' })).not.toBeInTheDocument())
    expect(groupsStore.get()).toHaveLength(1)
  })

  it('shares a summary of who pays whom', async () => {
    seedTrip()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Share group summary' }))
    const sheet = await screen.findByRole('dialog', { name: 'Share group summary' })
    expect(within(sheet).getByText('2 payments square everyone up.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Copy text' }))
    const text = await navigator.clipboard.readText()
    expect(text).toContain('🏖️ Goa\n₹1,200 spent · 2 expenses · 3 people')
    expect(text).toContain('Sam pays Ayush ₹400')
  })
})
