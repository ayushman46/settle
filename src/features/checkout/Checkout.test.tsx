import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, updateFriend, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { expensesStore } from '../../data/stores'
import type { UpiPaySheetProps } from '../../kit/UpiPaySheet'
import { shareResult } from '../../lib/share'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { CheckoutLink } from './CheckoutLink'
import { CheckoutScreen } from './CheckoutScreen'
import { checkoutFor } from './store'
import { checkoutToday } from './today'

vi.setConfig({ testTimeout: 30_000 })

// The real sheet hands off to a UPI app; here "paid" is one button that calls back as it would.
vi.mock('../../kit/UpiPaySheet', () => ({
  UpiPaySheet: ({ open, onClose, payee, payer, amount, onMarkPaid }: UpiPaySheetProps) =>
    open ? (
      <div role="dialog" aria-label={`${payer.name} pays ${payee.name}`}>
        <span>{amount}</span>
        <button
          type="button"
          onClick={() => {
            onMarkPaid?.()
            onClose()
          }}
        >
          Money moved
        </button>
      </div>
    ) : null,
}))
// Nothing leaves the test: what would be shared is caught here.
vi.mock('../../lib/share', async (original) => ({ ...(await original<Record<string, unknown>>()), shareResult: vi.fn(async () => 'shared') }))

/** Sunday 15 Nov 2026, noon: the last day in Goa. */
const NOW = new Date(2026, 10, 15, 12)

let riya: string
let sam: string
let goa: Group

