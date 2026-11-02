/** Auto-settle's watcher also feeds Stuck money: failed payments noticed, money back ticked, each with Undo. */
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stuckStore } from '../../data/stores'
import { addStuck } from '../../data/stuck'
import { renderAt, resetProScreens } from '../pro/testing'
import { AutoSettleWatcher } from './AutoSettleWatcher'
import { alertToCredit } from './alerts'
import { stuckToastMessage } from './useAutoSettle'
import { t } from '../../i18n/runtime'
import type { StuckPayment } from '../../data/stores'

vi.setConfig({ testTimeout: 30_000 })

/** The Android app's bridge with the PaymentAlerts plugin, draining `queue`. */
function fakeAndroid(queue: unknown[]) {
  let drained = 0
  vi.stubGlobal('Capacitor', {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    PluginHeaders: [{ name: 'PaymentAlerts' }],
    nativePromise: async (plugin: string, method: string) => {
      if (plugin !== 'PaymentAlerts') throw new Error(plugin)
      if (method !== 'drain') return {}
      drained += 1
      return { alerts: queue.splice(0) }
    },
    addListener: () => ({ remove: async () => undefined }),
  })
  return { drained: () => drained }
}

const GPAY = 'com.google.android.apps.nbu.paisa.user'
const MESSAGES = 'com.google.android.apps.messaging'
/** Monday 2 Nov 2026, 10 am. */
const AT = new Date(2026, 10, 2, 10, 0).getTime()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AT + 5 * 60_000)
  resetProScreens()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AutoSettleWatcher — Stuck money', () => {
  it('a failed payment the phone saw becomes Stuck money, with Undo', async () => {
    fakeAndroid([{ id: 'g1', app: GPAY, title: 'Payment failed', text: '₹500 to Riya Sharma', postedAt: AT }])
    const { user } = renderAt('/app', <AutoSettleWatcher />)
    expect(await screen.findByText('₹500 to Riya Sharma may be stuck — did it leave your account?')).toBeInTheDocument()
    expect(stuckStore.get()).toEqual([expect.objectContaining({ amount: 50_000, party: 'Riya Sharma', source: 'alert', confirmed: false })])
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([])
  })

  it('money back closes it, and says what the bank owes for the wait', async () => {
    const s = addStuck({
      kind: 'failed',
      rail: 'upi_person',
      party: 'Riya Sharma',
      merchant: null,
      amount: 50_000,
      date: '2026-10-28',
      promisedBy: null,
      ref: '630611112222',
      orderId: null,
      bank: 'icici',
      account: 'XX902',
      app: 'gpay',
      source: 'manual',
      confirmed: true,
    })
    fakeAndroid([{ id: 's1', app: MESSAGES, title: 'ICICIB', text: 'Rs 500.00 reversed to ICICI Bank Acct XX902 on 02-Nov-26 for failed UPI txn 630611112222.', postedAt: AT }])
    const { user } = renderAt('/app', <AutoSettleWatcher />)
    // Due back by 29 Oct (T+1), back on 2 Nov: 4 days late, ₹100 a day.
    expect(await screen.findByText('₹500 from the failed Riya Sharma payment is back — 4 days late: your bank owes you ₹400 for the wait')).toBeInTheDocument()
    expect(stuckStore.get()[0]?.back).toMatchObject({ date: '2026-11-02', amount: 50_000, compensation: 0 })
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([s])
  })

  it('a pending payment that went through before Settle looked is never shown', async () => {
    const android = fakeAndroid([
      { id: 'p1', app: 'com.phonepe.app', title: 'Payment pending', text: '₹500 to Riya Sharma. Your bank is taking longer than usual.', postedAt: AT },
      { id: 'p2', app: 'com.phonepe.app', title: 'Payment successful', text: '₹500 paid to Riya Sharma', postedAt: AT + 40_000 },
    ])
    renderAt('/app', <AutoSettleWatcher />)
    await vi.waitFor(() => expect(android.drained()).toBe(1))
    await Promise.resolve()
    expect(screen.queryByText(/stuck|Stuck money/)).toBeNull()
    expect(stuckStore.get()).toEqual([])
  })

  it('a pending payment waits quietly for its "failed" or "successful": no toast, nothing saved yet', async () => {
    const android = fakeAndroid([{ id: 'p3', app: 'com.phonepe.app', title: 'Payment pending', text: '₹850 to Murugan Tea Stall. Your bank is taking longer than usual.', postedAt: AT }])
    renderAt('/app', <AutoSettleWatcher />)
    await vi.waitFor(() => expect(android.drained()).toBe(1))
    await Promise.resolve()
    expect(screen.queryByText(/stuck|Stuck money/)).toBeNull()
    expect(stuckStore.get()).toEqual([])
  })

  it('a payment waiting for a tap that went through after all is gone — not set aside — with Undo', async () => {
    const waiting = addStuck(
      {
        kind: 'failed',
        rail: 'upi_merchant',
        party: 'Sri Krishna Medicals',
        merchant: null,
        amount: 310_000,
        date: '2026-11-02',
        promisedBy: null,
        ref: null,
        orderId: null,
        bank: null,
        account: null,
        app: 'phonepe',
        source: 'alert',
        confirmed: false,
      },
      AT - 3 * 60 * 60_000,
    )
    fakeAndroid([{ id: 'ok1', app: 'com.phonepe.app', title: 'Payment Successful', text: '₹3,100 paid to Sri Krishna Medicals', postedAt: AT }])
    const { user } = renderAt('/app', <AutoSettleWatcher />)
    expect(await screen.findByText('₹3,100 to Sri Krishna Medicals went through after all — nothing stuck')).toBeInTheDocument()
    expect(stuckStore.get()).toEqual([])
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()).toEqual([waiting])
  })

  it('the bank’s compensation for the wait is noted, not taken as money back', async () => {
    addStuck({
      kind: 'failed',
      rail: 'imps',
      party: 'Sri Sai Mobile Spares',
      merchant: null,
      amount: 1_200_000,
      date: '2026-10-28',
      promisedBy: null,
      ref: '630312345678',
      orderId: null,
      bank: 'icici',
      account: 'XX4821',
      app: null,
      source: 'sms',
      confirmed: true,
      back: { date: '2026-11-02', amount: 1_200_000, compensation: 0 },
    })
    const text = 'Dear Customer, Rs.200.00 has been credited to your ICICI Bank A/c XX4821 on 02-Nov-26 as compensation for delayed reversal of IMPS Ref 630312345678. -ICICI Bank'
    fakeAndroid([{ id: 'c1', app: MESSAGES, title: 'ICICIB', text, postedAt: AT }])
    renderAt('/app', <AutoSettleWatcher />)
    expect(await screen.findByText(/^₹200 paid for the wait on the Sri Sai Mobile Spares payment/)).toBeInTheDocument()
    expect(stuckStore.get()[0]?.back).toMatchObject({ amount: 1_200_000, compensation: 20_000 })
  })

  it('says nothing when nothing was stuck', async () => {
    const android = fakeAndroid([{ id: 'g2', app: GPAY, title: 'Riya Sharma paid you ₹420', text: '', postedAt: AT }])
    renderAt('/app', <AutoSettleWatcher />)
    await vi.waitFor(() => expect(android.drained()).toBe(1))
    await Promise.resolve()
    expect(screen.queryByText(/stuck|Stuck money|is back/)).toBeNull()
    expect(stuckStore.get()).toEqual([])
  })
})

