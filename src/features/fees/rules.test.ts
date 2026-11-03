import { describe, expect, it } from 'vitest'
import { bankLetter, ombudsmanFields, ombudsmanLetter } from './letters'
import { atmCap, findingsOf, MINBAL_SCHEDULES } from './rules'
import { emptyFees, type FeeCharge, type FeeClaim, type FeesState } from './store'
import { claimStage, feesView } from './view'

function charge(c: Partial<FeeCharge> & Pick<FeeCharge, 'id' | 'kind'>): FeeCharge {
  return {
    date: '2026-10-02',
    amount: 300_00,
    gst: 54_00,
    reversed: 0,
    text: '',
    bank: 'hdfc',
    account: 'XX4821',
    balanceBefore: null,
    balanceAfter: null,
    monthAtm: null,
    onFailed: false,
    online: null,
    avg: null,
    idleDays: null,
    monthWithdrawals: null,
    source: 'statement',
    addedAt: 1,
    ...c,
  }
}

const state = (charges: FeeCharge[], more: Partial<FeesState> = {}): FeesState => ({ ...emptyFees(), charges, ...more })
const rules = (s: FeesState) => findingsOf(s).map((f) => [f.rule, f.verdict, f.claim, f.question])

describe('minimum balance', () => {
  it('HDFC’s own slabs: ₹300 at most for an average of ₹6,000 against ₹10,000 — charged ₹600, ₹300 (and its GST) back', () => {
    expect(MINBAL_SCHEDULES.hdfc?.(10000_00, 6000_00)).toBe(300_00)
    expect(MINBAL_SCHEDULES.icici?.(10000_00, 9000_00)).toBe(60_00)
    expect(MINBAL_SCHEDULES.axis?.(12000_00, 0)).toBe(600_00)
    const s = state([charge({ id: 'm', kind: 'minbal', amount: 600_00, gst: 108_00, avg: { period: '2026-09', balance: 6000_00 } })], {
      accounts: { '*': { type: 'regular', mab: 10000_00 } },
      answers: { 'minbalNotice:m': false },
    })
    expect(rules(s)).toEqual([['minbalOverSchedule', 'wrong', 354_00, null]])
  })

  it('a warning SMS less than a month before the charge: the whole charge, no question', () => {
    const s = state([charge({ id: 'm', kind: 'minbal', date: '2026-10-20' })], { notices: [{ date: '2026-10-05', bank: 'hdfc', account: 'XX4821' }] })
    expect(rules(s)).toEqual([['minbalNotice', 'wrong', 354_00, null]])
    expect(findingsOf(s)[0]?.facts).toMatchObject({ notice: '2026-10-05', until: '2026-11-05' })
    // A month and more after the warning: nothing to claim on that ground.
    expect(rules(state([charge({ id: 'm', kind: 'minbal', date: '2026-11-06' })], { notices: [{ date: '2026-10-05', bank: null, account: null }] }))).toEqual([])
  })

  it('two years with nothing done: asks whether the account was dormant', () => {
    expect(rules(state([charge({ id: 'm', kind: 'minbal', idleDays: 800 })], { answers: { 'minbalNotice:m': false } }))).toEqual([['minbalInoperative', 'ask', 354_00, 'inoperative']])
  })

  it('Bank of Baroda’s waiver covers its standard schemes: said so', () => {
    const [f] = findingsOf(state([charge({ id: 'm', kind: 'minbal', bank: 'bob', date: '2025-08-01' })]))
    expect(f).toMatchObject({ rule: 'minbalWaived', facts: { standard: 1 } })
    // Before the waiver: no such claim.
    expect(findingsOf(state([charge({ id: 'm', kind: 'minbal', bank: 'bob', date: '2025-05-01' })])).map((x) => x.rule)).toEqual(['minbalNotice'])
  })

  it('a minor’s account below zero', () => {
    const s = state([charge({ id: 'm', kind: 'minbal', balanceBefore: 100_00, balanceAfter: -254_00 })], { accounts: { '*': { type: 'minor', mab: null } }, answers: { 'minbalNotice:m': false } })
    expect(rules(s)).toEqual([['minorNegative', 'wrong', 254_00, null]])
  })
})

