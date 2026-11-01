import { describe, expect, it } from 'vitest'
import { STUCK_RAILS, STUCK_STEP_KINDS, type StuckPayment } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import {
  airsewaMessage,
  bankComplaint,
  bankName,
  commissionSummary,
  compensationClaim,
  letterDate,
  letterFor,
  merchantMessage,
  nchMessage,
  ombudsmanComplaint,
  ombudsmanFields,
  PLACEHOLDERS,
  rupees,
} from './letters'
import { RAIL_RULES, RBI_CIRCULAR } from './rules'

const TODAY = '2026-11-02'
const ME = { name: 'Ayush Mishra', upiId: 'ayush@okaxis' }

/** ₹500 to Swiggy by UPI on 20 Oct (T+5 → due 25 Oct): 8 days late on 2 Nov. */
function failed(over: Partial<StuckPayment> = {}): StuckPayment {
  return {
    id: 's1',
    kind: 'failed',
    rail: 'upi_merchant',
    party: 'Swiggy',
    merchant: 'swiggy',
    amount: 50_000,
    date: '2026-10-20',
    promisedBy: null,
    ref: '629420113457',
    orderId: null,
    bank: 'hdfc',
    account: 'XX4821',
    app: 'gpay',
    source: 'sms',
    confirmed: true,
    steps: [],
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

/** A ₹1,299 Amazon refund started 20 Oct (5 working days → due 27 Oct). */
function refund(over: Partial<StuckPayment> = {}): StuckPayment {
  return failed({ kind: 'refund', rail: null, party: null, merchant: 'amazon', amount: 129_900, ref: null, orderId: '404-1234567-7654321', bank: null, account: null, app: null, ...over })
}

/** Words a polite, factual letter never uses. */
const THREATS = /\b(?:legal action|sue|lawyer|court|notice|police|or else|failing which)\b/i

describe('letterDate and rupees', () => {
  it('writes dates the same way everywhere: "28 Oct 2026"', () => {
    expect(letterDate('2026-10-28')).toBe('28 Oct 2026')
    expect(letterDate('2026-09-05')).toBe('5 Sep 2026')
    expect(letterDate('2027-01-01')).toBe('1 Jan 2027')
    expect(letterDate('not a date')).toBe('not a date')
  })

  it('writes rupees as the app does, whole amounts without paise', () => {
    expect(rupees(50_000)).toBe(formatMoney(50_000, 'INR', { trimZeros: true }))
    expect(rupees(50_000)).toMatch(/^₹\s?500$/)
    expect(rupees(64_950)).toMatch(/649\.50$/)
    expect(rupees(1_20_00_000)).toBe(formatMoney(1_20_00_000, 'INR', { trimZeros: true }))
  })

  it('names banks in full, and keeps a name it does not know', () => {
    expect(bankName('hdfc')).toBe('HDFC Bank')
    expect(bankName('SBI')).toBe('State Bank of India')
    expect(bankName('Saraswat Bank')).toBe('Saraswat Bank')
    expect(bankName(null)).toBeNull()
    expect(bankName('  ')).toBeNull()
  })
})

describe('bankComplaint', () => {
  it('states the facts, the circular and its row, the deadline, the compensation so far, and asks for both', () => {
    const { subject, body } = bankComplaint(failed(), ME, TODAY)
    expect(subject).toBe(`Reversal and compensation: failed UPI payment of ${rupees(50_000)} on 20 Oct 2026 (UPI ref 629420113457)`)
    expect(body).toContain('The Grievance Redressal Officer,\nHDFC Bank')
    expect(body).toContain('Date: 2 Nov 2026')
    expect(body).toContain(`On 20 Oct 2026, ${rupees(50_000)} was debited from my account for a UPI payment to Swiggy, but the transaction failed`)
    expect(body).toContain('UPI reference (RRN/UTR): 629420113457')
    expect(body).toContain('Account: XX4821')
    expect(body).toContain('Paid using: Google Pay')
    expect(body).toContain(RBI_CIRCULAR)
    expect(body).toContain(RAIL_RULES.upi_merchant.row)
    expect(body).toContain('T + 5 days, that is by 25 Oct 2026')
    expect(body).toContain(`it is 8 days past that date`)
    expect(body).toContain(`the compensation due so far is ${rupees(80_000)} (8 days x ${rupees(10_000)})`)
    expect(body).toContain(`${rupees(10_000)} for each further day until it is reversed`)
    expect(body).toContain(`1. Reverse ${rupees(50_000)} to my account`)
    expect(body).toContain(`2. Credit the compensation due under the circular: ${rupees(80_000)} as of 2 Nov 2026`)
    expect(body).toContain('share its reference number')
    expect(body.endsWith('Yours faithfully,\nAyush Mishra\nUPI ID: ayush@okaxis\nMobile: [your mobile number]')).toBe(true)
    expect(body).not.toMatch(THREATS)
  })

  it('uses T + 1 for a UPI transfer to a person', () => {
    const { body } = bankComplaint(failed({ rail: 'upi_person', party: 'Riya Sharma', merchant: null }), ME, TODAY)
    expect(body).toContain(RAIL_RULES.upi_person.row)
    expect(body).toContain('T + 1 day, that is by 21 Oct 2026')
    expect(body).toContain('a UPI transfer to Riya Sharma')
    expect(body).toContain(`${rupees(1_20_000)} (12 days x`)
  })

  it('takes the longest deadline when how it was paid is not known', () => {
    const { body } = bankComplaint(failed({ rail: null }), ME, TODAY)
    expect(body).toContain('within T + 5 days at the most, that is by 25 Oct 2026')
  })

  it('before the deadline, asks for the reversal and names the date from which ₹100 a day runs', () => {
    const { body } = bankComplaint(failed(), ME, '2026-10-23')
    expect(body).toContain('If it is not reversed by 25 Oct 2026')
    expect(body).toContain(`I request you to reverse ${rupees(50_000)} to my account by 25 Oct 2026`)
    expect(body).not.toContain('compensation due so far')
  })

  it('says the cash was not dispensed at an ATM, and leaves out a UPI ID nobody needs', () => {
    const { subject, body } = bankComplaint(failed({ rail: 'atm', party: null, merchant: null, app: null, ref: null }), { name: 'Ayush', upiId: null }, TODAY)
    expect(subject).toContain('ATM cash not dispensed')
    expect(body).toContain('for an ATM withdrawal, but the cash was not dispensed')
    expect(body).toContain(RAIL_RULES.atm.row)
    expect(body).toContain(`Transaction reference: ${PLACEHOLDERS.reference}`)
    expect(body).not.toContain('UPI ID')
  })

  it('leaves placeholders for what Settle does not know', () => {
    const { body } = bankComplaint(failed({ bank: null, account: null, ref: null, app: null }), { name: '', upiId: null }, TODAY)
    expect(body).toContain(`The Grievance Redressal Officer,\n${PLACEHOLDERS.bank}`)
    expect(body).toContain(`Account: ${PLACEHOLDERS.account}`)
    expect(body).toContain(`UPI reference (RRN/UTR): ${PLACEHOLDERS.reference}`)
    expect(body).toContain(`${PLACEHOLDERS.name}\nUPI ID: ${PLACEHOLDERS.upiId}\nMobile: ${PLACEHOLDERS.mobile}`)
    expect(body).not.toContain('Paid using')
  })

  it('counts the compensation even before the "did it leave?" tap — sending it says the money left', () => {
    expect(bankComplaint(failed({ confirmed: false }), ME, TODAY).body).toContain(`compensation due so far is ${rupees(80_000)}`)
  })

  it('becomes the compensation claim once the money is back, and the business message for a refund', () => {
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    expect(bankComplaint(back, ME, TODAY)).toEqual(compensationClaim(back, ME, TODAY))
    expect(bankComplaint(refund(), ME, TODAY)).toEqual(merchantMessage(refund(), ME, TODAY))
  })
})

describe('compensationClaim', () => {
  it('counts the days it was late up to the day it came back, and asks for the ₹100 a day', () => {
    const { subject, body } = compensationClaim(failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }), ME, TODAY)
    expect(subject).toBe(`Compensation for late reversal: failed UPI payment of ${rupees(50_000)} on 20 Oct 2026 (UPI ref 629420113457)`)
    expect(body).toContain('It was reversed on 30 Oct 2026.')
    expect(body).toContain(`5 days after 25 Oct 2026, the date the circular required, so the compensation due is ${rupees(50_000)} (5 days x ${rupees(10_000)})`)
    expect(body).toContain('I have not received this compensation.')
    expect(body).toContain(`I request you to credit the compensation of ${rupees(50_000)} due under the circular.`)
    expect(body).not.toMatch(THREATS)
  })

  it('takes off what was paid already', () => {
    const { body } = compensationClaim(failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 20_000 } }), ME, TODAY)
    expect(body).toContain(`I have received ${rupees(20_000)} of it so far, so ${rupees(30_000)} is still due.`)
    expect(body).toContain(`credit the compensation of ${rupees(30_000)}`)
  })

  it('asks for the rest of the money when only part came back', () => {
    const { body } = compensationClaim(failed({ back: { date: '2026-10-30', amount: 30_000, compensation: 0 } }), ME, TODAY)
    expect(body).toContain(`Only ${rupees(30_000)} of it was reversed, on 30 Oct 2026; ${rupees(20_000)} is still to come.`)
    expect(body).toContain(`reverse the remaining ${rupees(20_000)} to my account, and credit the compensation of ${rupees(50_000)}`)
  })

  it('asks for nothing it is not owed when it came back in time', () => {
    const { body } = compensationClaim(failed({ back: { date: '2026-10-24', amount: 50_000, compensation: 0 } }), ME, TODAY)
    expect(body).toContain('within the time the circular sets')
    expect(body).not.toContain('credit the compensation')
  })

  it('is the bank complaint while the money is not back', () => {
    expect(compensationClaim(failed(), ME, TODAY)).toEqual(bankComplaint(failed(), ME, TODAY))
  })
})

