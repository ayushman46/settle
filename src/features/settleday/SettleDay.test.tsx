import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, setGroupArchived, updateFriend, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import { shareResult } from '../../lib/share'
import { shareFile } from '../../share/shareFile'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { SettleDayCard } from './SettleDayCard'
import { SettleDayScreen } from './SettleDayScreen'
import { setSettleDay, settleDayFor } from './store'

vi.setConfig({ testTimeout: 30_000 })

// The real sheet hands off to a UPI app; here "paid" is one button that calls back as it would.
vi.mock('../../kit/UpiPaySheet', () => ({
  UpiPaySheet: ({ open, onClose, payee, amount, onMarkPaid }: UpiPaySheetProps) =>
    open ? (
      <div role="dialog" aria-label={`Pay ${payee.name}`}>
        <span>{amount}</span>
        <button
          type="button"
          onClick={() => {
            onMarkPaid?.()
            onClose()
          }}
        >
          I’ve paid
        </button>
      </div>
    ) : null,
}))
// Nothing leaves the test: what would be shared is caught here.
vi.mock('../../lib/share', async (original) => ({ ...(await original<Record<string, unknown>>()), shareResult: vi.fn(async () => 'shared') }))
vi.mock('../../share/shareFile', async (original) => ({ ...(await original<Record<string, unknown>>()), shareFile: vi.fn(async () => 'downloaded') }))

/** Sunday 15 Nov 2026, noon. */
const NOW = new Date(2026, 10, 15, 12)
const EARLIER = new Date(2026, 9, 1).getTime()

let riya: string
let sam: string
let flat: Group

const live = (): Group => groupsStore.get().find((g) => g.id === flat.id)!
const path = (): string => `/app/groups/${flat.id}/settle-day`

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetProScreens()
  vi.mocked(shareResult).mockClear()
  vi.mocked(shareFile).mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  updateFriend(riya, { upiId: 'riya@okicici' })
  flat = createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => {
  vi.useRealTimers()
})

