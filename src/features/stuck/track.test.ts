import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllData, exportBackup } from '../../data/backup'
import { stuckSeenStore, stuckStore } from '../../data/stores'
import { addStuck, type StuckDraft } from '../../data/stuck'
import { resetDataForTests } from '../../data/testing'
import { readStuckMessage, type StuckSignal } from './detect'
import { alertSignals, SEEN_MS, trackStuckSignals } from './track'

const GPAY = 'com.google.android.apps.nbu.paisa.user'
const PHONEPE = 'com.phonepe.app'
const MESSAGES = 'com.google.android.apps.messaging'
const SWIGGY = 'in.swiggy.android'

/** Monday 2 Nov 2026, 10 am. */
const T = new Date(2026, 10, 2, 10, 0).getTime()
const MIN = 60_000
const TODAY = '2026-11-02'

/** What the phone saw: `text` posted by `app` at `at`. */
function heard(text: string, app: string, at: number = T): StuckSignal {
  const signal = readStuckMessage(text, { today: TODAY, app, at })
  if (!signal) throw new Error(`Not a stuck-money message: ${text}`)
  return signal
}

const FAILED_GPAY = (at = T) => heard('Payment failed\n₹500 to Riya Sharma · Any money debited will be refunded within 3 working days', GPAY, at)
const FAILED_BANK = (at = T) => heard('Your UPI payment of Rs.500.00 to RIYA SHARMA failed. Any amount debited will be reversed in 48 hrs. UPI Ref 630611112222 -HDFC Bank', MESSAGES, at)
const DEBIT = (at: number, ref = '630611112222') => heard(`Rs.500.00 debited from a/c **4821 on 02-11-26 to VPA riya.s@okaxis (UPI Ref No ${ref}). Not you? Call on 18002586161 to report`, MESSAGES, at)

const manual = (over: Partial<StuckDraft> = {}): StuckDraft => ({
  kind: 'failed',
  rail: 'upi_merchant',
  party: 'Swiggy',
  merchant: 'swiggy',
  amount: 50_000,
  date: '2026-10-28',
  promisedBy: null,
  ref: null,
  orderId: null,
  bank: null,
  account: null,
  app: null,
  source: 'manual',
  confirmed: true,
  ...over,
})

beforeEach(() => {
  resetDataForTests()
})

