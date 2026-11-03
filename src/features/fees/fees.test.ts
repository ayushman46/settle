import { beforeEach, describe, expect, it } from 'vitest'
import { parseDelimited } from '../whospaid/statement'
import { answerFindings, setAccount } from './actions'
import { feeKindOf, isReversal, isTaxLine } from './kinds'
import { bankLetter, basicLetter } from './letters'
import { readLines } from './lines'
import { checkRows, lateAtmReversals, statementMeta } from './read'
import { findingsOf } from './rules'
import { chargePeriod, periodAverage } from './scan'
import { readChargeSms } from './sms'
import { emptyFees, feesStore } from './store'

const HEADER = 'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance'

/** A statement as CSV text, from rows of [date, narration, withdrawal, deposit, balance]. */
function csv(rows: ReadonlyArray<readonly [string, string, string, string, string]>, top: readonly string[] = []): string[][] {
  const text = [...top, HEADER, ...rows.map(([d, n, w, dep, b]) => `${d},"${n}",0000,${d},${w},${dep},${b}`)].join('\n')
  return parseDelimited(text)
}

beforeEach(() => {
  localStorage.clear()
  feesStore.set(emptyFees())
})

describe('feeKindOf', () => {
  it.each([
    ['NON MAINT OF AMB CHGS OCT 26', 'minbal'],
    ['MIN BAL CHARGES', 'minbal'],
    ['AQB CHG QTR SEP-26', 'minbal'],
    ['ATM WDL CHGS 3 TXN', 'atm'],
    ['NFS CASH WDL CHRG', 'atm'],
    ['ATM DECLINE CHG INSUFF BAL', 'atmDecline'],
    ['SMS ALERT CHGS QTR SEP26', 'sms'],
    ['DEBIT CARD ANNUAL FEE', 'card'],
    ['DCARDFEE 4821', 'card'],
    ['NEFT CHGS INCL GST', 'neft'],
    ['IMPS P2A CHG', 'imps'],
    ['UPI TXN CHARGES', 'upi'],
    ['CHQ BOOK CHGS 25 LVS', 'chequeBook'],
    ['ACH DEBIT RETURN CHARGES', 'bounce'],
    ['CASH DEP CHGS NON HOME', 'cash'],
    ['DORMANT A/C REACTIVATION CHG', 'dormant'],
    ['FORECLOSURE CHARGES LN 4471', 'prepay'],
    ['PASSBOOK ISSUE CHG', 'statement'],
    ['SERVICE CHARGES', 'other'],
    // As banks print them (statements filed in court and complaints).
    ['AMB CHRG INCL GST FOR NOV2018', 'minbal'],
    ['MABchgs-Feb21+GST', 'minbal'],
    ['INST-ALERT CHG INC GST JAN-MAR2020-MIR20', 'sms'],
    ['SMSChrgsJAN-MAR26 GST', 'sms'],
    ['DEBIT CARD ANNUAL FEE-DEC-2021 141221-MIR2235812563569', 'card'],
    ['DEBIT ATMCard AMC 2018-19 459200*2244 SILVER-GLOBAL', 'card'],
    ['DCARDFEE/0098/S', 'card'],
    ['Consolidated Charges', 'other'],
  ])('reads "%s" as %s', (text, kind) => {
    expect(feeKindOf(text)).toBe(kind)
  })

  it.each(['UPI/P2A/629618427311/RIYA SHARMA/HDFC BANK/Dinner', 'ATM WDL 1234 MG ROAD', 'NEFT-SBIN0001234-RIYA SHARMA-RENT', 'INT.PD:01-10-26 TO 31-10-26', 'SALARY OCT 2026', 'POS 4821 SWIGGY'])(
    'is not fooled by "%s"',
    (text) => {
      expect(feeKindOf(text)).toBeNull()
    },
  )

  it('tells GST lines and reversals apart', () => {
    expect(isTaxLine('GST ON AMB CHGS')).toBe(true)
    expect(isTaxLine('CGST @9% ON CHGS')).toBe(true)
    expect(isTaxLine('UPI/P2M/GST SUVIDHA KENDRA')).toBe(false)
    expect(isReversal('REV NON MAINT OF AMB CHGS')).toBe(true)
  })
})

