import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { nextStep, summarize } from './rules'
import { accountLine, appLabel, backLine, bankLabel, clockOf, dueLine, groupStuck, homeLines, knownParty, partyName, railLabel, sectionOf, statusLine } from './view'

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

const TODAY = '2026-11-01'
const line = (s: StuckPayment, today = TODAY) => statusLine(s, nextStep(s, today), today)

describe('names and labels', () => {
  it('says who owes it: the name, else the business Settle knows, else how it was paid or what it is', () => {
    expect(partyName(stuck())).toBe('Riya Sharma')
    expect(partyName(stuck({ party: '  ', merchant: 'swiggy' }))).toBe('Swiggy')
    expect(partyName(stuck({ party: null, rail: 'atm' }))).toBe('ATM, no cash came out')
    expect(partyName(stuck({ party: null, rail: null }))).toBe('A failed payment')
    expect(partyName(stuck({ kind: 'refund', party: null }))).toBe('A refund')
    expect(knownParty(stuck({ party: null }))).toBeNull()
    expect(backLine(stuck({ party: null }), 50_000, 0, 0)).toBe('₹500 is back')
    expect(backLine(stuck(), 50_000, 2, 20_000)).toBe('₹500 from Riya Sharma is back — 2 days late, so your bank owes you ₹200 for the wait')
  })

  it('names how it was paid, the bank, the app and the account', () => {
    expect(railLabel('upi_person')).toBe('UPI to a person')
    expect(railLabel(null)).toBe('Not sure')
    expect(bankLabel('hdfc')).toBe('HDFC')
    expect(bankLabel('Some Bank')).toBe('Some Bank')
    expect(appLabel('gpay')).toBe('GPay')
    expect(appLabel(null)).toBeNull()
    expect(accountLine(stuck())).toBe('HDFC ••4821')
    expect(accountLine(stuck({ bank: null }))).toBe('••4821')
    expect(accountLine(stuck({ bank: null, account: null }))).toBeNull()
  })
})

describe('one line per payment', () => {
  it('a failed payment to check asks if the money left', () => {
    expect(line(stuck({ confirmed: false }))).toBe('Did ₹500 leave your account?')
  })

  it('in time, says when it’s due back', () => {
    expect(line(stuck({ rail: 'upi_merchant' }), '2026-10-29')).toBe('Due back by 2 Nov')
    expect(line(stuck(), '2026-10-28')).toBe('Due back tomorrow')
    expect(line(stuck(), '2026-10-29')).toBe('Due back today')
    expect(dueLine('2026-11-03', TODAY)).toBe('Due back by 3 Nov')
  })

  it('late, counts the days and what the bank owes for them', () => {
    expect(line(stuck())).toBe('3 days late · your bank owes you ₹300')
    expect(line(stuck({ kind: 'refund', rail: null, party: 'Swiggy', merchant: 'swiggy', promisedBy: '2026-10-30' }))).toBe('2 days late · raise it with Swiggy')
  })

  it('raised, escalated, back and set aside', () => {
    expect(line(stuck({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }))).toBe('Raised with your bank · they have till 30 Nov')
    expect(line(stuck({ steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] }))).toBe('Time to take it to the RBI Ombudsman')
    expect(
      line(
        stuck({
          steps: [
            { kind: 'bank', date: '2026-10-01', ref: null },
            { kind: 'ombudsman', date: '2026-10-31', ref: null },
          ],
        }),
      ),
    ).toBe('With the RBI Ombudsman')
    expect(line(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))).toBe('Back 2 days late · your bank owes you ₹200')
    expect(line(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }))).toBe('Back on 31 Oct · + ₹200 for the wait')
    expect(line(stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }))).toBe('Back on 29 Oct')
    expect(line(stuck({ dismissedAt: 5 }))).toBe('Set aside')
  })
})