describe('new stuck payments', () => {
  it('saves a failure the phone saw — waiting for a tap when the app only says the money may have left', () => {
    const result = trackStuckSignals([FAILED_GPAY()], 'alert', T + MIN)
    expect(result.added).toHaveLength(1)
    expect(result.added[0]).toMatchObject({ kind: 'failed', amount: 50_000, party: 'Riya Sharma', rail: 'upi_person', app: 'gpay', source: 'alert', confirmed: false, date: TODAY, createdAt: T + MIN })
    expect(result.back).toEqual([])
    expect(stuckStore.get()).toEqual(result.added)
  })

  it('a failure told twice — the UPI app, then the bank — is one, and the second fills in what the first lacked', () => {
    const result = trackStuckSignals([FAILED_BANK(T + MIN), FAILED_GPAY()], 'alert', T + 2 * MIN)
    expect(result.added).toHaveLength(1)
    expect(stuckStore.get()).toHaveLength(1)
    expect(stuckStore.get()[0]).toMatchObject({ party: 'Riya Sharma', app: 'gpay', ref: '630611112222', bank: 'hdfc' })
  })

  it('…also when the second comes after Settle has already saved the first', () => {
    trackStuckSignals([FAILED_GPAY()], 'alert', T + MIN)
    const later = trackStuckSignals([FAILED_BANK(T + 3 * MIN)], 'alert', T + 4 * MIN)
    expect(later.added).toEqual([])
    expect(stuckStore.get()).toHaveLength(1)
    expect(stuckStore.get()[0]?.ref).toBe('630611112222')
  })

  it('a pending payment that then fails is the same payment', () => {
    const pending = heard('Payment pending\n₹500 to Riya Sharma. Your bank is taking longer than usual.', PHONEPE, T)
    trackStuckSignals([pending], 'alert', T + MIN)
    const failed = trackStuckSignals([FAILED_BANK(T + 3 * 60 * MIN)], 'alert', T + 3 * 60 * MIN)
    expect(failed.added).toEqual([])
    expect(stuckStore.get()).toHaveLength(1)
    expect(stuckStore.get()[0]).toMatchObject({ ref: '630611112222', confirmed: false })
  })

  it('a different amount, or the same amount to someone else, is another payment', () => {
    const other = heard('Payment failed\n₹500 to Swiggy', GPAY, T + MIN)
    const more = heard('Payment failed\n₹650 to Riya Sharma', GPAY, T + 2 * MIN)
    expect(trackStuckSignals([FAILED_GPAY(), other, more], 'alert', T + 3 * MIN).added).toHaveLength(3)
  })

  it('a known reference already saved by hand is learned into, not added again', () => {
    const own = addStuck(manual({ party: null, merchant: null, ref: '630611112222', confirmed: false }), T)
    const result = trackStuckSignals([FAILED_BANK()], 'alert', T + MIN)
    expect(result.added).toEqual([])
    expect(stuckStore.get()).toEqual([expect.objectContaining({ id: own.id, party: 'Riya Sharma', bank: 'hdfc' })])
  })

  it('a refund a business started is saved with its order and promise; its second message is the same refund', () => {
    const started = heard('Refund initiated\nYour refund of ₹249 for order #148293651 has been initiated and will be credited to your original payment method in 5-7 business days.', SWIGGY, T)
    const processed = heard('Refund of Rs.249.00 from SWIGGY has been processed to your HDFC Bank Card XX9034. It will reflect in 5-7 days.', MESSAGES, T + 26 * 60 * MIN)
    const first = trackStuckSignals([started], 'alert', T + MIN)
    expect(first.added[0]).toMatchObject({ kind: 'refund', merchant: 'swiggy', party: 'Swiggy', orderId: '148293651', promisedBy: '2026-11-11', confirmed: true })
    const second = trackStuckSignals([processed], 'alert', T + 27 * 60 * MIN)
    expect(second.added).toEqual([])
    // The first promise stands; what the bank added is kept.
    expect(stuckStore.get()).toEqual([expect.objectContaining({ promisedBy: '2026-11-11', account: 'XX9034', bank: 'hdfc' })])
  })

  it('a refund from no one in particular is not saved', () => {
    const anonymous = heard('Refund initiated: Amt: Rs.3,274.66 on HDFC Bank Credit Card 1111.', MESSAGES)
    expect(trackStuckSignals([anonymous], 'alert', T).added).toEqual([])
  })
})

describe('did the money leave? — the debit decides', () => {
  it('a debit just before the failure confirms it', () => {
    const result = trackStuckSignals([FAILED_GPAY(), DEBIT(T - 30 * 1000)], 'alert', T + MIN)
    expect(result.added[0]?.confirmed).toBe(true)
  })

  it('a debit up to 30 minutes before, or a minute after, confirms it — even in a later batch', () => {
    trackStuckSignals([DEBIT(T - 25 * MIN, '630699990000')], 'alert', T - 20 * MIN)
    expect(trackStuckSignals([FAILED_GPAY()], 'alert', T + MIN).added[0]?.confirmed).toBe(true)

    resetDataForTests()
    trackStuckSignals([FAILED_GPAY()], 'alert', T + 30 * 1000)
    expect(stuckStore.get()[0]?.confirmed).toBe(false)
    trackStuckSignals([DEBIT(T + MIN, '630699990000')], 'alert', T + 2 * MIN)
    expect(stuckStore.get()[0]?.confirmed).toBe(true)
  })

  it('a debit long after the failure is the retry that went through, not the stuck money', () => {
    const result = trackStuckSignals([FAILED_GPAY(), DEBIT(T + 10 * MIN, '630699990000')], 'alert', T + 11 * MIN)
    expect(result.added[0]?.confirmed).toBe(false)
  })

  it('the same UPI reference confirms it whenever it came; a different one never does', () => {
    expect(trackStuckSignals([FAILED_BANK(), DEBIT(T + 20 * MIN)], 'alert', T + 21 * MIN).added[0]?.confirmed).toBe(true)
    resetDataForTests()
    expect(trackStuckSignals([FAILED_BANK(), DEBIT(T - MIN, '630699990000')], 'alert', T + MIN).added[0]?.confirmed).toBe(false)
  })

  it('one debit confirms one failure', () => {
    const swiggy = heard('Payment failed\n₹500 to Swiggy', GPAY, T + 30 * 1000)
    const result = trackStuckSignals([DEBIT(T - MIN, '630699990000'), FAILED_GPAY(), swiggy], 'alert', T + MIN)
    expect(result.added.map((s) => s.confirmed)).toEqual([true, false])
  })

  it('a pending payment is never confirmed by a debit (it may still go through)', () => {
    const pending = heard('Payment pending\n₹500 to Riya Sharma. Your bank is taking longer than usual.', PHONEPE, T)
    expect(trackStuckSignals([DEBIT(T - MIN, '630699990000'), pending], 'alert', T + MIN).added[0]?.confirmed).toBe(false)
  })

  it('a failure that says the money was taken needs no debit', () => {
    const taken = heard('Payment Failed\nMoney Deducted / Transaction Not Completed. ₹349 to Blinkit will be refunded in 3-5 days.', PHONEPE)
    expect(trackStuckSignals([taken], 'alert', T + MIN).added[0]?.confirmed).toBe(true)
  })
})

