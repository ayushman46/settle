import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RATES_CACHE_KEY, resetRatesForTests } from '../../api/rates'
import { expensesStore, setSplitPrefill } from '../../data'
import { BRAND, ME_ID, type BillSnapshot } from '../../domain/types'
import { EMPTY_META } from '../../types'
import { takeBillStart } from '../bill/launch'
import { json, route } from '../pro/testing'
import { SPLIT_DRAFT_KEY } from './splitDraft'
import { currentUrl, renderApp, resetSplitScreens, seedExpense, seedGroup, seedPeople } from './testing'

// Trip currency is on in these tests (as it ships).
vi.mock('../trip/enabled', () => ({ TRIP_ENABLED: true }))

const OCT_22 = new Date(2026, 9, 22, 12)

/** Whole-screen tests type a lot; give them room on a busy machine. */
const SCREEN = { timeout: 30_000 }

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

describe('NewSplitScreen — a new split', SCREEN, () => {
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
  })

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

  it('splits a meal with no bill: what each had, the total from that, tax and tip in proportion', async () => {
    const { user } = renderApp('/app/split/new')
    await user.type(screen.getByLabelText("What's it for?"), 'Dinner')
    await pickPerson(user, 'Riya')
    await pickPerson(user, 'Sam')
    await user.click(screen.getByRole('radio', { name: 'What each had' }))
    await user.type(screen.getByLabelText('What you had'), '400')
    await user.type(screen.getByLabelText('What Riya had'), '300')
    await user.type(screen.getByLabelText('What Sam had'), '500')
    expect(saveButton()).toBeDisabled()

    // No total typed: one tap uses what everyone had.
    await user.click(screen.getByRole('button', { name: 'Use ₹1,200' }))
    expect(amountField()).toHaveValue('1,200')
    expect(screen.getByText('You’ll get back ₹800 from Riya and Sam')).toBeInTheDocument()

    // Tax and tip on top: type what was really paid, and it's shared in proportion.
    await user.clear(amountField())
    await user.type(amountField(), '1380')
    expect(screen.getByText('₹180 tax & tip shared in proportion')).toBeInTheDocument()
    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Split saved' })
    expect(expensesStore.get()[0]).toMatchObject({
      mode: 'had',
      total: 138_000,
      participants: [
        { friendId: ME_ID, input: 40_000 },
        { friendId: 'riya', input: 30_000 },
        { friendId: 'sam', input: 50_000 },
      ],
      shares: { [ME_ID]: 46_000, riya: 34_500, sam: 57_500 },
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

describe('NewSplitScreen — starting points', SCREEN, () => {
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
    // Converted into rupees by default; switched off, it's settled outside the group.
    await user.click(await screen.findByRole('switch', { name: 'Settle in ₹ (recommended)' }))
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

  it('tells where a hand-off came from by the address when it doesn’t say', () => {
    setSplitPrefill({ title: 'Airtel', total: 99_900 })
    renderApp('/app/split/new?from=scan')
    expect(screen.getByText('Filled in from your bill')).toBeInTheDocument()
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Airtel')
  })

  it('shows a hand-off’s own banner instead of the origin’s, and keeps it after a reload', async () => {
    setSplitPrefill({
      title: 'Swiggy',
      total: 25_000,
      source: 'sms',
      banner: { icon: 'message', title: 'Filled in from your SMS', body: 'Add who’s in, check it, then save.' },
    })
    const first = renderApp('/app/split/new?from=sms')
    expect(screen.getByText('Filled in from your SMS')).toBeInTheDocument()
    expect(screen.getByText('Add who’s in, check it, then save.')).toBeInTheDocument()
    await first.user.type(screen.getByLabelText("What's it for?"), ' order')
    const stored = window.sessionStorage.getItem(SPLIT_DRAFT_KEY)
    first.unmount()
    window.sessionStorage.setItem(SPLIT_DRAFT_KEY, stored ?? '')
    renderApp('/app/split/new?from=sms')
    expect(screen.getByText('Filled in from your SMS')).toBeInTheDocument()
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Swiggy order')
  })

  it.each([
    ['sms', { source: 'sms' as const }, 'Filled in from your SMS'],
    ['voice', { source: 'voice' as const }, 'Filled in from what you said'],
    ['rotation', {}, 'The next round'],
    ['sms', {}, 'Filled in from your SMS'],
  ])('names a from=%s hand-off', (from, extra, title) => {
    setSplitPrefill({ title: 'Dinner', total: 120_000, ...extra })
    renderApp(`/app/split/new?from=${from}`)
    expect(screen.getByText(title)).toBeInTheDocument()
  })

  it('saves an SMS hand-off with its source', async () => {
    setSplitPrefill({ title: 'Swiggy', category: 'food', total: 25_000, source: 'sms' })
    const { user } = renderApp('/app/split/new?from=sms')
    await pickPerson(user, 'Neha')
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({ title: 'Swiggy', source: 'sms', total: 25_000 })
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

describe('NewSplitScreen — unsaved work', SCREEN, () => {
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

describe('NewSplitScreen — editing', SCREEN, () => {
  it('saves changes and says who owes again', async () => {
    seedExpense()
    const { user } = renderApp('/app/split/e1/edit')
    expect(screen.getByRole('heading', { level: 1, name: 'Edit Dinner at Toit' })).toBeInTheDocument()
    expect(document.title).toBe(`Edit Dinner at Toit · ${BRAND.name}`)
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

/* ------------------------------------------------------------------ trip currency (spec 06) */

/** Units per 1 EUR — spec 06 §4's fixture table (not real rates). */
const ECB = { EUR: 1, USD: 1.0812, JPY: 163.42, INR: 90.4321, THB: 37.512, SGD: 1.4103, IDR: 17012.5, GBP: 0.8364 }

/** `GET /api/rates` answers `answer`'s table for each asked day (the 22nd isn't published yet: the 21st). */
function serveRates(asked: readonly string[] = ['2026-10-22', '2026-10-18'], answer = (day: string) => (day >= '2026-10-21' ? '2026-10-21' : day)) {
  for (const day of asked) {
    route(`/api/rates?date=${day}`, () => json({ date: answer(day), base: 'EUR', rates: ECB, pegged: {} }))
  }
}

const conversion = () => screen.getByRole('group', { name: 'Conversion' })
const settleSwitch = () => screen.getByRole('switch', { name: 'Settle in ₹ (recommended)' })

describe('NewSplitScreen — trip currency', SCREEN, () => {
  beforeEach(() => {
    resetRatesForTests()
    window.localStorage.removeItem(RATES_CACHE_KEY)
  })

  it('starts a trip group’s split in baht and saves it in rupees at the ECB rate', async () => {
    serveRates()
    seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    const { user } = renderApp('/app/split/new?group=g1')
    expect(screen.getByRole('button', { name: 'Currency: THB. Change' })).toBeInTheDocument()
    await user.type(amountField(), '1250')
    const panel = conversion()
    expect(await within(panel).findByText('≈ ₹3,013.44')).toBeInTheDocument()
    expect(within(panel).getByRole('note', { name: 'About ₹3,013.44 at 1 Thai baht = ₹2.4108' })).toBeInTheDocument()
    expect(within(panel).getByText('1 THB = ₹2.4108')).toBeInTheDocument()
    expect(within(panel).getByText('ECB rate for 21 Oct')).toBeInTheDocument()
    expect(settleSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Shares in ₹ (converted)')).toBeInTheDocument()
    expect(screen.getByText('Riya, Sam and Neha Sharma will owe you ₹753.36 each')).toBeInTheDocument()

    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Split saved' })
    expect(expensesStore.get()[0]).toMatchObject({
      currency: 'INR',
      total: 301_344,
      groupId: 'g1',
      shares: { [ME_ID]: 75_336, riya: 75_336, sam: 75_336, neha: 75_336 },
      fx: { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' },
    })
  })

  it('splits exact amounts in rupees on the converted total', async () => {
    serveRates()
    const { user } = renderApp('/app/split/new')
    await user.click(screen.getByRole('button', { name: 'Currency: INR. Change' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Currency' })).getByRole('button', { name: /Thai Baht/ }))
    await user.type(amountField(), '1250')
    await screen.findByText('≈ ₹3,013.44')
    await pickPerson(user, 'Riya')
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    await user.type(screen.getByLabelText('Amount for you'), '1000')
    await user.type(screen.getByLabelText('Amount for Riya'), '2013.44')
    expect(screen.getByText('Riya will owe you ₹2,013.44')).toBeInTheDocument()
    await user.click(saveButton())
    expect(expensesStore.get()[0]).toMatchObject({ mode: 'exact', currency: 'INR', total: 301_344, shares: { [ME_ID]: 100_000, riya: 201_344 } })
  })

  it('saves in baht, settled person to person, with the switch off', async () => {
    serveRates()
    seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    const { user } = renderApp('/app/split/new?group=g1')
    await user.type(amountField(), '1250')
    await user.click(settleSwitch())
    expect(settleSwitch()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText('≈ ₹3,013.44')).not.toBeInTheDocument()
    expect(screen.getByText(/In THB, so it’s settled person to person — not in Bangkok’s INR balances\./)).toBeInTheDocument()
    await user.click(saveButton())
    const saved = expensesStore.get()[0]!
    expect(saved).toMatchObject({ currency: 'THB', total: 125_000, groupId: 'g1' })
    expect(saved.fx).toBeUndefined()
  })

  it('takes what the bank charged, exactly', async () => {
    serveRates()
    seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    const { user } = renderApp('/app/split/new?group=g1')
    await user.type(amountField(), '1250')
    await screen.findByText('≈ ₹3,013.44')
    await user.click(within(conversion()).getByRole('button', { name: 'Change the exchange rate' }))
    const sheet = await screen.findByRole('dialog', { name: 'Exchange rate' })
    expect(within(sheet).getByLabelText('1 THB =')).toHaveValue('2.410751226')
    await user.click(within(sheet).getByRole('radio', { name: 'What your bank charged' }))
    expect(within(sheet).getByText('Card or forex markup? Use the rupee amount from your bank SMS — it’s exact.')).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Your bank charged'), '3104.20')
    expect(within(sheet).getByText('฿1,250 comes to ₹3,104.20')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exchange rate' })).not.toBeInTheDocument())
    expect(within(conversion()).getByText('≈ ₹3,104.20')).toBeInTheDocument()
    expect(within(conversion()).getByText('what your bank charged')).toBeInTheDocument()
    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Split saved' })
    expect(expensesStore.get()[0]).toMatchObject({
      currency: 'INR',
      total: 310_420,
      fx: { amount: 125_000, currency: 'THB', rate: '2.48336', rateDate: null, source: 'manual_total' },
    })
  })

  it('keeps Save off until a rate is added when there’s none', async () => {
    route('/api/rates?date=2026-10-22', () => json({ error: { code: 'rates_unavailable', message: 'x' } }, 503))
    seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    const { user } = renderApp('/app/split/new?group=g1')
    await user.type(amountField(), '1250')
    expect(await within(conversion()).findByText('No rate for THB on 22 Oct — add it')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText('Add the rate to settle in ₹')).toBeInTheDocument()

    await user.click(within(conversion()).getByRole('button', { name: 'Add rate' }))
    const sheet = await screen.findByRole('dialog', { name: 'Exchange rate' })
    expect(within(sheet).queryByRole('button', { name: 'Use the ECB rate' })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(within(sheet).getByText('Enter a rate above 0, like 2.4108.')).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('1 THB ='), '2.5')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(conversion()).findByText('≈ ₹3,125.00')).toBeInTheDocument()
    expect(within(conversion()).getByText('your rate')).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Split saved' })
    expect(expensesStore.get()[0]).toMatchObject({ total: 312_500, fx: { rate: '2.5', source: 'manual_rate', rateDate: null } })
  })

  it('says when the ECB doesn’t publish a currency', async () => {
    serveRates()
    seedGroup({ name: 'Colombo', travelCurrency: 'LKR' })
    const { user } = renderApp('/app/split/new?group=g1')
    await user.type(amountField(), '5000')
    expect(
      await within(conversion()).findByText('ECB doesn’t publish Sri Lankan rupee rates — add the rate from your receipt or bank SMS.'),
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('edits an expense paid abroad in baht, with its rate frozen', async () => {
    serveRates()
    seedGroup({ name: 'Bangkok', travelCurrency: 'THB' })
    seedExpense({
      groupId: 'g1',
      total: 301_344,
      shares: { [ME_ID]: 75_336, riya: 75_336, sam: 75_336, neha: 75_336 },
      fx: { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-16', source: 'ecb' },
    })
    const { user } = renderApp('/app/split/e1/edit')
    expect(amountField()).toHaveValue('1,250')
    expect(screen.getByRole('button', { name: 'Currency: THB. Change' })).toBeInTheDocument()
    expect(within(conversion()).getByText('≈ ₹3,013.44')).toBeInTheDocument()
    expect(within(conversion()).getByText('Rate frozen on 16 Oct')).toBeInTheDocument()
    // A new amount reconverts at the frozen rate.
    await user.clear(amountField())
    await user.type(amountField(), '2500')
    expect(within(conversion()).getByText('≈ ₹6,026.88')).toBeInTheDocument()
    await user.click(within(conversion()).getByRole('button', { name: 'Use the ECB rate for 18 Oct' }))
    expect(await within(conversion()).findByText('ECB rate for 18 Oct')).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(expensesStore.get()[0]).toMatchObject({ total: 602_688, fx: { amount: 250_000, rateDate: '2026-10-18', source: 'ecb' } })
  })

  it('converts an old expense in baht when asked to (convert=1)', async () => {
    serveRates()
    seedGroup({ name: 'Bangkok' })
    seedExpense({ groupId: 'g1', currency: 'THB', total: 125_000, shares: { [ME_ID]: 31_250, riya: 31_250, sam: 31_250, neha: 31_250 } })
    const { user } = renderApp('/app/split/e1/edit?convert=1')
    expect(settleSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(await within(conversion()).findByText('≈ ₹3,013.44')).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(expensesStore.get()[0]).toMatchObject({ currency: 'INR', total: 301_344, fx: { amount: 125_000, currency: 'THB' } })
  })
})
