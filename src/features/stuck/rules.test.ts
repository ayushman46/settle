import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { addWorkingDays, findMerchant } from './merchants'
import {
  backParts,
  compensationDue,
  daysLate,
  dueBy,
  NACH_REVOKED_RULE,
  needsAction,
  nextStep,
  ombudsmanLastDay,
  ombudsmanTooLate,
  RAIL_RULES,
  refundDueBasis,
  sortStuck,
  stillOwed,
  summarize,
} from './rules'

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
    repliedAt: null,
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

  it('a payment within the same wallet (on-us) is due the next day; a NACH debit after a revoked mandate cites its own row, 7(b)', () => {
    expect(dueBy(stuck({ rail: 'wallet' }))).toBe('2026-10-29')
    expect(RAIL_RULES.wallet.row).toMatch(/on-us.*\(I\.8\.b\)$/)
    expect(NACH_REVOKED_RULE).toEqual({ days: 1, row: 'NACH — account debited despite revocation of the debit mandate with the bank by the customer (I.7.b)' })
  })

  it('a refund is due when the business promised, or after its usual working days', () => {
    expect(dueBy(stuck({ kind: 'refund', rail: null, promisedBy: '2026-11-05' }))).toBe('2026-11-05')
    // Wed 28 Oct + 5 working days (Thu, Fri, Mon, Tue, Wed) = Wed 4 Nov.
    expect(dueBy(stuck({ kind: 'refund', rail: null, merchant: 'amazon' }))).toBe('2026-11-04')
  })

  it('says where a refund’s date comes from, so nothing claims a promise that wasn’t made', () => {
    expect(refundDueBasis(stuck({ kind: 'refund', promisedBy: '2026-11-05', merchant: 'flipkart' }))).toEqual({ kind: 'promised' })
    expect(refundDueBasis(stuck({ kind: 'refund', merchant: 'flipkart' }))).toEqual({ kind: 'merchant', name: 'Flipkart', workingDays: 7 })
    expect(refundDueBasis(stuck({ kind: 'refund' }))).toEqual({ kind: 'default', workingDays: 7 })
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

  it('gives the bank 30 days — the 30th its last — then the RBI Ombudsman, with no made-up deadline after', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: 'C123' }] })
    expect(nextStep(raised, '2026-11-28')).toEqual({ stage: 'raised', step: null, until: '2026-11-29' })
    expect(nextStep(raised, '2026-11-29')).toEqual({ stage: 'raised', step: null, until: '2026-11-29' })
    expect(nextStep(raised, '2026-11-30')).toEqual({ stage: 'escalate', step: 'ombudsman', until: null })
    const filed = stuck({ steps: [...raised.steps, { kind: 'ombudsman', date: '2026-12-01', ref: null }] })
    expect(nextStep(filed, '2027-01-20')).toEqual({ stage: 'escalated', step: null, until: null })
  })

  it('once the bank has replied or turned it down, the Ombudsman opens straight away', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: 'C123' }] })
    expect(nextStep({ ...raised, repliedAt: '2026-11-04' }, '2026-11-05')).toEqual({ stage: 'escalate', step: 'ombudsman', until: null })
    // A reply dated before the complaint isn't its reply.
    expect(nextStep({ ...raised, repliedAt: '2026-10-20' }, '2026-11-05').stage).toBe('raised')
    expect(needsAction('escalate')).toBe(true)
  })

  it('back late: the compensation is still to claim', () => {
    const back = stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 0 } })
    expect(nextStep(back, '2026-11-02')).toEqual({ stage: 'compensation', step: 'bank', until: null })
    expect(nextStep(stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }), '2026-11-02').stage).toBe('back')
    expect(nextStep(stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 30_000 } }), '2026-11-02').stage).toBe('back')
  })

  it('back in full with the compensation raised: its own stages, not the money’s', () => {
    // ₹4,500 by UPI on 28 Oct, raised with the bank on 31 Oct, back on 2 Nov: 4 days late, ₹400 owed.
    const owed = stuck({ amount: 450_000, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }], back: { date: '2026-11-02', amount: 450_000, compensation: 0 } })
    expect(nextStep(owed, '2026-11-02')).toEqual({ stage: 'compensationRaised', step: null, until: '2026-11-30' })
    expect(nextStep(owed, '2026-12-01')).toEqual({ stage: 'compensationEscalate', step: 'ombudsman', until: null })
    expect(nextStep({ ...owed, repliedAt: '2026-11-05' }, '2026-11-06').stage).toBe('compensationEscalate')
    const filed = { ...owed, steps: [...owed.steps, { kind: 'ombudsman' as const, date: '2026-12-02', ref: null }] }
    expect(nextStep(filed, '2026-12-10')).toEqual({ stage: 'compensationEscalated', step: null, until: null })
    expect(needsAction('compensationEscalate')).toBe(true)
    expect(needsAction('compensationRaised')).toBe(false)
  })

  it('a refund goes to the business, then the consumer helpline, then a commission', () => {
    const refund = stuck({ kind: 'refund', rail: null, merchant: 'swiggy', party: 'Swiggy', promisedBy: '2026-11-01' })
    expect(nextStep(refund, '2026-11-02')).toEqual({ stage: 'overdue', step: 'merchant', until: null })
    const asked = { ...refund, steps: [{ kind: 'merchant' as const, date: '2026-11-02', ref: null }] }
    expect(nextStep(asked, '2026-11-05').stage).toBe('raised')
    expect(nextStep(asked, '2026-11-09')).toEqual({ stage: 'raised', step: null, until: '2026-11-09' })
    expect(nextStep(asked, '2026-11-10')).toEqual({ stage: 'escalate', step: 'nch', until: null })
  })

  it('an airline refund goes to AirSewa after the airline', () => {
    const flight = stuck({ kind: 'refund', rail: null, merchant: 'indigo', promisedBy: '2026-11-01', steps: [{ kind: 'merchant', date: '2026-11-02', ref: null }] })
    expect(nextStep(flight, '2026-11-20').step).toBe('airsewa')
  })

  it('the Ombudsman window closes 90 days after the bank’s 30 days (the 2026 scheme)', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: null }] })
    expect(ombudsmanLastDay(raised)).toBe('2027-02-27')
    expect(ombudsmanTooLate(raised, '2027-02-27')).toBe(false)
    expect(ombudsmanTooLate(raised, '2027-02-28')).toBe(true)
  })

  it('counts the Ombudsman’s 90 days from the later of the bank’s 30 days and its reply, and has no last day before a complaint or once it’s filed', () => {
    const raised = stuck({ steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], repliedAt: '2026-11-04' })
    // An early reply never shortens it: still 90 days from the end of the bank's 30 days.
    expect(ombudsmanLastDay(raised)).toBe('2027-02-27')
    expect(ombudsmanLastDay({ ...raised, repliedAt: '2026-10-30' })).toBe('2027-02-27')
    // A late reply reopens it.
    expect(ombudsmanLastDay({ ...raised, repliedAt: '2027-03-01' })).toBe('2027-05-30')
    expect(ombudsmanLastDay(stuck())).toBeNull()
    expect(ombudsmanLastDay({ ...raised, steps: [...raised.steps, { kind: 'ombudsman', date: '2026-11-10', ref: null }] })).toBeNull()
    expect(ombudsmanTooLate(stuck(), '2030-01-01')).toBe(false)
  })
})

