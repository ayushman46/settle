import { afterEach, describe, expect, it, vi } from 'vitest'
import { alertToPaidOut, type RawAlert } from '../features/autosettle/alerts'
import { expectPayment, PAY_WATCH_MS, paymentsSeen, resetPayWatchForTests } from './payWatch'

const GPAY = 'com.google.android.apps.nbu.paisa.user'
const MESSAGES = 'com.google.android.apps.messaging'
const at = Date.UTC(2026, 10, 14, 10, 0, 0)
const alert = (app: string, title: string, text: string, postedAt = at): RawAlert => ({ id: `${app}:${postedAt}:${text.length}`, app, title, text, postedAt })

afterEach(() => resetPayWatchForTests())

describe('a payment you made, as the phone’s alerts tell it', () => {
  it('reads a UPI app saying it went through', () => {
    expect(alertToPaidOut(alert(GPAY, 'Google Pay', 'You paid ₹400.00 to Riya Sharma'))).toEqual({ amount: 40_000, at })
    expect(alertToPaidOut(alert(GPAY, 'Payment successful', '₹1,250 sent to SAM K'))).toEqual({ amount: 125_000, at })
  })

  it('reads the bank’s debit SMS', () => {
    const sms = 'Rs.400.00 debited from A/c XX4821 on 14-11-26 to VPA riya.s@okhdfcbank (UPI Ref No 631812345678). -HDFC Bank'
    expect(alertToPaidOut(alert(MESSAGES, 'HDFCBK', sms))).toEqual({ amount: 40_000, at })
  })

  it('is not fooled by money in, a failure, a request or a refund', () => {
    expect(alertToPaidOut(alert(GPAY, 'Google Pay', 'Riya Sharma paid you ₹400.00'))).toBeNull()
    expect(alertToPaidOut(alert(GPAY, 'Payment failed', 'Your payment of ₹400 to Riya failed'))).toBeNull()
    expect(alertToPaidOut(alert(GPAY, 'Google Pay', 'Payment to Riya of ₹400 is pending'))).toBeNull()
    expect(alertToPaidOut(alert(GPAY, 'Google Pay', 'Sam requested ₹400 from you'))).toBeNull()
    expect(alertToPaidOut(alert(MESSAGES, 'HDFCBK', 'Rs.400.00 debited from A/c XX4821 has been reversed and refunded.'))).toBeNull()
    expect(alertToPaidOut(alert(GPAY, 'Google Pay', 'You paid Riya'))).toBeNull()
  })
})

describe('waiting to hear that a payment went through', () => {
  it('is told once when the same amount leaves the account after setting off', () => {
    const seen = vi.fn()
    expectPayment(40_000, seen, at)
    paymentsSeen([{ amount: 25_000, at: at + 60_000 }])
    expect(seen).not.toHaveBeenCalled()
    paymentsSeen([{ amount: 40_000, at: at + 90_000 }])
    paymentsSeen([{ amount: 40_000, at: at + 95_000 }])
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('ignores a payment from before, or from long after', () => {
    const seen = vi.fn()
    expectPayment(40_000, seen, at)
    paymentsSeen([
      { amount: 40_000, at: at - 60_000 },
      { amount: 40_000, at: at + PAY_WATCH_MS + 1 },
    ])
    expect(seen).not.toHaveBeenCalled()
  })

  it('stops when told to (answered by hand, or the sheet closed)', () => {
    const seen = vi.fn()
    const stop = expectPayment(40_000, seen, at)
    stop()
    paymentsSeen([{ amount: 40_000, at: at + 1_000 }])
    expect(seen).not.toHaveBeenCalled()
  })

  it('one alert settles one waiting payment, not two', () => {
    const first = vi.fn()
    const second = vi.fn()
    expectPayment(40_000, first, at)
    expectPayment(40_000, second, at)
    paymentsSeen([{ amount: 40_000, at: at + 1_000 }])
    expect(first.mock.calls.length + second.mock.calls.length).toBe(1)
  })
})
