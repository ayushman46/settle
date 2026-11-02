import { describe, expect, it } from 'vitest'
import { STUCK_RAILS, STUCK_STEP_KINDS, type StuckPayment } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import { BANK_LABELS } from '../sharein/sms/smsView'
import {
  airsewaMessage,
  bankComplaint,
  bankName,
  blanksIn,
  commissionSummary,
  compensationClaim,
  isRealName,
  letterDate,
  letterFor,
  merchantMessage,
  nchMessage,
  ombudsmanComplaint,
  ombudsmanFields,
  PLACEHOLDERS,
  rupees,
  signsWithUpiId,
  withSubject,
} from './letters'
import { dueBy, RAIL_RULES, RBI_CIRCULAR } from './rules'

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
    repliedAt: null,
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
  it('writes dates the same way everywhere: "28 October 2026"', () => {
    expect(letterDate('2026-10-28')).toBe('28 October 2026')
    expect(letterDate('2026-09-05')).toBe('5 September 2026')
    expect(letterDate('2027-01-01')).toBe('1 January 2027')
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

  it('names every bank the SMS reader knows, never by its bare id', () => {
    for (const id of Object.keys(BANK_LABELS)) expect(bankName(id), id).not.toBe(id)
  })
})

describe('your details, and what is left to fill in', () => {
  const FULL = { ...ME, mobile: '98200 12345', place: 'Pune, Maharashtra', address: '12 MG Road, Pune 411001' }

  it('puts your mobile and address in the letter, so no bracket is left for them', () => {
    const { body } = bankComplaint(failed(), FULL, TODAY)
    expect(body.endsWith('Yours faithfully,\nAyush Mishra\nUPI ID: ayush@okaxis\nMobile: 98200 12345\nAddress: 12 MG Road, Pune 411001')).toBe(true)
    expect(blanksIn(body)).toEqual([])
    expect(nchMessage(refund(), FULL, TODAY).body.endsWith('Ayush Mishra, Pune, Maharashtra')).toBe(true)
    const summary = commissionSummary(refund(), FULL, TODAY).body
    expect(summary).toContain('Complainant: Ayush Mishra, 12 MG Road, Pune 411001\nMobile: 98200 12345')
  })

  it('signs only a UPI payment with the UPI ID', () => {
    const imps = bankComplaint(failed({ rail: 'imps', app: null }), ME, TODAY).body
    expect(imps).not.toContain('UPI ID')
    expect(imps).toContain('Account: XX4821')
    expect(merchantMessage(refund(), ME, TODAY).body).not.toContain('UPI ID')
  })

  it('lists the brackets left, each once', () => {
    expect(blanksIn('Mobile: [your mobile number]\nUPI ID: [your UPI ID]\n[your mobile number]')).toEqual(['[your mobile number]', '[your UPI ID]'])
    expect(blanksIn('nothing to fill')).toEqual([])
  })

  it('starts the copied text with the subject, unless the letter already has it', () => {
    const bank = bankComplaint(failed(), ME, TODAY)
    expect(withSubject(bank)).toBe(bank.body)
    const shop = merchantMessage(refund(), ME, TODAY)
    expect(withSubject(shop)).toBe(`Subject: ${shop.subject}\n\n${shop.body}`)
  })
})

describe('what a failed-payment letter claims', () => {
  it('says only that it failed, not that the other side never got it', () => {
    for (const rail of STUCK_RAILS) {
      const { body } = bankComplaint(failed({ rail }), ME, TODAY)
      expect(body, rail).not.toContain('did not receive')
    }
  })

  it('pays a shop "at" its card machine, and leaves a name in another script out of the sentence', () => {
    const shop = bankComplaint(failed({ rail: 'card_pos', party: 'ઇન્ડિયન ઓઇલ પેટ્રોલ પંપ', merchant: null, app: null }), ME, TODAY).body
    expect(shop).toContain(`${rupees(50_000)} was debited from my account for a card payment (point of sale), but the transaction failed.`)
    expect(shop).toContain('Paid at: ઇન્ડિયન ઓઇલ પેટ્રોલ પંપ')
    expect(bankComplaint(failed({ rail: 'card_pos', party: 'Indian Oil, SG Highway', merchant: null }), ME, TODAY).body).toContain(
      'for a card payment (point of sale) at Indian Oil, SG Highway, but the transaction failed.',
    )
  })

  it('counts exactly 30 days as 30, not "more than 30"', () => {
    const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-03', ref: null }] })
    const { body } = ombudsmanComplaint(raised, ME, TODAY)
    expect(body).toContain('30 days have passed since then, and it has not been resolved.')
    expect(body).not.toContain('More than 30 days')
  })

  it('keeps asking for the rest when only part of it came back', () => {
    const part = failed({ back: { date: '2026-10-30', amount: 30_000, compensation: 0 } })
    const { subject, body } = letterFor('bank', part, ME, TODAY)
    expect(subject).toMatch(/^Reversal and compensation/)
    expect(body).toContain(`Only ${rupees(30_000)} of it was reversed, on 30 October 2026; ${rupees(20_000)} is still to come.`)
    expect(body).toContain(`the remaining ${rupees(20_000)} has not been reversed`)
    expect(body).toContain(`1. Reverse ${rupees(20_000)} to my account`)
    expect(body).toContain(`${rupees(80_000)} as of 2 November 2026`)
  })
})

