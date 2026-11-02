import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { nextStep, summarize } from './rules'
import {
  accountLine,
  appLabel,
  backLine,
  bankLabel,
  checkLabel,
  clockOf,
  dueLine,
  groupStuck,
  homeLines,
  knownParty,
  listTitle,
  orderTail,
  partyName,
  railLabel,
  refundDueText,
  rowAmount,
  sectionOf,
  stageBadge,
  statusLine,
  stuckDate,
  stuckTitle,
} from './view'

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

const TODAY = '2026-11-01'
const line = (s: StuckPayment, today = TODAY) => statusLine(s, nextStep(s, today), today)
const badge = (s: StuckPayment, today = TODAY) => stageBadge(s, nextStep(s, today), today)
const amountOf = (s: StuckPayment, today = TODAY) => rowAmount(s, nextStep(s, today), today)

describe('names and labels', () => {
  it('says who owes it: the name, else the business Settle knows, else how it was paid or what it is', () => {
    expect(partyName(stuck())).toBe('Riya Sharma')
    expect(partyName(stuck({ party: '  ', merchant: 'swiggy' }))).toBe('Swiggy')
    expect(partyName(stuck({ party: null, rail: 'atm' }))).toBe('ATM, no cash came out')
    expect(partyName(stuck({ party: null, rail: null }))).toBe('A failed payment')
    expect(partyName(stuck({ kind: 'refund', party: null }))).toBe('A refund')
    expect(knownParty(stuck({ party: null }))).toBeNull()
  })

  it('titles it by what it is, so a payee never reads as a friend who owes you', () => {
    expect(stuckTitle(stuck({ party: 'Neha' }))).toBe('Failed payment to Neha')
    expect(stuckTitle(stuck({ kind: 'refund', rail: null, party: null, merchant: 'amazon' }))).toBe('Amazon refund')
    // No name: how it was paid, with the account it left when that's known, so two aren't alike.
    expect(stuckTitle(stuck({ party: null, rail: 'atm' }))).toBe('ATM, no cash came out')
    expect(listTitle(stuck({ party: null, rail: 'atm', bank: 'kvb', account: 'XX4410' }))).toBe('ATM, no cash came out · KVB ••4410')
    expect(listTitle(stuck({ party: null, rail: null, bank: null, account: 'XX4410' }))).toBe('A failed payment · ••4410')
    expect(listTitle(stuck({ party: null, rail: 'atm', bank: null, account: null }))).toBe('ATM, no cash came out')
    expect(listTitle(stuck({ party: 'Neha' }))).toBe('Failed payment to Neha')
    expect(stuckTitle(stuck({ kind: 'refund', rail: null, party: null }))).toBe('A refund')
    expect(orderTail(stuck({ orderId: '403-1122334-5566778' }))).toBe('Order …5566778')
    expect(orderTail(stuck({ orderId: 'OD432178651234567100' }))).toBe('Order …4567100')
    // Ten characters or fewer: whole, never cut from the front.
    expect(orderTail(stuck({ orderId: 'BLK-88213' }))).toBe('Order BLK-88213')
    expect(orderTail(stuck({ orderId: '4512345678' }))).toBe('Order 4512345678')
    expect(orderTail(stuck({ orderId: 'A12' }))).toBe('Order A12')
    expect(orderTail(stuck({ kind: 'refund', merchant: 'indigo', orderId: 'K7XQ2M' }))).toBe('PNR K7XQ2M')
    expect(orderTail(stuck())).toBeNull()
  })

  it('says the money came back to you, not from the person you paid — and what’s still to come of a part', () => {
    expect(backLine(stuck({ party: null }), 50_000, 0, 0)).toBe('₹500 is back')
    expect(backLine(stuck(), 50_000, 2, 20_000)).toBe('Your ₹500 to Riya Sharma is back in your account — 2 days late, so your bank owes you ₹200 for the wait')
    expect(backLine(stuck({ kind: 'refund', party: 'Flipkart' }), 50_000, 0, 0)).toBe('₹500 from Flipkart is back')
    expect(backLine(stuck({ party: 'Rohan', amount: 249_900 }), 200_000, 2, 20_000)).toBe('₹2,000 of your ₹2,499 to Rohan is back — ₹499 still to come')
    expect(backLine(stuck({ kind: 'refund', party: 'Flipkart', amount: 129_900 }), 100_000, 0, 0)).toBe('₹1,000 of ₹1,299 from Flipkart is back — ₹299 still to come')
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

  it('gives a check button its row’s amount and name, after its own words', () => {
    expect(checkLabel(stuck({ party: 'Swiggy', amount: 64_900 }), 'Yes, it left')).toBe('Yes, it left — ₹649 to Swiggy')
    expect(checkLabel(stuck({ party: null }), 'No')).toBe('No — ₹500')
  })

  it('dates outside this year carry the year', () => {
    expect(stuckDate('2026-11-03', TODAY)).toBe('3 Nov')
    expect(stuckDate('2024-11-03', TODAY)).toMatch(/2024/)
    expect(clockOf(stuck({ date: '2024-11-02' }), TODAY)[1]?.title).toMatch(/^Due back by .*2024$/)
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

  it('raised or taken higher, still says how late and what’s owed', () => {
    expect(line(stuck({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }))).toBe('Raised · 3 days late · ₹300 owed so far')
    const refund = stuck({ kind: 'refund', rail: null, party: 'Swiggy', merchant: 'swiggy', promisedBy: '2026-10-30', steps: [{ kind: 'merchant', date: '2026-10-31', ref: null }] })
    expect(line(refund)).toBe('Raised with Swiggy · 2 days late · give them till 7 Nov')
    // The bank's 30th day is its last; the Ombudsman opens the day after.
    expect(line(stuck({ steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] }), '2026-10-31')).toBe('Raised · 2 days late · ₹200 owed so far')
    expect(line(stuck({ steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] }), '2026-11-01')).toBe('3 days late · ₹300 owed · take it to the RBI Ombudsman')
    const filed = stuck({
      steps: [
        { kind: 'bank', date: '2026-10-01', ref: null },
        { kind: 'ombudsman', date: '2026-10-31', ref: null },
      ],
    })
    expect(line(filed)).toBe('With the RBI Ombudsman · 3 days late · ₹300 owed so far')
  })

  it('says plainly when the Ombudsman’s time has likely passed', () => {
    const old = stuck({ date: '2026-05-01', steps: [{ kind: 'bank', date: '2026-06-05', ref: null }] })
    expect(line(old)).toBe('183 days late · the time for the RBI Ombudsman has likely passed')
    expect(clockOf(old, TODAY).map((e) => [e.key, e.date])).toEqual([
      ['start', '2026-05-01'],
      ['due', null],
      ['step-bank', '2026-06-05'],
      ['bank-time-up', '2026-07-05'],
      ['ombudsman-by', '2026-10-03'],
      ['late', TODAY],
    ])
    expect(clockOf(old, TODAY)[4]).toMatchObject({ title: 'The time for the RBI Ombudsman has likely passed', state: 'done' })
  })

  it('back, owed for the wait, set aside', () => {
    expect(line(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))).toBe('Back 2 days late · your bank owes you ₹200')
    expect(line(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 10_000 } }))).toBe('Back 2 days late · your bank still owes you ₹100')
    expect(line(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }))).toBe('Back on 31 Oct · +₹200 for the wait')
    expect(line(stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }))).toBe('Back on 29 Oct')
    expect(line(stuck({ dismissedAt: 5 }))).toBe('Set aside')
  })

  it('back in full with the compensation raised: the line is about the compensation', () => {
    const owed = stuck({ amount: 450_000, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }], back: { date: '2026-11-01', amount: 450_000, compensation: 0 } })
    expect(line(owed)).toBe('₹4,500 back · ₹300 for the wait still owed · they have till 30 Nov')
    expect(line(owed, '2026-12-01')).toBe('₹4,500 back · take the ₹300 to the RBI Ombudsman')
    expect(line({ ...owed, steps: [...owed.steps, { kind: 'ombudsman', date: '2026-12-01', ref: null }] }, '2026-12-05')).toBe('₹4,500 back · ₹300 with the RBI Ombudsman')
    expect(amountOf(owed)).toBe(30_000)
    expect(badge(owed)).toEqual({ label: 'Owed for the wait', tone: 'neutral' })
  })

  it('part back: says what’s still to come, and the row shows only that', () => {
    const part = stuck({ kind: 'refund', rail: null, party: null, merchant: 'flipkart', amount: 129_900, date: '2026-10-23', back: { date: '2026-11-02', amount: 100_000, compensation: 0 } })
    expect(line(part, '2026-11-04')).toBe('Part back · ₹299 still to come · 1 day late · raise it with Flipkart')
    expect(amountOf(part, '2026-11-04')).toBe(29_900)
    expect(badge(part, '2026-11-04')).toEqual({ label: 'Part back · 1 day late', tone: 'negative' })
    expect(sectionOf(nextStep(part, '2026-11-04').stage)).toBe('needs')
  })
})