const live = (): Group => groupsStore.get().find((g) => g.id === goa.id)!
const path = (): string => `/app/groups/${goa.id}/checkout`
const list = () => within(screen.getByRole('region', { name: 'Payments before you leave' }))
const lines = (): string[] => list().getAllByRole('listitem').map((li) => li.querySelector('span[class*="rowText"]')?.textContent ?? '')
const square = (): boolean => Object.values(groupBalances(live(), expensesStore.get())).every((v) => v === 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetProScreens()
  vi.mocked(shareResult).mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  updateFriend(riya, { upiId: 'riya@okicici' })
  goa = createGroup({ name: 'Goa 2026', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => {
  vi.useRealTimers()
})

/** You owe Riya ₹200; Sam owes Riya ₹400. ₹2,000 spent from 12 to 14 Nov. */
function spend(): void {
  saveExpense(draft({ title: 'Hotel', total: 120_000, date: '2026-11-12', payerId: riya, groupId: goa.id, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 80_000, date: '2026-11-14', payerId: ME_ID, groupId: goa.id, participants: everyone(ME_ID, sam) }))
}

describe('CheckoutScreen', () => {
  it('one line per payment: Pay yours, show a QR for the next, tick them off, and end on “All square” to share', async () => {
    spend()
    const { user } = renderAt(path(), <CheckoutScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settle before you leave' })).toBeInTheDocument()
    expect(screen.getByText('2 payments and everyone is square.')).toBeInTheDocument()
    expect(lines()).toEqual(['You pay Riya', 'Sam pays Riya'])
    expect(list().getByText('₹200')).toBeInTheDocument()
    expect(list().getByText('₹400')).toBeInTheDocument()
    // Yours has Pay, not a QR to scan off your own phone.
    expect(screen.queryByRole('button', { name: /Show a QR for You/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pay Riya ₹200' }))
    await user.click(within(screen.getByRole('dialog', { name: 'You pays Riya' })).getByRole('button', { name: 'Money moved' }))
    expect(live().settlements).toMatchObject([{ fromId: ME_ID, toId: riya, amount: 20_000, method: 'upi', date: '2026-11-15' }])
    expect(screen.getByText('1 of 2 paid. 1 more payment and everyone is square.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paid: You paid Riya ₹200. Tap to undo.' })).toHaveAttribute('aria-pressed', 'true')
    // The list stays where it was.
    expect(lines()).toEqual(['You paid Riya', 'Sam pays Riya'])
    expect(checkoutFor(goa.id)?.rows.map((r) => r.settlementId !== null)).toEqual([true, false])

    // Riya has a UPI ID: a full-screen QR for Sam to scan, with the amount in it.
    await user.click(screen.getByRole('button', { name: 'Show a QR for Sam to pay Riya ₹400' }))
    const qr = await screen.findByRole('dialog', { name: 'Scan to pay Riya' })
    expect(within(qr).getByText('For Sam to scan')).toBeInTheDocument()
    const code = within(qr).getByRole('img', { name: 'QR code to pay Riya ₹400' })
    const link = code.closest('[data-qr-value]')?.getAttribute('data-qr-value') ?? ''
    expect(link).toMatch(/^upi:\/\/pay\?pa=riya%40okicici&pn=Riya&am=400(\.00)?&cu=INR&tn=Goa%202026$/)
    expect(within(qr).getByText('Open any UPI app and scan. ₹400 is already filled in.')).toBeInTheDocument()
    expect(within(qr).getByText('Settle can’t see the payment. Tick it once Sam shows you it went through.')).toBeInTheDocument()
    await user.click(within(qr).getByRole('button', { name: 'Sam has paid' }))

    expect(live().settlements).toHaveLength(2)
    expect(square()).toBe(true)
    expect(screen.getByText('That was the last one. Everyone is square.')).toBeInTheDocument()
    expect(screen.getByText('All paid. Everyone is square.')).toBeInTheDocument()
    const card = within(screen.getByRole('region', { name: 'Goa 2026: all square' }))
    expect(card.getByRole('heading', { name: 'All square' })).toBeInTheDocument()
    expect(card.getByText('12 to 14 Nov')).toBeInTheDocument()
    expect(card.getByText('Spent').nextElementSibling).toHaveTextContent('₹2,000')
    expect(card.getByText('People').nextElementSibling).toHaveTextContent('3')
    expect(card.getByText('Payments made').nextElementSibling).toHaveTextContent('2')

    await user.click(card.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(shareResult).toHaveBeenCalledTimes(1))
    expect(vi.mocked(shareResult).mock.calls[0]?.[0]).toBe('🏖️ Goa 2026: all square\n12 to 14 Nov · ₹2,000 spent · 3 people\n2 payments and nobody owes anybody.\n\n— split with Settle')
  })

  it('a tick records the payment; Undo removes the payment and the tick, exactly', async () => {
    spend()
    const { user } = renderAt(path(), <CheckoutScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹400' }))
    expect(live().settlements).toMatchObject([{ fromId: sam, toId: riya, amount: 40_000, method: 'other' }])
    expect(screen.getByText('Ticked: Sam paid Riya ₹400')).toBeInTheDocument()
    expect(checkoutFor(goa.id)?.rows[1]?.settlementId).toBe(live().settlements[0]?.id)

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(live().settlements).toEqual([])
    expect(checkoutFor(goa.id)?.rows.map((r) => r.settlementId)).toEqual([null, null])
    expect(lines()).toEqual(['You pay Riya', 'Sam pays Riya'])
    expect(screen.getByText('2 payments and everyone is square.')).toBeInTheDocument()

    // A tick can also be taken back on its own line, later.
    await user.click(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹400' }))
    await user.click(screen.getByRole('button', { name: 'Paid: Sam paid Riya ₹400. Tap to undo.' }))
    expect(live().settlements).toEqual([])
    expect(screen.getByText('Open again: Sam pays Riya ₹400')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹400' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps its ticks when you come back from the UPI app (or reopen the page)', async () => {
    spend()
    const first = renderAt(path(), <CheckoutScreen />)
    await first.user.click(screen.getByRole('button', { name: 'Mark paid: You pay Riya ₹200' }))
    first.unmount()
    renderAt(path(), <CheckoutScreen />)
    expect(lines()).toEqual(['You paid Riya', 'Sam pays Riya'])
    expect(screen.getByText('1 of 2 paid. 1 more payment and everyone is square.')).toBeInTheDocument()
  })

  it('an expense added after you started: ticked lines stay, open ones are worked out again, and it says so', async () => {
    spend()
    const { user } = renderAt(path(), <CheckoutScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark paid: You pay Riya ₹200' }))
    expect(screen.queryByText('The payments changed')).not.toBeInTheDocument()
    // Chai at the airport: Sam paid ₹300 for all three.
    act(() => {
      saveExpense(draft({ title: 'Chai', total: 30_000, date: '2026-11-15', payerId: sam, groupId: goa.id, participants: everyone(ME_ID, riya, sam) }))
    })
    expect(await screen.findByText('The payments changed')).toBeInTheDocument()
    // You now owe ₹100 again; Sam owes ₹200 less; Riya is owed ₹300.
    expect(lines()).toEqual(['You paid Riya', 'You pay Riya', 'Sam pays Riya'])
    expect(screen.getByRole('button', { name: 'Mark paid: You pay Riya ₹100' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹200' })).toBeInTheDocument()
    expect(screen.getByText('1 of 3 paid. 2 more payments and everyone is square.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark paid: You pay Riya ₹100' }))
    await user.click(screen.getByRole('button', { name: 'Mark paid: Sam pays Riya ₹200' }))
    expect(square()).toBe(true)
    expect(screen.getByRole('region', { name: 'Goa 2026: all square' })).toBeInTheDocument()
  })

  it('no UPI ID for the receiver: says so and offers to add it, instead of a QR that can’t exist', async () => {
    // Sam owes you ₹400, and your own UPI ID isn't saved.
    saveExpense(draft({ title: 'Cab', total: 80_000, date: '2026-11-14', payerId: ME_ID, groupId: goa.id, participants: everyone(ME_ID, sam) }))
    const { user } = renderAt(path(), <CheckoutScreen />)
    expect(screen.getByText('1 payment and everyone is square.')).toBeInTheDocument()
    expect(screen.getByText('Your UPI ID isn’t saved, so there’s no QR yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Show a QR/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a UPI ID for you, to show a QR' }))
    expect(screen.getByRole('dialog', { name: 'Sam pays You' })).toBeInTheDocument()

    // Once it is saved, the QR is offered.
    act(() => {
      updateProfile({ upiId: 'ayush@upi' })
    })
    expect(await screen.findByRole('button', { name: 'Show a QR for Sam to pay you ₹400' })).toBeInTheDocument()
    expect(screen.queryByText('Your UPI ID isn’t saved, so there’s no QR yet.')).not.toBeInTheDocument()
  })

  it('money that isn’t rupees: ticks only, and it says why there’s no Pay or QR', async () => {
    const trip = createGroup({ name: 'Bali', emoji: '🌴', kind: 'trip', currency: 'USD', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Villa', total: 9_000, currency: 'USD', payerId: riya, groupId: trip.id, participants: everyone(ME_ID, riya) }))
    const { user } = renderAt(`/app/groups/${trip.id}/checkout`, <CheckoutScreen />)
    expect(screen.getByText('UPI only moves rupees, so there’s no Pay or QR here. Tick each payment once it’s made.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark paid: You pay Riya $45' }))
    expect(screen.getByRole('region', { name: 'Bali: all square' })).toBeInTheDocument()
  })

  it('nothing spent yet: sells the page in a sentence and offers the one action', async () => {
    const { user } = renderAt(path(), <CheckoutScreen />)
    expect(screen.getByRole('heading', { name: 'Nothing to settle yet' })).toBeInTheDocument()
    expect(screen.getByText(/On the last day this page is the checklist/)).toBeInTheDocument()
    expect(checkoutFor(goa.id)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add an expense' }))
    expect(currentUrl()).toBe(`/app/split/new?group=${goa.id}`)
  })

  it('already square: the card, without claiming payments nobody ticked here', () => {
    saveExpense(draft({ title: 'Hotel', total: 120_000, date: '2026-11-12', payerId: riya, groupId: goa.id, participants: everyone(riya) }))
    renderAt(path(), <CheckoutScreen />)
    expect(screen.getByText('Nobody owes anybody.')).toBeInTheDocument()
    const card = within(screen.getByRole('region', { name: 'Goa 2026: all square' }))
    expect(card.getByText('12 Nov')).toBeInTheDocument()
    expect(card.queryByText('Payments made')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Payments before you leave' })).not.toBeInTheDocument()
  })

  it('a group that no longer exists says so', () => {
    renderAt('/app/groups/nope/checkout', <CheckoutScreen />)
    expect(screen.getByRole('heading', { name: 'This group is gone' })).toBeInTheDocument()
  })
})

describe('CheckoutLink', () => {
  it('says what is left and opens the checklist', async () => {
    spend()
    const { user } = renderAt('/app', <CheckoutLink group={goa} />)
    await user.click(screen.getByRole('button', { name: 'Settle before you leave. 2 payments and everyone is square.' }))
    expect(currentUrl()).toBe(path())
  })

  it('as a chip, for a row of group tools', async () => {
    spend()
    const { user } = renderAt('/app', <CheckoutLink group={goa} variant="chip" />)
    await user.click(screen.getByRole('button', { name: 'Settle before you leave' }))
    expect(currentUrl()).toBe(path())
  })

  it('shows nothing when nothing is owed', () => {
    const { container } = renderAt('/app', <CheckoutLink group={goa} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('checkoutToday', () => {
  it('never has anything due', () => {
    spend()
    expect(checkoutToday(NOW)).toEqual([])
  })
})
