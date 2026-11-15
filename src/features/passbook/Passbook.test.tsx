import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { List } from '../../components'
import { addFriend, createGroup, expensesStore, groupsStore, recordSettlement, saveExpense, setPaidBack, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import type * as NativeApp from '../../lib/nativeApp'
import type * as ShareLib from '../../lib/share'
import type * as ShareFile from '../../share/shareFile'
import { printPage } from '../../lib/nativeApp'
import { shareResult } from '../../lib/share'
import { shareFile } from '../../share/shareFile'
import { friendBalance, netIn } from '../friends/friendBalance'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { passbook } from './engine'
import { PassbookLink } from './PassbookLink'
import { PassbookScreen } from './PassbookScreen'
import { passbookCsv, passbookCsvFilename, passbookText, SHARE_MAX_LINES } from './passbookText'
import { passbookPath } from './paths'
import { passbookSchema, passbookStore, setPassbookRange } from './store'
import { passbookToday } from './index'
import * as z from 'zod/mini'

vi.setConfig({ testTimeout: 30_000 })

vi.mock('../../lib/share', async (original) => ({ ...(await original<typeof ShareLib>()), shareResult: vi.fn(async () => 'copied') }))
vi.mock('../../lib/nativeApp', async (original) => ({ ...(await original<typeof NativeApp>()), printPage: vi.fn() }))
vi.mock('../../share/shareFile', async (original) => ({ ...(await original<typeof ShareFile>()), shareFile: vi.fn(async () => 'downloaded') }))

let riya: string
let sam: string
let dinner: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 12))
  resetProScreens()
  vi.mocked(shareResult).mockClear()
  vi.mocked(printPage).mockClear()
  vi.mocked(shareFile).mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * With Riya: ₹2,000 lent on 20 Aug, her ₹500 of a dinner on 21 Oct, ₹3,000 I paid for her in Goa on
 * 25 Oct, my ₹150 of her cab on 3 Nov. In Goa she paid ₹3,000 for Sam, so the group settles as
 * "Sam pays you ₹3,000": Riya owes ₹2,350 in all.
 */
function seed(): void {
  saveExpense(draft({ kind: 'loan', title: 'Cash', total: 200_000, date: '2026-08-20', participants: everyone(riya) }))
  dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-10-21', with: [riya] })).id
  saveExpense(draft({ title: 'Cab', total: 30_000, date: '2026-11-03', payerId: riya, participants: everyone(ME_ID, riya) }))
  const goa = createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
  saveExpense(draft({ title: 'Scooter', total: 300_000, date: '2026-10-25', groupId: goa.id, participants: everyone(riya) }))
  saveExpense(draft({ title: 'Ferry', total: 300_000, date: '2026-10-26', groupId: goa.id, payerId: riya, participants: everyone(sam) }))
}

