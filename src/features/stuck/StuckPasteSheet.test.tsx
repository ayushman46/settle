import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stuckStore } from '../../data/stores'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, peekStuckPrefill, readStuckPaste } from './prefill'
import { StuckPasteSheet } from './StuckPasteSheet'
import { seedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

const SWIGGY_FAILED = 'Your UPI payment of Rs.649.00 to SWIGGY failed. UPI Ref 430112345678.'
const OTP = '123456 is your OTP for txn of INR 4,500.00 at FLIPKART. Do not share it with anyone.'
const AMAZON_REFUND = 'Refund of Rs.1,299 for your Amazon order 402-1234567-1234567 has been initiated. It will reach your account in 3-5 business days.'
const FRIEND_CREDIT = 'Rs.7200.00 credited to your A/c XX4821 by VPA arjun@okaxis on 01-11-26. UPI Ref 630498765432 -HDFC Bank'
const SWIGGY_DEBIT = 'Sent Rs.649.00 From HDFC Bank A/C *4821 To SWIGGY On 01/11/26 Ref 430598765432'
const BIGBASKET_PENDING = 'Your payment of Rs.1,999.00 to BIGBASKET via UPI is pending. Ref 430177778888'

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

describe('readStuckPaste', () => {
  it('reads each message on its own: an OTP pasted with a failed payment doesn’t hide it', () => {
    const paste = readStuckPaste(`${SWIGGY_FAILED}\n\n${OTP}`, '2026-11-01')
    expect(paste.items).toHaveLength(1)
    expect(paste.items[0]?.prefill).toMatchObject({ kind: 'failed', amount: 64_900, merchant: 'swiggy', ref: '430112345678' })
    expect(paste.skipped).toEqual(['otp'])
  })

  it('finds every stuck payment in a chunk, and says what the rest were', () => {
    const paste = readStuckPaste([SWIGGY_DEBIT, OTP, SWIGGY_FAILED, AMAZON_REFUND, FRIEND_CREDIT].join('\n\n'), '2026-11-01')
    expect(paste.items.map((item) => [item.prefill.kind, item.prefill.amount])).toEqual([
      ['failed', 64_900],
      ['refund', 129_900],
    ])
    // The debit has another reference: another payment, not this failure's money.
    expect(paste.debits).toHaveLength(1)
    expect(paste.credits).toBe(1)
    expect(paste.skipped).toEqual(['otp', 'in'])
  })

  it('a failure pasted with its own debit is known to have taken the money', () => {
    const debit = 'Rs.649.00 debited from A/c XX4821 on 01-11-26 to SWIGGY. UPI Ref 430112345678 -HDFC Bank'
    const paste = readStuckPaste(`${SWIGGY_FAILED}\n\n${debit}`, '2026-11-01')
    expect(paste.items[0]?.prefill.confirmed).toBe(true)
    expect(paste.paired).toHaveLength(1)
    expect(paste.debits).toEqual([])
  })
})

describe('StuckPasteSheet', SLOW, () => {
  async function paste(text: string) {
    const utils = renderAt('/app/stuck', <StuckPasteSheet open onClose={() => {}} />)
    const sheet = screen.getByRole('dialog', { name: 'Paste a message' })
    await utils.user.click(within(sheet).getByRole('textbox', { name: 'Paste the bank SMS or app message' }))
    await utils.user.paste(text)
    await utils.user.click(within(sheet).getByRole('button', { name: 'Read it' }))
    return { ...utils, sheet }
  }

  it('one failed payment with an OTP opens Add, filled in', async () => {
    await paste(`${SWIGGY_FAILED}\n\n${OTP}`)
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, merchant: 'swiggy', ref: '430112345678', source: 'sms' })
  })

  it('several found: lists them and tracks the ones ticked, with Undo', async () => {
    const { user, sheet } = await paste([SWIGGY_DEBIT, OTP, SWIGGY_FAILED, AMAZON_REFUND, FRIEND_CREDIT].join('\n\n'))
    expect(within(sheet).getByRole('heading', { name: 'Found 2 stuck payments' })).toBeInTheDocument()
    expect(within(sheet).getByRole('checkbox', { name: /^Swiggy · ₹649/ })).toBeChecked()
    expect(within(sheet).getByRole('checkbox', { name: /^Amazon · ₹1,299/ })).toBeChecked()
    expect(within(sheet).getByText('3 messages skipped (OTP, money in, payment out)')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Track these 2' }))
    expect(stuckStore.get().map((s) => [s.kind, s.amount])).toEqual([
      ['failed', 64_900],
      ['refund', 129_900],
    ])
    expect(await screen.findByText(/^Tracking 2 stuck payments/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([])
  })

  it('the same message twice opens the one already tracked instead of adding it again', async () => {
    seedStuck(stuckPayment({ id: 's1', party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', amount: 64_900, ref: '430112345678', date: '2026-11-01' }))
    await paste(SWIGGY_FAILED)
    expect(currentUrl()).toBe('/app/stuck/s1')
    expect(await screen.findByText('You’re already tracking this — here it is')).toBeInTheDocument()
    expect(stuckStore.get()).toHaveLength(1)
  })

  it('a plain debit asks whether that payment failed, and carries everything it said into Add', async () => {
    const { user, sheet } = await paste(SWIGGY_DEBIT)
    expect(within(sheet).getByText('Did this payment fail but take your money?')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Yes, it failed' }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, party: 'Swiggy', ref: '430598765432', bank: 'hdfc', account: 'XX4821', date: '2026-11-01', confirmed: true })
  })

  it('a pending payment suggests waiting for the final SMS', async () => {
    const { user, sheet } = await paste(BIGBASKET_PENDING)
    expect(within(sheet).getByText('Still pending — wait for the final SMS')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/stuck')
    await user.click(within(sheet).getByRole('button', { name: 'Track it anyway' }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 199_900, confirmed: false })
  })

  it('money in from a friend points to Who’s paid?', async () => {
    const { user, sheet } = await paste(FRIEND_CREDIT)
    expect(within(sheet).getByText('Looks like money came in')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Open Who’s paid?' }))
    expect(currentUrl()).toBe('/app/whos-paid')
  })

  it('nothing stuck: Add it yourself keeps what the message did say', async () => {
    const { user, sheet } = await paste(`${SWIGGY_DEBIT}\n\n${SWIGGY_DEBIT.replace('430598765432', '430598765433')}`)
    expect(within(sheet).getByText('Couldn’t find a stuck payment in that')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Add it yourself' }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ amount: 64_900, party: 'Swiggy', ref: '430598765432' })
    expect(peekStuckPrefill()?.kind).toBeUndefined()
  })
})