describe('the pill', () => {
  it('keeps the lateness in words once raised, and says “Got it back” when it’s done', () => {
    expect(badge(stuck({ date: '2026-11-01' }))).toEqual({ label: 'Not due yet', tone: 'neutral' })
    expect(badge(stuck())).toEqual({ label: '3 days late', tone: 'negative' })
    expect(badge(stuck({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }))).toEqual({ label: 'Raised · 3 days late', tone: 'warning' })
    expect(badge(stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }))).toEqual({ label: 'Got it back', tone: 'positive' })
  })
})

describe('the list’s parts', () => {
  it('puts each stage in its section', () => {
    expect(['check', 'overdue', 'escalate', 'compensation', 'compensationEscalate'].map((s) => sectionOf(s as never))).toEqual(['needs', 'needs', 'needs', 'needs', 'needs'])
    expect(['raised', 'escalated'].map((s) => sectionOf(s as never))).toEqual(['them', 'them'])
    expect(['compensationRaised', 'compensationEscalated'].map((s) => sectionOf(s as never))).toEqual(['owed', 'owed'])
    expect(sectionOf('waiting')).toBe('onway')
    expect(sectionOf('back')).toBe('back')
    expect(sectionOf('dismissed')).toBe('aside')
  })

  it('groups and orders them, the latest money back first', () => {
    const groups = groupStuck(
      [
        stuck({ id: 'late' }),
        stuck({ id: 'check', confirmed: false }),
        stuck({ id: 'wait', date: '2026-11-01' }),
        stuck({ id: 'raised', steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }),
        stuck({ id: 'owed', steps: [{ kind: 'bank', date: '2026-10-31', ref: null }], back: { date: '2026-11-01', amount: 50_000, compensation: 0 } }),
        stuck({ id: 'back1', back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }),
        stuck({ id: 'back2', back: { date: '2026-10-30', amount: 50_000, compensation: 10_000 } }),
        stuck({ id: 'aside', dismissedAt: 3 }),
      ],
      TODAY,
    )
    expect(groups.needs.map((e) => e.payment.id)).toEqual(['late', 'check'])
    expect(groups.them.map((e) => e.payment.id)).toEqual(['raised'])
    expect(groups.owed.map((e) => e.payment.id)).toEqual(['owed'])
    expect(groups.onway.map((e) => e.payment.id)).toEqual(['wait'])
    expect(groups.back.map((e) => e.payment.id)).toEqual(['back2', 'back1'])
    expect(groups.aside.map((e) => e.payment.id)).toEqual(['aside'])
  })
})