describe('ombudsmanComplaint', () => {
  const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: 'HDFC-CRM-88213' }] })

  it('names the scheme, the bank complaint and its number, the 30 days, and the relief worked out', () => {
    const { subject, body } = ombudsmanComplaint(raised, ME, '2026-11-28')
    expect(subject).toBe(`Complaint against HDFC Bank: failed UPI payment of ${rupees(50_000)} on 20 Oct 2026, not reversed, compensation not paid`)
    expect(body).toContain('against HDFC Bank under the Reserve Bank - Integrated Ombudsman Scheme, 2026')
    expect(body).toContain(RBI_CIRCULAR)
    expect(body).toContain(RAIL_RULES.upi_merchant.row)
    expect(body).toContain('I complained to the bank on 27 Oct 2026, complaint number HDFC-CRM-88213. More than 30 days have passed since then, and it has not been resolved.')
    expect(body).toContain(
      `Reversal of ${rupees(50_000)}; compensation of ${rupees(3_40_000)} as of 28 Nov 2026 under RBI/2019-20/67 (34 days x ${rupees(10_000)} from 26 Oct 2026); and ${rupees(10_000)} for each further day until the reversal.`,
    )
    expect(body).toContain('Attached: my complaint to the bank and its reply (if any)')
    expect(body).not.toMatch(THREATS)
  })

  it('says the reply did not resolve it when it goes before the 30 days are up', () => {
    expect(ombudsmanComplaint(raised, ME, '2026-11-10').body).toContain("The bank's reply did not resolve it.")
  })

  it('leaves the bank complaint to fill in when it was not noted', () => {
    const { body } = ombudsmanComplaint(failed(), ME, TODAY)
    expect(body).toContain(`I complained to the bank on ${PLACEHOLDERS.complaintDate}, complaint number ${PLACEHOLDERS.complaintNumber}.`)
  })

  it('asks only for the compensation when the money came back late', () => {
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 }, steps: [{ kind: 'bank', date: '2026-11-01', ref: null }] })
    const { subject, body } = ombudsmanComplaint(back, ME, '2026-12-05')
    expect(subject).toContain('compensation for the late reversal not paid')
    expect(body).toContain('The money was reversed only on 30 Oct 2026.')
    expect(body).toContain(`Compensation of ${rupees(50_000)} under RBI/2019-20/67 (5 days x ${rupees(10_000)} from 26 Oct 2026).`)
    expect(body).not.toContain('for each further day')
    expect(body).toContain('showing the debit and the reversal')
  })
})