describe('the list’s four parts', () => {
  it('puts each stage in its section', () => {
    expect(['check', 'overdue', 'escalate', 'compensation'].map((s) => sectionOf(s as never))).toEqual(['needs', 'needs', 'needs', 'needs'])
    expect(['waiting', 'raised', 'escalated'].map((s) => sectionOf(s as never))).toEqual(['onway', 'onway', 'onway'])
    expect(sectionOf('back')).toBe('back')
    expect(sectionOf('dismissed')).toBe('aside')
  })

  it('groups and orders them, the latest money back first', () => {
    const groups = groupStuck(
      [
        stuck({ id: 'late' }),
        stuck({ id: 'check', confirmed: false }),
        stuck({ id: 'wait', date: '2026-11-01' }),
        stuck({ id: 'back1', back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }),
        stuck({ id: 'back2', back: { date: '2026-10-30', amount: 50_000, compensation: 10_000 } }),
        stuck({ id: 'aside', dismissedAt: 3 }),
      ],
      TODAY,
    )
    expect(groups.needs.map((e) => e.payment.id)).toEqual(['late', 'check'])
    expect(groups.onway.map((e) => e.payment.id)).toEqual(['wait'])
    expect(groups.back.map((e) => e.payment.id)).toEqual(['back2', 'back1'])
    expect(groups.aside.map((e) => e.payment.id)).toEqual(['aside'])
  })
})

describe('the clock', () => {
  it('tells a late failed payment’s story, with the RBI’s rule and the running compensation', () => {
    const events = clockOf(stuck({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }), TODAY)
    expect(events.map((e) => [e.title, e.detail, e.date, e.state])).toEqual([
      ['The money left your account', null, '2026-10-28', 'done'],
      ['Due back by 29 Oct', 'The RBI’s rule for UPI to a person: back the next day.', null, 'done'],
      ['3 days late', '₹300 for the wait so far · ₹100 more each day', null, 'late'],
      ['Raised with your bank', 'Complaint no. CMP-778', '2026-10-31', 'done'],
      ['Waiting on your bank till 30 Nov', null, null, 'next'],
    ])
  })

  it('shows what’s live while it’s in time, and the money back once it is', () => {
    expect(clockOf(stuck({ rail: null }), '2026-10-29').map((e) => [e.title, e.detail, e.state])).toEqual([
      ['The money left your account', null, 'done'],
      ['Due back by 2 Nov', 'The RBI’s longest deadline, 5 days. Say how you paid for the exact one.', 'now'],
    ])
    const back = clockOf(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }), TODAY)
    expect(back.map((e) => e.title)).toEqual(['The money left your account', 'Due back by 29 Oct', '2 days late', 'Back · ₹500'])
    expect(back[2]?.detail).toBe('Worth ₹200 for the wait, under the RBI’s rules')
    expect(back[3]?.detail).toBe('+ ₹200 for the wait, paid')
  })

  it('a refund follows the business’s word', () => {
    const refund = stuck({ kind: 'refund', rail: null, party: 'Swiggy', merchant: 'swiggy', date: '2026-10-20' })
    expect(clockOf(refund, TODAY)[0]?.title).toBe('Refund promised')
    expect(clockOf(refund, TODAY)[1]?.detail).toBe('Swiggy’s own timeline: 7 working days.')
    expect(clockOf({ ...refund, promisedBy: '2026-10-25' }, TODAY)[1]?.detail).toBe('Swiggy said it would be back by then.')
  })
})

describe('Home’s line', () => {
  it('only when something is owed, leading with the money', () => {
    expect(homeLines(summarize([], TODAY))).toBeNull()
    expect(homeLines(summarize([stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } })], TODAY))).toBeNull()
    expect(homeLines(summarize([stuck(), stuck({ id: 's2', amount: 420_000, date: '2026-10-31' })], TODAY))).toEqual({
      title: '₹4,700 stuck with banks and shops',
      line: '1 needs you · + ₹300 for the wait',
    })
    expect(homeLines(summarize([stuck({ date: '2026-11-01' })], TODAY))).toEqual({ title: '₹500 stuck with banks and shops', line: 'Nothing for you to do yet' })
    expect(homeLines(summarize([stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })], TODAY))?.title).toBe('Your bank owes you ₹200 for the wait')
    expect(homeLines(summarize([stuck({ confirmed: false })], TODAY))?.title).toBe('1 failed payment to check')
  })
})