describe('part of it back', () => {
  it('keeps the rest owed, still late, on the same ladder', () => {
    const part = stuck({ kind: 'refund', rail: null, merchant: 'indigo', party: 'IndiGo', amount: 845_000, promisedBy: '2026-10-25', back: { date: '2026-10-30', amount: 810_000, compensation: 0 } })
    expect(stillOwed(part, '2026-11-02')).toEqual({ money: 35_000, compensation: 0 })
    expect(nextStep(part, '2026-11-02')).toEqual({ stage: 'overdue', step: 'merchant', until: null })
    expect(daysLate(part, '2026-11-02')).toBe(8)
  })

  it('a failed payment part reversed keeps counting compensation until all of it is back', () => {
    const part = stuck({ back: { date: '2026-10-30', amount: 40_000, compensation: 0 } })
    expect(compensationDue(part, '2026-11-01')).toBe(30_000)
    expect(summarize([part], '2026-11-01')).toMatchObject({ open: 1, stuck: 10_000, recovered: 40_000, recoveredCount: 0 })
  })

  it('a Flipkart refund with ₹1,000 of ₹1,299 back stays open for the ₹299, and is late after 3 Nov', () => {
    const part = stuck({ kind: 'refund', rail: null, party: null, merchant: 'flipkart', amount: 129_900, date: '2026-10-23', back: { date: '2026-11-02', amount: 100_000, compensation: 0 } })
    expect(nextStep(part, '2026-11-03').stage).toBe('waiting')
    expect(nextStep(part, '2026-11-04')).toEqual({ stage: 'overdue', step: 'merchant', until: null })
    expect(summarize([part], '2026-11-04')).toMatchObject({ open: 1, stuck: 29_900, recovered: 100_000, recoveredCount: 0 })
  })

  it('₹11,000 of a ₹12,000 IMPS back is still overdue with the bank, the ₹100 a day still running', () => {
    const part = stuck({ rail: 'imps', amount: 1_200_000, date: '2026-10-29', back: { date: '2026-10-31', amount: 1_100_000, compensation: 0 } })
    expect(nextStep(part, '2026-11-02')).toEqual({ stage: 'overdue', step: 'bank', until: null })
    expect(daysLate(part, '2026-11-02')).toBe(3)
    expect(stillOwed(part, '2026-11-02')).toEqual({ money: 100_000, compensation: 30_000 })
  })

  it('reads each time money came in, in date order — the totals as one part when saved before the parts were kept', () => {
    expect(backParts(stuck())).toEqual([])
    expect(backParts(stuck({ back: { date: '2026-10-30', amount: 40_000, compensation: 0 } }))).toEqual([{ date: '2026-10-30', amount: 40_000, compensation: 0 }])
    expect(backParts(stuck({ back: { date: '2026-10-30', amount: 40_000, compensation: 0, parts: [] } }))).toEqual([{ date: '2026-10-30', amount: 40_000, compensation: 0 }])
    const parts = [
      { date: '2026-11-01', amount: 10_000, compensation: 0 },
      { date: '2026-10-30', amount: 40_000, compensation: 0 },
      { date: '2026-11-05', amount: 0, compensation: 40_000 },
    ]
    expect(backParts(stuck({ back: { date: '2026-11-01', amount: 50_000, compensation: 40_000, parts } })).map((p) => p.date)).toEqual(['2026-10-30', '2026-11-01', '2026-11-05'])
  })

  it('compensation paid never closes a case short of its money', () => {
    const generous = stuck({ amount: 245_000, back: { date: '2026-11-01', amount: 200_000, compensation: 500_000 } })
    expect(nextStep(generous, '2026-11-02').stage).toBe('overdue')
    const raised = stuck({ amount: 249_900, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }], back: { date: '2026-11-01', amount: 200_000, compensation: 0 } })
    expect(nextStep(raised, '2026-11-02').stage).toBe('raised')
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
    expect(summarize(list, '2026-11-01')).toEqual({ open: 3, stuck: 170_000, compensation: 50_000, act: 3, recovered: 30_000, recoveredCompensation: 0, recoveredCount: 1 })
  })

  it('counts the money that came back apart from the compensation, so it’s never more than was stuck', () => {
    // ₹2,450 by UPI to a person on 8 Oct, due 9 Oct: all back on 21 Oct (12 days late), and the ₹1,200 for the wait paid.
    const pooja = stuck({ amount: 245_000, date: '2026-10-08', back: { date: '2026-10-21', amount: 245_000, compensation: 120_000 } })
    expect(summarize([pooja], '2026-11-01')).toMatchObject({ recovered: 245_000, recoveredCompensation: 120_000, recoveredCount: 1, compensation: 0 })
  })

  it('puts what needs you first', () => {
    const list = [stuck({ id: 'waiting', date: '2026-11-01' }), stuck({ id: 'late' }), stuck({ id: 'gone', dismissedAt: 1 })]
    expect(sortStuck(list, '2026-11-01').map((s) => s.id)).toEqual(['late', 'waiting', 'gone'])
  })

  it('at each stage, the most urgent first: the most days late, the soonest last day — not the newest', () => {
    const today = '2026-11-02'
    // Late, nothing raised: 3 days late (Zomato) before 2 (Swiggy), though Swiggy is newer.
    const zomato = stuck({ id: 'zomato', date: '2026-10-29', createdAt: 1 })
    const swiggy = stuck({ id: 'swiggy', date: '2026-10-30', createdAt: 2 })
    // 18 days late before 7.
    const ola = stuck({ id: 'ola', date: '2026-10-14' })
    expect(sortStuck([swiggy, zomato, ola], today).map((s) => s.id)).toEqual(['ola', 'zomato', 'swiggy'])
    // Not due yet: due 4 Nov before due 6 Nov, though paid earlier.
    const croma = stuck({ id: 'croma', kind: 'refund', rail: null, date: '2026-10-25', promisedBy: '2026-11-04' })
    const amazon = stuck({ id: 'amazon', kind: 'refund', rail: null, date: '2026-10-31', promisedBy: '2026-11-06' })
    expect(sortStuck([amazon, croma], today).map((s) => s.id)).toEqual(['croma', 'amazon'])
    // Raised: whoever's time runs out first.
    const early = stuck({ id: 'early', steps: [{ kind: 'bank', date: '2026-10-29', ref: null }] })
    const later = stuck({ id: 'later', date: '2026-10-20', steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] })
    expect(sortStuck([later, early], today).map((s) => s.id)).toEqual(['early', 'later'])
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

  it('skips the national holidays too', () => {
    // Thu 1 Oct + 7 working days, Gandhi Jayanti (Fri 2 Oct) not one of them = Tue 13 Oct.
    expect(addWorkingDays('2026-10-01', 7)).toBe('2026-10-13')
    // Mon 25 Jan 2027 + 1, past Republic Day (Tue 26 Jan) = Wed 27 Jan.
    expect(addWorkingDays('2027-01-25', 1)).toBe('2027-01-27')
  })
})

