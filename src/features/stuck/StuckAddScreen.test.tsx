import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stuckStore } from '../../data/stores'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, peekStuckPrefill, setStuckPrefill } from './prefill'
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
const amount = () => screen.getByRole('textbox', { name: 'How much is stuck?' })

describe('StuckAddScreen — a failed payment', SLOW, () => {
  it('asks what’s stuck first, and says what’s missing until it can be saved', async () => {
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'What’s stuck?' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'What’s stuck?' })).toBeInTheDocument()
    expect(screen.getByText(/that failed but took your money is a failed payment — even on IRCTC/)).toBeInTheDocument()
    expect(save()).toBeDisabled()
    expect(screen.queryByRole('textbox', { name: 'How much is stuck?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^A payment failed but took my money/ }))
    expect(screen.getByRole('radio', { name: /^A payment failed/ })).toHaveAttribute('aria-checked', 'true')
    // The amount's question is on screen, not only for screen readers.
    expect(screen.getByText('How much is stuck?')).not.toHaveClass('visually-hidden')
    expect(screen.getByText('Add the amount')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('asks the day and how it was paid — nothing is assumed', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '2000')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Say when the money left')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '3 days ago' }))
    // No way of paying picked for you.
    expect(screen.getByRole('radio', { name: /^Not sure/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Pick how you paid to see the RBI’s deadline.')).toBeInTheDocument()
    expect(screen.getByText('Say how you paid — or pick Not sure')).toBeInTheDocument()
    expect(save()).toBeDisabled()
    // Paid on 29 Oct, due back 30 Oct: already 2 days late on 1 Nov.
    await user.click(screen.getByRole('radio', { name: 'UPI to a person Due the next day' }))
    expect(screen.getByText('It was due back by 30 Oct, so your bank already owes you ₹200 — and ₹100 more each day.')).toBeInTheDocument()
    expect(save()).toBeEnabled()
  })

  it('shows the RBI’s deadline for how you paid, and saves → its page', async () => {
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    await user.click(screen.getByRole('radio', { name: /^A payment failed/ }))
    await user.type(amount(), '649')
    await user.click(screen.getByRole('button', { name: 'Today' }))

    await user.click(screen.getByRole('radio', { name: /^Not sure/ }))
    expect(screen.getByText('Due back by 6 Nov at the latest. Pick how you paid for the exact deadline.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'UPI to a person Due the next day' }))
    expect(screen.getByText('The RBI says it’s due back by 2 Nov. After that, your bank owes you ₹100 a day.')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^IMPS/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More ways' }))
    expect(screen.getByRole('radio', { name: /^IMPS transfer Due the next day/ })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Paid to (optional)' }), 'Riya Sharma')
    await user.type(screen.getByRole('textbox', { name: 'UPI reference (optional)' }), '430112345678')
    expect(save()).toBeEnabled()
    await user.click(save())

    const [saved] = stuckStore.get()
    expect(saved).toMatchObject({ kind: 'failed', rail: 'upi_person', party: 'Riya Sharma', amount: 64_900, date: '2026-11-01', ref: '430112345678', source: 'manual', confirmed: true, bank: null, account: null, app: null })
    expect(currentUrl()).toBe(`/app/stuck/${saved?.id}`)
    expect(await screen.findByText('Tracking it — Settle will count the days')).toBeInTheDocument()
    // Undo takes it away and goes back to the form as it was — not to "This one's gone".
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([])
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, party: 'Riya Sharma', ref: '430112345678', date: '2026-11-01', undone: true })
  })

  it('back after Undo, the form says it isn’t saved', () => {
    setStuckPrefill({ kind: 'failed', amount: 64_900, rail: 'upi_person', date: '2026-11-01', source: 'manual', confirmed: true, undone: true })
    renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('Not saved. Change anything you need, then tap Start tracking again.')).toBeInTheDocument()
    expect(save()).toBeEnabled()
  })

  it('offers 4 and 5 days ago, says the day picked in words, and gives an old day its year', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '1200')
    await user.click(screen.getByRole('button', { name: '5 days ago' }))
    expect(screen.getByText('Picked: 27 Oct')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Another day/), { target: { value: '2024-11-03' } })
    expect(screen.getByText('Picked: 3 Nov 2024')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'UPI to a shop Due within 5 days' }))
    expect(screen.getByText(/^It was due back by 8 Nov 2024, so your bank already owes you/)).toBeInTheDocument()
  })

  it('“Not sure”, a few days on: a payment to a person may be late already', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '2000')
    await user.click(screen.getByRole('button', { name: '3 days ago' }))
    await user.click(screen.getByRole('radio', { name: /^Not sure/ }))
    // Paid 29 Oct: to a person, due 30 Oct (2 days late on 1 Nov); at the latest, 3 Nov.
    expect(
      screen.getByText('Due back by 3 Nov at the latest. But if you paid a person, it was due by 30 Oct — your bank may already owe you ₹200. Pick how you paid for the exact deadline.'),
    ).toBeInTheDocument()
  })

  it('reads commas typed in the amount as Indian grouping', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '99,99,999')
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: /^Not sure/ }))
    await user.click(save())
    expect(stuckStore.get()[0]?.amount).toBe(999_999_900)
  })

  it('won’t take a day that hasn’t come yet', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '500')
    await user.click(screen.getByRole('radio', { name: /^Not sure/ }))
    fireEvent.change(screen.getByLabelText(/^Another day/), { target: { value: '2026-11-09' } })
    expect(screen.getByText('That day hasn’t come yet — pick today or earlier')).toBeInTheDocument()
    expect(save()).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^Another day/), { target: { value: '2026-10-20' } })
    expect(save()).toBeEnabled()
  })

  it('asks for the bank, the UPI app and the account’s last 4 digits', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '500')
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: 'UPI to a shop Due within 5 days' }))
    await user.click(screen.getByRole('button', { name: 'Google Pay' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Your bank' }), 'HDFC')
    await user.type(screen.getByRole('textbox', { name: 'Last 4 digits of your account' }), '77a31')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ rail: 'upi_merchant', bank: 'hdfc', account: 'XX7731', app: 'gpay' })
  })

  it('a bank Settle doesn’t list is typed in', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '500')
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: /^Card, at a shop/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Bank that gave you the card' }), 'Another bank')
    await user.type(screen.getByRole('textbox', { name: 'Bank’s name' }), 'Saraswat Bank')
    await user.type(screen.getByRole('textbox', { name: 'Last 4 digits of your card' }), '4417')
    expect(screen.getByRole('textbox', { name: 'Card transaction reference (optional)' })).toBeInTheDocument()
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ rail: 'card_pos', bank: 'Saraswat Bank', account: 'XX4417' })
  })

  it('a wallet payment asks which wallet, and calls the reference what the wallet does', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '750')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('button', { name: 'More ways' }))
    await user.click(screen.getByRole('radio', { name: /^Wallet/ }))
    expect(screen.getByText('The RBI says it’s due back by 2 Nov. After that, the wallet company owes you ₹100 a day.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Wallet transaction or order ID (optional)' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Your bank' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Paytm' }))
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ rail: 'wallet', app: 'paytm' })
  })

  it('names the fields the way an ATM slip does', async () => {
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '2000')
    await user.click(screen.getByRole('radio', { name: /^ATM, no cash came out/ }))
    expect(screen.getByRole('textbox', { name: 'Which ATM? (optional)' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Transaction number on the slip (optional)' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Last 4 digits of your card' })).toBeInTheDocument()
  })

  it('opens filled in from a message — bank and account there to check — and asks whether the money left when the message didn’t say', async () => {
    setStuckPrefill({ kind: 'failed', amount: 64_900, rail: 'upi_merchant', party: 'SWIGGY', merchant: 'swiggy', date: '2026-10-31', ref: '430199887766', bank: 'sbi', account: 'XX1234', source: 'sms', confirmed: false })
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('Filled in from the message. Check it and save.')).toBeInTheDocument()
    expect(amount()).toHaveValue('649')
    expect(screen.getByRole('button', { name: 'Yesterday' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'UPI to a shop Due within 5 days' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Paid to (optional)' })).toHaveValue('SWIGGY')
    expect(screen.getByRole('combobox', { name: 'Your bank' })).toHaveValue('sbi')
    expect(screen.getByRole('textbox', { name: 'Last 4 digits of your account' })).toHaveValue('1234')
    const left = screen.getByRole('switch', { name: 'The money left my account' })
    expect(left).toHaveAttribute('aria-checked', 'false')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ amount: 64_900, merchant: 'swiggy', bank: 'sbi', account: 'XX1234', source: 'sms', confirmed: false, date: '2026-10-31' })
  })
})