describe('ombudsmanFields', () => {
  it('gives the values for the RBI form, in its order', () => {
    const fields = ombudsmanFields(failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: 'HDFC-CRM-88213' }] }), ME, '2026-11-28')
    expect(fields.map((f) => f.id)).toEqual(['entity', 'category', 'date', 'amount', 'reference', 'account', 'bankComplaint', 'relief'])
    const value = Object.fromEntries(fields.map((f) => [f.id, f.value]))
    expect(value).toMatchObject({
      entity: 'HDFC Bank',
      category: 'Failed transaction: UPI — account debited but transaction confirmation not received at merchant location',
      date: '20 Oct 2026',
      amount: rupees(50_000),
      reference: '629420113457',
      account: 'XX4821',
      bankComplaint: '27 Oct 2026, complaint number HDFC-CRM-88213',
    })
    expect(value.relief).toContain(`compensation of ${rupees(3_40_000)}`)
    expect(fields.every((f) => f.known)).toBe(true)
  })

  it('marks what is left to fill in', () => {
    const fields = ombudsmanFields(failed({ bank: null, ref: null, account: null, rail: null }), ME, TODAY)
    const unknown = fields.filter((f) => !f.known).map((f) => [f.id, f.value])
    expect(unknown).toEqual([
      ['entity', PLACEHOLDERS.bank],
      ['reference', PLACEHOLDERS.reference],
      ['account', PLACEHOLDERS.account],
      ['bankComplaint', `${PLACEHOLDERS.complaintDate}, complaint number ${PLACEHOLDERS.complaintNumber}`],
    ])
    expect(fields.find((f) => f.id === 'category')?.value).toBe('Failed transaction: account debited, not reversed within the RBI turnaround time')
  })
})