describe('stuckToastMessage', () => {
  const stuck = (over: Partial<StuckPayment>): StuckPayment => ({
    id: 's',
    kind: 'failed',
    rail: null,
    party: null,
    merchant: null,
    amount: 50_000,
    date: '2026-11-02',
    promisedBy: null,
    ref: null,
    orderId: null,
    bank: null,
    account: null,
    app: null,
    source: 'alert',
    confirmed: true,
    steps: [],
    repliedAt: null,
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  })
  const say = (added: StuckPayment[], back: StuckPayment[] = []) => stuckToastMessage({ added, back }, t, '2026-11-02')

  it.each([
    [[stuck({ party: 'Swiggy' })], '₹500 to Swiggy failed but took your money — tracking it in Stuck money'],
    [[stuck({})], 'A ₹500 payment failed but took your money — tracking it in Stuck money'],
    [[stuck({ confirmed: false })], 'A ₹500 payment may be stuck — did it leave your account?'],
    [[stuck({ kind: 'refund', merchant: 'flipkart', amount: 129_900 })], 'Tracking Flipkart’s refund of ₹1,299 till it lands'],
    [[stuck({ kind: 'refund' })], 'Tracking a refund of ₹500 till it lands'],
    [[stuck({}), stuck({ id: 't' })], '2 payments added to Stuck money'],
    // Told late: due back by 25 Oct (T+5), 8 days on, ₹100 a day.
    [[stuck({ party: 'Swiggy', rail: 'upi_merchant', date: '2026-10-20' })], '₹500 to Swiggy failed but took your money — it’s 8 days late: your bank owes you ₹800 for the wait so far'],
    [[stuck({ rail: 'atm' })], 'The ATM didn’t give you ₹500 but took it from your account — tracking it in Stuck money'],
    [[stuck({ rail: 'atm', amount: 500_000, date: '2026-10-20' })], 'The ATM didn’t give you ₹5,000 but took it from your account — it’s 8 days late: your bank owes you ₹800 for the wait so far'],
  ])('added: %#', (added, message) => {
    expect(say(added)).toBe(message)
  })

  it('a payment waiting for a tap that went through after all', () => {
    const cleared = stuck({ party: 'Murugan Tea Stall', confirmed: false, dismissedAt: 1 })
    expect(stuckToastMessage({ added: [], back: [], cleared: [cleared] }, t, '2026-11-02')).toBe('₹500 to Murugan Tea Stall went through after all — nothing stuck')
    expect(stuckToastMessage({ added: [], back: [], cleared: [cleared, { ...cleared, id: 't' }] }, t, '2026-11-02')).toBe('2 payments went through after all — nothing stuck')
  })

  it('compensation paid for the wait: how much came, and what’s still owed', () => {
    // Due back by 29 Oct (T+1), back on 2 Nov: 4 days late, ₹400 owed.
    const late = { rail: 'upi_person' as const, date: '2026-10-28', party: 'Riya Sharma' }
    const paidAll = stuck({ ...late, back: { date: '2026-11-02', amount: 50_000, compensation: 40_000, parts: [{ date: '2026-11-02', amount: 50_000, compensation: 0 }, { date: '2026-11-02', amount: 0, compensation: 40_000 }] } })
    expect(stuckToastMessage({ added: [], back: [], paid: [paidAll] }, t, '2026-11-02')).toBe('₹400 paid for the wait on the Riya Sharma payment — noted in Stuck money')
    const paidPart = stuck({ ...late, back: { date: '2026-11-02', amount: 50_000, compensation: 20_000, parts: [{ date: '2026-11-02', amount: 50_000, compensation: 0 }, { date: '2026-11-02', amount: 0, compensation: 20_000 }] } })
    expect(stuckToastMessage({ added: [], back: [], paid: [paidPart] }, t, '2026-11-02')).toBe('₹200 paid for the wait on the Riya Sharma payment — ₹200 still to come')
    expect(stuckToastMessage({ added: [], back: [], paid: [{ ...paidAll, party: null }] }, t, '2026-11-02')).toBe('₹400 paid for the wait on a failed payment — noted in Stuck money')
  })

  it('money back comes first', () => {
    const back = { date: '2026-11-02', amount: 50_000, compensation: 0 }
    expect(say([stuck({})], [stuck({ party: 'Swiggy', back })])).toBe('₹500 from the failed Swiggy payment is back')
    expect(say([], [stuck({ kind: 'refund', merchant: 'zomato', back })])).toBe('Zomato’s refund of ₹500 is in')
    expect(say([], [stuck({ back }), stuck({ id: 't', back })])).toBe('2 stuck payments are back')
    expect(say([], [])).toBeNull()
  })
})

describe('Auto-settle leaves stuck money alone', () => {
  it.each([
    ['a shop’s refund', { app: 'in.swiggy.android', title: 'Refund credited', text: '₹249 has been credited to your account' }],
    ['a refund still to come, by SMS', { app: MESSAGES, title: 'HDFCBK', text: 'Refund of Rs.249 from SWIGGY will be credited to your A/c XX4821 in 5-7 days' }],
    ['a failed payment', { app: GPAY, title: 'Payment failed', text: '₹500 to Riya Sharma. Money will be credited back to your account' }],
  ])('%s is nobody paying you', (_, alert) => {
    expect(alertToCredit({ id: 'x', postedAt: AT, ...alert })).toBeNull()
  })
})
