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
    expect(screen.getByText('Banks must put a failed UPI payment to a person back the next day. After that, they owe you ₹100 a day.')).toBeInTheDocument()
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
    expect(within(hero).getByText('For the wait').nextSibling).toHaveTextContent('+ ₹300')
    expect(within(hero).getByText('Got back so far').nextSibling).toHaveTextContent('₹740')
    expect(hero).toHaveTextContent('2 need you')
  })

  it('puts what needs you first, then what’s on its way, what came back, and what was set aside (folded)', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    const section = (name: RegExp) => screen.getByRole('region', { name })
    const rows = (name: RegExp) => within(section(name)).getAllByRole('listitem')

    expect(rows(/^Needs you/).map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Riya Sharma 3 days late · your bank owes you ₹300 ₹500/),
      expect.stringMatching(/^Zepto Did ₹249 leave your account\? ₹249/),
    ])
    expect(rows(/^On its way/)[0]).toHaveTextContent('Amazon Due back by 5 Nov ₹4,200')
    expect(rows(/^Got back/)[0]).toHaveTextContent('Swiggy Back on 30 Oct ₹740')

    const aside = screen.getByRole('button', { name: /^Set aside/ })
    expect(aside).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Rapido')).not.toBeVisible()
    await user.click(aside)
    expect(aside).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Rapido')).toBeVisible()
  })

  it('opens a payment', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(screen.getByRole('button', { name: /^Amazon/ }))
    expect(currentUrl()).toBe('/app/stuck/refund')
  })
})

describe('StuckScreen — did it leave your account?', SLOW, () => {
  it('Yes counts it, with Undo', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(within(screen.getByRole('group', { name: 'Zepto Did ₹249 leave your account?' })).getByRole('button', { name: 'Yes, it left' }))
    expect(storedStuck('check')?.confirmed).toBe(true)
    expect(await screen.findByText('Got it — Settle’s counting the days')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What you’re owed' })).toHaveTextContent('₹4,949')
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('check')?.confirmed).toBe(false)
  })

  it('No sets it aside, with Undo', async () => {
    seedFive()
    const { user } = renderAt('/app/stuck', <StuckScreen />)
    await user.click(within(screen.getByRole('group', { name: 'Zepto Did ₹249 leave your account?' })).getByRole('button', { name: 'No' }))
    expect(storedStuck('check')?.dismissedAt).not.toBeNull()
    expect(within(screen.getByRole('region', { name: /^Needs you/ })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Set aside 2/ })).toBeInTheDocument()
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
    expect(await screen.findByText('₹500 from Riya Sharma is back — 3 days late, so your bank owes you ₹300 for the wait')).toBeInTheDocument()
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
