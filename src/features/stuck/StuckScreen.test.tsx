import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import type { StuckSignal } from './detect'

const fake = vi.hoisted(() => ({
  signal: null as StuckSignal | null,
  back: [] as StuckPayment[],
  undo: vi.fn(),
}))
vi.mock('./detect', () => ({
  readStuckMessage: vi.fn(() => fake.signal),
  signalToDraft: vi.fn(() => null),
}))
vi.mock('./track', () => ({
  trackStuckSignals: vi.fn(() => ({ added: [], back: fake.back, undo: fake.undo })),
}))

import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, peekStuckPrefill } from './prefill'
import { StuckScreen } from './StuckScreen'
import { seedStuck, storedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

beforeEach(() => {
  resetProScreens()
  clearStuckPrefill()
  fake.signal = null
  fake.back = []
  fake.undo.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
  clearStuckPrefill()
})

function seedFive(): void {
  seedStuck(
    // Due back 29 Oct, three days late: the bank owes ₹300.
    stuckPayment({ id: 'late' }),
    // An app said it failed; did it take the money?
    stuckPayment({ id: 'check', party: 'Zepto', amount: 24_900, rail: 'upi_merchant', date: '2026-10-31', confirmed: false }),
    // A refund Amazon promised by 5 Nov.
    stuckPayment({ id: 'refund', kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', amount: 420_000, date: '2026-10-30', promisedBy: '2026-11-05' }),
    // Back in time.
    stuckPayment({ id: 'back', party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', amount: 74_000, date: '2026-10-27', back: { date: '2026-10-30', amount: 74_000, compensation: 0 } }),
    // Set aside.
    stuckPayment({ id: 'aside', party: 'Rapido', amount: 9_900, dismissedAt: 5 }),
  )
}

const failedSignal: StuckSignal = {
  type: 'failed',
  amount: 64_900,
  date: '2026-10-31',
  at: 0,
  ref: '430199887766',
  party: 'SWIGGY',
  merchant: 'swiggy',
  bank: 'sbi',
  account: 'XX1234',
  app: null,
  vpa: 'swiggy@icici',
  rail: 'upi_merchant',
  debited: true,
}

describe('StuckScreen — nothing yet', SLOW, () => {
  it('explains itself in two lines, with Add one and Paste a message', async () => {
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Stuck money' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Money stuck with a bank or a shop?' })).toBeInTheDocument()
    expect(screen.getByText(/^Failed UPI to a person, IMPS and wallet payments must be back the next day; UPI to a shop, card payments and ATM withdrawals within 5 days/)).toBeInTheDocument()
    expect(screen.getByText('A refund that’s late? Settle counts from the business’s own deadline.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Paste a message' }))
    expect(await screen.findByRole('dialog', { name: 'Paste a message' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Add one' }))
    expect(currentUrl()).toBe('/app/stuck/new')
  })
})

describe('StuckScreen — the list', SLOW, () => {
  it('leads with what banks and shops owe you, the wait and what came back', () => {
    seedFive()
    renderAt('/app/stuck', <StuckScreen />)
    const hero = screen.getByRole('region', { name: 'What you’re owed' })
    expect(hero).toHaveTextContent('Banks and shops owe you')
    expect(hero).toHaveTextContent('₹4,700')
    expect(within(hero).getByText('For the wait').nextSibling).toHaveTextContent('+₹300')
    expect(within(hero).getByText('Got back so far').nextSibling).toHaveTextContent('₹740')
    expect(hero).toHaveTextContent('2 need you')
  })

  it('puts what needs you first, then what’s not due yet, what came back, and what was set aside (folded)', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    const section = (name: RegExp) => screen.getByRole('region', { name })
    const rows = (name: RegExp) => within(section(name)).getAllByRole('listitem')

    expect(section(/^Needs you/)).toHaveAccessibleName('Needs you, 2 payments')
    expect(rows(/^Needs you/).map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Failed payment to Riya Sharma 3 days late · your bank owes you ₹300 ₹500/),
      expect.stringMatching(/^Failed payment to Zepto Did ₹249 leave your account\? ₹249/),
    ])
    expect(rows(/^Not due yet/)[0]).toHaveTextContent('Amazon refund Due back by 5 Nov ₹4,200')
    expect(rows(/^Got back/)[0]).toHaveTextContent('Failed payment to Swiggy Back on 30 Oct ₹740')

    const aside = screen.getByRole('button', { name: 'Set aside, 1 payment' })
    expect(aside).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Failed payment to Rapido')).not.toBeVisible()
    await user.click(aside)
    expect(aside).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Failed payment to Rapido')).toBeVisible()
  })

  it('opens a payment', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(screen.getByRole('button', { name: /^Amazon refund/ }))
    expect(currentUrl()).toBe('/app/stuck/refund')
  })

  it('files a raised one under Waiting on them, still saying how late, and money back with only the wait owed under Owed for the wait', () => {
    seedStuck(
      stuckPayment({ id: 'raised', party: 'Swiggy', amount: 64_900, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }),
      stuckPayment({ id: 'owed', party: 'Kabir Mehta', amount: 450_000, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }], back: { date: '2026-11-01', amount: 450_000, compensation: 0 } }),
    )
    renderAt('/app/stuck', <StuckScreen />)
    expect(within(screen.getByRole('region', { name: /^Waiting on them/ })).getByRole('listitem')).toHaveTextContent(
      'Failed payment to Swiggy Raised · 3 days late · ₹300 owed so far ₹649',
    )
    expect(within(screen.getByRole('region', { name: /^Owed for the wait/ })).getByRole('listitem')).toHaveTextContent(
      'Failed payment to Kabir Mehta ₹4,500 back · raised for the ₹300 · they have till 30 Nov ₹300',
    )
    expect(screen.queryByRole('region', { name: /^Not due yet/ })).not.toBeInTheDocument()
  })

  it('a part back keeps it open, the row showing only what’s still to come; an order number tells two apart', () => {
    seedStuck(
      stuckPayment({ id: 'part', kind: 'refund', rail: null, party: null, merchant: 'flipkart', amount: 129_900, date: '2026-10-20', orderId: 'OD4311223344556677', back: { date: '2026-10-31', amount: 100_000, compensation: 0 } }),
    )
    renderAt('/app/stuck', <StuckScreen />)
    expect(screen.getByRole('region', { name: 'What you’re owed' })).toHaveTextContent('₹299')
    expect(within(screen.getByRole('region', { name: /^Needs you/ })).getByRole('listitem')).toHaveTextContent(
      'Flipkart refund · Order …4556677 Part back · ₹299 still to come · 3 days late · raise it with Flipkart ₹299',
    )
  })

  it('with only payments to check, the hero asks about them rather than saying nothing’s stuck', () => {
    seedStuck(stuckPayment({ id: 'a', confirmed: false }), stuckPayment({ id: 'b', party: 'Zepto', confirmed: false }))
    renderAt('/app/stuck', <StuckScreen />)
    const hero = screen.getByRole('region', { name: 'What you’re owed' })
    expect(hero).toHaveTextContent('2 payments to check — did the money leave your account?')
    expect(hero).not.toHaveTextContent('Nothing stuck right now')
  })
})

