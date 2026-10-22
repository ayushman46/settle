import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expensesStore, setSplitPrefill } from '../../data'
import { ME_ID, type BillSnapshot } from '../../domain/types'
import { EMPTY_META } from '../../types'
import { takeBillStart } from '../bill/launch'
import { SPLIT_DRAFT_KEY } from './splitDraft'
import { currentUrl, renderApp, resetSplitScreens, seedExpense, seedGroup, seedPeople } from './testing'

const OCT_22 = new Date(2026, 9, 22, 12)

beforeEach(() => {
  resetSplitScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  seedPeople()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetSplitScreens()
})

const saveButton = () => screen.getByRole('button', { name: /^Save (split|changes)$/ })
const amountField = () => screen.getByLabelText('Amount')

async function pickPerson(user: UserEvent, name: string): Promise<void> {
  await user.type(screen.getByRole('textbox', { name: 'Search or add people' }), `${name}{Enter}`)
}

const BILL: BillSnapshot = {
  meta: { ...EMPTY_META, merchant: 'Toit', tax: 5_000 },
  items: [
    { id: 'i1', name: 'Pizza', quantity: 1, amount: 60_000 },
    { id: 'i2', name: 'Beer', quantity: 2, amount: 40_000 },
  ],
  assignments: { i1: { [ME_ID]: 1, riya: 1 }, i2: { riya: 1 } },
  warnings: [],
}

