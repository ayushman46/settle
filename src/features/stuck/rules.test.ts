import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { addWorkingDays, findMerchant } from './merchants'
import { compensationDue, daysLate, dueBy, nextStep, ombudsmanTooLate, sortStuck, stillOwed, summarize } from './rules'

function stuck(over: Partial<StuckPayment> = {}): StuckPayment {
  return {
    id: 's1',
    kind: 'failed',
    rail: 'upi_person',
    party: 'Riya Sharma',
    merchant: null,
    amount: 50_000,
    date: '2026-10-28',
    promisedBy: null,
    ref: '430112345678',
    orderId: null,
    bank: 'hdfc',
    account: 'XX4821',
    app: 'gpay',
    source: 'manual',
    confirmed: true,
    steps: [],
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

describe('the RBI deadlines', () => {
  it('UPI to a person is due back the next day; to a shop, in five', () => {
    expect(dueBy(stuck())).toBe('2026-10-29')
    expect(dueBy(stuck({ rail: 'upi_merchant' }))).toBe('2026-11-02')
    expect(dueBy(stuck({ rail: 'atm' }))).toBe('2026-11-02')
    expect(dueBy(stuck({ rail: 'imps' }))).toBe('2026-10-29')
  })

  it('an unknown way of paying gets the longer deadline, so a claim is never early', () => {
    expect(dueBy(stuck({ rail: null }))).toBe('2026-11-02')
  })

  it('a refund is due when the business promised, or after its usual working days', () => {
    expect(dueBy(stuck({ kind: 'refund', rail: null, promisedBy: '2026-11-05' }))).toBe('2026-11-05')
    // Wed 28 Oct + 5 working days (Thu, Fri, Mon, Tue, Wed) = Wed 4 Nov.
    expect(dueBy(stuck({ kind: 'refund', rail: null, merchant: 'amazon' }))).toBe('2026-11-04')
  })
})

describe('compensation', () => {
  it('is ₹100 for each day past the deadline, up to today', () => {
    expect(daysLate(stuck(), '2026-10-29')).toBe(0)
    expect(compensationDue(stuck(), '2026-10-29')).toBe(0)
    expect(daysLate(stuck(), '2026-11-01')).toBe(3)
    expect(compensationDue(stuck(), '2026-11-01')).toBe(30_000)
  })

  it('stops the day the money came back, and still counts once it has', () => {
    const back = stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })
    expect(compensationDue(back, '2026-11-20')).toBe(20_000)
    expect(stillOwed(back, '2026-11-20')).toEqual({ money: 0, compensation: 20_000 })
  })

  it('is nothing for refunds, unconfirmed failures and set-aside ones', () => {
    expect(compensationDue(stuck({ kind: 'refund', rail: null }), '2026-12-01')).toBe(0)
    expect(compensationDue(stuck({ confirmed: false }), '2026-12-01')).toBe(0)
    expect(compensationDue(stuck({ dismissedAt: 5 }), '2026-12-01')).toBe(0)
  })

  it('what the bank already paid comes off', () => {
    const paid = stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 20_000 } })
    expect(stillOwed(paid, '2026-11-05')).toEqual({ money: 0, compensation: 10_000 })
  })
})

describe('what to do next', () => {
  it('asks first when an app only said the payment failed', () => {
    expect(nextStep(stuck({ confirmed: false }), '2026-10-28')).toEqual({ stage: 'check', step: null, until: null })
  })

  it('waits until the deadline, then says to raise it with the bank', () => {
    expect(nextStep(stuck(), '2026-10-29')).toEqual({ stage: 'waiting', step: null, until: '2026-10-29' })
    expect(nextStep(stuck(), '2026-10-30')).toEqual({ stage: 'overdue', step: 'bank', until: null })
  })

  it('gives the bank 30 days, then the RBI Ombudsman', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: 'C123' }] })
    expect(nextStep(raised, '2026-11-28')).toEqual({ stage: 'raised', step: null, until: '2026-11-29' })
    expect(nextStep(raised, '2026-11-29')).toEqual({ stage: 'escalate', step: 'ombudsman', until: null })
    const filed = stuck({ steps: [...raised.steps, { kind: 'ombudsman', date: '2026-12-01', ref: null }] })
    expect(nextStep(filed, '2026-12-02').stage).toBe('escalated')
  })

  it('back late: the compensation is still to claim', () => {
    const back = stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 0 } })
    expect(nextStep(back, '2026-11-02')).toEqual({ stage: 'compensation', step: 'bank', until: null })
    expect(nextStep(stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }), '2026-11-02').stage).toBe('back')
    expect(nextStep(stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 30_000 } }), '2026-11-02').stage).toBe('back')
  })

  it('a refund goes to the business, then the consumer helpline, then a commission', () => {
    const refund = stuck({ kind: 'refund', rail: null, merchant: 'swiggy', party: 'Swiggy', promisedBy: '2026-11-01' })
    expect(nextStep(refund, '2026-11-02')).toEqual({ stage: 'overdue', step: 'merchant', until: null })
    const asked = { ...refund, steps: [{ kind: 'merchant' as const, date: '2026-11-02', ref: null }] }
    expect(nextStep(asked, '2026-11-05').stage).toBe('raised')
    expect(nextStep(asked, '2026-11-09')).toEqual({ stage: 'escalate', step: 'nch', until: null })
  })

  it('an airline refund goes to AirSewa after the airline', () => {
    const flight = stuck({ kind: 'refund', rail: null, merchant: 'indigo', promisedBy: '2026-11-01', steps: [{ kind: 'merchant', date: '2026-11-02', ref: null }] })
    expect(nextStep(flight, '2026-11-20').step).toBe('airsewa')
  })

  it('the Ombudsman window closes 90 days after the bank’s 30 days (the 2026 scheme)', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: null }] })
    expect(ombudsmanTooLate(raised, '2027-02-27')).toBe(false)
    expect(ombudsmanTooLate(raised, '2027-02-28')).toBe(true)
  })
})

describe('the list', () => {
  it('sums what is stuck, what is owed for the wait and what came back', () => {
    const list = [
      stuck({ id: 'a' }),
      stuck({ id: 'b', amount: 120_000, rail: 'upi_merchant', date: '2026-10-31' }),
      stuck({ id: 'c', back: { date: '2026-10-31', amount: 30_000, compensation: 0 }, amount: 30_000 }),
      stuck({ id: 'd', confirmed: false, amount: 99_900 }),
      stuck({ id: 'e', dismissedAt: 9 }),
    ]
    expect(summarize(list, '2026-11-01')).toEqual({ open: 3, stuck: 170_000, compensation: 50_000, act: 3, recovered: 30_000, recoveredCount: 1 })
  })

  it('puts what needs you first', () => {
    const list = [stuck({ id: 'waiting', date: '2026-11-01' }), stuck({ id: 'late' }), stuck({ id: 'gone', dismissedAt: 1 })]
    expect(sortStuck(list, '2026-11-01').map((s) => s.id)).toEqual(['late', 'waiting', 'gone'])
  })
})

describe('businesses', () => {
  it('finds a business by name in a message', () => {
    expect(findMerchant('Refund of Rs.420 from SWIGGY initiated')?.id).toBe('swiggy')
    expect(findMerchant('Your Air India Express booking refund')?.id).toBe('airindia')
    expect(findMerchant('Payment to Riya Sharma')).toBeNull()
  })

  it('skips weekends when counting working days', () => {
    // Fri 30 Oct + 1 working day = Mon 2 Nov.
    expect(addWorkingDays('2026-10-30', 1)).toBe('2026-11-02')
  })
})