describe('a NACH debit after the mandate was revoked', () => {
  /** ₹3,000 taken by Cult Fitness on 30 Oct under a mandate revoked on 15 Oct. */
  const nach = failed({ rail: 'nach', party: 'Cult Fitness', merchant: null, amount: 3_00_000, date: '2026-10-30', ref: 'HDFC7021234567890', app: null })
  const revoked = { ...nach, mandateRevoked: true, mandateRevokedOn: '2026-10-15' }

  it('says it was debited although the mandate was revoked, not that a payment failed', () => {
    const { subject, body } = bankComplaint(revoked, ME, TODAY)
    expect(subject).toBe(`Reversal and compensation: unauthorised NACH debit (mandate revoked) of ${rupees(3_00_000)} on 30 October 2026 (ref HDFC7021234567890)`)
    expect(body).toContain(`On 30 October 2026, my account was debited ${rupees(3_00_000)} under a NACH mandate in favour of Cult Fitness, although I had revoked that mandate with the bank on 15 October 2026.`)
    expect(body).toContain('Mandate (UMRN) or debit reference: HDFC7021234567890')
    expect(body).not.toMatch(/transaction failed|did not receive/)
    expect(body).toContain('T + 1 day, that is by 31 October 2026')
  })

  it('leaves the day it was revoked to fill in when it was not given', () => {
    expect(bankComplaint({ ...revoked, mandateRevokedOn: null }, ME, TODAY).body).toContain(`revoked that mandate with the bank on ${PLACEHOLDERS.mandateRevoked}.`)
  })

  it('tells the Ombudsman, the helpline and a commission the same', () => {
    expect(ombudsmanFields(revoked, ME, TODAY).find((f) => f.id === 'category')?.value).toBe('NACH — account debited despite the mandate having been revoked')
    expect(ombudsmanComplaint(revoked, ME, TODAY).body).not.toContain('transaction failed')
    expect(nchMessage(revoked, ME, TODAY).body).toContain('under a NACH mandate in favour of Cult Fitness that I had revoked')
    const summary = commissionSummary(revoked, ME, TODAY).body
    expect(summary).toContain('About: a NACH debit made after I had revoked the mandate')
    expect(summary.indexOf('15 October 2026: I revoked the NACH mandate')).toBeLessThan(summary.indexOf('30 October 2026:'))
  })

  it('stays a failed NACH debit when nothing says the mandate was revoked', () => {
    expect(bankComplaint(nach, ME, TODAY).subject).toMatch(/failed NACH debit/)
  })
})

describe('when the bank has replied', () => {
  it('tells the Ombudsman the day it replied', () => {
    const replied = failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }], repliedAt: '2026-10-31' })
    expect(ombudsmanComplaint(replied, ME, TODAY).body).toContain('I complained to the bank on 27 October 2026. The bank replied on 31 October 2026, and the reply did not resolve it.')
  })
})

describe('a wallet payment', () => {
  /** ₹750 from a Paytm wallet to Airtel prepaid on 28 Oct (T+1, so due 29 Oct). */
  const paytm = failed({ rail: 'wallet', party: 'Airtel prepaid recharge', merchant: null, amount: 75_000, date: '2026-10-28', ref: 'T2610281234', bank: null, account: null, app: 'paytm' })

  it('goes to the company behind the wallet, about the wallet', () => {
    const { body } = bankComplaint(paytm, { ...ME, mobile: '98200 12345' }, TODAY)
    expect(body).toContain('The Grievance Redressal Officer,\nPaytm Payments Bank Ltd')
    expect(body).toContain(`${rupees(75_000)} was debited from my Paytm wallet for a payment to Airtel prepaid recharge, but the transaction failed. It has not been returned to my wallet.`)
    expect(body).toContain('Wallet transaction ID: T2610281234')
    expect(body).toContain('Wallet: Paytm')
    expect(body).toContain('Registered mobile: 98200 12345')
    expect(body).toContain(`1. Reverse ${rupees(75_000)} to my wallet`)
    expect(body).toContain('the wallet issuer is to pay compensation')
    expect(body).not.toContain('Account:')
    expect(body).not.toContain(PLACEHOLDERS.bank)
    expect(body).not.toContain('UPI ID')
  })

  it('names the issuer to the RBI Ombudsman, with the registered mobile for the account', () => {
    const { subject, body } = ombudsmanComplaint(paytm, ME, TODAY)
    expect(subject).toMatch(/^Complaint against Paytm Payments Bank Ltd: failed wallet payment/)
    expect(body).toContain('I complained to the wallet company on')
    expect(body).toContain('the wallet statement showing the debit')
    const value = Object.fromEntries(ombudsmanFields(paytm, { ...ME, mobile: '98200 12345' }, TODAY).map((f) => [f.id, f.value]))
    expect(value).toMatchObject({ entity: 'Paytm Payments Bank Ltd', account: '98200 12345' })
  })

  it('knows the other wallets, and leaves an unknown one to fill in', () => {
    expect(bankComplaint({ ...paytm, app: 'com.mobikwik_new' }, ME, TODAY).body).toContain('One MobiKwik Systems Ltd')
    expect(bankComplaint({ ...paytm, app: 'amazonpay' }, ME, TODAY).body).toContain('Amazon Pay (India) Pvt Ltd')
    expect(bankComplaint({ ...paytm, app: 'PhonePe' }, ME, TODAY).body).toContain('PhonePe Pvt Ltd')
    const unknown = bankComplaint({ ...paytm, app: null }, ME, TODAY).body
    expect(unknown).toContain(`The Grievance Redressal Officer,\n${PLACEHOLDERS.wallet}`)
    expect(unknown).toContain('debited from my wallet for a payment')
  })
})

