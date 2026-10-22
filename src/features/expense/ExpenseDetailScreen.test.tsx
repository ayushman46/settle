import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expensesStore } from '../../data'
import { BRAND, ME_ID, type BillSnapshot, type Expense } from '../../domain/types'
import { EMPTY_META } from '../../types'
import { takeBillStart } from '../bill/launch'
import { paywallState } from '../pro/paywall'
import { currentUrl, renderApp, resetSplitScreens, seedExpense, seedGroup, seedPeople } from '../split/testing'

const OCT_22 = new Date(2026, 9, 22, 12)

/** Whole-screen tests type a lot; give them room on a busy machine. */
const SCREEN = { timeout: 30_000 }

beforeEach(() => {
  resetSplitScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  seedPeople()
  // ₹2,766 dinner I paid, four ways; Riya has paid me back (tests replace it as needed).
  seedExpense()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetSplitScreens()
})

const stored = (id = 'e1'): Expense | undefined => expensesStore.get().find((e) => e.id === id)

function seedBill(itemCount = 2, extra: Partial<Expense> = {}): Expense {
  const items = Array.from({ length: itemCount }, (_, i) => ({ id: `i${i + 1}`, name: `Dish ${i + 1}`, quantity: i === 1 ? 2 : 1, amount: 10_000 }))
  const bill: BillSnapshot = {
    meta: { ...EMPTY_META, merchant: 'Toit', tax: 1_000 },
    items,
    assignments: { i1: { [ME_ID]: 1, riya: 1 }, i2: { riya: 1 } },
    warnings: [],
  }
  const total = itemCount * 10_000 + 1_000
  return seedExpense({
    kind: 'bill',
    mode: 'items',
    title: 'Toit',
    total,
    bill,
    participants: [ME_ID, 'riya'].map((friendId) => ({ friendId, input: null })),
    shares: { [ME_ID]: total / 2, riya: total / 2 },
    paidBack: {},
    source: 'scan',
    ...extra,
  })
}

