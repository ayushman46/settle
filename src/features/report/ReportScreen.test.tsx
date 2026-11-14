import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, CSV_BOM, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { renderAt, resetProScreens } from '../pro/testing'
import type * as Share from '../../share'
import { ReportScreen } from './ReportScreen'
import { reportStore } from './store'

const shared = vi.hoisted(() => ({ blobs: [] as Array<{ blob: Blob; name: string }> }))
vi.mock('../../share', async (importOriginal) => ({
  ...(await importOriginal<typeof Share>()),
  shareFile: vi.fn(async (blob: Blob, name: string) => {
    shared.blobs.push({ blob, name })
    return 'downloaded'
  }),
}))

vi.setConfig({ testTimeout: 30_000 })

let pune: string
let riya: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  shared.blobs.length = 0
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  pune = createGroup({ name: 'Pune visit', emoji: '🧳', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] }).id
  saveExpense(draft({ title: 'Hotel', total: 600_000, date: '2026-11-03', category: 'travel', groupId: pune, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 90_000, date: '2026-11-02', category: 'transport', groupId: pune, participants: everyone(ME_ID, riya), source: 'scan' }))
  saveExpense(draft({ title: 'Lunch', total: 40_000, date: '2026-11-04', groupId: pune, payerId: riya, participants: everyone(ME_ID, riya) }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const status = () => screen.getByRole('status', { name: 'Total to claim' })

async function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })
}

describe('ReportScreen', () => {
  it('starts on the latest group with what I paid, all ticked; unticking and the basis change the total', async () => {
    const { user } = renderAt('/app/report', <ReportScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeInTheDocument()
    expect(screen.getByLabelText('Group')).toHaveValue(pune)
    expect(status()).toHaveTextContent('₹6,900 · 2 expenses')
    expect(status()).toHaveTextContent('Six thousand nine hundred rupees')
    await user.click(screen.getByRole('checkbox', { name: 'Claim Cab, ₹900' }))
    expect(status()).toHaveTextContent('₹6,000 · 1 expense')
    await user.click(screen.getByRole('radio', { name: 'My share' }))
    // My share: Cab ₹450 (still unticked), Hotel ₹3,000, Lunch ₹200.
    expect(status()).toHaveTextContent('₹3,200 · 2 expenses')
    expect(screen.getByRole('checkbox', { name: 'Claim Lunch, ₹200' })).toBeChecked()
  })

  it('“Only ones with a bill” keeps just the scanned one', async () => {
    const { user } = renderAt('/app/report', <ReportScreen />)
    await user.click(screen.getByRole('button', { name: 'Only ones with a bill' }))
    expect(status()).toHaveTextContent('₹900 · 1 expense')
  })

  it('prints the sheet with the name, purpose, table and total in words', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const { user } = renderAt(`/app/report?group=${pune}`, <ReportScreen />)
    await user.type(screen.getByLabelText(/Purpose/), 'Client visit')
    await user.tab()
    expect(reportStore.get().purpose).toBe('Client visit')
    const sheet = screen.getByRole('article', { name: 'Expense claim' })
    // The name on the claim, and as who paid each of the two bills.
    expect(within(sheet).getAllByText('Ayush')).toHaveLength(3)
    expect(within(sheet).getByText('Client visit')).toBeInTheDocument()
    // The group on its own line; the period is the dates covered, first to last expense.
    expect(within(sheet).getByText('Group').nextElementSibling).toHaveTextContent('Pune visit')
    expect(within(sheet).getByText('Period').nextElementSibling).toHaveTextContent('02/11/2026 to 03/11/2026')
    expect(within(sheet).getAllByRole('row').length).toBeGreaterThan(2)
    expect(sheet).toHaveTextContent('Six thousand nine hundred rupees')
    expect(sheet).toHaveTextContent('Made with Settle')
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('downloads a CSV of the ticked expenses', async () => {
    const { user } = renderAt('/app/report', <ReportScreen />)
    await user.click(screen.getByRole('checkbox', { name: 'Claim Hotel, ₹6,000' }))
    await user.click(screen.getByRole('button', { name: 'Download CSV' }))
    await waitFor(() => expect(shared.blobs).toHaveLength(1))
    expect(shared.blobs[0]?.name).toBe('settle-expense-claim-2026-11-14.csv')
    const text = await blobText(shared.blobs[0]!.blob)
    expect(text.replace(CSV_BOM, '').split('\r\n')).toEqual([
      'Date,Title,Category,Paid by,Amount,Currency,Bill amount,Bill currency,Rate,Share of bill',
      '2026-11-02,Cab,Transport,Ayush,900.00,INR,,,,',
      ',Total,,,900.00,INR,,,,',
      '',
    ])
    expect(await screen.findByText('Saved the claim as a spreadsheet')).toBeInTheDocument()
  })

  it('my share of a bill paid in dollars says it is a share of the whole bill, with the rate to 4 decimals', async () => {
    const zoom = draft({ title: 'Zoom', total: 188_486, date: '2026-11-05', groupId: pune, participants: everyone(ME_ID, riya) })
    saveExpense({ ...zoom, fx: { amount: 2_000, currency: 'USD', rate: '94.24312342', rateDate: '2026-11-05', source: 'ecb' } })
    const { user } = renderAt(`/app/report?group=${pune}`, <ReportScreen />)
    await user.click(screen.getByRole('radio', { name: 'My share' }))
    expect(screen.getByText('Your share of $20, at 94.2431')).toBeInTheDocument()
    expect(screen.queryByText(/94\.243123/)).not.toBeInTheDocument()
    const sheet = screen.getByRole('article', { name: 'Expense claim' })
    expect(sheet).toHaveTextContent('share of $20.00 bill paid, at 94.2431')
    expect(sheet).not.toHaveTextContent('$10.00')
  })

  it('the choices and chips are full-size tap targets', () => {
    renderAt('/app/report', <ReportScreen />)
    expect(screen.getByRole('radiogroup', { name: 'What to claim' }).className).not.toMatch(/sm/)
    expect(screen.getByRole('button', { name: 'Untick all' }).className).toMatch(/lg/)
  })

  it('says so when there is nothing to claim, and offers my share', async () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] }).id
    saveExpense(draft({ title: 'Shack', total: 30_000, date: '2026-11-10', groupId: goa, payerId: riya, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt(`/app/report?group=${goa}`, <ReportScreen />)
    expect(screen.getByText('Nothing to claim here')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Print or save as PDF' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'My share' }))
    expect(status()).toHaveTextContent('₹150 · 1 expense')
  })

  it('with no expenses at all, says how it works', () => {
    resetProScreens()
    renderAt('/app/report', <ReportScreen />)
    expect(screen.getByText('No expenses yet')).toBeInTheDocument()
  })
})