describe('the clock', () => {
  it('tells a late failed payment’s story in date order, today’s lateness last', () => {
    const events = clockOf(stuck({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }), TODAY)
    expect(events.map((e) => [e.title, e.detail, e.date, e.state])).toEqual([
      ['The money left your account', null, '2026-10-28', 'done'],
      ['Due back by 29 Oct', 'UPI to a person: the RBI’s rule says back the next day.', null, 'done'],
      ['Raised with your bank', 'Complaint no. CMP-778', '2026-10-31', 'done'],
      ['3 days late', '₹300 for the wait so far · ₹100 more each day', TODAY, 'late'],
      ['Waiting on your bank till 30 Nov', 'Not sorted by then? Next is the RBI Ombudsman.', null, 'next'],
      ['Last day for the RBI Ombudsman', null, '2027-02-28', 'next'],
    ])
  })

  it('marks the day the bank’s 30 days ran out when it’s time to go higher', () => {
    const events = clockOf(stuck({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] }), TODAY)
    expect(events.map((e) => [e.key, e.date])).toEqual([
      ['start', '2026-09-20'],
      ['due', null],
      ['step-bank', '2026-09-25'],
      ['bank-time-up', '2026-10-25'],
      ['late', TODAY],
      ['ombudsman-by', '2027-01-23'],
    ])
    expect(events.slice(3).map((e) => e.title)).toEqual(['Your bank’s 30 days ran out', '41 days late', 'Last day for the RBI Ombudsman'])
  })

  it('in time, counts the days so far and puts the due day after', () => {
    expect(clockOf(stuck({ rail: null }), '2026-10-30').map((e) => [e.title, e.state])).toEqual([
      ['The money left your account', 'done'],
      ['2 days so far', 'now'],
      ['Due back by 2 Nov', 'next'],
    ])
    expect(clockOf(stuck(), '2026-10-29').map((e) => [e.title, e.state])).toEqual([
      ['The money left your account', 'done'],
      ['Due back by 29 Oct', 'now'],
    ])
  })

  it('all back: the lateness is a fact, and Back is the last, good step — even before a later complaint', () => {
    const back = clockOf(stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }), TODAY)
    expect(back.map((e) => [e.title, e.state])).toEqual([
      ['The money left your account', 'done'],
      ['Due back by 29 Oct', 'done'],
      ['2 days late', 'done'],
      ['Back · ₹500', 'back'],
    ])
    expect(back[2]?.detail).toBe('Worth ₹200 for the wait, under the RBI’s rules')
    expect(back[3]?.detail).toBe('+₹200 for the wait, paid')
    const claimed = clockOf(stuck({ back: { date: '2026-10-20', amount: 50_000, compensation: 0 }, date: '2026-10-10', steps: [{ kind: 'bank', date: '2026-10-25', ref: null }] }), TODAY)
    expect(claimed.map((e) => e.key)).toEqual(['start', 'due', 'late', 'back', 'step-bank', 'wait', 'ombudsman-by'])
    expect(claimed.find((e) => e.key === 'wait')?.title).toBe('Waiting on your bank for the ₹900 till 24 Nov')
  })

  it('part back: how much of it, and the clock keeps running', () => {
    const part = clockOf(stuck({ back: { date: '2026-10-31', amount: 40_000, compensation: 0 } }), TODAY)
    expect(part.map((e) => [e.title, e.state])).toEqual([
      ['The money left your account', 'done'],
      ['Due back by 29 Oct', 'done'],
      ['Part back · ₹400 of ₹500', 'done'],
      ['3 days late', 'late'],
    ])
  })

  it('each part back on its own day — none overwritten — and the lateness told before the last of it', () => {
    // ₹5,000 by UPI to a person on 25 Oct, due 26 Oct: ₹2,000 back on 30 Oct, the other ₹3,000 on 1 Nov (6 days late).
    const parts = [
      { date: '2026-10-30', amount: 200_000, compensation: 0 },
      { date: '2026-11-01', amount: 300_000, compensation: 0 },
    ]
    const vikram = stuck({ amount: 500_000, date: '2026-10-25', back: { date: '2026-11-01', amount: 500_000, compensation: 0, parts } })
    expect(clockOf(vikram, '2026-11-02').map((e) => [e.key, e.title, e.date, e.state])).toEqual([
      ['start', 'The money left your account', '2026-10-25', 'done'],
      ['due', 'Due back by 26 Oct', null, 'done'],
      ['back', 'Part back · ₹2,000 of ₹5,000', '2026-10-30', 'done'],
      ['late', '6 days late', null, 'done'],
      ['back-2', 'Back · the last ₹3,000 of ₹5,000', '2026-11-01', 'back'],
    ])
    // Still open: each part, then today's lateness.
    const open = stuck({ amount: 500_000, date: '2026-10-25', back: { date: '2026-11-01', amount: 300_000, compensation: 0, parts: [parts[0]!, { date: '2026-11-01', amount: 100_000, compensation: 0 }] } })
    expect(clockOf(open, '2026-11-02').map((e) => [e.title, e.date])).toEqual([
      ['The money left your account', '2026-10-25'],
      ['Due back by 26 Oct', null],
      ['Part back · ₹2,000 of ₹5,000', '2026-10-30'],
      ['₹1,000 more back · ₹3,000 of ₹5,000', '2026-11-01'],
      ['7 days late', '2026-11-02'],
    ])
  })

  it('compensation paid after the complaint gets its own day, after it', () => {
    // ₹4,500 on 1 Oct, due 2 Oct, back 6 Oct (4 days late, ₹400); raised with the bank 20 Oct; the ₹400 paid 28 Oct.
    const parts = [
      { date: '2026-10-06', amount: 450_000, compensation: 0 },
      { date: '2026-10-28', amount: 0, compensation: 40_000 },
    ]
    const rohit = stuck({ amount: 450_000, date: '2026-10-01', steps: [{ kind: 'bank', date: '2026-10-20', ref: null }], back: { date: '2026-10-06', amount: 450_000, compensation: 40_000, parts } })
    expect(clockOf(rohit, TODAY).map((e) => [e.key, e.title, e.date])).toEqual([
      ['start', 'The money left your account', '2026-10-01'],
      ['due', 'Due back by 2 Oct', null],
      ['late', '4 days late', null],
      ['back', 'Back · ₹4,500', '2026-10-06'],
      ['step-bank', 'Raised with your bank', '2026-10-20'],
      ['paid', '+₹400 for the wait, paid', '2026-10-28'],
    ])
    // Saved before the parts were kept: the day it was paid wasn't noted, so it's told after the complaint, with no day.
    const old = { ...rohit, back: { date: '2026-10-06', amount: 450_000, compensation: 40_000 } }
    const events = clockOf(old, TODAY)
    expect(events.map((e) => [e.key, e.date])).toEqual([
      ['start', '2026-10-01'],
      ['due', null],
      ['late', null],
      ['back', '2026-10-06'],
      ['step-bank', '2026-10-20'],
      ['paid', null],
    ])
    expect(events.find((e) => e.key === 'back')?.detail).toBeNull()
  })

  it('on the same day, the money back comes before the complaint raised for the wait', () => {
    // ₹14,000 to Neha on 20 Oct, due 21 Oct: back 2 Nov, and the ₹1,200 for the wait raised with the bank the same day.
    const neha = stuck({ party: 'Neha', amount: 1_400_000, date: '2026-10-20', steps: [{ kind: 'bank', date: '2026-11-02', ref: null }], back: { date: '2026-11-02', amount: 1_400_000, compensation: 0 } })
    expect(clockOf(neha, '2026-11-02').map((e) => e.key)).toEqual(['start', 'due', 'late', 'back', 'step-bank', 'wait', 'ombudsman-by'])
  })

  it('a wallet payment says it left the wallet, and that the next day is for one within the same wallet', () => {
    const paytm = stuck({ rail: 'wallet', app: 'paytm', party: 'Zomato', back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })
    const events = clockOf(paytm, TODAY)
    expect(events[0]?.title).toBe('The money left your wallet')
    expect(events[1]?.detail).toBe('Paid within the same wallet: the RBI’s rule says back the next day. If the wallet app paid over UPI or a card, that one’s deadline counts instead — change how you paid.')
    expect(line(paytm)).toBe('Back 2 days late · the wallet company owes you ₹200')
    expect(homeLines(summarize([paytm], TODAY), [paytm], TODAY)?.title).toBe('The wallet company owes you ₹200 for the wait')
  })

  it('set aside: no lateness, and the bank’s reply shows when it came', () => {
    expect(clockOf(stuck({ dismissedAt: 5 }), TODAY).map((e) => e.key)).toEqual(['start', 'due', 'aside'])
    const replied = clockOf(stuck({ steps: [{ kind: 'bank', date: '2026-10-29', ref: null }], repliedAt: '2026-10-30' }), TODAY)
    expect(replied.map((e) => [e.key, e.date])).toEqual([
      ['start', '2026-10-28'],
      ['due', null],
      ['step-bank', '2026-10-29'],
      ['replied', '2026-10-30'],
      ['late', TODAY],
      ['ombudsman-by', '2027-02-26'],
    ])
  })

  it('with the Ombudsman: follow it up there, no made-up deadline', () => {
    const filed = stuck({
      steps: [
        { kind: 'bank', date: '2026-08-14', ref: null },
        { kind: 'ombudsman', date: '2026-09-20', ref: null },
      ],
      date: '2026-08-10',
    })
    const events = clockOf(filed, TODAY)
    expect(events.at(-1)).toMatchObject({ title: 'Follow it up on cms.rbi.org.in', state: 'next' })
    expect(events.some((e) => e.title.startsWith('Waiting on'))).toBe(false)
  })

  it('a refund follows the business’s word — and never claims a promise it didn’t make', () => {
    const refund = stuck({ kind: 'refund', rail: null, party: 'Swiggy', merchant: 'swiggy', date: '2026-10-20' })
    expect(clockOf(refund, TODAY)[0]?.title).toBe('Refund started')
    expect(clockOf(refund, TODAY)[1]?.detail).toBe('Swiggy’s own timeline: 7 working days.')
    expect(clockOf({ ...refund, promisedBy: '2026-10-25' }, TODAY)[1]?.detail).toBe('Swiggy said it would be back by then.')
    const late = (s: StuckPayment) => clockOf(s, '2026-11-20').find((e) => e.key === 'late')?.detail
    expect(late({ ...refund, promisedBy: '2026-10-25' })).toBe('Past the date they gave')
    expect(late(refund)).toBe('Past their own deadline')
    const unknown = { ...refund, party: 'keralagadgets.in', merchant: null }
    expect(clockOf(unknown, TODAY)[1]?.detail).toBe('Refunds usually come within 7 working days — they didn’t say when.')
    expect(late(unknown)).toBe('Past the usual time for a refund')
  })

  it('“What to do now” for a refund says where its date came from', () => {
    const refund = stuck({ kind: 'refund', rail: null, party: null, merchant: 'flipkart', date: '2026-10-23' })
    expect(refundDueText(refund, '2026-11-02')).toBe('Flipkart’s own timeline gives it till 3 Nov. If it’s late, Settle will help you ask for it.')
    expect(refundDueText(refund, '2026-11-05')).toBe('Flipkart’s own timeline (7 working days) ran out on 3 Nov. Ask them for it — the message is ready.')
    const unknown = { ...refund, party: 'keralagadgets.in', merchant: null, date: '2026-10-01' }
    expect(refundDueText(unknown, '2026-11-02')).toBe('Refunds usually come within 7 working days, so it was due by 13 Oct. Ask them for it — the message is ready.')
    expect(refundDueText({ ...refund, party: 'Blinkit', promisedBy: '2026-10-29' }, '2026-11-02')).toBe('Blinkit said it would be back by 29 Oct. Ask them for it — the message is ready.')
  })
})