describe('other charges', () => {
  it('UPI: any charge before Aug 2026, nothing firm in the gap, a question after 14 Sep 2026', () => {
    expect(rules(state([charge({ id: 'u', kind: 'upi', date: '2026-03-01', amount: 5_00, gst: 90 })]))).toEqual([['upi', 'wrong', 590, null]])
    expect(rules(state([charge({ id: 'u', kind: 'upi', date: '2026-09-01' })]))).toEqual([])
    expect(rules(state([charge({ id: 'u', kind: 'upi', date: '2026-10-01', amount: 5_00, gst: 90 })]))).toEqual([['upi', 'ask', 590, 'upiSmall']])
  })

  it('a monthly statement charge asks if it was a duplicate you asked for; a duplicate statement is fine', () => {
    expect(rules(state([charge({ id: 's', kind: 'statement', text: 'PASSBOOK ISSUE CHG' })]))).toEqual([['statementFree', 'ask', 354_00, 'duplicateStatement']])
    expect(rules(state([charge({ id: 's', kind: 'statement', text: 'DUPLICATE STMT CHGS' })]))).toEqual([])
  })

  it('reactivating a dormant account, a charge taken twice for one month, and an incoming NEFT', () => {
    expect(rules(state([charge({ id: 'd', kind: 'dormant', text: 'DORMANT A/C REACTIVATION CHG' })]))).toEqual([['activation', 'wrong', 354_00, null]])
    const twice = state([charge({ id: 'a', kind: 'sms', amount: 15_00, gst: 2_70, date: '2026-07-01' }), charge({ id: 'b', kind: 'sms', amount: 15_00, gst: 2_70, date: '2026-07-11' })])
    expect(rules(twice)).toEqual([['duplicate', 'wrong', 17_70, null]])
    expect(rules(state([charge({ id: 'n', kind: 'neft', amount: 2_50, gst: 45, online: false, text: 'NEFT INWARD CHG' })]))).toEqual([['transferInward', 'wrong', 295, null]])
  })

  it('an ATM charge with five withdrawals that month is allowed; a decline asks why', () => {
    expect(rules(state([charge({ id: 'a', kind: 'atm', amount: 23_00, gst: 4_14, monthAtm: 5 })]))).toEqual([])
    expect(rules(state([charge({ id: 'a', kind: 'atmDecline', amount: 20_00, gst: 3_60 })]))).toEqual([['atmDecline', 'ask', 23_60, 'declineReason']])
    expect(atmCap('2025-05-01')).toBe(23_00)
    expect(atmCap('2024-01-01')).toBe(21_00)
    expect(atmCap('2021-06-01')).toBe(20_00)
  })

  it('answering “fine” takes it out; setting a finding aside does too', () => {
    const s = state([charge({ id: 'u', kind: 'upi', date: '2026-10-01' })])
    expect(rules({ ...s, answers: { 'upi:u': false } })).toEqual([])
    expect(rules({ ...s, dismissed: ['upi:u'] })).toEqual([])
  })
})

describe('claims', () => {
  const claim = (more: Partial<FeeClaim> = {}): FeeClaim => ({
    id: 'k',
    bank: 'hdfc',
    account: 'XX4821',
    chargeIds: ['m'],
    amount: 354_00,
    steps: [],
    repliedAt: null,
    back: null,
    dismissedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...more,
  })

  it('the bank’s 30 days, then the RBI Ombudsman for 90 from the later of those and its reply', () => {
    expect(claimStage(claim(), '2026-11-03')).toMatchObject({ stage: 'ready', until: null, last: null })
    const sent = claim({ steps: [{ kind: 'bank', date: '2026-10-01', ref: 'C1' }] })
    expect(claimStage(sent, '2026-10-20')).toMatchObject({ stage: 'raised', until: '2026-10-31', last: '2027-01-29' })
    expect(claimStage(sent, '2026-10-31')).toMatchObject({ stage: 'ombudsman' })
    // An early reply doesn't shorten it; a late one starts the 90 days from it.
    expect(claimStage({ ...sent, repliedAt: '2026-10-10' }, '2026-10-20')).toMatchObject({ stage: 'replied', last: '2027-01-29' })
    expect(claimStage({ ...sent, repliedAt: '2026-11-20' }, '2026-11-21')).toMatchObject({ stage: 'replied', last: '2027-02-18' })
    expect(claimStage(sent, '2027-01-30')).toMatchObject({ stage: 'closed' })
    expect(claimStage({ ...sent, steps: [...sent.steps, { kind: 'ombudsman', date: '2026-11-02', ref: null }] }, '2026-11-03')).toMatchObject({ stage: 'ombudsmanRaised' })
    expect(claimStage({ ...sent, back: { date: '2026-11-01', amount: 354_00 } }, '2026-11-03')).toMatchObject({ stage: 'back' })
  })

  it('what the bank owes counts claims not yet back, and charges in a claim leave “Claim back”', () => {
    const m = charge({ id: 'm', kind: 'minbal', bank: 'sbi', date: '2026-10-01' })
    const u = charge({ id: 'u', kind: 'upi', bank: 'sbi', date: '2026-03-01', amount: 5_00, gst: 90 })
    const s = state([m, u], { claims: [claim({ bank: 'sbi', chargeIds: ['m'], steps: [{ kind: 'bank', date: '2026-10-05', ref: null }] })] })
    const view = feesView(s, '2026-11-03')
    expect(view.groups.map((g) => g.findings.map((f) => f.charge.id))).toEqual([['u']])
    expect(view.owed).toBe(354_00 + 590)
    expect(view.claims[0]?.findings.map((f) => f.rule)).toEqual(['minbalWaived'])
  })

  it('the RBI Ombudsman’s letter and fields carry the bank complaint', () => {
    const m = charge({ id: 'm', kind: 'minbal', bank: 'sbi', date: '2026-10-01' })
    const s = state([m])
    const findings = findingsOf(s)
    const k = claim({ bank: 'sbi', steps: [{ kind: 'bank', date: '2026-10-05', ref: 'SBI-55' }] })
    const letter = ombudsmanLetter(k, findings, { name: 'Ravi Kumar', upiId: null, mobile: '98400 00000' }, '2026-11-10')
    expect(letter.subject).toBe('Complaint against State Bank of India: charges debited from my savings account ending 4821 against RBI directions')
    expect(letter.body).toContain('I complained to State Bank of India on 5 October 2026 (complaint number SBI-55)')
    expect(letter.body).toContain('The bank has not resolved it within 30 days.')
    expect(letter.body).toContain('Reserve Bank – Integrated Ombudsman Scheme, 2026')
    expect(ombudsmanFields(k, findings).map((f) => [f.id, f.value])).toEqual([
      ['entity', 'State Bank of India'],
      ['category', 'Deposit account: charges levied against RBI directions'],
      ['date', '1 October 2026'],
      ['amount', '₹354'],
      ['reference', '5 October 2026, SBI-55'],
      ['account', 'XX4821'],
      ['relief', 'Reversal of ₹354 wrongly charged, with GST'],
    ])
    // A follow-up to the bank says when it was first raised.
    expect(bankLetter(findings, { name: 'Ravi Kumar', upiId: null }, '2026-11-10', '2026-10-05').body).toContain('I first wrote to you about this on 5 October 2026')
  })
})