describe('bankComplaint', () => {
  it('states the facts, the circular and its row, the deadline, the compensation so far, and asks for both', () => {
    const { subject, body } = bankComplaint(failed(), ME, TODAY)
    expect(subject).toBe(`Reversal and compensation: failed UPI payment of ${rupees(50_000)} on 20 October 2026 (UPI ref 629420113457)`)
    expect(body).toContain('The Grievance Redressal Officer,\nHDFC Bank')
    expect(body).toContain('Date: 2 November 2026')
    expect(body).toContain(`On 20 October 2026, ${rupees(50_000)} was debited from my account for a UPI payment to Swiggy, but the transaction failed`)
    expect(body).toContain('UPI reference (RRN/UTR): 629420113457')
    expect(body).toContain('Account: XX4821')
    expect(body).toContain('Paid using: Google Pay')
    expect(body).toContain(RBI_CIRCULAR)
    expect(body).toContain(RAIL_RULES.upi_merchant.row)
    expect(body).toContain('T + 5 days, that is by 25 October 2026')
    expect(body).toContain(`it is 8 days past that date`)
    expect(body).toContain(`the compensation due so far is ${rupees(80_000)} (8 days × ${rupees(10_000)})`)
    expect(body).toContain(`${rupees(10_000)} for each further day until it is reversed`)
    expect(body).toContain(`1. Reverse ${rupees(50_000)} to my account`)
    expect(body).toContain(`2. Credit the compensation due under the circular: ${rupees(80_000)} as of 2 November 2026`)
    expect(body).toContain('share its reference number')
    expect(body.endsWith('Yours faithfully,\nAyush Mishra\nUPI ID: ayush@okaxis\nMobile: [your mobile number]')).toBe(true)
    expect(body).not.toMatch(THREATS)
  })

  it('uses T + 1 for a UPI transfer to a person', () => {
    const { body } = bankComplaint(failed({ rail: 'upi_person', party: 'Riya Sharma', merchant: null }), ME, TODAY)
    expect(body).toContain(RAIL_RULES.upi_person.row)
    expect(body).toContain('T + 1 day, that is by 21 October 2026')
    expect(body).toContain('a UPI transfer to Riya Sharma')
    expect(body).toContain(`${rupees(1_20_000)} (12 days ×`)
  })

  it('takes the longest deadline when how it was paid is not known', () => {
    const { body } = bankComplaint(failed({ rail: null }), ME, TODAY)
    expect(body).toContain('within T + 5 days at the most, that is by 25 October 2026')
  })

  it('before the deadline, says it has to be reversed by then, and states the ₹100 a day once', () => {
    const { body } = bankComplaint(failed(), ME, '2026-10-23')
    expect(body).toContain('It has to be reversed by T + 5 days, that is by 25 October 2026')
    expect(body).not.toContain('It had to be')
    expect(body).toContain(`I request you to reverse ${rupees(50_000)} to my account by 25 October 2026.`)
    expect(body).not.toContain('compensation due so far')
    expect(body.split(`${rupees(10_000)} for each day`)).toHaveLength(2)
    expect(body).not.toContain('If it is reversed later')
    // On the day itself it still "has to be"; the day after, it "had to be".
    expect(bankComplaint(failed(), ME, '2026-10-25').body).toContain('It has to be reversed')
    expect(bankComplaint(failed(), ME, '2026-10-26').body).toContain('It had to be reversed')
  })

  it('says the cash was not dispensed at an ATM, and leaves out a UPI ID nobody needs', () => {
    const { subject, body } = bankComplaint(failed({ rail: 'atm', party: null, merchant: null, app: null, ref: null }), { name: 'Ayush', upiId: null }, TODAY)
    expect(subject).toContain('undispensed ATM withdrawal of')
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
    expect(body).toContain(`${PLACEHOLDERS.name}\nMobile: ${PLACEHOLDERS.mobile}`)
    expect(body).not.toContain('UPI ID')
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
    expect(subject).toBe(`Compensation for late reversal: failed UPI payment of ${rupees(50_000)} on 20 October 2026 (UPI ref 629420113457)`)
    expect(body).toContain('It was reversed on 30 October 2026.')
    expect(body).toContain(`5 days after 25 October 2026, the date the circular required, so the compensation due is ${rupees(50_000)} (5 days × ${rupees(10_000)})`)
    expect(body).toContain('I have not received this compensation.')
    expect(body).toContain(`I request you to credit the compensation of ${rupees(50_000)} due under the circular.`)
    expect(body).not.toMatch(THREATS)
  })

  it('takes off what was paid already', () => {
    const { body } = compensationClaim(failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 20_000 } }), ME, TODAY)
    expect(body).toContain(`I have received ${rupees(20_000)} of it so far, so ${rupees(30_000)} is still due.`)
    expect(body).toContain(`credit the compensation of ${rupees(30_000)}`)
  })

  it('asks for the rest of the money when only part came back, with the days still running', () => {
    const { body } = compensationClaim(failed({ back: { date: '2026-10-30', amount: 30_000, compensation: 0 } }), ME, TODAY)
    expect(body).toContain(`Only ${rupees(30_000)} of it was reversed, on 30 October 2026; ${rupees(20_000)} is still to come.`)
    expect(body).toContain('it is 8 days past 25 October 2026, the date the circular required, and the rest has not been reversed')
    expect(body).not.toContain('The reversal came')
    expect(body).toContain(`reverse the remaining ${rupees(20_000)} to my account, and credit the compensation of ${rupees(80_000)}`)
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
    expect(subject).toBe(`Complaint against HDFC Bank: failed UPI payment of ${rupees(50_000)} on 20 October 2026, not reversed, compensation not paid`)
    expect(body).toContain('against HDFC Bank under the Reserve Bank - Integrated Ombudsman Scheme, 2026')
    expect(body).toContain(RBI_CIRCULAR)
    expect(body).toContain(RAIL_RULES.upi_merchant.row)
    expect(body).toContain('I complained to the bank on 27 October 2026, complaint number HDFC-CRM-88213. More than 30 days have passed since then, and it has not been resolved.')
    expect(body).toContain(
      `Reversal of ${rupees(50_000)}; compensation of ${rupees(3_40_000)} as of 28 November 2026 under RBI/2019-20/67 (34 days × ${rupees(10_000)}, counted from 26 October 2026, the day after the deadline); and ${rupees(10_000)} for each further day until the reversal.`,
    )
    // More than 30 days and no reply noted: nothing to attach but the complaint.
    expect(body).toContain('Attached: my complaint to the bank, and the account statement showing the debit.')
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
    expect(body).toContain('The money was reversed only on 30 October 2026.')
    expect(body).toContain(`Compensation of ${rupees(50_000)} under RBI/2019-20/67 (5 days × ${rupees(10_000)}, counted from 26 October 2026, the day after the deadline).`)
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
      date: '20 October 2026',
      amount: rupees(50_000),
      reference: '629420113457',
      account: 'XX4821',
      bankComplaint: '27 October 2026, complaint number HDFC-CRM-88213',
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
    expect(body).toContain('Refund started on: 20 October 2026')
    expect(body).toContain('Your refund timeline is 5 working days, so it was due by 27 October 2026.')
    expect(body).toContain('It is now 6 days past that date')
    expect(body).toContain('reference number (ARN or UTR)')
    expect(body).toContain('Consumer Protection (E-Commerce) Rules, 2020')
    expect(body).not.toMatch(THREATS)
  })

  it('holds the business to the day it promised', () => {
    expect(merchantMessage(refund({ promisedBy: '2026-10-25' }), ME, TODAY).body).toContain('You said it would reach me by 25 October 2026. It is now 8 days past that date')
  })

  it('cites the DGCA for an airline, and no rule for a business Settle does not know', () => {
    expect(merchantMessage(refund({ merchant: 'indigo' }), ME, TODAY).body).toContain('CAR Section 3, Series M, Part II')
    const unknown = merchantMessage(refund({ merchant: null, party: 'Sharma Electronics', orderId: null }), ME, TODAY).body
    expect(unknown).toContain('Hello Sharma Electronics support,')
    expect(unknown).toContain('Refunds usually arrive within 7 working days, so I expected it by ')
    expect(unknown).not.toContain('You said')
    expect(unknown).toContain(`Order / booking number: ${PLACEHOLDERS.order}`)
    expect(unknown).not.toContain('E-Commerce')
    expect(unknown).toContain('share a ticket or reference number')
  })

  it('asks a business to confirm a failed payment never arrived', () => {
    const { subject, body } = merchantMessage(failed(), ME, TODAY)
    expect(subject).toBe(`Payment of ${rupees(50_000)} on 20 October 2026 failed but was debited`)
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
        "Refund started 20 October 2026; due by 27 October 2026 under Amazon's own refund timeline (5 working days); not received as of 5 November 2026.",
        'Complained so far: 28 October 2026: complained to Amazon (ticket TKT-55021). Not resolved.',
        'Sector: E-commerce.',
        'Please take this up with Amazon.',
        `Ayush Mishra, ${PLACEHOLDERS.place}`,
      ].join('\n'),
    )
    expect(body.length).toBeLessThan(500)
  })

  it('works without a ticket, and for a failed payment', () => {
    // Nothing noted with Amazon: no request is claimed, and the day is left to fill in.
    const none = nchMessage(refund(), ME, TODAY).body
    expect(none).toContain(`I contacted Amazon about it on ${PLACEHOLDERS.contacted}; it has not been resolved.`)
    expect(none).not.toContain('I asked')
    const { body } = nchMessage(failed(), ME, TODAY)
    expect(body).toContain(`a UPI payment of ${rupees(50_000)} to Swiggy on 20 October 2026 failed`)
    expect(body).toContain('Reference: 629420113457.')
  })
})