describe('StuckAddScreen — from a message', SLOW, () => {
  it('a message that doesn’t say the day: asks it, nothing picked', () => {
    setStuckPrefill({ kind: 'failed', amount: 200_000, rail: 'upi_person', party: 'RAMESH KUMAR', ref: '430212345678', source: 'sms', confirmed: true })
    renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('Filled in from the message. It doesn’t say the day — when did the money leave?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Say when the money left')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('a refund’s “in 7 working days” lights its chip and counts from the day said, as it’s corrected', async () => {
    setStuckPrefill({ kind: 'refund', amount: 109_900, party: 'Myntra', merchant: 'myntra', orderId: '1209384756-5521', promisedDays: 7, promisedWorking: true, source: 'sms', confirmed: true })
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('Filled in from the message. It doesn’t say the day — when did the message come?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 working days' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    // Sun 1 Nov + 7 working days = Tue 10 Nov.
    expect(screen.getByText('Due back by 10 Nov, as they said.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Another day/), { target: { value: '2026-10-21' } })
    // Wed 21 Oct + 7 working days = Fri 30 Oct: late.
    expect(screen.getByText('It was due back by 30 Oct, as they said — it’s late.')).toBeInTheDocument()
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', merchant: 'myntra', date: '2026-10-21', promisedBy: '2026-10-30' })
  })

  it('a message’s own “within 3 days” is a chip of its own', () => {
    setStuckPrefill({ kind: 'refund', amount: 50_000, merchant: 'swiggy', party: 'Swiggy', date: '2026-10-30', promisedDays: 3, promisedWorking: false, source: 'sms' })
    renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByRole('button', { name: '3 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Due back by 2 Nov, as they said.')).toBeInTheDocument()
  })

  it('an airline’s refund to a card opens with “paid by card” on, under the DGCA’s 7 days', () => {
    setStuckPrefill({ kind: 'refund', amount: 845_000, party: 'IndiGo', merchant: 'indigo', orderId: 'X7KQ2M', rail: 'card_online', date: '2026-10-21', promisedDays: 7, source: 'sms', confirmed: true })
    renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByRole('switch', { name: /^Paid for the ticket by card/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('It was due back by 28 Oct — the DGCA gives airlines 7 days to refund a ticket paid by card.')).toBeInTheDocument()
  })
})

describe('StuckAddScreen — already tracked', SLOW, () => {
  it('the same reference opens the one already tracked instead of adding it twice', async () => {
    seedStuck(stuckPayment({ ref: '630314567890', amount: 1_200_000, date: '2026-10-30' }))
    setStuckPrefill({ kind: 'failed', amount: 1_200_000, rail: 'imps', ref: '630314567890', date: '2026-10-30', source: 'sms', confirmed: true })
    const { user } = renderAt('/app/stuck/new', <StuckAddScreen />)
    expect(screen.getByText('You’re already tracking this')).toBeInTheDocument()
    expect(screen.getByText('Same reference number — it’s the same money.')).toBeInTheDocument()
    // Why the button changed, right above it.
    expect(screen.getByText('You’re already tracking this — the same reference number')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start tracking' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(currentUrl()).toBe('/app/stuck/s1')
    expect(stuckStore.get()).toHaveLength(1)
  })

  it('a refund with the same order number, typed by hand, is caught too', async () => {
    seedStuck(stuckPayment({ kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', ref: null, amount: 129_900, orderId: '402-1234567-1234567', date: '2026-10-29' }))
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '1299')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('radio', { name: 'Amazon' }))
    await user.type(screen.getByRole('textbox', { name: 'Order or booking number (optional)' }), '402-1234567-1234567')
    expect(screen.getByText('Same order number — it’s the same refund.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(stuckStore.get()).toHaveLength(1)
  })

  it('the same amount, party and day without a reference only asks — two can happen', async () => {
    seedStuck(stuckPayment({ ref: null, party: 'Swiggy', amount: 64_900, date: '2026-10-31' }))
    const { user } = renderAt('/app/stuck/new?kind=failed', <StuckAddScreen />)
    await user.type(amount(), '649')
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: /^Not sure/ }))
    await user.type(screen.getByRole('combobox', { name: 'Paid to (optional)' }), 'Swiggy')
    expect(screen.getByText('Already tracking this?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Track it anyway' }))
    expect(stuckStore.get()).toHaveLength(2)
  })
})

describe('StuckAddScreen — a refund', SLOW, () => {
  it('picks the business, shows its own timeline, and needs a name for someone else', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    expect(screen.getByRole('radio', { name: /^A refund hasn’t come/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('When was it cancelled, or the refund started?')).toBeInTheDocument()
    await user.type(amount(), '1299')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('Say who owes the refund')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Flipkart' }))
    // Sun 1 Nov + 7 working days = Tue 10 Nov.
    expect(screen.getByText('Due back by 10 Nov — Flipkart says refunds take up to 7 working days.')).toBeInTheDocument()
    // "They said 5 working days": Fri 6 Nov.
    await user.click(screen.getByRole('button', { name: '5 working days' }))
    expect(screen.getByText('Due back by 6 Nov, as they said.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^They said by/), { target: { value: '2026-11-10' } })
    expect(screen.getByRole('button', { name: '5 working days' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Due back by 10 Nov, as they said.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Someone else' }))
    expect(save()).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Business name' }), 'Croma')
    await user.type(screen.getByRole('textbox', { name: 'Order or booking number (optional)' }), 'CR-7781')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', rail: null, party: 'Croma', merchant: null, amount: 129_900, orderId: 'CR-7781', promisedBy: '2026-11-10', confirmed: true })
  })

  it('a business Settle knows is saved by its name; a working-days promise is saved as its day', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '450')
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: 'Swiggy' }))
    expect(screen.getByRole('button', { name: 'They didn’t say' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '7 working days' }))
    await user.click(save())
    // Sat 31 Oct + 7 working days = Tue 10 Nov.
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', party: 'Swiggy', merchant: 'swiggy', promisedBy: '2026-11-10' })
  })

  it('a flight or train asks for the PNR, and a typed “PNR” isn’t doubled', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '8450')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('radio', { name: 'IndiGo' }))
    await user.type(screen.getByRole('textbox', { name: 'PNR (optional)' }), 'PNR X7K2LQ')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ merchant: 'indigo', orderId: 'X7K2LQ' })
  })

  it('a promised day the person picked stays theirs: before the start, it’s shown as wrong, not moved', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '450')
    await user.click(screen.getByRole('button', { name: '3 days ago' }))
    await user.click(screen.getByRole('radio', { name: 'Swiggy' }))
    fireEvent.change(screen.getByLabelText(/^They said by/), { target: { value: '2026-10-30' } })
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    expect(screen.getByText('Their date can’t be before it was cancelled')).toBeInTheDocument()
    // No deadline that contradicts it.
    expect(screen.queryByText(/as they said/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^They said by/)).toHaveValue('2026-10-30')
    expect(save()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '3 days ago' }))
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ date: '2026-10-29', promisedBy: '2026-10-30' })
  })

  it('a flight or train with no PNR yet: one tap makes it a failed payment', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '1845')
    await user.click(screen.getByRole('radio', { name: 'IRCTC' }))
    await user.click(screen.getByRole('button', { name: 'It’s a failed payment' }))
    expect(screen.getByRole('radio', { name: /^A payment failed/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Paid to (optional)' })).toHaveValue('IRCTC')
  })

  it('a refund’s ARN or UTR is kept', async () => {
    const { user } = renderAt('/app/stuck/new?kind=refund', <StuckAddScreen />)
    await user.type(amount(), '1299')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('radio', { name: 'Amazon' }))
    await user.type(screen.getByRole('textbox', { name: 'Refund reference — ARN or UTR (optional)' }), '74332746300123456789012')
    await user.click(save())
    expect(stuckStore.get()[0]).toMatchObject({ kind: 'refund', ref: '74332746300123456789012' })
  })
})