describe('after the customer panel', () => {
  it('a charge below zero still asks about the warning: no warning, and all of it is claimable', () => {
    const s = state([charge({ id: 'm', kind: 'minbal', amount: 600_00, gst: 108_00, balanceBefore: 69_91, balanceAfter: -638_09 })])
    const [f] = findingsOf(s)
    expect(f).toMatchObject({ rule: 'minbalNegative', claim: 638_09, upgrade: { rule: 'minbalNotice', verdict: 'ask', claim: 708_00 } })
    expect(feesView(s, '2026-11-03').asks.map((a) => a.rule)).toEqual(['minbalNotice'])
    expect(findingsOf({ ...s, answers: { 'minbalNotice:m': true } })[0]).toMatchObject({ rule: 'minbalNotice', claim: 708_00, upgrade: null })
  })

  it('“Not sure” claims it, and the letter asks the bank to show its notice rather than saying there was none', () => {
    const s = state([charge({ id: 'm', kind: 'minbal' })], { answers: { 'minbalNotice:m': 'unsure' } })
    const findings = findingsOf(s)
    expect(findings[0]).toMatchObject({ rule: 'minbalNotice', verdict: 'wrong', facts: { unsure: 1 } })
    const body = bankLetter(findings, { name: 'Asha', upiId: null }, '2026-11-03').body
    expect(body).toContain('I do not recall any notice')
    expect(body).not.toContain('I received no notice')
  })

  it('part of a claim back keeps the rest open; all of it back says so', () => {
    const k = { id: 'k', bank: 'hdfc', account: 'XX4821', chargeIds: ['m'], amount: 668_18, steps: [{ kind: 'bank' as const, date: '2026-10-01', ref: null }], repliedAt: null, back: { date: '2026-11-01', amount: 300_00 }, dismissedAt: null, createdAt: 1, updatedAt: 1 }
    expect(claimStage(k, '2026-11-03', 300_00)).toMatchObject({ stage: 'ombudsman', backSoFar: 300_00, rest: 368_18 })
    expect(claimStage(k, '2026-11-03', 668_18)).toMatchObject({ stage: 'back', rest: 0 })
    // A reversal of its charge counts as money back without being noted.
    const s = state([charge({ id: 'm', kind: 'minbal', reversed: 354_00 })], { claims: [{ ...k, amount: 354_00, back: null }] })
    expect(feesView(s, '2026-11-03').claims[0]).toMatchObject({ stage: 'back', backSoFar: 354_00 })
    expect(feesView(s, '2026-11-03')).toMatchObject({ owed: 0, back: 354_00, found: 1 })
  })

  it('an insufficient-balance decline and an app’s convenience fee aren’t claimed', () => {
    expect(rules(state([charge({ id: 'd', kind: 'atmDecline', text: 'ATM DECLINE CHG INSUFF BAL' })]))).toEqual([])
    expect(rules(state([charge({ id: 'u', kind: 'upi', date: '2026-03-01', bank: null, account: null, source: 'sms' })]))).toEqual([])
  })
})