describe('reading a statement', () => {
  it('reads every line oldest first, with balances, from a newest-first statement', () => {
    const rows = csv([
      ['03/10/26', 'UPI-SWIGGY-swiggy@axb', '400.00', '', '9600.00'],
      ['01/10/26', 'UPI/P2A/123412341234/RIYA SHARMA', '', '10000.00', '10000.00'],
    ])
    const read = readLines(rows)
    expect(read?.lines.map((l) => [l.date, l.delta, l.balance])).toEqual([
      ['2026-10-01', 1000000, 1000000],
      ['2026-10-03', -40000, 960000],
    ])
    expect(read?.trusted).toBe(true)
  })

  it('finds the bank, the account and a basic account above the table', () => {
    const rows = csv([['01/10/26', 'X', '1.00', '', '1.00']], ['HDFC BANK Ltd.', 'Account No :XXXXXXXX4821', 'Product : BASIC SAVINGS BANK DEPOSIT A/C', 'IFSC : HDFC0001234'])
    expect(statementMeta(rows)).toEqual({ bank: 'hdfc', account: 'XX4821', type: 'basic', period: null })
  })

  it('works out the month a minimum-balance charge is for, and its average balance', () => {
    expect(chargePeriod('2026-11-02', false)).toEqual({ from: '2026-10-01', to: '2026-10-31', label: '2026-10' })
    expect(chargePeriod('2026-10-31', false)).toEqual({ from: '2026-10-01', to: '2026-10-31', label: '2026-10' })
    expect(chargePeriod('2026-10-03', true)).toEqual({ from: '2026-07-01', to: '2026-09-30', label: '2026-Q3' })
    const read = readLines(
      csv([
        ['30/09/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '12000.00'],
        ['16/10/26', 'UPI-SWIGGY-swiggy@axb', '4000.00', '', '8000.00'],
        ['02/11/26', 'NON MAINT OF AMB CHGS', '500.00', '', '7500.00'],
      ]),
    )
    // 15 days at ₹12,000 and 16 at ₹8,000.
    const avg = periodAverage(read?.lines ?? [], '2026-10-01', '2026-10-31', (l) => feeKindOf(l.narration) === 'minbal')
    expect(avg).toBe(Math.round((15 * 1200000 + 16 * 800000) / 31))
  })
})

describe('finding what breaks a rule', () => {
  it('claims the part of a minimum-balance charge that turned the balance negative, with its GST', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/P2A/123412341234/RIYA SHARMA', '', '100.00', '100.00'],
        ['02/11/26', 'NON MAINT OF AMB CHGS OCT26', '500.00', '', '-400.00'],
        ['02/11/26', 'GST ON AMB CHGS', '90.00', '', '-490.00'],
      ]),
      'Acct_Statement_XX4821.csv',
    )
    const [charge] = feesStore.get().charges
    expect(charge).toMatchObject({ kind: 'minbal', amount: 50000, gst: 9000, balanceBefore: 10000, balanceAfter: -49000 })
    const findings = findingsOf(feesStore.get())
    expect(findings[0]).toMatchObject({ rule: 'minbalNegative', verdict: 'wrong', claim: 49000 })
    // It also asks whether the bank warned first (the whole charge, if not).
    expect(findings[0]?.also).toEqual([])
  })

  it('claims the whole charge once you say the bank never warned you', () => {
    checkRows(csv([['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '5000.00'], ['02/11/26', 'MIN BAL CHARGES', '300.00', '', '4700.00']]))
    let [f] = findingsOf(feesStore.get())
    expect(f).toMatchObject({ rule: 'minbalNotice', verdict: 'ask', question: 'warned' })
    answerFindings([f?.key ?? ''], true)
    ;[f] = findingsOf(feesStore.get())
    expect(f).toMatchObject({ rule: 'minbalNotice', verdict: 'wrong', claim: 30000 })
  })

  it("claims a minimum-balance charge from a bank that stopped charging it", () => {
    checkRows(csv([['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '5000.00'], ['02/11/26', 'MIN BAL CHARGES', '300.00', '', '4700.00']], ['State Bank of India', 'IFSC SBIN0001234']))
    expect(findingsOf(feesStore.get())[0]).toMatchObject({ rule: 'minbalWaived', verdict: 'wrong', claim: 30000 })
  })

  it('claims all of it on a basic account, and when the average was not short at all', () => {
    checkRows(
      csv([
        ['30/09/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '12000.00'],
        ['02/11/26', 'NON MAINT OF AMB CHGS', '500.00', '', '11500.00'],
      ]),
    )
    setAccount(null, null, { type: 'regular', mab: 1000000 }, true)
    expect(findingsOf(feesStore.get())[0]).toMatchObject({ rule: 'minbalNotShort', verdict: 'wrong', claim: 50000 })
    setAccount(null, null, { type: 'basic' }, true)
    expect(findingsOf(feesStore.get())[0]).toMatchObject({ rule: 'minbalBasic', verdict: 'wrong', claim: 50000 })
  })

  it('asks about an ATM charge in a month with only two withdrawals (a failed one not counted)', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '20000.00'],
        ['05/10/26', 'NWD-5123XXXX4821-MUMBAI', '2000.00', '', '18000.00'],
        ['09/10/26', 'NWD-5123XXXX4821-ANDHERI', '1000.00', '', '17000.00'],
        ['12/10/26', 'NWD-5123XXXX4821-BANDRA', '3000.00', '', '14000.00'],
        ['13/10/26', 'REV NWD-5123XXXX4821-BANDRA', '', '3000.00', '17000.00'],
        ['31/10/26', 'ATM WDL CHGS', '23.00', '', '16977.00'],
        ['31/10/26', 'GST ON ATM CHGS', '4.14', '', '16972.86'],
      ]),
    )
    const [f] = findingsOf(feesStore.get())
    expect(f).toMatchObject({ rule: 'atmFree', verdict: 'ask', question: 'atmEnquiry', claim: 2714, facts: { count: 2, failed: 1 } })
  })

  it('claims an NEFT charge on a transfer sent from net banking, and a UPI charge', () => {
    checkRows(
      csv([
        ['01/03/25', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '20000.00'],
        ['05/03/25', 'NEFT DR-SBIN0001234-RIYA SHARMA-NETBANK-RENT', '10000.00', '', '10000.00'],
        ['05/03/25', 'NEFT CHGS', '2.50', '', '9997.50'],
        ['05/03/25', 'GST ON NEFT CHGS', '0.45', '', '9997.05'],
        ['09/03/25', 'UPI TXN CHARGES', '5.00', '', '9992.05'],
      ]),
    )
    const rules = findingsOf(feesStore.get()).map((f) => [f.rule, f.verdict, f.claim])
    expect(rules).toEqual([
      ['upi', 'wrong', 500],
      ['neftOnline', 'wrong', 295],
    ])
  })

  it('claims the GST left behind when a charge was reversed alone', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '20000.00'],
        ['02/10/26', 'SMS ALERT CHGS QTR SEP26', '15.00', '', '19985.00'],
        ['02/10/26', 'GST ON SMS CHGS', '2.70', '', '19982.30'],
        ['20/10/26', 'REV SMS ALERT CHGS', '', '15.00', '19997.30'],
      ]),
    )
    expect(findingsOf(feesStore.get())).toMatchObject([{ rule: 'gstLeft', verdict: 'wrong', claim: 270 }])
  })

  it('keeps each charge once when the same statement is read twice', () => {
    const rows = csv([['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '5000.00'], ['02/11/26', 'MIN BAL CHARGES', '300.00', '', '4700.00']])
    checkRows(rows)
    const again = checkRows(rows)
    expect(feesStore.get().charges).toHaveLength(1)
    expect(again.kind === 'read' && again.result.added).toEqual([])
  })

  it('finds ATM withdrawals that came back after the 5 days', () => {
    const read = readLines(
      csv([
        ['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '1.00', '20000.00'],
        ['03/10/26', 'ATW-5123XXXX4821-PUNE', '2000.00', '', '18000.00'],
        ['14/10/26', 'ATM RVSL ATW-5123XXXX4821-PUNE', '', '2000.00', '20000.00'],
      ]),
    )
    expect(lateAtmReversals(read?.lines ?? [])).toEqual([{ date: '2026-10-03', backOn: '2026-10-14', amount: 200000, text: 'ATW-5123XXXX4821-PUNE' }])
  })
})

describe('charge SMS', () => {
  it('reads a minimum-balance charge with the negative balance it left', () => {
    const read = readChargeSms('Rs.590.00 debited from A/c XX4821 on 02-11-26 towards Non Maintenance of AMB Charges incl GST. Avl Bal INR -490.00 -HDFC Bank', '2026-11-03')
    expect(read).toMatchObject({ type: 'charge', kind: 'minbal', amount: 59000, account: 'XX4821', bank: 'hdfc', date: '2026-11-02', balanceAfter: -49000 })
  })

  it('reads a reversal, and ignores a payment and an OTP', () => {
    expect(readChargeSms('Rs 590 credited to your A/c XX4821 towards reversal of AMB charges. -Axis Bank', '2026-11-03')).toMatchObject({ type: 'reversal', kind: 'minbal', amount: 59000 })
    expect(readChargeSms('Rs.500 debited from A/c XX4821 to VPA swiggy@axb (UPI Ref 629618427311)', '2026-11-03')).toBeNull()
    expect(readChargeSms('123456 is your OTP for ATM charges waiver', '2026-11-03')).toBeNull()
  })
})

describe('letters', () => {
  it('lists each charge with its rule and the total', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/P2A/123412341234/RIYA SHARMA', '', '100.00', '100.00'],
        ['02/11/26', 'NON MAINT OF AMB CHGS OCT26', '500.00', '', '-400.00'],
        ['02/11/26', 'GST ON AMB CHGS', '90.00', '', '-490.00'],
      ]),
      '',
    )
    feesStore.set({ ...feesStore.get(), charges: feesStore.get().charges.map((c) => ({ ...c, bank: 'hdfc', account: 'XX4821' })) })
    const letter = bankLetter(findingsOf(feesStore.get()), { name: 'Asha Rao', upiId: null, mobile: '98450 12345' }, '2026-11-03')
    expect(letter.subject).toBe('Reversal of a charge wrongly debited from my savings account ending 4821')
    expect(letter.body).toContain('To: The Branch Manager / Grievance Redressal Officer, HDFC Bank')
    expect(letter.body).toContain('1. 2 November 2026: charge for non-maintenance of minimum balance of ₹590 (₹500 + ₹90 GST)')
    expect(letter.body).toContain('from ₹100 to −₹490')
    expect(letter.body).toContain('para 160(6)')
    expect(letter.body).toContain('Please reverse ₹490 of it.')
    expect(letter.body).toContain('Total to be reversed: ₹490')
    expect(letter.body).toContain('Mobile: 98450 12345')
  })

  it('asks to convert to a basic account, citing the 7 days', () => {
    expect(basicLetter('icici', 'XX1234', { name: 'Asha Rao', upiId: null }, '2026-11-03').body).toContain('within seven days')
  })
})