describe('money back', () => {
  it('with the same reference, closes that one for sure', () => {
    const a = addStuck(manual({ ref: '630611112222' }), T)
    const b = addStuck(manual({ party: 'Zomato', merchant: 'zomato' }), T)
    const reversal = heard('Rs 500.00 reversed to ICICI Bank Acct XX902 on 02-Nov-26 for failed UPI txn 630611112222.', MESSAGES)
    const result = trackStuckSignals([reversal], 'alert', T + MIN)
    expect(result.back.map((s) => s.id)).toEqual([a.id])
    expect(result.back[0]?.back).toEqual({ date: TODAY, amount: 50_000, compensation: 0 })
    expect(stuckStore.get().find((s) => s.id === b.id)?.back).toBeNull()
  })

  it('without one, closes the only open payment it could be', () => {
    const s = addStuck(manual({ confirmed: false }), T)
    const reversal = heard('Your A/c XX4821 is credited with INR 500.00 on 01-11-26. Info: UPI-REV-630512340987. -HDFC Bank', MESSAGES)
    const result = trackStuckSignals([reversal], 'alert', T + MIN)
    expect(result.back).toEqual([expect.objectContaining({ id: s.id, confirmed: true, back: { date: '2026-11-01', amount: 50_000, compensation: 0 } })])
  })

  it('when two could be it, closes neither', () => {
    addStuck(manual(), T)
    addStuck(manual({ party: 'Riya Sharma', merchant: null, rail: 'upi_person' }), T)
    const reversal = heard('INR 500 credited to your A/c XX1234 (transaction reversed). -Yes Bank', MESSAGES)
    expect(trackStuckSignals([reversal], 'alert', T + MIN).back).toEqual([])
  })

  it('not money from before the day it left, nor more than 120 days after', () => {
    addStuck(manual({ date: '2026-10-28' }), T)
    const early = heard('Rs.500.00 credited to your A/c XX3367 on 27/10/26 towards UPI/RET/630411112222 for failed transaction. -SBI', MESSAGES)
    expect(trackStuckSignals([early], 'alert', T).back).toEqual([])
    const late = readStuckMessage('Rs.500.00 credited to your A/c XX3367 on 01/03/27 towards UPI/RET/630411113333 for failed transaction. -SBI', { today: '2027-03-01' }) as StuckSignal
    expect(trackStuckSignals([late], 'sms', T + 200 * 86_400_000).back).toEqual([])
  })

  it('a business’s refund closes a refund from it, a reversal closes a failed payment', () => {
    const refund = addStuck(manual({ kind: 'refund', rail: null, amount: 24_900, date: '2026-10-30' }), T)
    const failed = addStuck(manual({ party: 'Riya Sharma', merchant: null, rail: 'upi_person', amount: 24_900, date: '2026-10-30' }), T)
    const fromSwiggy = heard('Dear Customer, refund of INR 249 from Swiggy Limited Banga has been credited to your IndusInd Bank Credit Card XX1234 on 01-Nov-26', MESSAGES)
    expect(trackStuckSignals([fromSwiggy], 'alert', T).back.map((s) => s.id)).toEqual([refund.id])
    const reversed = heard('Rs 249.00 reversed to ICICI Bank Acct XX902 on 02-Nov-26 for failed UPI txn 630600001111.', MESSAGES, T + 60 * MIN)
    expect(trackStuckSignals([reversed], 'alert', T + 61 * MIN).back.map((s) => s.id)).toEqual([failed.id])
  })

  it('the same money told twice is counted once, even with another open payment of that amount', () => {
    const swiggy = addStuck(manual({ ref: '630611119999' }), T)
    const riya = addStuck(manual({ party: 'Riya Sharma', merchant: null, rail: 'upi_person' }), T)
    const app = heard('Your money is back\n₹500 from your failed payment to Swiggy has been credited back to your account', GPAY, T)
    const bank = heard('Rs 500.00 reversed to ICICI Bank Acct XX902 on 02-Nov-26 for failed UPI txn 630611119999.', MESSAGES, T + 2 * MIN)
    const result = trackStuckSignals([app, bank], 'alert', T + 3 * MIN)
    expect(result.back.map((s) => s.id)).toEqual([swiggy.id])
    expect(stuckStore.get().find((s) => s.id === riya.id)?.back).toBeNull()
  })

  it('a failure and its money back in one go: saved, then closed', () => {
    const reversal = heard('Rs 500.00 reversed to HDFC Bank A/c XX4821 on 02-11-26 for failed UPI txn 630611112222.', MESSAGES, T + 60 * MIN)
    const result = trackStuckSignals([reversal, FAILED_BANK()], 'alert', T + 61 * MIN)
    expect(result.added).toHaveLength(1)
    expect(result.back).toHaveLength(1)
    expect(stuckStore.get()[0]).toMatchObject({ back: { date: TODAY, amount: 50_000, compensation: 0 }, confirmed: true })
  })
})