describe('merchantMessage', () => {
  it('asks for the refund with the order, the amount and its own timeline, and cites the e-commerce rules', () => {
    const { subject, body } = merchantMessage(refund(), ME, TODAY)
    expect(subject).toBe(`Refund of ${rupees(1_29_900)} for order 404-1234567-7654321 not received`)
    expect(body.startsWith('Hello Amazon support,')).toBe(true)
    expect(body).toContain('Order / booking number: 404-1234567-7654321')
    expect(body).toContain(`Refund amount: ${rupees(1_29_900)}`)
    expect(body).toContain('Refund started on: 20 Oct 2026')
    expect(body).toContain('Your refund timeline is 5 working days, so it was due by 27 Oct 2026.')
    expect(body).toContain('It is now 6 days past that date')
    expect(body).toContain('reference number (ARN or UTR)')
    expect(body).toContain('Consumer Protection (E-Commerce) Rules, 2020')
    expect(body).not.toMatch(THREATS)
  })

  it('holds the business to the day it promised', () => {
    expect(merchantMessage(refund({ promisedBy: '2026-10-25' }), ME, TODAY).body).toContain('You said it would reach me by 25 Oct 2026. It is now 8 days past that date')
  })

  it('cites the DGCA for an airline, and no rule for a business Settle does not know', () => {
    expect(merchantMessage(refund({ merchant: 'indigo' }), ME, TODAY).body).toContain('CAR Section 3, Series M, Part II')
    const unknown = merchantMessage(refund({ merchant: null, party: 'Sharma Electronics', orderId: null }), ME, TODAY).body
    expect(unknown).toContain('Hello Sharma Electronics support,')
    expect(unknown).toContain('It was due by ')
    expect(unknown).toContain(`Order / booking number: ${PLACEHOLDERS.order}`)
    expect(unknown).not.toContain('E-Commerce')
    expect(unknown).toContain('share a ticket or reference number')
  })

  it('asks a business to confirm a failed payment never arrived', () => {
    const { subject, body } = merchantMessage(failed(), ME, TODAY)
    expect(subject).toBe(`Payment of ${rupees(50_000)} on 20 Oct 2026 failed but was debited`)
    expect(body).toContain('Please confirm whether you received this payment')
  })
})

describe('nchMessage', () => {
  const asked = refund({ steps: [{ kind: 'merchant', date: '2026-10-28', ref: 'TKT-55021' }] })

  it('fits a WhatsApp message: the business, order, amount, dates and the ticket', () => {
    const { subject, body } = nchMessage(asked, ME, '2026-11-05')
    expect(subject).toBe('Refund not received from Amazon')
    expect(body).toBe(
      [
        `Complaint: refund of ${rupees(1_29_900)} from Amazon not received.`,
        'Order: 404-1234567-7654321.',
        'Refund started 20 Oct 2026, due by 27 Oct 2026; not received as of 5 Nov 2026.',
        'I complained to Amazon on 28 Oct 2026 (ticket TKT-55021); not resolved.',
        'Please take this up with Amazon.',
        `Ayush Mishra, ${PLACEHOLDERS.place}`,
      ].join('\n'),
    )
    expect(body.length).toBeLessThan(500)
  })

  it('works without a ticket, and for a failed payment', () => {
    expect(nchMessage(refund(), ME, TODAY).body).toContain('I asked Amazon for it; not resolved.')
    const { body } = nchMessage(failed(), ME, TODAY)
    expect(body).toContain(`a UPI payment of ${rupees(50_000)} to Swiggy on 20 Oct 2026 failed`)
    expect(body).toContain('Reference: 629420113457.')
  })
})