describe('NewSplitScreen — a new split', () => {
  it('splits an amount end to end, celebrates, then opens it', async () => {
    const { user } = renderApp('/app/split/new')
    expect(screen.getByRole('heading', { level: 1, name: 'New split' })).toBeInTheDocument()
    expect(amountField()).toHaveFocus()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText('Enter an amount above zero.')).toBeInTheDocument()

    await user.type(amountField(), '2400')
    await user.type(screen.getByLabelText("What's it for?"), 'Dinner at Toit')
    expect(screen.getByRole('radio', { name: /Food & drinks/ })).toHaveAttribute('aria-checked', 'true')
    await pickPerson(user, 'Riya')
    await pickPerson(user, 'Sam')
    expect(screen.getByText('Riya and Sam will owe you ₹800 each')).toBeInTheDocument()

    await user.click(saveButton())
    const burst = await screen.findByRole('dialog', { name: 'Split saved' })
    expect(within(burst).getByText('Riya and Sam owe you ₹800 each')).toBeInTheDocument()
    const [saved] = expensesStore.get()
    expect(saved).toMatchObject({
      kind: 'split',
      title: 'Dinner at Toit',
      category: 'food',
      currency: 'INR',
      total: 240_000,
      date: '2026-10-22',
      payerId: ME_ID,
      mode: 'equal',
      shares: { [ME_ID]: 80_000, riya: 80_000, sam: 80_000 },
      source: 'manual',
      groupId: null,
      note: null,
    })

    await user.click(burst)
    await waitFor(() => expect(currentUrl()).toBe(`/app/expense/${saved!.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dinner at Toit' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SPLIT_DRAFT_KEY)).toBeNull()
  }, 20_000)

  it('keeps Save off with the exact reason until the amounts add up', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '1000')
    await pickPerson(user, 'Riya')
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    await user.type(screen.getByLabelText('Amount for you'), '300')
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText("The amounts don't add up to the total yet.")).toBeInTheDocument()
    await user.type(screen.getByLabelText('Amount for Riya'), '700')
    expect(saveButton()).toBeEnabled()
    expect(screen.getByText('Riya will owe you ₹700')).toBeInTheDocument()
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({
      mode: 'exact',
      participants: [
        { friendId: ME_ID, input: 30_000 },
        { friendId: 'riya', input: 70_000 },
      ],
      shares: { [ME_ID]: 30_000, riya: 70_000 },
    })
  })

  it('records who paid', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '1000')
    await pickPerson(user, 'Riya')
    await user.click(screen.getByRole('button', { name: /Paid by/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Who paid?' })
    await user.click(within(sheet).getByRole('radio', { name: /Riya/ }))
    expect(await screen.findByText('You’ll owe Riya ₹500')).toBeInTheDocument()
    await user.click(saveButton())
    expect(expensesStore.get()[0]?.payerId).toBe('riya')
  })

  it('lets the payer round everyone else to whole rupees', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '1000')
    await pickPerson(user, 'Riya')
    await pickPerson(user, 'Sam')
    await user.click(screen.getByRole('switch', { name: /Round to whole ₹/ }))
    expect(screen.getByText('Riya and Sam will owe you ₹333 each')).toBeInTheDocument()
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({
      roundedToWhole: true,
      shares: { [ME_ID]: 33_400, riya: 33_300, sam: 33_300 },
    })
  })

  it('follows the title for the category until one is picked', async () => {
    const { user } = renderApp('/app/split/new')
    const title = screen.getByLabelText("What's it for?")
    await user.type(title, 'Uber')
    expect(screen.getByRole('radio', { name: /Transport/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: /Groceries/ }))
    await user.type(title, ' to Blinkit')
    expect(screen.getByRole('radio', { name: /Groceries/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('moves on to who’s in when Enter is pressed in the title', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(screen.getByLabelText("What's it for?"), 'Snacks{Enter}')
    expect(screen.getByRole('textbox', { name: 'Search or add people' })).toHaveFocus()
  })

  it('keeps a note with its line breaks', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '500')
    await user.type(screen.getByLabelText('Note'), 'Flat 4B{Enter}Paid in cash')
    await user.click(saveButton())
    expect(expensesStore.get()[0]?.note).toBe('Flat 4B\nPaid in cash')
  })

  it('changes the currency, keeping the number, with an undo', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '2400')
    await user.click(screen.getByRole('button', { name: 'Currency: INR. Change' }))
    const sheet = await screen.findByRole('dialog', { name: 'Currency' })
    await user.click(within(sheet).getByRole('button', { name: /US Dollar/ }))
    expect(await screen.findByRole('button', { name: 'Currency: USD. Change' })).toBeInTheDocument()
    expect(amountField()).toHaveValue('2,400')
    await user.click(await screen.findByRole('button', { name: /^Undo: Now in USD/ }))
    expect(await screen.findByRole('button', { name: 'Currency: INR. Change' })).toBeInTheDocument()
  })
})

describe('NewSplitScreen — starting points', () => {
  it('starts with the whole group, filed under it', async () => {
    seedGroup()
    const { user } = renderApp('/app/split/new?group=g1')
    expect(screen.getByRole('list', { name: 'Picked: 4 people' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Group\s+Goa 2026/ })).toBeInTheDocument()
    await user.type(amountField(), '4000')
    expect(screen.getByText('Riya, Sam and Neha Sharma will owe you ₹1,000 each')).toBeInTheDocument()
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({ groupId: 'g1', currency: 'INR' })
  })

  it('says when a split in another currency settles outside its group', async () => {
    seedGroup()
    const { user } = renderApp('/app/split/new?group=g1')
    await user.click(screen.getByRole('button', { name: 'Currency: INR. Change' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Currency' })).getByRole('button', { name: /Euro/ }))
    expect(await screen.findByText(/In EUR, so it’s settled person to person — not in Goa 2026’s INR balances\./)).toBeInTheDocument()
  })

  it('starts with a friend', () => {
    renderApp('/app/split/new?friend=riya')
    const picked = screen.getByRole('list', { name: 'Picked: 2 people' })
    expect(within(picked).getByText('Riya')).toBeInTheDocument()
  })

  it('starts rent as "Rent" and suggests splitting it by percentage', async () => {
    const { user } = renderApp('/app/split/new?category=rent')
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Rent')
    expect(screen.getByRole('radio', { name: /^Rent/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Rent is often fairer/)).not.toBeInTheDocument()
    await pickPerson(user, 'Riya')
    expect(screen.getByText('Rooms of different sizes? Rent is often fairer split by percentage.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split by %' }))
    expect(screen.getByRole('radio', { name: 'Percentages' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Rent is often fairer/)).not.toBeInTheDocument()
  })

  it('suggests a group for a trip', async () => {
    const { user } = renderApp('/app/split/new?category=trip')
    expect(screen.getByRole('radio', { name: /Travel & stays/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Splitting a whole trip?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start a trip group' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/groups?new=1'))
  })

  it('lets a trip be split just this once', async () => {
    const { user } = renderApp('/app/split/new?category=travel')
    await user.click(screen.getByRole('button', { name: 'Just this once' }))
    expect(screen.queryByText('Splitting a whole trip?')).not.toBeInTheDocument()
  })

  it('takes a "Just say it" hand-off and asks before throwing it away', async () => {
    setSplitPrefill({
      title: 'Cab to airport',
      category: 'transport',
      total: 84_000,
      mode: 'shares',
      participants: [
        { friendId: ME_ID, input: 1 },
        { friendId: 'riya', input: 1 },
        { friendId: 'sam', input: 2 },
      ],
      source: 'describe',
    })
    const { user } = renderApp('/app/split/new?from=describe')
    expect(screen.getByText('Filled in from what you typed')).toBeInTheDocument()
    expect(amountField()).toHaveValue('840')
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Cab to airport')
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('You’ll get back ₹630 from Riya and Sam')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('dialog', { name: 'Discard this split?' })).toBeInTheDocument()
  })

  it('takes a scanned bill and saves it as a scan', async () => {
    setSplitPrefill({ title: 'BESCOM', category: 'utilities', total: 184_000, date: '2026-10-05', source: 'scan' })
    const { user } = renderApp('/app/split/new?from=scan')
    expect(screen.getByText('Filled in from your bill')).toBeInTheDocument()
    await pickPerson(user, 'Neha')
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({ title: 'BESCOM', category: 'utilities', date: '2026-10-05', source: 'scan', total: 184_000 })
  })

  it('copies an expense, dated today and with nobody paid', async () => {
    const original = seedExpense({ date: '2026-09-30', note: 'Corner table' })
    const { user } = renderApp(`/app/split/new?from=duplicate&of=${original.id}`)
    expect(screen.getByText('A copy of Dinner at Toit')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Date: Today/)).toBeInTheDocument()
    await user.click(saveButton())
    const copy = expensesStore.get().find((e) => e.id !== original.id)
    expect(copy).toMatchObject({ title: 'Dinner at Toit', total: 276_600, date: '2026-10-22', paidBack: {}, note: 'Corner table' })
    expect(expensesStore.get().find((e) => e.id === original.id)).toEqual(original)
  })

  it('starts empty when the expense to copy is gone', () => {
    renderApp('/app/split/new?from=duplicate&of=nope')
    expect(screen.queryByText(/A copy of/)).not.toBeInTheDocument()
    expect(amountField()).toHaveValue('')
  })
})

describe('NewSplitScreen — unsaved work', () => {
  it('asks before throwing away what was typed, and Back again keeps editing', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '500')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const confirm = await screen.findByRole('dialog', { name: 'Discard this split?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Discard this split?' })).not.toBeInTheDocument())
    expect(amountField()).toHaveValue('500')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard this split?' })).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(currentUrl()).toBe('/app'))
    expect(expensesStore.get()).toHaveLength(0)
  })

  it('asks on the system Back button too', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(amountField(), '500')
    act(() => window.history.back())
    expect(await screen.findByRole('dialog', { name: 'Discard this split?' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/split/new')
  })

  it('leaves straight away when nothing changed', async () => {
    const { user } = renderApp('/app/split/new?group=nope')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app'))
    expect(screen.queryByRole('dialog', { name: 'Discard this split?' })).not.toBeInTheDocument()
  })

  it('goes back to the group it was started from', async () => {
    seedGroup()
    const { user } = renderApp('/app/split/new?group=g1')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/groups/g1'))
  })

  it('brings back what was typed after a reload', async () => {
    setSplitPrefill({ title: 'Cab', total: 84_000, source: 'describe' })
    const first = renderApp('/app/split/new?from=describe')
    await first.user.type(screen.getByLabelText("What's it for?"), ' home')
    const stored = window.sessionStorage.getItem(SPLIT_DRAFT_KEY)
    expect(stored).not.toBeNull()
    // A reload never runs the screen's clean-up, so the draft is still there afterwards.
    first.unmount()
    window.sessionStorage.setItem(SPLIT_DRAFT_KEY, stored ?? '')

    renderApp('/app/split/new?from=describe')
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Cab home')
    expect(amountField()).toHaveValue('840')
    expect(amountField()).not.toHaveFocus()
    expect(screen.getByText('Filled in from what you typed')).toBeInTheDocument()
  })
})

describe('NewSplitScreen — editing', () => {
  it('saves changes and says who owes again', async () => {
    seedExpense()
    const { user } = renderApp('/app/split/e1/edit')
    expect(screen.getByRole('heading', { level: 1, name: 'Edit Dinner at Toit' })).toBeInTheDocument()
    expect(amountField()).toHaveValue('2,766')
    expect(saveButton()).toHaveTextContent('Save changes')
    await user.clear(amountField())
    await user.type(amountField(), '3000')
    await user.click(saveButton())
    expect(await screen.findByText('Changes saved. Riya owes more now, so they’re marked as not paid yet.')).toBeInTheDocument()
    expect(expensesStore.get()[0]).toMatchObject({ id: 'e1', total: 300_000, paidBack: {} })
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
  })

  it('goes back to the expense when nothing changed', async () => {
    seedExpense()
    const { user } = renderApp('/app/split/e1/edit')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dinner at Toit' })).toBeInTheDocument()
  })

  it('asks before throwing away changes', async () => {
    const original = seedExpense()
    const { user } = renderApp('/app/split/e1/edit')
    await user.type(screen.getByLabelText("What's it for?"), '!')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const confirm = await screen.findByRole('dialog', { name: 'Discard changes?' })
    expect(within(confirm).getByText('Your changes to Dinner at Toit won’t be saved.')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(expensesStore.get()[0]).toEqual(original)
  })

  it('edits the details and amount of an itemized bill, keeping who had what', async () => {
    seedExpense({
      kind: 'bill',
      mode: 'items',
      title: 'Toit',
      total: 105_000,
      bill: BILL,
      participants: [ME_ID, 'riya'].map((friendId) => ({ friendId, input: null })),
      shares: { [ME_ID]: 31_500, riya: 73_500 },
      paidBack: {},
      source: 'scan',
    })
    const { user } = renderApp('/app/split/e1/edit')
    expect(screen.getByText('2 items · 2 people')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Currency/ })).not.toBeInTheDocument()
    const total = screen.getByLabelText('Total paid')
    await user.clear(total)
    await user.type(total, '1100')
    await user.click(saveButton())
    const saved = expensesStore.get()[0]!
    expect(saved).toMatchObject({ kind: 'bill', mode: 'items', total: 110_000, bill: BILL, source: 'scan' })
    expect(saved.shares[ME_ID]! + saved.shares.riya!).toBe(110_000)
  })

  it('opens the bill again to change who had what', async () => {
    seedExpense({
      kind: 'bill',
      mode: 'items',
      total: 105_000,
      bill: BILL,
      participants: [ME_ID, 'riya'].map((friendId) => ({ friendId, input: null })),
      shares: { [ME_ID]: 31_500, riya: 73_500 },
    })
    const { user } = renderApp('/app/split/e1/edit')
    await user.click(screen.getByRole('button', { name: 'Change who had what' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/bill'))
    expect(takeBillStart()).toEqual({ kind: 'edit', expenseId: 'e1' })
  })

  it('says so when the expense is gone', async () => {
    const { user } = renderApp('/app/split/nope/edit')
    expect(screen.getByRole('heading', { level: 1, name: 'This expense is gone' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See activity' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/activity'))
  })
})