describe('a payment that went through after all', () => {
  const PENDING = (at = T) => heard('Payment pending\n₹500 to Riya Sharma. Your bank is taking longer than usual.', PHONEPE, at)
  const WENT_THROUGH = (at: number, text = '₹500 paid to Riya Sharma\nUPI transaction ID: 630611112299') => heard(text, GPAY, at)

  it('told in the same go as its pending alert, it was never stuck: nothing is kept, nothing to say', () => {
    const result = trackStuckSignals([WENT_THROUGH(T + 40 * 1000), PENDING()], 'alert', T + MIN)
    expect(result).toMatchObject({ added: [], back: [], cleared: [] })
    expect(stuckStore.get()).toEqual([])
  })

  it('told later, it sets the waiting one aside — and Undo brings it back', () => {
    trackStuckSignals([PENDING()], 'alert', T + 30 * 1000)
    const waiting = stuckStore.get()
    const result = trackStuckSignals([WENT_THROUGH(T + 5 * MIN)], 'alert', T + 6 * MIN)
    expect(result.added).toEqual([])
    expect(result.cleared).toEqual([expect.objectContaining({ id: waiting[0]?.id, dismissedAt: T + 6 * MIN, back: null })])
    result.undo()
    expect(stuckStore.get()).toEqual(waiting)
  })

  it('the same reference clears it, whoever it names', () => {
    trackStuckSignals([FAILED_BANK()], 'alert', T + MIN)
    const paid = WENT_THROUGH(T + 3 * 60 * MIN, 'Payment successful\n₹500 paid to RIYA S\nUPI Ref: 630611112222')
    expect(trackStuckSignals([paid], 'alert', T + 3 * 60 * MIN).cleared).toHaveLength(1)
  })

  it('never adds, confirms or clears anything else', () => {
    // Alone: nothing.
    expect(trackStuckSignals([WENT_THROUGH(T)], 'alert', T + MIN).added).toEqual([])
    expect(stuckStore.get()).toEqual([])
    // A failure the bank said took the money: the payment that went through is the retry.
    const taken = heard('Payment Failed\nMoney Deducted / Transaction Not Completed. ₹500 to Riya Sharma will be refunded in 3-5 days.', PHONEPE, T + 2 * MIN)
    // Someone else, the same amount.
    const swiggy = heard('Payment pending\n₹500 to Swiggy. Your bank is taking longer than usual.', PHONEPE, T + 3 * MIN)
    trackStuckSignals([taken, swiggy], 'alert', T + 4 * MIN)
    const before = stuckStore.get()
    expect(before.map((s) => s.confirmed)).toEqual([true, false])
    const result = trackStuckSignals([WENT_THROUGH(T + 5 * MIN)], 'alert', T + 6 * MIN)
    expect(result).toMatchObject({ added: [], back: [], cleared: [] })
    expect(stuckStore.get()).toEqual(before)
  })

  it('not two days after the pending alert, nor from before it', () => {
    trackStuckSignals([PENDING()], 'alert', T + MIN)
    expect(trackStuckSignals([WENT_THROUGH(T - 10 * MIN)], 'alert', T + 2 * MIN).cleared).toEqual([])
    expect(trackStuckSignals([WENT_THROUGH(T + 49 * 60 * MIN)], 'alert', T + 49 * 60 * MIN).cleared).toEqual([])
    expect(stuckStore.get()[0]?.dismissedAt).toBeNull()
  })
})