describe('ExpenseDetailScreen — what it is', SCREEN, () => {
  it('shows what it was, who paid, where you stand and how much has come back', () => {
    renderApp('/app/expense/e1')
    expect(screen.getByRole('heading', { level: 1, name: 'Dinner at Toit' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Food & drinks' })).toBeInTheDocument()
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-10-18')
    expect(screen.getByText('Paid by you')).toBeInTheDocument()
    expect(screen.getByText('You’re owed ₹1,383')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /691\.50.*collected/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Shares' })).toBeInTheDocument()
    expect(screen.getByText(/^Added /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share pay link' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'The bill' })).not.toBeInTheDocument()
    expect(document.title).toBe(`Dinner at Toit · ${BRAND.name}`)
  })

  it('shows the note with its line breaks', () => {
    seedExpense({ note: 'Corner table\nAyush’s birthday' })
    renderApp('/app/expense/e1')
    expect(screen.getByRole('heading', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByText(/Corner table/)).toHaveTextContent('Corner table Ayush’s birthday', { normalizeWhitespace: true })
  })

  it('shows the bill item by item, adding up to what was paid', async () => {
    seedBill(8)
    const { user } = renderApp('/app/expense/e1')
    const bill = screen.getByRole('region', { name: 'The bill' })
    const items = within(bill).getByRole('list', { name: 'Items' })
    expect(within(items).getAllByRole('listitem')).toHaveLength(6)
    expect(within(items).getByText('× 2')).toBeInTheDocument()
    expect(within(items).getByRole('img', { name: 'You and Riya' })).toBeInTheDocument()
    expect(within(items).getAllByText('Shared by everyone').length).toBeGreaterThan(0)
    await user.click(within(bill).getByRole('button', { name: 'Show all 8 items' }))
    expect(within(items).getAllByRole('listitem')).toHaveLength(8)
    expect(within(bill).getByText('Tax')).toBeInTheDocument()
    expect(within(bill).getByText('+₹10')).toBeInTheDocument()
    expect(within(bill).getByText('Total paid')).toBeInTheDocument()
    expect(within(bill).getByText('₹810')).toBeInTheDocument()
  })

  it('says so when the expense is gone', async () => {
    const { user } = renderApp('/app/expense/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'This expense is gone' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See activity' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/activity'))
  })

  it('goes back to activity, or to the group it is in', async () => {
    const first = renderApp('/app/expense/e1')
    await first.user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/activity'))
    first.unmount()

    seedGroup()
    seedExpense({ id: 'e2', groupId: 'g1' })
    const second = renderApp('/app/expense/e2')
    await second.user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/groups/g1'))
  })
})

describe('ExpenseDetailScreen — collecting', SCREEN, () => {
  it('ticks someone off as paid, with an undo', async () => {
    const { user } = renderApp('/app/expense/e1')
    const tick = screen.getByRole('button', { name: 'Sam paid you back' })
    expect(tick).toHaveAttribute('aria-pressed', 'false')
    await user.click(tick)
    expect(stored()?.paidBack.sam).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sam paid you back' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(await screen.findByRole('button', { name: /^Undo: Sam is marked as paid/ }))
    expect(stored()?.paidBack.sam).toBeUndefined()
  })

  it('cheers when the last person pays', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Sam paid you back' }))
    await user.click(screen.getByRole('button', { name: 'Neha Sharma paid you back' }))
    expect(await screen.findByText('Everyone’s paid — all ₹2,074.50 is back')).toBeInTheDocument()
    expect(screen.getByText('Settled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
  })

  it('marks everyone paid at once, and the undo only takes back those ticks', async () => {
    const riyaPaidAt = stored()?.paidBack.riya
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Mark all paid' }))
    expect(Object.keys(stored()?.paidBack ?? {}).sort()).toEqual(['neha', 'riya', 'sam'])
    expect(screen.queryByRole('button', { name: 'Mark all paid' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /^Undo: Everyone’s paid/ }))
    expect(stored()?.paidBack).toEqual({ riya: riyaPaidAt })
  })

  it('marks everyone paid from the menu too', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    const menu = await screen.findByRole('dialog', { name: 'Dinner at Toit' })
    await user.click(within(menu).getByRole('button', { name: /Mark everyone as paid/ }))
    expect(Object.keys(stored()?.paidBack ?? {})).toHaveLength(3)
  })

  it('shows a UPI QR for someone who owes you, and marks them paid from it', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Show a UPI QR for Sam to pay ₹691.50' }))
    const sheet = await screen.findByRole('dialog', { name: 'Collect from Sam' })
    await user.click(within(sheet).getByRole('button', { name: 'Mark as paid' }))
    expect(stored()?.paidBack.sam).toBeDefined()
    expect(await screen.findByText('Sam is marked as paid')).toBeInTheDocument()
  })

  it('nudges someone who owes you', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Nudge Sam about ₹691.50' }))
    expect(await screen.findByRole('dialog', { name: 'Nudge Sam' })).toBeInTheDocument()
  })

  it('shares the pay link, and offers Pro for a clean card', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Share pay link' }))
    const sheet = await screen.findByRole('dialog', { name: 'Share split' })
    await user.click(within(sheet).getByRole('button', { name: /Remove the line with/ }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'clean_cards' } })
  })
})

describe('ExpenseDetailScreen — when you owe', SCREEN, () => {
  it('pays the payer over UPI and says so once paid', async () => {
    seedExpense({ payerId: 'riya', paidBack: {} })
    const { user } = renderApp('/app/expense/e1')
    expect(screen.getByText('Paid by Riya')).toBeInTheDocument()
    expect(screen.getByText('You owe Riya ₹691.50')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay Riya ₹691.50' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay Riya' })
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))
    expect(stored()?.paidBack[ME_ID]).toBeDefined()
    expect(await screen.findByText('You paid Riya back')).toBeInTheDocument()
  })

  it('says you’ve paid back in currencies UPI can’t move', async () => {
    seedExpense({ payerId: 'riya', paidBack: {}, currency: 'EUR' })
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'I’ve paid Riya back' }))
    expect(stored()?.paidBack[ME_ID]).toBeDefined()
    expect(await screen.findByText('You are marked as paid')).toBeInTheDocument()
  })

  it('cheers when you were the last one to pay back', async () => {
    seedExpense({ payerId: 'riya', paidBack: { sam: 1, neha: 1 } })
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'You paid Riya back' }))
    expect(await screen.findByText('All settled with Riya')).toBeInTheDocument()
  })
})

describe('ExpenseDetailScreen — in a group', SCREEN, () => {
  it('sends you to the group’s settle up', async () => {
    seedGroup()
    seedExpense({ groupId: 'g1' })
    const { user } = renderApp('/app/expense/e1')
    expect(screen.getByRole('link', { name: 'In the group Goa 2026' })).toHaveAttribute('href', '/app/groups/g1')
    expect(screen.getByText('You lent ₹2,074.50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark all paid' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Settle up in Goa 2026' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/groups/g1/settle'))
  })
})

describe('ExpenseDetailScreen — changing it', SCREEN, () => {
  it('edits a split on the split screen', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'Edit Dinner at Toit' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/e1/edit'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit Dinner at Toit' })).toBeInTheDocument()
  })

  it('reopens an itemized bill in the bill flow', async () => {
    seedBill()
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Toit' })).getByRole('button', { name: /Edit the bill/ }))
    await waitFor(() => expect(currentUrl()).toBe('/app/bill'))
    expect(takeBillStart()).toEqual({ kind: 'edit', expenseId: 'e1' })
  })

  it('duplicates it into a new split', async () => {
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Dinner at Toit' })).getByRole('button', { name: /Duplicate/ }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new?from=duplicate&of=e1'))
    expect(await screen.findByText('A copy of Dinner at Toit')).toBeInTheDocument()
  })

  it('deletes it with an undo', async () => {
    const original = stored()
    const { user } = renderApp('/app/expense/e1')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Dinner at Toit' })).getByRole('button', { name: /Delete/ }))
    expect(stored()).toBeUndefined()
    await waitFor(() => expect(currentUrl()).toBe('/app/activity'))
    await user.click(await screen.findByRole('button', { name: /^Undo: Dinner at Toit deleted/ }))
    expect(stored()).toEqual(original)
  })
})
