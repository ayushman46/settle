import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stuckStore } from '../../data/stores'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, MAX_PASTE_MESSAGES, peekStuckPrefill, readStuckPaste } from './prefill'
import { StuckPasteSheet } from './StuckPasteSheet'
import { seedStuck, storedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

const SWIGGY_FAILED = 'Your UPI payment of Rs.649.00 to SWIGGY failed. UPI Ref 430112345678.'
const OTP = '123456 is your OTP for txn of INR 4,500.00 at FLIPKART. Do not share it with anyone.'
const AMAZON_REFUND = 'Refund of Rs.1,299 for your Amazon order 402-1234567-1234567 has been initiated. It will reach your account in 3-5 business days.'
const FRIEND_CREDIT = 'Rs.7200.00 credited to your A/c XX4821 by VPA arjun@okaxis on 01-11-26. UPI Ref 630498765432 -HDFC Bank'
const SWIGGY_DEBIT = 'Sent Rs.649.00 From HDFC Bank A/C *4821 To SWIGGY On 01/11/26 Ref 430598765432'
const BIGBASKET_PENDING = 'Your payment of Rs.1,999.00 to BIGBASKET via UPI is pending. Ref 430177778888'
const SWIGGY_FAILED_DATED = 'Your UPI payment of Rs.649.00 to SWIGGY on 31-10-26 failed. UPI Ref 430112345678.'
const AMAZON_REFUND_DATED = 'Refund of Rs.1,299 for your Amazon order 402-1234567-1234567 has been initiated on 30-10-2026. It will reach your account in 3-5 business days.'

/** Meera's pair: SBI's debit (with its day) and its failure (without one). */
const MEERA_DEBIT = 'Dear UPI user A/C X4821 debited by 2000.00 on date 29Oct26 trf to RAMESH KUMAR Refno 430212345678. If not u? call 1800111109. -SBI'
const MEERA_FAILED = 'Transaction of Rs.2000 to RAMESH KUMAR failed. Amount will be reversed to A/c XX4821 shortly. UPI Ref 430212345678 -SBI'
/** ICICI's own failure SMS and its debit, for the same IMPS. */
const ICICI_FAILED =
  'Dear Customer, your IMPS transaction of Rs.12,000.00 from ICICI Bank A/c XX4821 to SRI SAI MOBILE SPARES on 30-Oct-26 has failed. IMPS Ref No 630312345678. The debited amount will be reversed to your account. -ICICI Bank'
const ICICI_DEBIT = 'ICICI Bank Acct XX4821 debited for Rs 12000.00 on 30-Oct-26; IMPS:630312345678 credited to SRI SAI MOBILE SPARES. Call 18002662 for dispute.'

/** A failed UPI payment of ₹`rupees` with its own reference. */
const failure = (rupees: number, ref: string) => `Your UPI payment of Rs.${rupees}.00 to MYNTRA on 31-10-26 failed. UPI Ref ${ref} -Axis Bank`

beforeEach(() => {
  resetProScreens()
  clearStuckPrefill()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
  clearStuckPrefill()
  window.sessionStorage.clear()
})

describe('readStuckPaste', () => {
  it('reads each message on its own: an OTP pasted with a failed payment doesn’t hide it', () => {
    const paste = readStuckPaste(`${SWIGGY_FAILED}\n\n${OTP}`, '2026-11-01')
    expect(paste.items).toHaveLength(1)
    expect(paste.items[0]?.prefill).toMatchObject({ kind: 'failed', amount: 64_900, merchant: 'swiggy', ref: '430112345678' })
    expect(paste.skipped).toEqual(['otp'])
    expect(paste.read).toBe(2)
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

  it('a message that prints no day leaves the day unset — never a quiet “today”', () => {
    expect(readStuckPaste(SWIGGY_FAILED, '2026-11-01').items[0]?.prefill.date).toBeUndefined()
    expect(readStuckPaste(SWIGGY_FAILED_DATED, '2026-11-01').items[0]?.prefill.date).toBe('2026-10-31')
  })

  it('a failure without a day takes its debit’s day (Meera’s pair: 29 Oct, the money left)', () => {
    for (const text of [`${MEERA_DEBIT}\n\n${MEERA_FAILED}`, `${MEERA_FAILED}\n\n${MEERA_DEBIT}`]) {
      const paste = readStuckPaste(text, '2026-11-02')
      expect(paste.items).toHaveLength(1)
      expect(paste.items[0]?.prefill).toMatchObject({ kind: 'failed', amount: 200_000, date: '2026-10-29', confirmed: true })
    }
  })

  it('“in 7 working days” stays a count from the day, not a day of its own (Neha’s Myntra refund)', () => {
    const neha = 'Hi Neha, refund of Rs. 1099 for your Myntra order 1209384756-5521 has been initiated. It will reflect in your account in 7 working days. - Myntra'
    expect(readStuckPaste(neha, '2026-11-02').items[0]?.prefill).toMatchObject({ kind: 'refund', merchant: 'myntra', promisedBy: null, promisedDays: 7, promisedWorking: true })
    expect(readStuckPaste(neha, '2026-11-02').items[0]?.prefill.date).toBeUndefined()
    // "5-7 business days" from a day it prints: the 7 working days chip, from 24 Oct.
    const flipkart = 'Your refund of Rs.1,299 for order OD432112345678901234 has been initiated on 24-10-2026. It will be credited in 5-7 business days. - Flipkart'
    expect(readStuckPaste(flipkart, '2026-11-02').items[0]?.prefill).toMatchObject({ date: '2026-10-24', promisedBy: null, promisedDays: 7 })
    // Hinglish "5-7 din mein": 7 days, counted the same way.
    const hinglish = 'Aapka Rs 500 ka refund Swiggy se initiate ho gaya hai, 5-7 din mein aa jayega.'
    expect(readStuckPaste(hinglish, '2026-11-02').items[0]?.prefill).toMatchObject({ kind: 'refund', promisedBy: null, promisedDays: 7, promisedWorking: false })
    // "By 12 Nov" is a day of its own.
    const byDay = 'Refund of Rs.1,299 for your Amazon order 402-1234567-1234567 has been initiated on 30-10-2026 and will be credited by 12 Nov.'
    expect(readStuckPaste(byDay, '2026-11-02').items[0]?.prefill).toMatchObject({ promisedBy: '2026-11-12' })
    expect(readStuckPaste(byDay, '2026-11-02').items[0]?.prefill.promisedDays).toBeUndefined()
  })

  it('an airline’s refund to a card turns “paid by card” on (the DGCA’s 7 days)', () => {
    const indigo =
      'Dear Customer, your refund of INR 8,450.00 for PNR X7KQ2M (flight 6E 2134 DEL-BOM, cancelled on 21 Oct 2026) has been initiated to your HDFC Bank credit card ending 4821. It will reflect within 7 working days. - IndiGo'
    expect(readStuckPaste(indigo, '2026-11-02').items[0]?.prefill).toMatchObject({ kind: 'refund', merchant: 'indigo', rail: 'card_online', orderId: 'X7KQ2M' })
  })

  it('reads every message — not only the first five — and past the limit, counts what it left', () => {
    const mohammed = [ICICI_FAILED, failure(2499, '430155556666'), OTP, failure(5000, '430177778888'), failure(3200, '430211223344'), failure(1500, '630399887766')]
    expect(readStuckPaste(mohammed.join('\n\n'), '2026-11-01').items.map((item) => item.prefill.amount)).toEqual([1_200_000, 249_900, 500_000, 320_000, 150_000])

    const twelve = [SWIGGY_DEBIT, FRIEND_CREDIT, OTP, SWIGGY_DEBIT.replace('430598765432', '430598765499'), OTP]
    for (let i = 0; i < 7; i += 1) twelve.push(failure(100 + i, `43020000000${i}`))
    const paste = readStuckPaste(twelve.join('\n\n'), '2026-11-01')
    expect(paste.items).toHaveLength(7)
    expect(paste.read).toBe(12)
    expect(paste.left).toBe(0)

    // A long message doesn't cut off the one after it.
    const offer = `Get flat 10% off on electronics. ${'Shop the festive sale now with great offers on phones and laptops. '.repeat(30)}`
    expect(offer.length).toBeGreaterThan(2000)
    expect(readStuckPaste(`${offer}\n\n${failure(2499, '430155556666')}`, '2026-11-01').items).toHaveLength(1)

    const many = Array.from({ length: MAX_PASTE_MESSAGES + 5 }, (_, i) => failure(100 + i, `4303${String(i).padStart(8, '0')}`))
    const capped = readStuckPaste(many.join('\n\n'), '2026-11-01')
    expect(capped.items).toHaveLength(MAX_PASTE_MESSAGES)
    expect(capped.left).toBe(5)
  })

  it('the same message pasted twice counts once', () => {
    const paste = readStuckPaste(`${SWIGGY_FAILED}\n\n${SWIGGY_FAILED}`, '2026-11-01')
    expect(paste.items).toHaveLength(1)
    expect(paste.skipped).toEqual(['repeat'])
  })

  it('a failed booking with an amount but no ₹ is still read, never “not a payment” (IRCTC)', () => {
    const irctc = 'Dear Customer, Ticket booking for PNR could not be completed. Amt 1845 debited on 26/10/2026, Txn 100004512345678, will be refunded to source. -IRCTC'
    const paste = readStuckPaste(irctc, '2026-11-01')
    const read = paste.items[0]?.prefill ?? paste.found
    expect(read).toMatchObject({ kind: 'failed', amount: 184_500, date: '2026-10-26' })
    expect(paste.skipped).not.toContain('other')
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
    await paste(`${SWIGGY_FAILED_DATED}\n\n${OTP}`)
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, merchant: 'swiggy', ref: '430112345678', source: 'sms', date: '2026-10-31' })
  })

  it('several found: lists them and tracks the ones ticked, with Undo', async () => {
    const { user, sheet } = await paste([SWIGGY_DEBIT, OTP, SWIGGY_FAILED_DATED, AMAZON_REFUND_DATED, FRIEND_CREDIT].join('\n\n'))
    expect(within(sheet).getByRole('heading', { name: 'Found 2 stuck payments' })).toBeInTheDocument()
    expect(within(sheet).getByRole('checkbox', { name: /^Swiggy · ₹649 Failed payment · 31 Oct/ })).toBeChecked()
    expect(within(sheet).getByRole('checkbox', { name: /^Amazon · ₹1,299 Refund · 30 Oct/ })).toBeChecked()
    expect(within(sheet).getByRole('button', { name: 'Check first: Swiggy · ₹649 · 31 Oct' })).toBeInTheDocument()
    expect(within(sheet).getByText('Read 5 messages · 2 stuck · 3 messages skipped (OTP, money in, payment out)')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Track these 2' }))
    expect(stuckStore.get().map((s) => [s.kind, s.amount, s.date])).toEqual([
      ['failed', 64_900, '2026-10-31'],
      ['refund', 129_900, '2026-10-30'],
    ])
    expect(await screen.findByText(/^Tracking 2 stuck payments/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([])
  })

  it('messages that print no day: one question for them all, and a promise in days counts from the day said', async () => {
    const { user, sheet } = await paste([OTP, SWIGGY_FAILED, AMAZON_REFUND].join('\n\n'))
    expect(within(sheet).getByRole('checkbox', { name: /^Swiggy · ₹649 Failed payment · No day in the message/ })).toBeChecked()
    const track = within(sheet).getByRole('button', { name: 'Track these 2' })
    expect(track).toBeDisabled()
    expect(within(sheet).getByText('Say when they came')).toBeInTheDocument()
    const day = within(sheet).getByRole('group', { name: '2 messages don’t say the day — when did they come?' })
    expect(within(day).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(day).getByRole('button', { name: 'Yesterday' }))
    await user.click(track)
    // Sat 31 Oct + 5 working days = Fri 6 Nov.
    expect(stuckStore.get().map((s) => [s.kind, s.date, s.promisedBy])).toEqual([
      ['failed', '2026-10-31', null],
      ['refund', '2026-10-31', '2026-11-06'],
    ])
  })

  it('“Check first” comes back to the list, ticks as they were', async () => {
    const { user, sheet, unmount } = await paste([SWIGGY_FAILED_DATED, AMAZON_REFUND_DATED].join('\n\n'))
    await user.click(within(sheet).getByRole('checkbox', { name: /^Amazon/ }))
    await user.click(within(sheet).getByRole('button', { name: /^Check first: Swiggy/ }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ kind: 'failed', amount: 64_900, date: '2026-10-31' })
    unmount()

    // Back on the list (the sheet itself is closed there): the found ones again.
    renderAt('/app/stuck', <StuckPasteSheet open={false} onClose={() => {}} />)
    const again = await screen.findByRole('dialog', { name: 'Paste a message' })
    expect(within(again).getByRole('heading', { name: 'Found 2 stuck payments' })).toBeInTheDocument()
    expect(within(again).getByRole('checkbox', { name: /^Swiggy/ })).not.toBeChecked()
    expect(within(again).getByRole('checkbox', { name: /^Amazon/ })).not.toBeChecked()
  })

  it('a list already tracked says so, opens each one, and is done', async () => {
    seedStuck(
      stuckPayment({ id: 's1', party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', amount: 64_900, ref: '430112345678', date: '2026-10-31' }),
      stuckPayment({ id: 's2', kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', amount: 129_900, ref: null, orderId: '402-1234567-1234567', date: '2026-10-30' }),
    )
    const { user, sheet } = await paste([SWIGGY_FAILED_DATED, AMAZON_REFUND_DATED].join('\n\n'))
    expect(within(sheet).getByText('You’re already tracking all of these')).toBeInTheDocument()
    expect(within(sheet).getByRole('checkbox', { name: /^Swiggy .* Already tracked/ })).toBeDisabled()
    expect(within(sheet).queryByRole('button', { name: /^Track these/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /^Open it: Amazon/ }))
    expect(currentUrl()).toBe('/app/stuck/s2')
  })

  it('the same message twice in one paste is one payment', async () => {
    const { sheet } = await paste(`${SWIGGY_FAILED_DATED}\n\n${OTP}\n\n${SWIGGY_FAILED_DATED}\n\n${AMAZON_REFUND_DATED}`)
    expect(within(sheet).getAllByRole('checkbox', { name: /^Swiggy/ })).toHaveLength(1)
    expect(within(sheet).getByText(/2 messages skipped \(OTP, pasted twice\)/)).toBeInTheDocument()
  })

  it('the same message again opens the one already tracked instead of adding it again', async () => {
    seedStuck(stuckPayment({ id: 's1', party: 'Swiggy', merchant: 'swiggy', rail: 'upi_merchant', amount: 64_900, ref: '430112345678', date: '2026-11-01' }))
    await paste(SWIGGY_FAILED)
    expect(currentUrl()).toBe('/app/stuck/s1')
    expect(await screen.findByText('You’re already tracking this — here it is')).toBeInTheDocument()
    expect(stuckStore.get()).toHaveLength(1)
  })

  it('the bank’s debit for a tracked payment, said to have failed, notes the money left (with Undo)', async () => {
    seedStuck(stuckPayment({ id: 's1', rail: 'imps', party: 'SRI SAI MOBILE SPARES', amount: 1_200_000, ref: '630312345678', date: '2026-10-30', confirmed: false }))
    const { user, sheet } = await paste(ICICI_DEBIT)
    await user.click(within(sheet).getByRole('button', { name: 'Yes, it failed' }))
    expect(currentUrl()).toBe('/app/stuck/s1')
    expect(storedStuck('s1')?.confirmed).toBe(true)
    // IMPS: due back 31 Oct; on 1 Nov, a day late.
    expect(await screen.findByText('Noted — the money left your account, so your bank owes you ₹100 for the wait so far.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.confirmed).toBe(false)
  })

  it('the bank’s own failure SMS, pasted again for a payment to check, notes the money left', async () => {
    seedStuck(stuckPayment({ id: 's1', rail: 'imps', party: 'SRI SAI MOBILE SPARES', amount: 1_200_000, ref: '630312345678', date: '2026-10-30', confirmed: false }))
    await paste(ICICI_FAILED)
    expect(currentUrl()).toBe('/app/stuck/s1')
    await waitFor(() => expect(storedStuck('s1')?.confirmed).toBe(true))
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

  it('nothing stuck: Add it yourself keeps what the message did say, and the tally counts every message', async () => {
    const { user, sheet } = await paste(`${SWIGGY_DEBIT}\n\n${SWIGGY_DEBIT.replace('430598765432', '430598765433')}`)
    expect(within(sheet).getByText('Couldn’t find a stuck payment in that')).toBeInTheDocument()
    expect(within(sheet).getByText('Read 2 messages · 2 messages skipped (payment out)')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Add it yourself' }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toMatchObject({ amount: 64_900, party: 'Swiggy', ref: '430598765432' })
    expect(peekStuckPrefill()?.kind).toBeUndefined()
  })
})