const pageNumber = (friendId: string): number => netIn(friendBalance(friendId, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')
const rupees = (minor: number): string => formatMoney(minor, 'INR', { trimZeros: true })
const closing = (): HTMLElement => {
  const found = screen.getAllByRole('status').filter((el) => el.textContent?.includes('Closing balance'))
  expect(found).toHaveLength(1)
  return found[0] as HTMLElement
}
/** Text on the screen itself (the sheet for paper repeats some of it, hidden until printed). */
const onScreen = (text: string | RegExp): HTMLElement => {
  const found = screen.getAllByText(text).filter((el) => !el.closest('[aria-hidden="true"]'))
  expect(found).toHaveLength(1)
  return found[0] as HTMLElement
}
const lines = () => within(screen.getByRole('list', { name: 'Entries, oldest first' })).getAllByRole('listitem')

describe('PassbookScreen', () => {
  it('lists every bill, loan and payment oldest first with the balance after each, and closes on the person’s page number', () => {
    seed()
    renderAt(passbookPath(riya), <PassbookScreen />)
    expect(screen.getByRole('heading', { name: 'Statement' })).toBeInTheDocument()
    expect(screen.getByText('Every bill and payment between you and Riya, oldest first, like a bank passbook.')).toBeInTheDocument()
    expect(onScreen('Everything till 15 Nov 2026')).toBeInTheDocument()

    const rows = lines()
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('20 Aug 2026')
    expect(rows[0]).toHaveTextContent('Cash')
    expect(rows[0]).toHaveTextContent('You lent Riya')
    expect(rows[0]).toHaveTextContent('+₹2,000')
    expect(rows[0]).toHaveTextContent('Owes you ₹2,000')
    expect(rows[1]).toHaveTextContent('Dinner')
    expect(rows[1]).toHaveTextContent('You paid for Riya')
    expect(rows[1]).toHaveTextContent('Owes you ₹2,500')
    expect(rows[2]).toHaveTextContent('Scooter')
    expect(rows[2]).toHaveTextContent('You paid for Riya · Goa trip')
    expect(rows[2]).toHaveTextContent('Owes you ₹5,500')
    expect(rows[3]).toHaveTextContent('Cab')
    expect(rows[3]).toHaveTextContent('Riya paid for you')
    expect(rows[3]).toHaveTextContent('Owes you ₹5,350')
    // The group settles as "Sam pays you": one line says so instead of a wrong total.
    expect(rows[4]).toHaveTextContent('Goa trip')
    expect(rows[4]).toHaveTextContent('Settled as a group')
    expect(rows[4]).toHaveTextContent('Owes you ₹2,350')
    expect(onScreen(/^Goa trip settles as a group, in the fewest payments/)).toBeInTheDocument()

    expect(pageNumber(riya)).toBe(235_000)
    expect(closing()).toHaveTextContent('Closing balance')
    expect(closing()).toHaveTextContent(`Riya owes you ${rupees(pageNumber(riya))}`)
    expect(closing()).toHaveTextContent('The same as on Riya’s page')
  })

  it('this month opens on the balance before it, and the choice is remembered', async () => {
    seed()
    const { user } = renderAt(passbookPath(riya), <PassbookScreen />)
    await user.click(screen.getByRole('radio', { name: 'This month' }))
    expect(onScreen('1 Nov 2026 to 15 Nov 2026')).toBeInTheDocument()
    expect(screen.getByText('From 3 earlier entries')).toBeInTheDocument()
    expect(screen.getByText('Riya owes you ₹5,500')).toBeInTheDocument()
    expect(lines()).toHaveLength(2)
    expect(closing()).toHaveTextContent('Riya owes you ₹2,350')
    expect(passbookStore.get().range).toBe('month')

    await user.click(screen.getByRole('radio', { name: '3 months' }))
    expect(onScreen('15 Aug 2026 to 15 Nov 2026')).toBeInTheDocument()
    expect(lines()).toHaveLength(5)
    expect(closing()).toHaveTextContent('Riya owes you ₹2,350')
  })

  it('a payment made while the statement is open shows up as a line, and the closing follows the person’s page', async () => {
    seed()
    renderAt(passbookPath(riya), <PassbookScreen />)
    setPaidBack(dinner, riya, true)
    await waitFor(() => expect(closing()).toHaveTextContent('Riya owes you ₹1,850'))
    expect(pageNumber(riya)).toBe(185_000)
    const paid = lines().find((row) => row.textContent?.includes('Payment for Dinner'))
    expect(paid).toHaveTextContent('Riya paid you')
    expect(paid).toHaveTextContent('15 Nov 2026')
  })

  it('when you owe them, says so; a payment recorded in a group is a line', () => {
    const flat = createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, sam] })
    saveExpense(draft({ title: 'Rent', total: 100_000, date: '2026-11-01', groupId: flat.id, payerId: sam, participants: everyone(ME_ID, sam) }))
    recordSettlement(flat.id, { fromId: ME_ID, toId: sam, amount: 20_000, date: '2026-11-05', method: 'upi' })
    renderAt(passbookPath(sam), <PassbookScreen />)
    const rows = lines()
    expect(rows[0]).toHaveTextContent('Sam paid for you · Flat 4B')
    expect(rows[0]).toHaveTextContent('You owe ₹500')
    expect(rows[1]).toHaveTextContent('Payment')
    expect(rows[1]).toHaveTextContent('You paid Sam · Flat 4B')
    expect(closing()).toHaveTextContent('You owe Sam ₹300')
    expect(pageNumber(sam)).toBe(-30_000)
  })

  it('keeps another currency in its own statement', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, with: [riya] }))
    saveExpense(draft({ title: 'Museum', total: 4_000, currency: 'USD', with: [riya] }))
    renderAt(passbookPath(riya), <PassbookScreen />)
    const inr = within(screen.getByRole('region', { name: 'Statement in INR' }))
    const usd = within(screen.getByRole('region', { name: 'Statement in USD' }))
    expect(inr.getByText('Closing balance').closest('[role="status"]')).toHaveTextContent('Riya owes you ₹500')
    expect(usd.getByText('Closing balance').closest('[role="status"]')).toHaveTextContent('Riya owes you $20')
    expect(screen.getByRole('heading', { name: 'In USD' })).toBeInTheDocument()
  })

  it('shares the statement as text by name, prints it, and downloads a spreadsheet', async () => {
    seed()
    const { user } = renderAt(passbookPath(riya), <PassbookScreen />)
    await user.click(screen.getByRole('button', { name: 'Share as text' }))
    const text = vi.mocked(shareResult).mock.calls[0]?.[0] ?? ''
    expect(text).toContain('*Statement: Ayush and Riya*')
    expect(text).toContain('20 Aug 2026 · Cash\nAyush lent Riya: +₹2,000 → Riya owes Ayush ₹2,000')
    expect(text).toContain('25 Oct 2026 · Scooter (Goa trip)')
    expect(text).toContain('*Closing balance: Riya owes Ayush ₹2,350*')
    expect(text).not.toMatch(/\bYou\b|\byou\b/)
    expect(await screen.findByText('Statement copied. Paste it in a chat.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(printPage).toHaveBeenCalledWith('Statement')
    // The sheet for paper is in the page, by name.
    const sheet = within(screen.getByRole('article', { name: 'Statement', hidden: true }))
    expect(sheet.getByText('Ayush and Riya')).toBeInTheDocument()
    expect(sheet.getByText('Ayush gave')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download spreadsheet' }))
    await waitFor(() => expect(shareFile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(shareFile).mock.calls[0]?.[1]).toBe('settle-statement-riya-2026-11-15.csv')
    expect(await screen.findByText('Statement saved as a spreadsheet')).toBeInTheDocument()
  })

  it('empty: says what will show up here and offers to split something', async () => {
    const { user } = renderAt(passbookPath(sam), <PassbookScreen />)
    expect(screen.getByRole('heading', { name: 'No entries with Sam yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share as text' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split something with Sam' }))
    expect(currentUrl()).toBe(`/app/split/new?friend=${sam}`)
  })

  it('someone who isn’t in your people, or yourself: nothing to show', async () => {
    const { user } = renderAt(passbookPath('nobody'), <PassbookScreen />)
    expect(screen.getByRole('heading', { name: 'No statement to show' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See your people' }))
    expect(currentUrl()).toBe('/app/friends')
  })

  it('also answers under the person’s own page address', () => {
    seed()
    renderAt(`/app/friends/${riya}/statement`, <PassbookScreen />)
    expect(closing()).toHaveTextContent('Riya owes you ₹2,350')
  })
})

describe('PassbookLink', () => {
  it('shows nothing until there is an entry, and never for yourself', () => {
    const { container } = renderAt('/app/friends/x', <PassbookLink friendId={sam} />)
    expect(container).toBeEmptyDOMElement()
    seed()
    const me = renderAt('/app/you', <PassbookLink friendId={ME_ID} />)
    expect(me.container).toBeEmptyDOMElement()
  })

  it('says how many entries there are and opens the statement', async () => {
    seed()
    const { user } = renderAt(`/app/friends/${riya}`, <List><PassbookLink friendId={riya} /></List>)
    const row = screen.getByRole('button', { name: /Statement/ })
    expect(row).toHaveTextContent('5 entries, with the balance after each')
    await user.click(row)
    expect(currentUrl()).toBe(`/app/people/${riya}/statement`)
  })
})

describe('the statement as text and as a spreadsheet', () => {
  const names = { name: 'Riya', me: 'Ayush' }

  it('without a name of your own, the text speaks from your side', () => {
    seed()
    const book = passbook({ friendId: riya, expenses: expensesStore.get(), groups: groupsStore.get(), currency: 'INR', today: '2026-11-15' })
    const text = passbookText(book, { name: 'Riya', me: null })
    expect(text).toContain('*My statement with Riya*')
    expect(text).toContain('You lent Riya: +₹2,000 → Riya owes you ₹2,000')
    expect(text).toContain('Goa trip settles as a group')
    expect(text.endsWith('Made with Settle')).toBe(true)
  })

  it('a long statement shares its last lines and opens on the balance just before them', () => {
    for (let i = 0; i < SHARE_MAX_LINES + 5; i++) saveExpense(draft({ title: `Chai ${i + 1}`, total: 2_000, date: '2026-10-01', with: [riya] }))
    const book = passbook({ friendId: riya, expenses: expensesStore.get(), groups: groupsStore.get(), currency: 'INR', today: '2026-11-15' })
    const text = passbookText(book, names)
    expect(text).toContain('Opening balance: Riya owes Ayush ₹50')
    expect(text).toContain('The 5 entries before these are in the opening balance.')
    expect(text.match(/Ayush paid for Riya/g)).toHaveLength(SHARE_MAX_LINES)
    expect(text).toContain(`*Closing balance: Riya owes Ayush ₹${(SHARE_MAX_LINES + 5) * 10}*`)
  })

  it('the spreadsheet has an opening row, a row per entry and a closing row, with no signed numbers', () => {
    seed()
    const book = passbook({ friendId: riya, expenses: expensesStore.get(), groups: groupsStore.get(), currency: 'INR', today: '2026-11-15', range: 'month' })
    const rows = passbookCsv(book, names).trimEnd().split('\r\n')
    expect(rows[0]).toBe('Date,Details,Group,Entry,You gave,You got,Balance,Who owes,Currency')
    expect(rows[1]).toBe('2026-11-01,Opening balance,,,,,5500.00,Riya,INR')
    expect(rows[2]).toBe('2026-11-03,Cab,,Riya paid for you,,150.00,5350.00,Riya,INR')
    expect(rows[3]).toBe('2026-11-15,Goa trip,Goa trip,Settled as a group,,3000.00,2350.00,Riya,INR')
    expect(rows[4]).toBe('2026-11-15,Closing balance,,,0.00,3150.00,2350.00,Riya,INR')
    expect(rows).toHaveLength(5)
    expect(rows.join('\n')).not.toMatch(/,-\d/)
  })

  it('names the file after the person, safely', () => {
    expect(passbookCsvFilename('Riya Sharma', '2026-11-15')).toBe('settle-statement-riya-sharma-2026-11-15.csv')
    expect(passbookCsvFilename('रिया', '2026-11-15')).toBe('settle-statement-2026-11-15.csv')
  })
})

describe('passbookStore', () => {
  it('remembers the dates and ignores anything that isn’t one of the three', () => {
    expect(passbookStore.get().range).toBeNull()
    setPassbookRange('three')
    expect(passbookStore.get().range).toBe('three')
    setPassbookRange('decade' as never)
    expect(passbookStore.get().range).toBe('three')
  })

  it('reads junk as "not picked yet"', () => {
    expect(z.parse(passbookSchema, { range: 'forever' })).toEqual({ range: null })
    expect(z.parse(passbookSchema, { range: 42, extra: true })).toEqual({ range: null })
    expect(z.safeParse(passbookSchema, 'nonsense').success).toBe(false)
  })

  it('has nothing for Today', () => {
    expect(passbookToday(new Date(2026, 10, 15))).toEqual([])
  })
})