describe('refunds, told straight', () => {
  it('calls a flight or train booking a PNR, once', () => {
    const flight = refund({ merchant: 'indigo', orderId: 'PNR X7K2LQ' })
    expect(merchantMessage(flight, ME, TODAY).subject).toBe(`Refund of ${rupees(1_29_900)} for PNR X7K2LQ not received`)
    expect(merchantMessage(flight, ME, TODAY).body).toContain('PNR / booking reference: X7K2LQ')
    expect(airsewaMessage(flight, ME, TODAY).subject).toBe('Refund not received: IndiGo, PNR X7K2LQ')
    expect(nchMessage(refund({ merchant: 'irctc', orderId: '4521367890' }), ME, TODAY).body).toContain('PNR: 4521367890.')
  })

  it('says a refund was usually due, not promised, when the business gave no date', () => {
    const shop = refund({ merchant: null, party: 'keralagadgets.in', date: '2026-10-01' })
    const nch = nchMessage(shop, ME, TODAY).body
    const due = letterDate(dueBy(shop))
    expect(nch).toContain(`refunds usually take up to 7 working days (by ${due})`)
    expect(nch).not.toContain('said')
    expect(commissionSummary(shop, ME, TODAY).body).toContain(`${due}: the end of the usual time for a refund (7 working days)`)
    expect(nchMessage(refund({ promisedBy: '2026-10-25' }), ME, TODAY).body).toContain('Amazon said it would be back by 25 October 2026')
  })

  it('asks for the rest of a refund that came only in part', () => {
    const part = refund({ back: { date: '2026-10-30', amount: 1_00_000, compensation: 0 } })
    const { subject, body } = merchantMessage(part, ME, TODAY)
    expect(subject).toBe(`Refund of ${rupees(1_29_900)} for order 404-1234567-7654321: ${rupees(29_900)} not received`)
    expect(body).toContain(`only partly reached me: ${rupees(1_00_000)} came on 30 October 2026, and ${rupees(29_900)} is still to come.`)
    expect(body).toContain(`Please credit the remaining ${rupees(29_900)}`)
    const nch = nchMessage(part, ME, TODAY).body
    expect(nch).toContain(`Complaint: refund of ${rupees(1_29_900)} from Amazon only partly received.`)
    expect(nch).toContain(`${rupees(1_00_000)} received on 30 October 2026; ${rupees(29_900)} still not received as of 2 November 2026.`)
    expect(nch).not.toContain('; not received as of')
    expect(commissionSummary(part, ME, TODAY).body).toContain(`Relief sought: Refund of ${rupees(29_900)}, with interest from 27 October 2026;`)
  })

  it('tells the helpline every complaint so far, in date order, with the refund reference', () => {
    const flight = refund({
      merchant: 'indigo',
      orderId: 'X7Y2ZQ',
      ref: 'ARN74512345',
      steps: [
        { kind: 'airsewa', date: '2026-10-01', ref: 'MOCA/E/2026/1102334' },
        { kind: 'merchant', date: '2026-09-20', ref: 'IGO-55821934' },
      ],
    })
    const { body } = nchMessage(flight, ME, TODAY)
    expect(body).toContain(
      'Complained so far: 20 September 2026: complained to IndiGo (ticket IGO-55821934); 1 October 2026: filed a grievance on AirSewa (reference MOCA/E/2026/1102334). Not resolved.',
    )
    expect(body).toContain('Refund reference (ARN/UTR): ARN74512345.')
    expect(body).toContain('Sector: Airlines.')
    expect(body.length).toBeLessThan(700)
  })

  it('lists the commission timeline in date order, a complaint before the due date included', () => {
    const early = refund({ date: '2026-08-04', steps: [{ kind: 'merchant', date: '2026-08-10', ref: null }] })
    const { body } = commissionSummary(early, ME, TODAY)
    expect(body.indexOf('10 August 2026: complained to Amazon')).toBeLessThan(body.indexOf('11 August 2026: the date it was due by'))
  })
})