describe('Undo', () => {
  it('puts everything back: new ones go, closed ones reopen, confirmed ones wait again', () => {
    const open = addStuck(manual({ ref: '630611119999' }), T)
    trackStuckSignals([FAILED_GPAY()], 'alert', T + MIN)
    const unconfirmed = stuckStore.get().find((s) => s.id !== open.id)
    const before = stuckStore.get()
    const reversal = heard('Rs 500.00 reversed to ICICI Bank Acct XX902 on 02-Nov-26 for failed UPI txn 630611119999.', MESSAGES, T + 5 * MIN)
    const fresh = heard('Payment failed\n₹120 to Chai Point', GPAY, T + 6 * MIN)
    const result = trackStuckSignals([DEBIT(T + 30 * 1000, '630699990000'), reversal, fresh], 'alert', T + 7 * MIN)
    expect(result.added).toHaveLength(1)
    expect(result.back).toHaveLength(1)
    expect(stuckStore.get().find((s) => s.id === unconfirmed?.id)?.confirmed).toBe(true)
    result.undo()
    expect(stuckStore.get()).toEqual(before)
  })

  it('a failure taken away with Undo isn’t added again when the bank tells it too', () => {
    trackStuckSignals([FAILED_GPAY()], 'alert', T + MIN).undo()
    expect(stuckStore.get()).toEqual([])
    expect(trackStuckSignals([FAILED_BANK(T + 2 * MIN)], 'alert', T + 3 * MIN).added).toEqual([])
    expect(stuckStore.get()).toEqual([])
  })
})

describe('what is remembered', () => {
  it('only for 48 hours, on this phone: not in backups, gone with “Delete all data”', () => {
    trackStuckSignals([DEBIT(T)], 'alert', T + MIN)
    expect(stuckSeenStore.get()).toHaveLength(1)
    trackStuckSignals([], 'alert', T + SEEN_MS + MIN)
    expect(stuckSeenStore.get()).toEqual([])
    trackStuckSignals([DEBIT(T + SEEN_MS)], 'alert', T + SEEN_MS + MIN)
    expect(Object.keys(exportBackup())).not.toContain('stuckSeen')
    expect(JSON.stringify(exportBackup())).not.toContain('630611112222')
    clearAllData()
    expect(stuckSeenStore.get()).toEqual([])
  })

  it('a debit shown by two SMS apps is one debit', () => {
    trackStuckSignals([DEBIT(T), DEBIT(T + 5 * 1000)], 'alert', T + MIN)
    expect(stuckSeenStore.get()).toHaveLength(1)
  })
})

describe('alertSignals', () => {
  it('reads each alert’s title and text together, and skips what isn’t stuck money', () => {
    const signals = alertSignals(
      [
        { app: GPAY, title: 'Payment failed', text: '₹500 to Riya Sharma', postedAt: T },
        { app: GPAY, title: 'Riya Sharma paid you ₹420', text: '', postedAt: T },
        { app: SWIGGY, title: 'Refund initiated', text: 'Your refund of ₹249 for order #148293651 has been initiated.', postedAt: T },
        { app: MESSAGES, title: 'HDFCBK', text: '481923 is your OTP for UPI transaction of Rs.250.00 at SWIGGY', postedAt: T },
      ],
      TODAY,
    )
    expect(signals.map((s) => [s.type, s.amount, s.at])).toEqual([
      ['failed', 50_000, T],
      ['refund_initiated', 24_900, T],
    ])
  })
})