describe('Home’s line', () => {
  it('only when something is owed, leading with the money', () => {
    expect(homeLines(summarize([], TODAY))).toBeNull()
    expect(homeLines(summarize([stuck({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } })], TODAY))).toBeNull()
    const two = [stuck(), stuck({ id: 's2', amount: 420_000, date: '2026-10-31' })]
    // Several, one needing you: that one by name, and how many more.
    expect(homeLines(summarize(two, TODAY), two, TODAY)).toEqual({ title: 'Failed payment to Riya Sharma · ₹500', line: '3 days late · your bank owes you ₹300 · + 1 more' })
    const calm = [stuck({ date: '2026-11-01' }), stuck({ id: 's2', date: '2026-11-01' })]
    expect(homeLines(summarize(calm, TODAY), calm, TODAY)).toEqual({ title: '₹1,000 stuck with banks and shops', line: 'Nothing to do today' })
  })

  it('names a single payment and opens it', () => {
    const late = [stuck({ party: 'Swiggy', amount: 64_900 })]
    expect(homeLines(summarize(late, TODAY), late, TODAY)).toEqual({ title: 'Failed payment to Swiggy · ₹649', line: '3 days late · your bank owes you ₹300', id: 's1' })
    const owed = [stuck({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })]
    expect(homeLines(summarize(owed, TODAY), owed, TODAY)).toEqual({ title: 'Your bank owes you ₹200 for the wait', line: 'Failed payment to Riya Sharma', id: 's1' })
    const check = [stuck({ confirmed: false })]
    expect(homeLines(summarize(check, TODAY), check, TODAY)).toMatchObject({ title: 'Failed payment to Riya Sharma · ₹500', line: 'Did ₹500 leave your account?' })
    expect(homeLines(summarize(check, TODAY))?.title).toBe('1 failed payment to check')
  })
})
