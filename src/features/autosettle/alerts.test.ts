import { describe, expect, it } from 'vitest'
import { alertToCredit, mergeAlerts, readRawAlerts, samePayment, type RawAlert } from './alerts'

const AT = new Date(2026, 9, 28, 19, 42).getTime()
const GPAY = 'com.google.android.apps.nbu.paisa.user'
const PHONEPE = 'com.phonepe.app'
const PAYTM = 'net.one97.paytm'
const BHIM = 'in.org.npci.upiapp'
const MESSAGES = 'com.google.android.apps.messaging'

const alert = (app: string, title: string, text: string, at = AT): RawAlert => ({ id: `${app}:${title}:${at}`, app, title, text, postedAt: at })

describe('alertToCredit — UPI apps', () => {
  it.each([
    ['Google Pay', alert(GPAY, 'Riya Sharma paid you ₹420', 'Tap to view details'), 42_000, 'Riya Sharma'],
    ['Google Pay, decimals', alert(GPAY, 'Money received', 'Riya Sharma sent you ₹1,250.50'), 125_050, 'Riya Sharma'],
    ['PhonePe', alert(PHONEPE, 'Received ₹420 from RIYA SHARMA', ''), 42_000, 'RIYA SHARMA'],
    ['Paytm', alert(PAYTM, 'Payment received', 'Rs.420 received from Riya Sharma in your bank a/c XX4821'), 42_000, 'Riya Sharma'],
    ['BHIM', alert(BHIM, 'Credit alert', 'You have received Rs. 420.00 from Sam on BHIM UPI.'), 42_000, 'Sam'],
    ['amount after the name', alert(GPAY, 'Payment received', '₹420 from Asha Iyer')],
  ])('%s: the amount and who from', (_, raw, amount = 42_000, name = 'Asha Iyer') => {
    const credit = alertToCredit(raw)
    expect(credit).toMatchObject({ amount, name, date: '2026-10-28', at: AT })
  })

  it('keeps a UPI ID and a 12-digit reference when the alert shows them', () => {
    const credit = alertToCredit(alert(BHIM, 'Credit alert', 'You have received Rs. 420.00 from riya.s@okhdfcbank. UPI Ref No 629618427311'))
    expect(credit).toMatchObject({ name: null, vpa: 'riya.s@okhdfcbank', utr: '629618427311' })
  })

  it.each([
    ['money you sent', alert(GPAY, 'You paid Riya Sharma ₹420', 'Payment successful')],
    ['money you sent (PhonePe)', alert(PHONEPE, 'Sent ₹420 to Riya Sharma', 'Debited from XX4821')],
    ['a request', alert(GPAY, 'Riya Sharma requested ₹420', 'Pay now')],
    ['cashback', alert(PHONEPE, 'Cashback received', '₹25 cashback credited to your wallet')],
    ['a refund', alert(PAYTM, 'Refund received', 'Rs.199 refunded for your order')],
    ['a reward', alert(GPAY, 'You won ₹10', 'Reward credited to your bank account')],
    ['no amount', alert(GPAY, 'Riya Sharma paid you', 'Tap to view')],
  ])('ignores %s', (_, raw) => {
    expect(alertToCredit(raw)).toBeNull()
  })

  it('a name that isn’t one stays empty', () => {
    expect(alertToCredit(alert(PAYTM, 'Payment received', 'Rs.420 received from your bank account'))?.name).toBeNull()
  })
})

describe('alertToCredit — bank SMS', () => {
  it('reads a bank’s "credited" SMS shown by the messages app', () => {
    const credit = alertToCredit(alert(MESSAGES, 'VM-HDFCBK', 'Rs.420.00 credited to a/c XX4821 on 28-10-26 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref no 629618427311).'))
    expect(credit).toMatchObject({ amount: 42_000, vpa: 'riya.s@okhdfcbank', utr: '629618427311', date: '2026-10-28' })
  })

  it('ignores debits and OTPs', () => {
    expect(alertToCredit(alert(MESSAGES, 'VM-HDFCBK', 'Your a/c XX4821 is debited with Rs 450.00 on 28-10-26 towards UPI/SWIGGY.'))).toBeNull()
    expect(alertToCredit(alert(MESSAGES, 'AD-ICICIB', '123456 is your OTP for a payment of Rs 420. Do not share it.'))).toBeNull()
  })
})

describe('one payment, told twice', () => {
  const gpay = alertToCredit(alert(GPAY, 'Riya Sharma paid you ₹420', ''))
  const sms = alertToCredit(alert(MESSAGES, 'VM-HDFCBK', 'Rs.420.00 credited to a/c XX4821 on 28-10-26 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref no 629618427311).', AT + 60_000))

  it('the UPI app’s alert and the bank’s SMS are merged, keeping both details', () => {
    expect(gpay && sms && samePayment(gpay, sms)).toBe(true)
    const merged = mergeAlerts([sms, gpay].filter((c) => c !== null))
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ name: 'Riya Sharma', vpa: 'riya.s@okhdfcbank', utr: '629618427311' })
  })

  it('two payments of the same amount from different people stay two', () => {
    const sam = alertToCredit(alert(PHONEPE, 'Received ₹420 from Sam D', '', AT + 30_000))
    expect(mergeAlerts([gpay, sam].filter((c) => c !== null))).toHaveLength(2)
  })

  it('the same amount an hour apart is two payments', () => {
    const later = alertToCredit(alert(GPAY, 'Riya Sharma paid you ₹420', '', AT + 60 * 60_000))
    expect(mergeAlerts([gpay, later].filter((c) => c !== null))).toHaveLength(2)
  })
})

describe('readRawAlerts', () => {
  it('keeps well-formed alerts and drops the rest', () => {
    expect(readRawAlerts([{ id: 'a', app: GPAY, title: 't', text: 'x', postedAt: 1 }, { id: 2 }, null, 'x', { id: 'b', app: GPAY, postedAt: 2 }])).toEqual([
      { id: 'a', app: GPAY, title: 't', text: 'x', postedAt: 1 },
      { id: 'b', app: GPAY, title: '', text: '', postedAt: 2 },
    ])
    expect(readRawAlerts(null)).toEqual([])
  })
})