describe('an airline refund paid by card', () => {
  // IndiGo cancelled on Tue 20 Oct; the DGCA gives 7 days for a card (27 Oct), as does IndiGo's own 5 working days.
  const indigo = (over: Partial<StuckPayment> = {}) => stuck({ kind: 'refund', rail: 'card_online', party: 'IndiGo', merchant: 'indigo', amount: 845_000, date: '2026-10-20', ...over })

  it('caps a later promise at the DGCA’s 7 days, and says so', () => {
    expect(dueBy(indigo({ promisedBy: '2026-11-05' }))).toBe('2026-10-27')
    expect(refundDueBasis(indigo({ promisedBy: '2026-11-05' }))).toEqual({ kind: 'dgca', days: 7 })
  })

  it('keeps the airline’s word when it gave an earlier date, and cites the DGCA when its own timeline ends the same day', () => {
    expect(dueBy(indigo({ promisedBy: '2026-10-24' }))).toBe('2026-10-24')
    expect(refundDueBasis(indigo({ promisedBy: '2026-10-24' }))).toEqual({ kind: 'promised' })
    expect(dueBy(indigo())).toBe('2026-10-27')
    expect(refundDueBasis(indigo()).kind).toBe('dgca')
  })

  it('follows the airline’s word when it wasn’t paid by card, and the rule is for airlines only', () => {
    expect(dueBy(indigo({ rail: null, promisedBy: '2026-11-05' }))).toBe('2026-11-05')
    expect(refundDueBasis(stuck({ kind: 'refund', rail: 'card_online', party: 'Flipkart', merchant: 'flipkart', date: '2026-10-20', promisedBy: '2026-11-05' })).kind).toBe('promised')
  })
})