describe('airsewaMessage', () => {
  it('gives the airline, PNR, amount, dates, the airline complaint and the DGCA rule', () => {
    const flight = refund({ merchant: 'indigo', amount: 4_52_000, orderId: 'Q7XK2P', date: '2026-10-15', steps: [{ kind: 'merchant', date: '2026-10-25', ref: 'IGO-1182' }] })
    const { subject, body } = airsewaMessage(flight, ME, TODAY)
    expect(subject).toBe('Refund not received: IndiGo, PNR Q7XK2P')
    expect(body).toContain('Airline: IndiGo')
    expect(body).toContain('PNR / booking reference: Q7XK2P')
    expect(body).toContain('Due by: 22 October 2026')
    expect(body).toContain('Complaint to the airline: 25 October 2026, reference IGO-1182')
    expect(body).toContain('As of 2 November 2026 it is 11 days late.')
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
    // No address given: no bracket for it (the filing form asks for it anyway).
    expect(body).toContain('Complainant: Ayush Mishra\n')
    expect(blanksIn(body)).toEqual([])
    expect(body).toContain('Against: Amazon')
    expect(body).toContain(
      [
        `- 20 October 2026: Amazon started a refund of ${rupees(1_29_900)} for order 404-1234567-7654321`,
        "- 27 October 2026: the date it was due by, under Amazon's own refund timeline",
        '- 28 October 2026: complained to Amazon (ticket TKT-55021)',
        '- 5 November 2026: complained to the National Consumer Helpline (docket 5517283)',
        '- 8 December 2026: still not received',
      ].join('\n'),
    )
    expect(body).toContain(
      `Relief sought: Refund of ${rupees(1_29_900)}, with interest from 27 October 2026; compensation for the deficiency in service; and the costs of this complaint.`,
    )
    expect(body).not.toMatch(THREATS)
  })

  it('is against the bank for a failed payment', () => {
    const { subject, body } = commissionSummary(failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }] }), ME, TODAY)
    expect(subject).toContain('against HDFC Bank')
    expect(body).toContain('- 27 October 2026: complained to HDFC Bank')
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
          // One way of writing a date: "2 November 2026", never "2 Nov" or "Sept".
          expect(`${subject}\n${body}`, `${step} ${s.kind} ${s.rail ?? '-'}`).not.toMatch(/\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/)
          expect(body, `${step} ${s.kind} ${s.rail ?? '-'}`).not.toMatch(THREATS)
        }
  })
})