describe('StuckAddScreen — edit', SLOW, () => {
  it('changes what’s known, with Undo', async () => {
    seedStuck(stuckPayment())
    const { user } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'What’s stuck?' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'What’s stuck?' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Your bank' })).toHaveValue('hdfc')
    expect(screen.getByRole('textbox', { name: 'Last 4 digits of your account' })).toHaveValue('4821')
    expect(screen.getByRole('button', { name: 'Google Pay' })).toHaveAttribute('aria-pressed', 'true')
    await user.clear(amount())
    await user.type(amount(), '520')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(storedStuck('s1')).toMatchObject({ amount: 52_000, bank: 'hdfc', account: 'XX4821', app: 'gpay' })
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.amount).toBe(50_000)
  })

  it('switching a failed payment raised with the bank to a refund takes the bank’s complaint off (Undo brings it back)', async () => {
    seedStuck(stuckPayment({ party: 'Swiggy', steps: [{ kind: 'bank', date: '2026-10-30', ref: 'HDFC-1' }] }))
    const { user } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    await user.click(screen.getByRole('radio', { name: /^A refund hasn’t come/ }))
    expect(screen.getByRole('radio', { name: 'Swiggy' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/takes off the complaint you noted to/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(storedStuck('s1')).toMatchObject({ kind: 'refund', merchant: 'swiggy', steps: [] })
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.steps).toEqual([{ kind: 'bank', date: '2026-10-30', ref: 'HDFC-1' }])
  })

  it('switching to a refund picks the business named — or keeps the name for someone else', async () => {
    seedStuck(stuckPayment({ party: 'IRCTC', merchant: null }), stuckPayment({ id: 's2', party: 'Croma Store', merchant: null }))
    const { user, unmount } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    await user.click(screen.getByRole('radio', { name: /^A refund hasn’t come/ }))
    expect(screen.getByRole('radio', { name: 'IRCTC' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/stuck/s1'))
    unmount()

    const second = renderAt('/app/stuck/s2/edit', <StuckAddScreen />)
    await second.user.click(screen.getByRole('radio', { name: /^A refund hasn’t come/ }))
    expect(screen.getByRole('radio', { name: 'Someone else' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'Business name' })).toHaveValue('Croma Store')
  })

  it('Back with changes asks first: keep editing, or discard them', async () => {
    seedStuck(stuckPayment())
    const { user } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    await user.clear(amount())
    await user.type(amount(), '520')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const ask = await screen.findByRole('dialog', { name: 'Discard your changes?' })
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Discard your changes?' })).not.toBeInTheDocument())
    expect(amount()).toHaveValue('520')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/stuck/s1'))
    expect(storedStuck('s1')?.amount).toBe(50_000)
  })

  it('money already back: the amount stays the full one, never less than what came back', async () => {
    seedStuck(stuckPayment({ amount: 129_900, back: { date: '2026-10-31', amount: 100_000, compensation: 0 } }))
    const { user } = renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    expect(screen.getByText('The full amount, not what’s left: ₹1,000 is back, ₹299 still to come')).toBeInTheDocument()
    await user.clear(amount())
    await user.type(amount(), '300')
    expect(amount()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('₹1,000 already came back — the amount can’t be less').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('all back: the deadline line says how it ended, not what’s owed from today', () => {
    // Paid 28 Oct to a person: due 29 Oct; back 31 Oct, 2 days late.
    seedStuck(stuckPayment({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))
    renderAt('/app/stuck/s1/edit', <StuckAddScreen />)
    expect(screen.getByText('It came back on 31 Oct, 2 days late — so your bank owes you ₹200 for the wait.')).toBeInTheDocument()
    expect(screen.getByText('The full amount, not what’s left: all of it is back')).toBeInTheDocument()
  })

  it('a payment that’s gone says so', () => {
    renderAt('/app/stuck/nope/edit', <StuckAddScreen />)
    expect(screen.getByRole('heading', { name: 'This one’s gone' })).toBeInTheDocument()
  })
})