describe('StuckScreen — did it leave your account?', SLOW, () => {
  it('Yes counts it, with Undo', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(within(screen.getByRole('group', { name: 'Failed payment to Zepto Did ₹249 leave your account?' })).getByRole('button', { name: 'Yes, it left — ₹249 to Zepto' }))
    expect(storedStuck('check')?.confirmed).toBe(true)
    expect(await screen.findByText('Got it — Settle’s counting the days')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What you’re owed' })).toHaveTextContent('₹4,949')
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('check')?.confirmed).toBe(false)
  })

  it('No sets it aside, with Undo', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(within(screen.getByRole('group', { name: 'Failed payment to Zepto Did ₹249 leave your account?' })).getByRole('button', { name: 'No — ₹249 to Zepto' }))
    expect(storedStuck('check')?.dismissedAt).not.toBeNull()
    expect(within(screen.getByRole('region', { name: /^Needs you/ })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Set aside, 2 payments' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('check')?.dismissedAt).toBeNull()
  })
})

describe('StuckScreen — paste a message', SLOW, () => {
  async function paste(user: ReturnType<typeof renderAt>['user'], text: string): Promise<HTMLElement> {
    await user.click(screen.getByRole('button', { name: 'Paste a message' }))
    const sheet = await screen.findByRole('dialog', { name: 'Paste a message' })
    await user.click(within(sheet).getByRole('textbox', { name: 'Paste the bank SMS or app message' }))
    await user.paste(text)
    await user.click(within(sheet).getByRole('button', { name: 'Read it' }))
    return sheet
  }

  it('a failed payment opens Add, filled in', async () => {
    seedFive()
    fake.signal = failedSignal
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await paste(user, 'Your UPI txn of Rs.649 to SWIGGY has failed')
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, rail: 'upi_merchant', merchant: 'swiggy', source: 'sms', confirmed: true })
  })

  it('money back ticks off what it belongs to, saying what the bank still owes, with Undo', async () => {
    seedFive()
    fake.signal = { ...failedSignal, type: 'reversal', amount: 50_000 }
    fake.back = [stuckPayment({ id: 'late', back: { date: '2026-11-01', amount: 50_000, compensation: 0 } })]
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await paste(user, 'Rs 500 reversed to your account for failed UPI txn 430112345678')
    expect(await screen.findByText('Your ₹500 to Riya Sharma is back in your account — 3 days late, so your bank owes you ₹300 for the wait')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(fake.undo).toHaveBeenCalledOnce()
  })

  it('money back that matches nothing says so', async () => {
    seedFive()
    fake.signal = { ...failedSignal, type: 'refund_credited', amount: 12_300 }
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await paste(user, 'Refund of Rs.123 credited')
    expect(await screen.findByText('₹123 came back, but nothing open here matches it')).toBeInTheDocument()
  })

  it('nothing found: says so kindly, with Add it yourself', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    const sheet = await paste(user, 'Your OTP is 123456')
    expect(within(sheet).getByText('Couldn’t find a stuck payment in that')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Add it yourself' }))
    expect(currentUrl()).toBe('/app/stuck/new')
  })
})