describe('payments are not charges', () => {
  it('a UPI or NEFT payment whose remark says “fee” or “charges” is left alone; the bank’s own charge line is kept', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '30000.00', '30000.00'],
        ['03/10/26', 'NEFT DR-CNRB0001234-PES UNIVERSITY-NETBANK-COLLEGE FEE', '24000.00', '', '6000.00'],
        ['04/10/26', 'UPI-CULT FIT-cultfit@ybl-YESB0000001-627712340001-SMS CHARGES WAIVED PROMO', '999.00', '', '5001.00'],
        ['05/10/26', 'NEFT CHGS', '2.50', '', '4998.50'],
      ]),
    )
    expect(feesStore.get().charges.map((c) => [c.kind, c.amount])).toEqual([['neft', 250]])
  })

  it('a charge removed as read wrong stays removed when the statement is read again', async () => {
    const rows = csv([['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '5000.00', '5000.00'], ['02/11/26', 'MIN BAL CHARGES', '300.00', '', '4700.00']])
    checkRows(rows)
    const { removeCharges } = await import('./actions')
    removeCharges(feesStore.get().charges.map((c) => c.id))
    checkRows(rows)
    expect(feesStore.get().charges).toEqual([])
  })

  it('reads a minus balance in an SMS (“AVl Bal -68.20”) and Bank of India’s “MinBalChrgs”', () => {
    expect(readChargeSms('Dear Customer, Rs 118.00 Debited(TRE) MinBalChrgsSEP26 GST in your Ac xxx5531 on 05-10-2026. AVl Bal -68.20 -Bank of India', '2026-11-03')).toMatchObject({ kind: 'minbal', amount: 11800, balanceAfter: -6820 })
    expect(readChargeSms('Late payment charges of Rs.500 + GST Rs.90 levied on your HDFC Bank Credit Card XX9001 on 02-11-26', '2026-11-03')).toMatchObject({ kind: 'late', amount: 50000, gst: 9000 })
  })
})

describe('ATM charges for a month the statement doesn’t cover', () => {
  it('a charge early in October for September, on a statement that starts in October, isn’t claimed on a count it can’t know', () => {
    checkRows(
      csv([
        ['01/10/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '5000.00', '5000.00'],
        ['05/10/26', 'ATM WDL CHGS SEP26', '23.00', '', '4977.00'],
      ]),
    )
    expect(feesStore.get().charges[0]).toMatchObject({ kind: 'atm', monthAtm: null })
    expect(findingsOf(feesStore.get())).toEqual([])
  })

  it('the bank’s own count in the narration counts: 4 transactions, one past the 3 free, is allowed', () => {
    checkRows(
      csv([
        ['01/09/26', 'UPI/CR/601234567890/RAHUL/SALARY ADV', '', '5000.00', '5000.00'],
        ['05/10/26', 'ATM WDL CHGS SEP26 4 TXNS', '23.00', '', '4977.00'],
      ]),
    )
    expect(feesStore.get().charges[0]).toMatchObject({ kind: 'atm', monthAtm: 4 })
    expect(findingsOf(feesStore.get())).toEqual([])
  })
})
