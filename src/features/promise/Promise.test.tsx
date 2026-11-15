import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, groupsStore, updateFriend, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import type * as ShareModule from '../../lib/share'
import { friendBalance, netIn } from '../friends/friendBalance'
import { recordBetween } from '../kist/actions'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { notePromise } from './actions'
import { PromiseChip } from './PromiseChip'
import { PromiseSheet } from './PromiseSheet'
import { PromisesScreen } from './PromisesScreen'
import { promisesNow } from './store'

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

const shareResult = vi.hoisted(() => vi.fn(async (_text: string) => 'copied' as const))
vi.mock('../../lib/share', async (original) => ({ ...(await original<typeof ShareModule>()), shareResult }))

/** Sunday 15 Nov 2026, noon. */
const START = new Date(2026, 10, 15, 12)
let clock = START.getTime()
function tick(minutes = 1): void {
  clock += minutes * 60_000
  vi.setSystemTime(new Date(clock))
}
function goTo(year: number, month: number, day: number): void {
  clock = new Date(year, month - 1, day, 12).getTime()
  vi.setSystemTime(new Date(clock))
}

let riya: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock = START.getTime()
  vi.setSystemTime(START)
  resetProScreens()
  shareResult.mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  updateFriend(riya, { phone: '9876543210' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** + Riya owes me, − I owe Riya. */
const net = (): number => netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')

function lend(amount = 200_000): void {
  saveLoan({ direction: 'lent', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
}

function borrow(amount = 120_000): void {
  saveLoan({ direction: 'borrowed', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
}

function note(amount = 50_000, due = '2026-11-20', direction: 'pay' | 'receive' = 'receive') {
  const noted = notePromise({ friendId: riya, direction, currency: 'INR', amount, due }, new Date(clock))
  if (!noted) throw new Error('not noted')
  tick()
  return noted.promise
}

describe('PromiseSheet', () => {
  it('their promise: all of it by Friday unless changed, saved in one tap, with the message ready to send', async () => {
    lend()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { user } = renderAt('/app/friends/riya', <PromiseSheet friendId={riya} open onClose={() => undefined} />)
    const sheet = screen.getByRole('dialog', { name: 'Promise to pay' })
    expect(within(sheet).getByText('Riya owes you ₹2,000. When did Riya say it will come?')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Friday' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Note ₹2,000 by Friday 20 Nov' })).toBeInTheDocument()

    const amount = within(sheet).getByLabelText('How much')
    await user.clear(amount)
    await user.type(amount, '500')
    await user.click(within(sheet).getByRole('button', { name: 'The 1st' }))
    await user.click(screen.getByRole('button', { name: 'Note ₹500 by Tuesday 1 Dec' }))

    expect(promisesNow()).toHaveLength(1)
    expect(promisesNow()[0]).toMatchObject({ friendId: riya, direction: 'receive', amount: 50_000, owedThen: 200_000, due: '2026-12-01', outcome: null })
    // Noting a promise moves no money.
    expect(net()).toBe(200_000)
    expect(screen.getByText('Noted: Riya will pay ₹500 by Tuesday 1 Dec')).toBeInTheDocument()
    expect(screen.getByText('Noting that you’ll pay ₹500 by Tuesday 1 Dec.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send on WhatsApp' }))
    expect(open.mock.calls[0]?.[0]).toBe(`https://wa.me/919876543210?text=${encodeURIComponent('Noting that you’ll pay ₹500 by Tuesday 1 Dec.')}`)

    // Undo takes the promise back and returns to the form.
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(promisesNow()).toEqual([])
    expect(screen.getByRole('button', { name: /^Note ₹/ })).toBeInTheDocument()
  })

  it('your promise: who is promising follows who owes whom, and any day can be picked', async () => {
    borrow()
    const { user } = renderAt('/app/friends/riya', <PromiseSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByText('You owe Riya ₹1,200. When will you pay?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Another day/), { target: { value: '2026-11-25' } })
    await user.click(screen.getByRole('button', { name: 'Promise ₹1,200 by Wednesday 25 Nov' }))
    expect(promisesNow()[0]).toMatchObject({ direction: 'pay', amount: 120_000, due: '2026-11-25' })
    expect(screen.getByText('Promised: you’ll pay Riya ₹1,200 by Wednesday 25 Nov')).toBeInTheDocument()
    expect(screen.getByText('I’ll pay you ₹1,200 by Wednesday 25 Nov.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Share another way' }))
    expect(shareResult.mock.calls[0]?.[0]).toBe('I’ll pay you ₹1,200 by Wednesday 25 Nov.')
    expect(await screen.findByText('Copied. Paste it in your chat.')).toBeInTheDocument()
  })

  it('does not save more than is owed or an empty amount: it stays and says what is wrong', async () => {
    lend()
    const onClose = vi.fn()
    const { user } = renderAt('/app/friends/riya', <PromiseSheet friendId={riya} open onClose={onClose} />)
    const amount = screen.getByLabelText('How much')
    await user.clear(amount)
    await user.type(amount, '2500')
    expect(screen.getAllByText('That is more than the ₹2,000 owed').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'That is more than the ₹2,000 owed' }))
    await user.clear(amount)
    await user.click(screen.getByRole('button', { name: 'Type how much is promised' }))
    expect(promisesNow()).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('an open promise is changed, not doubled, and can be removed with Undo', async () => {
    lend()
    const old = note(50_000, '2026-11-18')
    const onClose = vi.fn()
    const { user } = renderAt('/app/friends/riya', <PromiseSheet friendId={riya} open onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Change the promise' })).toBeInTheDocument()
    // It starts from the promise as it is.
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }))
    await user.click(screen.getByRole('button', { name: 'Note ₹500 by Monday 16 Nov' }))
    expect(promisesNow()).toHaveLength(1)
    expect(promisesNow()[0]).toMatchObject({ amount: 50_000, due: '2026-11-16' })
    expect(screen.getByText('Promise changed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(promisesNow()).toEqual([old])

    await user.click(screen.getByRole('button', { name: 'Remove the promise' }))
    expect(promisesNow()).toEqual([])
    expect(onClose).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(promisesNow()).toEqual([old])
  })

  it('says so when nothing is owed', () => {
    renderAt('/app/friends/riya', <PromiseSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Nothing is owed between you and Riya' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Note / })).not.toBeInTheDocument()
  })

  it('shows nothing for someone who is not in your people', () => {
    const { container } = renderAt('/app', <PromiseSheet friendId="nobody" open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PromiseChip', () => {
  it('shows nothing when there is no promise', () => {
    lend()
    const { container } = renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says by when, and whose promise it is', () => {
    lend()
    note()
    const { unmount } = renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(screen.getByText('Promised by Fri 20 Nov')).toBeInTheDocument()
    unmount()
    resetProScreens()
    updateProfile({ name: 'Ayush', currency: 'INR' })
    riya = addFriend({ name: 'Riya' }).id
    borrow()
    note(100_000, '2026-11-20', 'pay')
    renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(screen.getByText('You promised by Fri 20 Nov')).toBeInTheDocument()
  })

  it('says "by today" on its day', () => {
    lend()
    note()
    goTo(2026, 11, 20)
    renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(screen.getByText('Promised by today')).toBeInTheDocument()
  })

  it('says how long ago it was due once the date has passed unpaid, and closes it as broken', async () => {
    lend()
    note()
    goTo(2026, 11, 21)
    const first = renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(screen.getByText('Promise was due yesterday')).toBeInTheDocument()
    await waitFor(() => expect(promisesNow()[0]?.outcome).toBe('broken'))
    first.unmount()
    goTo(2026, 11, 22)
    renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(screen.getByText('Promise was due 2 days ago')).toBeInTheDocument()
  })

  it('goes away once the promise is kept, or paid late', () => {
    lend()
    note()
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-16')
    const { container } = renderAt('/app/collect', <PromiseChip friendId={riya} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PromisesScreen', () => {
  it('empty: says what it is for and where to start', async () => {
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    expect(screen.getByRole('heading', { name: 'No promises yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See who owes you' }))
    expect(currentUrl()).toBe('/app/collect')
  })

  it('offers the people a promise can be noted with, and opens the sheet for them', async () => {
    lend()
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    await user.click(screen.getByRole('button', { name: 'Note a promise with Riya. Owes you ₹2,000' }))
    expect(await screen.findByRole('dialog', { name: 'Promise to pay' })).toBeInTheDocument()
  })

  it('their promise: "Got" records the payment and the promise is kept; Undo opens it again', async () => {
    lend()
    note()
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    const open = (): HTMLElement => screen.getByRole('list', { name: 'Open' })
    expect(within(open()).getByText('Riya will pay you ₹500')).toBeInTheDocument()
    expect(within(open()).getByText('By Fri 20 Nov')).toBeInTheDocument()
    // Someone with an open promise is not offered a second one.
    expect(screen.queryByRole('list', { name: 'Note a promise' })).not.toBeInTheDocument()

    await user.click(within(open()).getByRole('button', { name: 'Ask Riya' }))
    expect(shareResult.mock.calls[0]?.[0]).toBe('A reminder: you said you’ll pay ₹500 by Friday 20 Nov.')

    await user.click(within(open()).getByRole('button', { name: 'Got ₹500' }))
    expect(net()).toBe(150_000)
    expect(screen.getByText('Got ₹500 from Riya')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Open' })).not.toBeInTheDocument()
    const history = screen.getByRole('list', { name: 'Kept and broken' })
    expect(within(history).getByText('Riya promised you ₹500')).toBeInTheDocument()
    expect(within(history).getByText('Kept · was due Fri 20 Nov')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'By person' })).getByText('Kept 1 of 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(net()).toBe(200_000)
    expect(within(open()).getByText('Riya will pay you ₹500')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Kept and broken' })).not.toBeInTheDocument()
  })

  it('your promise: Pay opens the UPI sheet, and "I’ve paid" keeps the promise', async () => {
    borrow()
    note(100_000, '2026-11-20', 'pay')
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    expect(screen.getByText('You’ll pay Riya ₹1,000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay ₹1,000' }))
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    expect(sheet).toHaveTextContent('100000')
    expect(net()).toBe(-120_000)
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))
    expect(net()).toBe(-20_000)
    expect(screen.getByText('Paid Riya ₹1,000')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Kept and broken' })).getByText('You promised Riya ₹1,000')).toBeInTheDocument()
  })

  it('part paid: says what is still to come and asks only for that', () => {
    lend()
    note()
    recordBetween(riya, 'receive', 20_000, 'INR', 'upi', '2026-11-16')
    renderAt('/app/promises', <PromisesScreen />)
    expect(screen.getByText('By Fri 20 Nov · ₹300 of it still to come')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Got ₹300' })).toBeInTheDocument()
  })

  it('a promise whose date passed unpaid is broken, and can be put right by hand, with Undo', async () => {
    lend()
    note()
    goTo(2026, 11, 22)
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    const history = (): HTMLElement => screen.getByRole('list', { name: 'Kept and broken' })
    expect(within(history()).getByText('Broken · was due Fri 20 Nov')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'By person' })).getByText('Kept 0 of 1')).toBeInTheDocument()
    await waitFor(() => expect(promisesNow()[0]?.outcome).toBe('broken'))
    // Riya can be asked for a new date.
    expect(screen.getByRole('button', { name: 'Note a promise with Riya. Owes you ₹2,000' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'It was kept: the promise with Riya due Fri 20 Nov' }))
    expect(within(history()).getByText('Kept · was due Fri 20 Nov')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'By person' })).getByText('Kept 1 of 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(within(history()).getByText('Broken · was due Fri 20 Nov')).toBeInTheDocument()
  })

  it('Change opens the promise to edit', async () => {
    lend()
    note()
    const { user } = renderAt('/app/promises', <PromisesScreen />)
    await user.click(screen.getByRole('button', { name: 'Change the promise with Riya' }))
    expect(await screen.findByRole('dialog', { name: 'Change the promise' })).toBeInTheDocument()
  })
})