describe('signed by you, with no blank it can do without', () => {
  const NO_UPI = { name: 'Priya', upiId: null, mobile: '98765 43210' }

  it('leaves the UPI ID line out when the profile has none, on every letter about a UPI payment', () => {
    const late = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] })
    for (const { body } of [bankComplaint(failed(), NO_UPI, TODAY), compensationClaim(late, NO_UPI, TODAY), ombudsmanComplaint(raised, NO_UPI, TODAY), merchantMessage(failed(), NO_UPI, TODAY)]) {
      expect(body).not.toContain('UPI ID')
      expect(blanksIn(body)).toEqual([])
    }
    expect(bankComplaint(failed(), NO_UPI, TODAY).body.endsWith('Yours faithfully,\nPriya\nMobile: 98765 43210')).toBe(true)
  })

  it('never signs as "You" or "Me": a skipped name is a blank to fill in', () => {
    for (const name of ['You', 'you ', 'Me', ' ']) {
      const { body } = bankComplaint(failed(), { name, upiId: null, mobile: '98765 43210' }, TODAY)
      expect(body.endsWith(`Yours faithfully,\n${PLACEHOLDERS.name}\nMobile: 98765 43210`), name).toBe(true)
      expect(blanksIn(body)).toEqual([PLACEHOLDERS.name])
    }
    expect(nchMessage(refund(), { name: 'You', upiId: null, place: 'Kolkata, West Bengal' }, TODAY).body.endsWith(`${PLACEHOLDERS.name}, Kolkata, West Bengal`)).toBe(true)
    expect(isRealName('Youssef')).toBe(true)
    expect(isRealName('Meera')).toBe(true)
  })

  it('knows which letters sign with the UPI ID', () => {
    expect(signsWithUpiId('bank', failed())).toBe(true)
    expect(signsWithUpiId('ombudsman', failed({ rail: 'upi_person' }))).toBe(true)
    expect(signsWithUpiId('bank', failed({ rail: 'imps' }))).toBe(false)
    expect(signsWithUpiId('nch', failed())).toBe(false)
    expect(signsWithUpiId('commission', failed())).toBe(false)
  })
})