/** You owe Riya ₹200; Sam owes Riya ₹400. */
function spend(): void {
  saveExpense(draft({ title: 'Rent', total: 120_000, payerId: riya, groupId: flat.id, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Gas', total: 80_000, payerId: ME_ID, groupId: flat.id, participants: everyone(ME_ID, sam) }))
}

describe('SettleDayCard', () => {
  it('no day yet: one quiet line with day chips; a tap sets it, Undo takes it back', async () => {
    const { user } = renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByRole('heading', { name: 'Pick a settle day' })).toBeInTheDocument()
    expect(screen.getByText('One day a month when everyone in Flat 4B clears what they owe.')).toBeInTheDocument()
    const chips = within(screen.getByRole('radiogroup', { name: 'Settle day for Flat 4B' }))
    expect(chips.getAllByRole('radio').map((c) => c.textContent)).toEqual(['1st', '5th', '10th', 'Last day', 'Other'])

    await user.click(chips.getByRole('radio', { name: '5th' }))
    expect(settleDayFor(flat.id)).toEqual({ day: 5, setAt: NOW.getTime() })
    expect(screen.getByText('Settle day set: the 5th of every month')).toBeInTheDocument()
    // 15 Nov to 5 Dec.
    expect(screen.getByRole('button', { name: 'Settle day is the 5th: 20 days to go. Next one: Sat, 5 Dec. Open settle day' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(settleDayFor(flat.id)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Pick a settle day' })).toBeInTheDocument()
  })

  it('“Other” offers every day from 1 to 28, and “Last day” follows the month', async () => {
    const { user } = renderAt('/app', <SettleDayCard group={flat} />)
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    const sheet = await screen.findByRole('dialog', { name: 'Which day of the month?' })
    expect(within(sheet).getAllByRole('radio')).toHaveLength(29)
    expect(within(sheet).queryByRole('radio', { name: '29th' })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('radio', { name: '12th' }))
    expect(settleDayFor(flat.id)?.day).toBe(12)
    expect(await screen.findByText('Settle day is the 12th: 27 days to go')).toBeInTheDocument()
  })

  it('counts down, says “tomorrow” the day before, and opens the settle-day page', async () => {
    setSettleDay(flat.id, 'last', EARLIER)
    const { user, unmount } = renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByText('Settle day is the last day of the month: 15 days to go')).toBeInTheDocument()
    expect(screen.getByText('Next one: Mon, 30 Nov')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Open settle day$/ }))
    expect(currentUrl()).toBe(path())
    unmount()

    setSettleDay(flat.id, 16, EARLIER)
    renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByText('Settle day is the 16th: tomorrow')).toBeInTheDocument()
  })

  it('on the day: “Today is settle day”, what you pay, and the way in', async () => {
    spend()
    setSettleDay(flat.id, 15, EARLIER)
    const { user } = renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByRole('heading', { name: 'Today is settle day' })).toBeInTheDocument()
    expect(screen.getByText('You pay ₹200. 2 payments clear Flat 4B.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Settle now' }))
    expect(currentUrl()).toBe(path())
  })

  it('on the day with nobody owing: says everyone is square, and doesn’t push', () => {
    setSettleDay(flat.id, 15, EARLIER)
    renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByRole('heading', { name: 'Today is settle day' })).toBeInTheDocument()
    expect(screen.getByText('Everyone in Flat 4B is square. Nothing to pay.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Settle now' })).not.toBeInTheDocument()
  })

  it('the day after: still asks while money is open, but not for a day that was only picked today', () => {
    spend()
    setSettleDay(flat.id, 14, EARLIER)
    const { unmount } = renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.getByRole('heading', { name: 'Settle day was yesterday' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settle now' })).toBeInTheDocument()
    unmount()

    setSettleDay(flat.id, 14)
    renderAt('/app', <SettleDayCard group={flat} />)
    expect(screen.queryByRole('heading', { name: 'Settle day was yesterday' })).not.toBeInTheDocument()
    // 15 Nov to 14 Dec.
    expect(screen.getByText('Settle day is the 14th: 29 days to go')).toBeInTheDocument()
  })

  it('shows nothing for an archived group or a group of one', () => {
    const solo = createGroup({ name: 'Just me', emoji: '🙂', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    const first = renderAt('/app', <SettleDayCard group={solo} />)
    expect(first.container).toBeEmptyDOMElement()
    first.unmount()
    const archived = setGroupArchived(flat.id, true)
    const second = renderAt('/app', <SettleDayCard group={archived} />)
    expect(second.container).toBeEmptyDOMElement()
  })
})

describe('SettleDayScreen', () => {
  it('on the day: yours first with Pay, the payment is recorded, and Undo puts it back', async () => {
    spend()
    setSettleDay(flat.id, 15, EARLIER)
    const { user } = renderAt(path(), <SettleDayScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settle day' })).toBeInTheDocument()
    expect(screen.getByText('Today is settle day')).toBeInTheDocument()
    const mine = within(screen.getByRole('region', { name: 'Yours to pay' }))
    expect(mine.getByText('You pay Riya')).toBeInTheDocument()
    expect(mine.getByText('₹200')).toBeInTheDocument()
    const rest = within(screen.getByRole('region', { name: 'Everyone else' }))
    expect(rest.getByText('Sam pays Riya')).toBeInTheDocument()
    expect(rest.getByText('₹400')).toBeInTheDocument()

    await user.click(mine.getByRole('button', { name: 'Pay Riya ₹200' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Pay Riya' })).getByRole('button', { name: 'I’ve paid' }))
    expect(live().settlements).toMatchObject([{ fromId: ME_ID, toId: riya, amount: 20_000, method: 'upi', date: '2026-11-15' }])
    expect(screen.queryByRole('region', { name: 'Yours to pay' })).not.toBeInTheDocument()
    expect(screen.getByText('Recorded: You paid Riya ₹200')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Paid today' })).getByText('You paid Riya')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(live().settlements).toEqual([])
    expect(within(screen.getByRole('region', { name: 'Yours to pay' })).getByText('You pay Riya')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Paid today' })).not.toBeInTheDocument()
  })

  it('“Mark paid” records someone else’s payment in one tap, with Undo; the last one leaves everyone square', async () => {
    spend()
    setSettleDay(flat.id, 15, EARLIER)
    const { user } = renderAt(path(), <SettleDayScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹400' }))
    expect(live().settlements).toMatchObject([{ fromId: sam, toId: riya, amount: 40_000, method: 'other' }])
    expect(screen.getByText('Recorded: Sam paid Riya ₹400')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(live().settlements).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹400' }))
    await user.click(screen.getByRole('button', { name: 'Mark paid: You pay Riya ₹200' }))
    expect(screen.getByRole('heading', { name: 'Everyone is square' })).toBeInTheDocument()
    expect(screen.getByText('Nothing to settle in Flat 4B right now.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Paid today' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('“Remind” opens the share sheet with the message ready: nothing is sent from the app', async () => {
    spend()
    setSettleDay(flat.id, 15, EARLIER)
    const { user } = renderAt(path(), <SettleDayScreen />)
    await user.click(screen.getByRole('button', { name: 'Remind Sam about ₹400' }))
    await waitFor(() => expect(shareResult).toHaveBeenCalledTimes(1))
    expect(vi.mocked(shareResult).mock.calls[0]?.[0]).toBe('Hi Sam, today is settle day for Flat 4B. Your part: ₹400 to Riya.\nUPI ID for Riya: riya@okicici')
    // Reminding records nothing.
    expect(live().settlements).toEqual([])
  })

  it('tells the group the day, and makes a calendar file that repeats every month', async () => {
    spend()
    setSettleDay(flat.id, 5, EARLIER)
    const { user } = renderAt(path(), <SettleDayScreen />)
    expect(screen.getByText('On the 5th of every month: 20 days to go')).toBeInTheDocument()
    const tell = within(screen.getByRole('region', { name: 'Tell the group' }))
    const message = 'Our settle day for Flat 4B is the 5th of every month. On that day everyone clears what they owe in the group.\nNext one: Sat, 5 Dec.'
    expect(tell.getByText((_, el) => el?.tagName === 'P' && el.textContent === message)).toBeInTheDocument()
    await user.click(tell.getByRole('button', { name: 'Tell the group' }))
    await waitFor(() => expect(shareResult).toHaveBeenCalledTimes(1))
    expect(vi.mocked(shareResult).mock.calls[0]?.[0]).toBe(message)

    await user.click(tell.getByRole('button', { name: 'Add to calendar' }))
    await waitFor(() => expect(shareFile).toHaveBeenCalledTimes(1))
    const [blob, filename] = vi.mocked(shareFile).mock.calls[0]!
    expect(filename).toBe('settle-day-Flat 4B.ics')
    expect(blob.type).toBe('text/calendar;charset=utf-8')
    const text = await readText(blob)
    expect(text).toContain('DTSTART;VALUE=DATE:20261205\r\nDTEND;VALUE=DATE:20261206\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=5\r\nSUMMARY:Settle day: Flat 4B\r\n')
    expect(await screen.findByText('Calendar file saved. Open it to add settle day to your calendar.')).toBeInTheDocument()
  })

  it('no day and no expenses: explains itself in a line, offers the days, and claims nothing', async () => {
    const { user } = renderAt(path(), <SettleDayScreen />)
    expect(screen.getByText(/^One day a month when everyone clears what they owe\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Everyone is square' })).toBeInTheDocument()
    expect(screen.getByText('No expenses in Flat 4B yet, so there’s nothing to settle.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tell the group' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('radiogroup', { name: 'Settle day for Flat 4B' })).getByRole('radio', { name: 'Last day' }))
    expect(settleDayFor(flat.id)?.day).toBe('last')
    expect(screen.getByText('On the last day of every month: 15 days to go')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tell the group' })).toBeInTheDocument()
  })

  it('changing or removing the day can be undone, back to exactly what it was', async () => {
    setSettleDay(flat.id, 5, EARLIER)
    const { user } = renderAt(path(), <SettleDayScreen />)
    const days = () => within(screen.getByRole('region', { name: 'The day' }))
    expect(days().getByRole('radio', { name: '5th' })).toHaveAttribute('aria-checked', 'true')
    await user.click(days().getByRole('radio', { name: '10th' }))
    expect(settleDayFor(flat.id)).toEqual({ day: 10, setAt: NOW.getTime() })
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(settleDayFor(flat.id)).toEqual({ day: 5, setAt: EARLIER })

    await user.click(screen.getByRole('button', { name: 'Remove settle day' }))
    expect(settleDayFor(flat.id)).toBeNull()
    expect(screen.getByText('Settle day removed for Flat 4B')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(settleDayFor(flat.id)).toEqual({ day: 5, setAt: EARLIER })
  })

  it('a group that no longer exists says so', () => {
    renderAt('/app/groups/nope/settle-day', <SettleDayScreen />)
    expect(screen.getByRole('heading', { name: 'This group is gone' })).toBeInTheDocument()
  })
})
