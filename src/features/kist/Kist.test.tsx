import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, recordSettlement, saveExpense, updateFriend, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import type * as ShareModule from '../../lib/share'
import { friendBalance, netIn } from '../friends/friendBalance'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { payNextPart, startPlan } from './actions'
import type { KistPlan } from './engine'
import { KistPlanScreen } from './KistPlanScreen'
import { KistScreen } from './KistScreen'
import { KistStartSheet } from './KistStartSheet'
import { kistStore, planById } from './store'

vi.setConfig({ testTimeout: 30_000 })

// The real sheet hands off to a UPI app; here "paid" is one button that calls back as it would.
vi.mock('../../kit/UpiPaySheet', () => ({
  UpiPaySheet: ({ open, onClose, payee, amount, note, onMarkPaid }: UpiPaySheetProps) =>
    open ? (
      <div role="dialog" aria-label={`Pay ${payee.name}`}>
        <span>{`${amount} ${note ?? ''}`}</span>
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

let riya: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock = START.getTime()
  vi.setSystemTime(START)
  resetProScreens()
  shareResult.mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okhdfc' })
  riya = addFriend({ name: 'Riya' }).id
  updateFriend(riya, { upiId: 'riya@okicici' })
})

afterEach(() => {
  vi.useRealTimers()
})

/** + Riya owes me, − I owe Riya. */
const net = (): number => netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')

function borrow(amount = 600_000) {
  const loan = saveLoan({ direction: 'borrowed', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
  return loan
}

function lend(amount = 600_000) {
  const loan = saveLoan({ direction: 'lent', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
  return loan
}

function start(direction: 'pay' | 'receive' = 'pay', total = 600_000): KistPlan {
  const plan = startPlan({ friendId: riya, direction, currency: 'INR', every: 'month', total, count: 3, first: '2026-12-01' })
  if (!plan) throw new Error('no plan')
  tick()
  return plan
}

const parts = (): string[] => within(screen.getByRole('list', { name: 'The parts' })).getAllByRole('listitem').map((li) => li.textContent ?? '')

describe('KistStartSheet', () => {
  it('is filled in already: what is owed, three parts, monthly from the next 1st, and shows the plan before saving', async () => {
    borrow()
    const onClose = vi.fn()
    const { user } = renderAt('/app/friends/riya', <KistStartSheet friendId={riya} open onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Pay in parts' })
    expect(within(sheet).getByText('You owe Riya ₹6,000. Pay it in small parts, on dates you both agree.')).toBeInTheDocument()
    expect(within(sheet).getByRole('radio', { name: 'Every month' })).toHaveAttribute('aria-checked', 'true')
    const preview = (): string[] => within(within(sheet).getByRole('list', { name: 'The plan' })).getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(preview()).toEqual(['Part 1 · Tue 1 Dec₹2,000', 'Part 2 · Fri 1 Jan 2027₹2,000', 'Part 3 · Mon 1 Feb 2027₹2,000'])

    // Four parts, weekly: the dates and amounts follow at once.
    await user.click(within(sheet).getByRole('button', { name: /^Increase/ }))
    await user.click(within(sheet).getByRole('radio', { name: 'Every week' }))
    expect(preview()).toEqual(['Part 1 · Sun 22 Nov₹1,500', 'Part 2 · Sun 29 Nov₹1,500', 'Part 3 · Sun 6 Dec₹1,500', 'Part 4 · Sun 13 Dec₹1,500'])

    await user.click(screen.getByRole('button', { name: 'Start the plan' }))
    const plan = kistStore.get().plans[0]!
    expect(plan).toMatchObject({ friendId: riya, direction: 'pay', currency: 'INR', every: 'week' })
    expect(plan.parts.map((p) => [p.amount, p.due])).toEqual([
      [150_000, '2026-11-22'],
      [150_000, '2026-11-29'],
      [150_000, '2026-12-06'],
      [150_000, '2026-12-13'],
    ])
    expect(onClose).toHaveBeenCalled()
    expect(currentUrl()).toBe(`/app/kist/${plan.id}`)
    // Starting a plan moves no money.
    expect(net()).toBe(-600_000)

    expect(screen.getByText('Plan started with Riya')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(kistStore.get().plans).toEqual([])
  })

  it('takes the other direction from who owes whom, a smaller amount, and a first date on the 31st', async () => {
    lend(1_000_000)
    const { user } = renderAt('/app/friends/riya', <KistStartSheet friendId={riya} open onClose={() => undefined} />)
    const sheet = screen.getByRole('dialog', { name: 'Pay in parts' })
    expect(within(sheet).getByText('Riya owes you ₹10,000. Take it in small parts, on dates you both agree.')).toBeInTheDocument()
    const amount = within(sheet).getByLabelText('Amount for the plan')
    await user.clear(amount)
    await user.type(amount, '7000')
    fireEvent.change(within(sheet).getByLabelText(/^First part on/), { target: { value: '2027-01-31' } })
    await user.click(screen.getByRole('button', { name: 'Start the plan' }))
    const plan = kistStore.get().plans[0]!
    expect(plan.direction).toBe('receive')
    expect(plan.parts.map((p) => [p.amount, p.due])).toEqual([
      [233_300, '2027-01-31'],
      [233_300, '2027-02-28'],
      [233_400, '2027-03-31'],
    ])
  })

  it('does not save more than is owed or an empty amount: it stays and says what is wrong', async () => {
    borrow()
    const onClose = vi.fn()
    const { user } = renderAt('/app/friends/riya', <KistStartSheet friendId={riya} open onClose={onClose} />)
    const amount = screen.getByLabelText('Amount for the plan')
    await user.clear(amount)
    await user.type(amount, '9000')
    expect(screen.getByText('That is more than the ₹6,000 owed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start the plan' }))
    await user.clear(amount)
    await user.click(screen.getByRole('button', { name: 'Start the plan' }))
    expect(screen.getByText('Type the amount for the plan')).toBeInTheDocument()
    expect(kistStore.get().plans).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says so when nothing is owed, and offers to add udhaar', async () => {
    const { user } = renderAt('/app/friends/riya', <KistStartSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Nothing is owed between you and Riya' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start the plan' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add udhaar' }))
    expect(currentUrl()).toBe('/app/lend')
  })

  it('opens the plan that is already running instead of starting a second one', async () => {
    borrow()
    const plan = start()
    const { user } = renderAt('/app/friends/riya', <KistStartSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'You already have a plan with Riya' })).toBeInTheDocument()
    expect(screen.getByText('₹6,000 is left on it. One plan at a time, so every payment has one place to go.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open the plan' }))
    expect(currentUrl()).toBe(`/app/kist/${plan.id}`)
  })

  it('shows nothing for someone who is not in your people', () => {
    const { container } = renderAt('/app', <KistStartSheet friendId="nobody" open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('KistScreen', () => {
  it('empty: says what it is for and offers the one way in', async () => {
    const { user } = renderAt('/app/kist', <KistScreen />)
    expect(screen.getByRole('heading', { name: 'Nothing to pay in parts yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add udhaar' }))
    expect(currentUrl()).toBe('/app/lend')
  })

  it('offers the people a plan can be started with, and opens the sheet filled in for them', async () => {
    borrow()
    const { user } = renderAt('/app/kist', <KistScreen />)
    expect(screen.getByText(/^Kist: a big amount cleared in a few small parts/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start a plan with Riya. You owe ₹6,000' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay in parts' })
    expect(within(sheet).getByText(/^You owe Riya ₹6,000/)).toBeInTheDocument()
  })

  it('lists the plans you pay and the ones you receive, each with the part that comes next', async () => {
    borrow()
    const plan = start()
    const sam = addFriend({ name: 'Sam' }).id
    saveLoan({ direction: 'lent', friendId: sam, amount: 300_000, currency: 'INR', what: 'cash', date: '2026-11-01' })
    startPlan({ friendId: sam, direction: 'receive', currency: 'INR', every: 'week', total: 300_000, count: 3, first: '2026-11-15' })
    const { user } = renderAt('/app/kist', <KistScreen />)
    expect(within(screen.getByRole('list', { name: 'You pay' })).getByRole('button', { name: 'Plan with Riya. Part 1 of 3: ₹2,000 on Tue 1 Dec' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'You receive' })).getByRole('button', { name: 'Plan with Sam. Part 1 of 3: ₹1,000 is due today' })).toBeInTheDocument()
    // Both have a plan running: nobody is left to start one with.
    expect(screen.queryByRole('list', { name: 'Start a plan' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Plan with Riya/ }))
    expect(currentUrl()).toBe(`/app/kist/${plan.id}`)
  })

  it('keeps finished plans in their own list', () => {
    borrow(300_000)
    const plan = start('pay', 300_000)
    for (let i = 0; i < 3; i += 1) payNextPart(plan.id, 'upi')
    renderAt('/app/kist', <KistScreen />)
    expect(within(screen.getByRole('list', { name: 'Finished' })).getByRole('button', { name: 'Plan with Riya. ₹3,000 cleared in 3 parts' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'You pay' })).not.toBeInTheDocument()
  })
})

describe('KistPlanScreen', () => {
  it('you pay: Pay opens the UPI sheet, and "I’ve paid" records one payment and ticks the part; Undo puts it back', async () => {
    const loan = borrow()
    const plan = start()
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByRole('heading', { name: 'You pay Riya in parts' })).toBeInTheDocument()
    expect(screen.getByText('₹6,000 in 3 parts, every month')).toBeInTheDocument()
    expect(screen.getByText('₹0 of ₹6,000 paid')).toBeInTheDocument()
    expect(parts()).toEqual(['1Part 1Due Tue 1 Dec₹2,000', '2Part 2Due Fri 1 Jan 2027₹2,000', '3Part 3Due Mon 1 Feb 2027₹2,000'])

    const next = screen.getByRole('region', { name: 'The part to pay next' })
    expect(within(next).getByRole('heading', { name: 'Part 1 of 3' })).toBeInTheDocument()
    await user.click(within(next).getByRole('button', { name: 'Pay ₹2,000' }))
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    expect(sheet).toHaveTextContent('200000 Part 1 of 3')
    // Nothing is recorded until the person says it is paid.
    expect(net()).toBe(-600_000)
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))

    expect(net()).toBe(-400_000)
    expect(expensesStore.get().find((e) => e.id === loan.id)?.partPaid).toEqual({ [ME_ID]: 200_000 })
    expect(screen.getByText('Part 1 paid: ₹2,000 to Riya')).toBeInTheDocument()
    expect(screen.getByText('₹2,000 of ₹6,000 paid')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 parts · ₹4,000 left')).toBeInTheDocument()
    expect(parts()[0]).toBe('Part 1Paid Sun 15 Nov₹2,000')
    expect(within(screen.getByRole('region', { name: 'The part to pay next' })).getByRole('heading', { name: 'Part 2 of 3' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(net()).toBe(-600_000)
    expect(expensesStore.get().find((e) => e.id === loan.id)?.partPaid).toBeUndefined()
    expect(planById(plan.id)).toEqual(plan)
    expect(screen.getByText('₹0 of ₹6,000 paid')).toBeInTheDocument()
  })

  it('you pay another way, then pay it all off in one go', async () => {
    borrow()
    const plan = start()
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark part 1, ₹2,000, as paid another way' }))
    expect(net()).toBe(-400_000)
    await user.click(screen.getByRole('button', { name: 'Pay it all off: ₹4,000' }))
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    expect(sheet).toHaveTextContent('400000 Paying off the rest')
    await user.click(within(sheet).getByRole('button', { name: 'I’ve paid' }))
    expect(net()).toBe(0)
    expect(screen.getByText('All paid off: ₹4,000 to Riya')).toBeInTheDocument()
    expect(screen.getByText('All 3 parts paid')).toBeInTheDocument()
    expect(screen.getByText('₹6,000 cleared, one part at a time.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'The part to pay next' })).not.toBeInTheDocument()
    expect(parts().every((line) => line.includes('Paid Sun 15 Nov'))).toBe(true)
  })

  it('you receive: "Got" records the friend’s payment, and a reminder is ready to send', async () => {
    lend()
    const plan = start('receive')
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByRole('heading', { name: 'Riya pays you in parts' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send a reminder' }))
    expect(shareResult.mock.calls[0]?.[0]).toBe('A reminder: part 1 of 3 of our plan, ₹2,000, is due Tuesday 1 Dec.\nMy UPI ID: ayush@okhdfc')
    await user.click(screen.getByRole('button', { name: 'Got ₹2,000' }))
    expect(net()).toBe(400_000)
    expect(screen.getByText('Part 1 received: ₹2,000 from Riya')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /^Pay / })).not.toBeInTheDocument()
  })

  it('shares the whole plan as a message, with the paid parts marked', async () => {
    borrow()
    const plan = start()
    payNextPart(plan.id, 'upi')
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    await user.click(screen.getByRole('button', { name: 'Share the plan' }))
    expect(shareResult.mock.calls[0]?.[0]).toBe(
      ['Our plan: I’ll pay you ₹6,000 in 3 parts.', '1. ₹2,000 by Tue 1 Dec (paid)', '2. ₹2,000 by Fri 1 Jan 2027', '3. ₹2,000 by Mon 1 Feb 2027', '₹4,000 left.'].join('\n'),
    )
    expect(await screen.findByText('Copied. Paste it in your chat.')).toBeInTheDocument()
  })

  it('a payment recorded elsewhere is offered as the next part, and counting it records no second payment', async () => {
    const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Villa', total: 1_200_000, payerId: riya, groupId: group.id, participants: everyone(ME_ID, riya) }))
    tick()
    const plan = start()
    recordSettlement(group.id, { fromId: ME_ID, toId: riya, amount: 200_000, date: '2026-11-15', method: 'upi' })
    tick()
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByText('You now owe Riya ₹4,000, but this plan still has ₹6,000 left. ₹2,000 was paid outside this plan since it started.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Count it as part 1' }))
    expect(groupsStore.get().find((g) => g.id === group.id)?.settlements).toHaveLength(1)
    expect(net()).toBe(-400_000)
    expect(screen.getByText('Part counted. No new payment was recorded.')).toBeInTheDocument()
    expect(parts()[0]).toBe('Part 1Counted Sun 15 Nov: paid outside this plan₹2,000')
    expect(screen.queryByText(/^You now owe Riya/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByRole('button', { name: 'Count it as part 1' })).toBeInTheDocument()
  })

  it('says so when more is owed than the plan covers, and can take the rest in', async () => {
    borrow()
    const plan = start()
    saveExpense(draft({ title: 'Cab', total: 280_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByText('You owe Riya ₹7,400 in all. This plan covers ₹6,000 of it.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add the other ₹1,400 to the plan' }))
    expect(screen.getByText('The plan now covers ₹7,400')).toBeInTheDocument()
    expect(parts().map((line) => line.slice(-6))).toEqual(['₹2,466', '₹2,466', '₹2,468'])
    expect(screen.queryByText(/^You owe Riya ₹7,400 in all/)).not.toBeInTheDocument()
  })

  it('never asks for more than is owed: the pay button says the smaller amount, and why', async () => {
    const loan = borrow()
    const plan = start()
    expensesStore.update((list) => list.map((e) => (e.id === loan.id ? { ...e, partPaid: { [ME_ID]: 450_000 } } : e)))
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByText(/^You now owe Riya ₹1,500, but this plan still has ₹6,000 left\./)).toBeInTheDocument()
    expect(screen.getByText('Only ₹1,500 is still owed, so that is what paying this part records.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark part 1, ₹1,500, as paid another way' }))
    expect(net()).toBe(0)
    expect(screen.getByText('Finished early')).toBeInTheDocument()
    expect(parts()).toEqual(['Part 1Paid Sun 15 Nov₹1,500', '2Part 2Not needed₹2,000', '3Part 3Not needed₹2,000'])
  })

  it('nothing owed any more: no pay button, and the plan can be finished', async () => {
    const loan = borrow()
    const plan = start()
    expensesStore.update((list) => list.map((e) => (e.id === loan.id ? { ...e, total: 0, shares: { [ME_ID]: 0 } } : e)))
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(screen.getByText('You don’t owe Riya anything now, but this plan still has ₹6,000 left.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pay ₹/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Count it/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finish the plan' }))
    expect(screen.getByText('Plan finished')).toBeInTheDocument()
    expect(planById(plan.id)?.endedAt).not.toBeNull()
  })

  it('a late part says how late', () => {
    borrow()
    const plan = start()
    vi.setSystemTime(new Date(2026, 11, 4, 12))
    renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    expect(within(screen.getByRole('region', { name: 'The part to pay next' })).getByText('Was due Tue 1 Dec, 3 days ago')).toBeInTheDocument()
    expect(parts()[0]).toBe('1Part 1Was due Tue 1 Dec, 3 days late₹2,000')
  })

  it('deleting removes only the plan, with Undo', async () => {
    borrow()
    const plan = start()
    payNextPart(plan.id, 'upi')
    const before = planById(plan.id)
    const { user } = renderAt(`/app/kist/${plan.id}`, <KistPlanScreen />)
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }))
    expect(kistStore.get().plans).toEqual([])
    expect(net()).toBe(-400_000)
    expect(currentUrl()).toBe('/app/kist')
    expect(screen.getByText('Plan deleted. Payments already recorded stay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(planById(plan.id)).toEqual(before)
  })

  it('says so when the plan is not there', async () => {
    const { user } = renderAt('/app/kist/gone', <KistPlanScreen />)
    expect(screen.getByRole('heading', { name: 'This plan is not here any more' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All plans' }))
    expect(currentUrl()).toBe('/app/kist')
  })
})