describe('a card or an ATM', () => {
  /** ₹5,000 not dispensed at an SBI ATM on 24 Oct, card ending 7712. */
  const atm = failed({ rail: 'atm', party: 'SBI ATM, Hazratganj, Lucknow', merchant: null, amount: 5_00_000, date: '2026-10-24', ref: '429718003456', bank: 'sbi', account: 'XX7712', app: null })

  it('names the ATM and the card, not "Paid to" and "Account"', () => {
    const raised = { ...atm, steps: [{ kind: 'bank' as const, date: '2026-10-01', ref: null }] }
    const back = { ...atm, back: { date: '2026-11-01', amount: 5_00_000, compensation: 0 } }
    for (const { body } of [bankComplaint(atm, ME, TODAY), compensationClaim(back, ME, TODAY), ombudsmanComplaint(raised, ME, TODAY)]) {
      expect(body).toContain('ATM: SBI ATM, Hazratganj, Lucknow')
      expect(body).toContain('Card ending: 7712')
      expect(body).not.toContain('Paid to:')
      expect(body).not.toContain('Account:')
    }
    expect(ombudsmanFields(raised, ME, TODAY).find((f) => f.id === 'account')?.value).toBe('Card ending 7712')
    expect(nchMessage(atm, ME, TODAY).body).toContain('Paid from: State Bank of India card ending 7712.')
  })

  it('pays a shop "at" its card machine, from the card', () => {
    const { body } = bankComplaint(failed({ rail: 'card_pos', party: 'Indian Oil, Satellite', merchant: null, account: 'XX4417', app: null }), ME, TODAY)
    expect(body).toContain('Paid at: Indian Oil, Satellite')
    expect(body).toContain('Card ending: 4417')
    expect(body).not.toContain('Account:')
  })

  it('leaves the card’s last digits to fill in when they were not saved', () => {
    expect(bankComplaint(failed({ rail: 'card_online', account: null }), ME, TODAY).body).toContain(`Card ending: ${PLACEHOLDERS.card}`)
  })
})

describe('a NACH debit after the mandate was revoked cites its own row', () => {
  it('cites row 7(b), not the combined NACH row', () => {
    const revoked = { ...failed({ rail: 'nach', party: 'Zenith Finance Ltd', merchant: null, app: null }), mandateRevoked: true, mandateRevokedOn: '2026-09-15' }
    const { body } = bankComplaint(revoked, ME, TODAY)
    expect(body).toContain('NACH — account debited despite revocation of the debit mandate with the bank by the customer (I.7.b)')
    expect(body).not.toContain(RAIL_RULES.nach.row)
    expect(body).toContain('Mandate in favour of: Zenith Finance Ltd')
  })
})

describe('what the letter says follows where the case stands', () => {
  it('asks a business before its due date where the refund stands, in the present tense', () => {
    // Due 27 October; asked on 24 October.
    const { body } = merchantMessage(refund(), ME, '2026-10-24')
    expect(body).toContain('Your refund timeline is 5 working days, so it is due by 27 October 2026.')
    expect(body).toContain('It has not reached my account yet.')
    expect(body).toContain('Please share where the refund stands, or its reference number (ARN or UTR) if it has already been sent.')
    expect(body).not.toContain('was due')
    expect(merchantMessage(refund({ merchant: null, party: 'Sharma Electronics' }), ME, '2026-10-24').body).toContain('so I expect it by')
  })

  it('cites the earlier ticket when writing to the business again', () => {
    const asked = refund({ steps: [{ kind: 'merchant', date: '2026-10-28', ref: 'FK-88231907' }] })
    const { body } = merchantMessage(asked, ME, TODAY)
    expect(body).toContain("I'm writing again about a refund that hasn't reached me.")
    expect(body).toContain('I raised this with you on 28 October 2026 (ticket FK-88231907), and it is still not resolved.')
    expect(body).not.toContain('please share a ticket number')
    expect(body).toContain('resolved within one month of my complaint')
    // Noted today: this is that first message, not a follow-up.
    expect(merchantMessage(refund({ steps: [{ kind: 'merchant', date: TODAY, ref: null }] }), ME, TODAY).body).not.toContain('again')
  })

  it('cites the earlier complaint when writing to the bank again', () => {
    const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: 'HD55120' }] })
    const { body } = bankComplaint(raised, ME, TODAY)
    expect(body).toContain('I first raised this with you on 27 October 2026 (complaint number HD55120), and it has not been resolved.')
    expect(body).toContain('Please reply to this under complaint number HD55120.')
    const claim = compensationClaim({ ...raised, back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }, ME, TODAY).body
    expect(claim).toContain('I first raised this with you on 27 October 2026 (complaint number HD55120)')
  })

  it('attaches the reply when the bank sent one, and says "if any" only while Settle does not know', () => {
    const replied = failed({ steps: [{ kind: 'bank', date: '2026-10-27', ref: null }], repliedAt: '2026-10-31' })
    const body = ombudsmanComplaint(replied, ME, TODAY).body
    expect(body).toContain('The bank replied on 31 October 2026, and the reply did not resolve it.')
    expect(body).toContain('Attached: my complaint to the bank and its reply, and the account statement')
    expect(body).not.toContain('if any')
    expect(ombudsmanComplaint(failed(), ME, TODAY).body).toContain('my complaint to the bank and its reply (if any)')
  })
})

