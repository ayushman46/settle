import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stuckStore } from '../../data/stores'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, setStuckPrefill } from './prefill'
import { StuckAddScreen } from './StuckAddScreen'
import { seedStuck, storedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

beforeEach(() => {
  resetProScreens()
  clearStuckPrefill()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
  clearStuckPrefill()
})

const save = () => screen.getByRole('button', { name: 'Start tracking' })

describe('StuckAddScreen — a failed payment', SLOW, () => {
  it('asks what’s stuck first, and says what’s missing until it can be saved', async () => {
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'What’s stuck?' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'What’s stuck?' })).toBeInTheDocument()
    expect(save()).toBeDisabled()
    expect(screen.queryByRole('textbox', { name: 'How much?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^A payment failed but took my money/ }))
    expect(screen.getByRole('radio', { name: /^A payment failed/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Add the amount')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('shows the RBI’s deadline for how you paid, and saves → its page', async () => {
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    await user.click(screen.getByRole('radio', { name: /^A payment failed/ }))
    await user.type(screen.getByRole('textbox', { name: 'How much?' }), '649')

    // Not sure until picked: the longest deadline, so a claim is never early.
    expect(screen.getByRole('radio', { name: /^Not sure/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Due back by 6 Nov at the latest. After that, your bank owes you ₹100 a day.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'UPI to a person Back in 1 day' }))
    expect(screen.getByText('Due back by 2 Nov, by the RBI’s rules. After that, your bank owes you ₹100 a day.')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Autopay/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More ways' }))
    expect(screen.getByRole('radio', { name: 'Autopay (NACH) Back in 1 day' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Paid to (optional)' }), 'Riya Sharma')
    await user.type(screen.getByRole('textbox', { name: 'UPI reference or transaction ID (optional)' }), '430112345678')
    expect(save()).toBeEnabled()
    await user.click(save())

    const [saved] = stuckStore.get()
    expect(saved).toMatchObject({ kind: 'failed', rail: 'upi_person', party: 'Riya Sharma', amount: 64_900, date: '2026-11-01', ref: '430112345678', source: 'manual', confirmed: true })
    expect(currentUrl()).toBe(`/app/stuck/${saved?.id}`)
    expect(await screen.findByText('Tracking it — Settle will count the days')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([])
  })

  it('opens filled in from a message, and asks whether the money left when the message didn’t say', async () => {
    setStuckPrefill({ kind: 'failed', amount: 64_900, rail: 'upi_merchant', party: 'SWIGGY', merchant: 'swiggy', date: '2026-10-31', ref: '430199887766', bank: 'sbi', account: 'XX1234', source: 'sms', confirmed: false })
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('Filled in from the message. Check it and save.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'How much?' })).toHaveValue('649')
    expect(screen.getByRole('radio', { name: 'UPI to a shop Back in 5 days' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'Paid to (optional)' })).toHaveValue('SWIGGY')
    const left = screen.getByRole('switch', { name: 'The money left my account' })
    expect(left).toHaveAttribute('aria-checked', 'false')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ amount: 64_900, merchant: 'swiggy', bank: 'sbi', account: 'XX1234', source: 'sms', confirmed: false, date: '2026-10-31' })
  })
})

describe('StuckAddScreen — a refund', SLOW, () => {
  it('picks the business, shows its own timeline, and needs a name for someone else', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    expect(screen.getByRole('radio', { name: /^A refund hasn’t come/ })).toHaveAttribute('aria-checked', 'true')
    await user.type(screen.getByRole('textbox', { name: 'How much?' }), '1299')
    expect(screen.getByText('Say who owes the refund')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Flipkart' }))
    // Sun 1 Nov + 7 working days = Tue 10 Nov.
    expect(screen.getByText('Due back by 10 Nov — Flipkart says refunds take up to 7 working days.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a date' }))
    expect(screen.getByText('Due back by 10 Nov, as they said.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Someone else' }))
    expect(save()).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Business name' }), 'Croma')
    await user.type(screen.getByRole('textbox', { name: 'Order or booking number (optional)' }), 'CR-7781')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', rail: null, party: 'Croma', merchant: null, amount: 129_900, orderId: 'CR-7781', promisedBy: '2026-11-10', confirmed: true })
  })

  it('a business Settle knows is saved by its name', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(screen.getByRole('textbox', { name: 'How much?' }), '450')
    await user.click(screen.getByRole('radio', { name: 'Swiggy' }))
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', party: 'Swiggy', merchant: 'swiggy', promisedBy: null })
  })
})

describe('StuckAddScreen — edit', SLOW, () => {
  it('changes what’s known, with Undo', async () => {
    seedStuck(stuckPayment())
    const { user } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Edit stuck money' })).toBeInTheDocument()
    const amount = screen.getByRole('textbox', { name: 'How much?' })
    expect(amount).toHaveValue('500')
    await user.clear(amount)
    await user.type(amount, '520')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(storedStuck('s1')?.amount).toBe(52_000)
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.amount).toBe(50_000)
  })

  it('a payment that’s gone says so', () => {
    renderAt('/app/stuck/nope/edit', <StuckAddScreen />)
    expect(screen.getByRole('heading', { name: 'This one’s gone' })).toBeInTheDocument()
  })
})