describe('airsewaMessage', () => {
  it('gives the airline, PNR, amount, dates, the airline complaint and the DGCA rule', () => {
    const flight = refund({ merchant: 'indigo', amount: 4_52_000, orderId: 'Q7XK2P', date: '2026-10-15', steps: [{ kind: 'merchant', date: '2026-10-25', ref: 'IGO-1182' }] })
    const { subject, body } = airsewaMessage(flight, ME, TODAY)
    expect(subject).toBe('Refund not received: IndiGo, PNR Q7XK2P')
    expect(body).toContain('Airline: IndiGo')
    expect(body).toContain('PNR / booking reference: Q7XK2P')
    expect(body).toContain('Due by: 22 Oct 2026')
    expect(body).toContain('Complaint to the airline: 25 Oct 2026, reference IGO-1182')
    expect(body).toContain('As of 2 Nov 2026 it is 11 days late.')
    expect(body).toContain('within 7 days when a ticket is paid by card, and within 14 working days when it is booked through an agent or portal')
    expect(body).toContain(`Please have IndiGo credit ${rupees(4_52_000)} to my original payment method.`)
  })

  it('leaves the PNR and the airline complaint to fill in', () => {
    const { body } = airsewaMessage(refund({ merchant: 'akasa', orderId: null }), ME, TODAY)
    expect(body).toContain(`PNR / booking reference: ${PLACEHOLDERS.pnr}`)
    expect(body).toContain(`Complaint to the airline: ${PLACEHOLDERS.complaintDate}, reference ${PLACEHOLDERS.complaintNumber}`)
  })
})

describe('commissionSummary', () => {
  it('sets out who, what, the dates and the steps taken, and the relief', () => {
    const steps = [
      { kind: 'nch' as const, date: '2026-11-05', ref: '5517283' },
      { kind: 'merchant' as const, date: '2026-10-28', ref: 'TKT-55021' },
    ]
    const { subject, body } = commissionSummary(refund({ steps }), ME, '2026-12-08')
    expect(subject).toBe(`Complaint summary: refund of ${rupees(1_29_900)} from Amazon not received`)
    expect(body).toContain(`Complainant: Ayush Mishra, ${PLACEHOLDERS.address}`)
    expect(body).toContain('Against: Amazon')
    expect(body).toContain(
      [
        `- 20 Oct 2026: Amazon started a refund of ${rupees(1_29_900)} for order 404-1234567-7654321`,
        '- 27 Oct 2026: the date it was due by',
        '- 28 Oct 2026: complained to Amazon (ticket TKT-55021)',
        '- 5 Nov 2026: complained to the National Consumer Helpline (docket 5517283)',
        '- 8 Dec 2026: still not received',
      ].join('\n'),
    )
    expect(body).toContain(`Relief sought: Refund of ${rupees(1_29_900)}.`)
    expect(body).not.toMatch(THREATS)
  })

  it('is against the bank for a failed payment', () => {
    const { subject, body } = commissionSummary(failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }] }), ME, TODAY)
    expect(subject).toContain('against HDFC Bank')
    expect(body).toContain('- 27 Oct 2026: complained to HDFC Bank')
    expect(body).toContain(`Relief sought: Reversal of ${rupees(50_000)}`)
  })
})

describe('letterFor', () => {
  it('picks the letter for each rung', () => {
    const s = failed()
    expect(letterFor('bank', s, ME, TODAY)).toEqual(bankComplaint(s, ME, TODAY))
    expect(letterFor('bank', failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }), ME, TODAY).subject).toMatch(/^Compensation for late reversal/)
    expect(letterFor('ombudsman', s, ME, TODAY)).toEqual(ombudsmanComplaint(s, ME, TODAY))
    const r = refund()
    expect(letterFor('merchant', r, ME, TODAY)).toEqual(merchantMessage(r, ME, TODAY))
    expect(letterFor('nch', r, ME, TODAY)).toEqual(nchMessage(r, ME, TODAY))
    expect(letterFor('airsewa', r, ME, TODAY)).toEqual(airsewaMessage(r, ME, TODAY))
    expect(letterFor('commission', r, ME, TODAY)).toEqual(commissionSummary(r, ME, TODAY))
  })

  it('never prints undefined, null or NaN, whatever is missing', () => {
    const bare = { party: null, merchant: null, ref: null, orderId: null, bank: null, account: null, app: null }
    const cases: StuckPayment[] = [
      ...STUCK_RAILS.map((rail) => failed({ rail, ...bare })),
      failed({ rail: null, ...bare }),
      failed({ back: { date: '2026-10-30', amount: 10_000, compensation: 5_000 } }),
      refund({ ...bare }),
      refund({ merchant: 'indigo', promisedBy: '2026-10-22' }),
    ]
    for (const s of cases)
      for (const step of STUCK_STEP_KINDS)
        for (const me of [ME, { name: '', upiId: null }]) {
          const { subject, body } = letterFor(step, s, me, TODAY)
          expect(`${subject}\n${body}`, `${step} ${s.kind} ${s.rail ?? '-'}`).not.toMatch(/undefined|null|NaN|\{|\}/)
        }
  })
})