describe('money that came back in parts', () => {
  /** ₹500, of which ₹100 came on 28 Oct and ₹200 on 30 Oct. */
  const parts = {
    date: '2026-10-30',
    amount: 30_000,
    compensation: 0,
    parts: [
      { date: '2026-10-28', amount: 10_000, compensation: 0 },
      { date: '2026-10-30', amount: 20_000, compensation: 0 },
    ],
  }

  it('lists each part with its own date', () => {
    const { body } = bankComplaint(failed({ back: parts }), ME, TODAY)
    expect(body).toContain(`Only ${rupees(30_000)} of it was reversed (${rupees(10_000)} on 28 October 2026 and ${rupees(20_000)} on 30 October 2026); ${rupees(20_000)} is still to come.`)
    const raised = failed({ back: parts, steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] })
    expect(ombudsmanComplaint(raised, ME, TODAY).body).toContain(`(${rupees(10_000)} on 28 October 2026 and ${rupees(20_000)} on 30 October 2026)`)
    const summary = commissionSummary(failed({ back: parts }), ME, TODAY).body
    expect(summary).toContain(`- 28 October 2026: ${rupees(10_000)} reversed`)
    expect(summary).toContain(`- 30 October 2026: ${rupees(20_000)} reversed`)
  })

  it('says a full reversal came in parts, and when the compensation was paid', () => {
    const all = {
      date: '2026-10-30',
      amount: 50_000,
      compensation: 20_000,
      parts: [
        { date: '2026-10-28', amount: 30_000, compensation: 0 },
        { date: '2026-10-30', amount: 20_000, compensation: 0 },
        { date: '2026-11-01', amount: 0, compensation: 20_000 },
      ],
    }
    const { body } = compensationClaim(failed({ back: all }), ME, TODAY)
    expect(body).toContain(`It was reversed in parts (${rupees(30_000)} on 28 October 2026 and ${rupees(20_000)} on 30 October 2026).`)
    expect(body).toContain(`I have received ${rupees(20_000)} of it so far (on 1 November 2026), so ${rupees(30_000)} is still due.`)
    expect(commissionSummary(failed({ back: all }), ME, TODAY).body).toContain(`- 1 November 2026: ${rupees(20_000)} compensation received`)
  })

  it('tells the business and the helpline what came, each time', () => {
    const came = {
      date: '2026-10-30',
      amount: 1_00_000,
      compensation: 0,
      parts: [
        { date: '2026-10-28', amount: 60_000, compensation: 0 },
        { date: '2026-10-30', amount: 40_000, compensation: 0 },
      ],
    }
    const part = refund({ back: came })
    expect(merchantMessage(part, ME, TODAY).body).toContain(
      `${rupees(1_00_000)} came in parts (${rupees(60_000)} on 28 October 2026 and ${rupees(40_000)} on 30 October 2026), and ${rupees(29_900)} is still to come.`,
    )
    expect(nchMessage(part, ME, TODAY).body).toContain(
      `${rupees(1_00_000)} received (${rupees(60_000)} on 28 October 2026 and ${rupees(40_000)} on 30 October 2026); ${rupees(29_900)} still not received`,
    )
  })
})

describe('an airline refund', () => {
  /** IndiGo ₹8,450, cancelled 21 Oct, paid by card: the DGCA's 7 days (due 28 Oct). */
  const flight = refund({ merchant: 'indigo', rail: 'card_online', amount: 8_45_000, date: '2026-10-21', orderId: 'X7KQ2M' })

  it('counts from the cancellation, and states the DGCA rule once', () => {
    const { body } = merchantMessage(flight, ME, TODAY)
    expect(body).toContain('Cancelled on: 21 October 2026')
    expect(body).not.toContain('Refund started')
    expect(body.match(/Series M, Part II/g)).toHaveLength(1)
  })

  it('tells AirSewa, the helpline and a commission it was paid by card', () => {
    expect(airsewaMessage(flight, ME, TODAY).body).toContain('Paid by: Card')
    const nch = nchMessage(flight, ME, TODAY).body
    expect(nch).toContain('Paid by card.')
    expect(nch).toContain('Cancelled 21 October 2026;')
    expect(commissionSummary(flight, ME, TODAY).body).toContain('21 October 2026: the booking for PNR X7KQ2M was cancelled; IndiGo owed a refund of')
  })
})
