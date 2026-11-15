import { describe, expect, it } from 'vitest'
import { guessPayday, isSalaryAlert } from './salary'

/** Bank alerts that are a salary arriving, as Indian banks word them. */
const SALARY: ReadonlyArray<[string, string]> = [
  ['sbi', 'Your A/C XXXXX3367 Credited INR 42,500.00 on 01/10/26 -Salary by NEFT from ACME SOFTWARE PVT LTD. Avl Bal INR 66,612.40-SBI'],
  ['hdfc', 'Update! INR 1,20,000.00 deposited in HDFC Bank A/c XX4821 on 31-OCT-26 for NEFT Cr-CITI0000001-INFOSYS LIMITED-SALARY OCT 2026. Avl bal INR 1,45,210.55'],
  ['icici', 'ICICI Bank Acct XX123 credited with Rs 65,000.00 on 30-Oct-26; SAL OCT26 TCS LTD. Avl Bal Rs 71,204.10'],
  ['axis', 'Dear Customer, your A/c no. XX9012 is credited by Rs.48,250.00 on 01-11-26 by SALARY/WIPRO LTD (NEFT Ref No AXISN26305998877). -Axis Bank'],
  ['kotak', 'Kotak Bank: Rs.72,400.00 credited to A/c X4411 on 31/10/26 towards SAL CR OCT 26. Bal: Rs.80,112.35'],
  ['canara', 'An amount of INR 35,000.00 has been CREDITED to your account XXX1234 on 07/11/2026 towards SALARY. Total Avail.bal INR 41,220.50 - Canara Bank'],
  ['bob', 'Salary of Rs 54,000 for Oct 2026 credited to your A/c XX2210 on 31-10-2026. Avl Bal Rs 59,870.12 - Bank of Baroda'],
  ['pnb', 'Ac XXXXXX5521 Credited with Rs.28,500.00, 05-11-2026 10:02:11 thru NEFT from ZOMATO LTD PAYROLL. Aval Bal 31,870.44 CR -PNB'],
  ['idfc', 'Your IDFC FIRST Bank A/C XXXXXXX8821 is credited by INR 91,300.00 on 30/10/26 17:45. Info: NEFT-SALARY-FLIPKART INTERNET P. New bal: INR 1,02,440.00'],
  ['yes', 'INR 38,750.00 credited to A/c ending 3041 on 07-NOV-2026 by NEFT/YESBN12026110718742/SAL NOV 2026/BYJUS. Avl Bal INR 40,201.00 - YES BANK'],
  ['union', 'A/c *1190 Credited for Rs:25,000.00 on 10-11-2026 09:14:55 by Mob Bk ref no 631412345678 SALARY NOV Avl Bal Rs:27,450.25 -Union Bank of India'],
  ['indusind', 'IndusInd Bank: Your A/c 15XXXX8890 is credited with INR 60,000.00 on 28/02/26 towards IMPS/SALARY FEB/RAZORPAY SOFTWARE. Avl Bal INR 61,500.00'],
  ['federal', 'Rs 18,000.00 credited to your A/c XX7719 on 01NOV2026. Stipend for Oct 2026 from IIT MADRAS. Bal Rs 19,340.10 - Federal Bank'],
  ['hdfc-2', 'HDFC Bank: Rs. 75,000.00 credited to a/c XXXXXX4821 on 30-11-26 by a/c linked to SALARY-NOV-2026 ACCENTURE SOLUTIONS (NEFT Ref HDFCN52026113045871).'],
  ['sbi-2', 'Dear SBI User, your A/c X3367-credited by Rs.42,500 on 30Oct26 transfer from ACME SOFTWARE Ref No 630412349876 SAL-OCT -SBI'],
  ['sbi-hindi', 'आपके खाते XX3367 में Rs.42,500.00 वेतन जमा किया गया है। दिनांक 01/11/26 -SBI'],
  ['icici-2', 'Dear Customer, Acct XX123 is credited with Rs 65,000.00 on 30-Nov-26 from TCS LTD. Info: SALNOV26. Avl Bal Rs 1,36,204.10'],
  ['au', 'Credit Alert! Rs.32,000.00 credited to AU Bank a/c X2231 on 01-11-2026 by NEFT - MONTHLY WAGES - SHREE CEMENT LTD. Bal Rs.33,010.00'],
  ['paytm-bank', 'Received Rs.22,000.00 in your Paytm Payments Bank a/c 91XXXX1234 from SWIGGY PAYROLL on 07-11-2026. Ref 631198765432.'],
  ['cboi', 'Your a/c XX4410 is credited by Rs.45,600.00 on 31-10-26 by SAL. Total Bal Rs.52,100.20 CBoI'],
  ['rupee-sign', '₹88,000.00 credited to A/c XX0042 on 28-Nov-26. SALARY NOVEMBER 2026 - ZOHO CORPORATION. Bal ₹1,10,420.75 - Indian Bank'],
  ['salary-account', 'Rs 54,000.00 credited to your Salary Account XX2210 on 31-10-26 towards SALARY OCT from ACME LTD. Avl Bal Rs 59,870.12'],
]

/** Alerts that mention money coming in, or salary, and are not your salary arriving. */
const NOT_SALARY: ReadonlyArray<[string, string]> = [
  ['a friend by UPI', 'Rs.420.00 credited to a/c XX4821 on 30-10-26 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref No 630112345678).'],
  ['a UPI transfer that says salary', 'Rs 15,000.00 credited to a/c XX4821 from VPA sharma.traders@okaxis (UPI Ref 631112345678) SALARY'],
  ['a friend into a salary account', 'Rs 2,000.00 credited to your Salary Account XX1234 on 30-10-26 from RAHUL VERMA via IMPS Ref 630412345678.'],
  ['a friend called Salim', 'Rs 5,000 credited to a/c XX4821 from SALIM KHAN via IMPS Ref 630412345678 on 05-11-26.'],
  ['a friend called Sal', 'Dear Customer, Rs 12,000.00 credited to your a/c XX4821 by NEFT from SAL DSOUZA on 05-11-26.'],
  ['a friend called Sal Decosta', 'Rs 12,000.00 credited to your a/c XX4821 by NEFT from SAL DECOSTA on 05-11-26.'],
  ['a GPay alert with a note', 'Riya Sharma paid you ₹15,000\nSalary for October'],
  ['a refund', 'Refund of Rs 1,299.00 has been credited to your a/c XX4821 by AMAZON PAY on 30-10-26.'],
  ['a tax refund', 'Income tax refund of Rs 12,340 for AY 2026-27 credited to your a/c XX3367. -ITD'],
  ['cashback', 'Cashback of Rs 50 credited to your Paytm Wallet for your recharge.'],
  ['a reward into a salary account', 'Your salary account XX4821 has been credited with Rs 500.00 cash reward from HDFC Bank.'],
  ['a card fee reversal', 'INR 1,500.00 credited to your Credit Card XX9921 as reversal of annual fee.'],
  ['a debit from a salary account', 'Your Salary A/c XX4821 is debited with Rs 15,000.00 on 01-11-26 towards rent. Avl Bal Rs 51,000.00'],
  ['paying the maid', 'Rs 8,000.00 debited from a/c XX4821 on 01-11-26 to ASHA DEVI (maid salary). Avl bal Rs 12,000'],
  ['salary still to come', 'Your salary of Rs 54,000 will be credited on 31-Oct-2026. - HR, ACME'],
  ['salary delayed', 'Your salary credit of Rs 54,000 is delayed. It will be credited by 5th Nov. -HR'],
  ['salary not credited', 'Rs 54,000 salary not credited yet? Raise a ticket with payroll.'],
  ['a loan advert', 'Get a personal loan up to Rs 5,00,000 on your salary. Amount credited in 10 minutes. Apply now: hdfc.bk/pl'],
  ['a salary loan', 'Advance salary loan of Rs 20,000 credited to your a/c XX1234. EMI of Rs 3,650 starts 05-Dec-26. -EarlySalary'],
  ['a loan against salary', 'Loan against salary: Rs 1,00,000 credited to a/c XX1234 on 12-11-26.'],
  ['a salary advance', 'Rs 10,000.00 credited to a/c XX1234 on 18-11-26 towards SALARY ADVANCE from ACME LTD.'],
  ['a telecom advert', 'Salary credited? Recharge with Rs 299 and get 2GB/day. -Jio'],
  ['an account upgrade advert', 'Upgrade your Salary Account to Imperia and get vouchers worth Rs 5,000 credited. T&C apply.'],
  ['an advert with a link', 'Salary credited! Rs 500 off on your first order at https://example.in/offer'],
  ['a payslip notice', 'ACME PAYROLL: Your salary slip for Oct 2026 is ready. Net pay Rs 54,000. Login to download.'],
  ['a reimbursement', 'Rs 8,450.00 credited to a/c XX4821 on 12-11-26 by NEFT-INFOSYS LIMITED-REIMBURSEMENT OCT. Avl bal Rs 31,220.00'],
  ['interest on a salary account', 'Interest of Rs 1,204.00 credited to your Salary Plus account XX4821 for the quarter. -Kotak'],
  ['a dividend', 'Dividend of Rs 420.00 credited to A/c XX4821 from ITC LTD on 14-11-26.'],
  ['provident fund', 'Your EPF contribution of Rs 3,600 for 10/2026 has been received. Passbook balance Rs 2,41,220. -EPFO'],
  ['an OTP', 'OTP 482913 for txn of Rs 42,500 at SALARY TAX SERVICES. Do not share.'],
  ['money from family', 'Rs 10,000.00 credited to a/c XX4821 on 02-11-26 by IMPS from SURESH KUMAR Ref 630612345678.'],
  ['no amount', 'Salary credited to your account. -ACME HR'],
  ['a failed credit', 'NEFT of Rs 54,000 towards SALARY OCT failed and could not be credited to a/c XX2210.'],
]

describe('isSalaryAlert', () => {
  it.each(SALARY)('salary arriving: %s', (_bank, text) => {
    expect(isSalaryAlert(text)).toBe(true)
  })

  it.each(NOT_SALARY)('not salary: %s', (_what, text) => {
    expect(isSalaryAlert(text)).toBe(false)
  })

  it('has at least 25 real-looking alerts on each side', () => {
    expect(SALARY.length + NOT_SALARY.length).toBeGreaterThanOrEqual(50)
    expect(SALARY.length).toBeGreaterThanOrEqual(20)
    expect(NOT_SALARY.length).toBeGreaterThanOrEqual(25)
  })

  it('reads nothing into junk', () => {
    expect(isSalaryAlert('')).toBe(false)
    expect(isSalaryAlert('   ')).toBe(false)
    expect(isSalaryAlert(`Salary Rs 100 credited ${'x'.repeat(3000)}`)).toBe(false)
    expect(isSalaryAlert(undefined as unknown as string)).toBe(false)
    expect(isSalaryAlert(42 as unknown as string)).toBe(false)
  })

  it('gives the same answer every time (no state kept between calls)', () => {
    const text = SALARY[0]?.[1] ?? ''
    for (let i = 0; i < 5; i++) expect(isSalaryAlert(text)).toBe(true)
  })
})

describe('guessPayday', () => {
  it('says nothing until two different months agree', () => {
    expect(guessPayday([])).toBeNull()
    expect(guessPayday(['2026-10-30'])).toBeNull()
    expect(guessPayday(['2026-10-30', '2026-10-30'])).toBeNull()
    // Two alerts in the same month (salary, then arrears) are one month.
    expect(guessPayday(['2026-10-30', '2026-10-31'])).toBeNull()
    expect(guessPayday(['2026-10-05', '2026-11-20'])).toBeNull()
  })

  it('the 30th twice is the 30th', () => {
    expect(guessPayday(['2026-10-30', '2026-11-30'])).toEqual({ payday: 30, days: ['2026-10-30', '2026-11-30'] })
    // Not next to each other either.
    expect(guessPayday(['2026-09-30', '2026-11-30'])?.payday).toBe(30)
  })

  it('the same plain day twice', () => {
    expect(guessPayday(['2026-10-07', '2026-12-07'])?.payday).toBe(7)
    expect(guessPayday(['2026-11-10', '2026-10-10'])).toEqual({ payday: 10, days: ['2026-10-10', '2026-11-10'] })
    expect(guessPayday(['2026-12-01', '2027-01-01'])?.payday).toBe(1)
  })

  it('the 31st and then the 30th is the last day', () => {
    expect(guessPayday(['2026-10-31', '2026-11-30'])?.payday).toBe('last')
    expect(guessPayday(['2026-07-31', '2026-08-31'])?.payday).toBe('last')
    expect(guessPayday(['2026-01-31', '2026-02-28'])?.payday).toBe('last')
    expect(guessPayday(['2028-02-29', '2028-03-31'])?.payday).toBe('last')
  })

  it('a Friday when the month ends on a weekend is the last working day', () => {
    // 28 Feb 2026 is a Saturday: paid on Friday the 27th. March ends on a Tuesday.
    expect(guessPayday(['2026-02-27', '2026-03-31'])?.payday).toBe('lastWorking')
    // 31 Oct 2026 is a Saturday; with November and December it can only be the last working day.
    expect(guessPayday(['2026-10-30', '2026-11-30', '2026-12-31'])).toEqual({ payday: 'lastWorking', days: ['2026-10-30', '2026-11-30', '2026-12-31'] })
  })

  it('a payday that fell on a weekend and moved to Friday or Monday still counts', () => {
    // 1 Nov 2026 is a Sunday: paid on Monday the 2nd.
    expect(guessPayday(['2026-10-01', '2026-11-02'])?.payday).toBe(1)
    // 7 Nov 2026 is a Saturday: paid on Friday the 6th.
    expect(guessPayday(['2026-10-07', '2026-11-06'])?.payday).toBe(7)
    // 28 Feb 2026 is a Saturday: paid on Friday the 27th.
    expect(guessPayday(['2026-01-28', '2026-02-27'])?.payday).toBe(28)
  })

  it('a 1st that fell on a Sunday and was paid the Friday before, in the month before', () => {
    expect(guessPayday(['2026-10-01', '2026-10-30', '2026-12-01'])).toEqual({ payday: 1, days: ['2026-10-01', '2026-10-30', '2026-12-01'] })
  })

  it('when two days fit equally, the one the newest alert landed on', () => {
    // Fri 4 Sep and Mon 5 Oct 2026: the 4th (moved to Monday) or the 5th (moved to Friday).
    expect(guessPayday(['2026-09-04', '2026-10-05'])?.payday).toBe(5)
  })

  it('more months beat fewer', () => {
    // A one-off on the 15th twice does not outvote four month-ends.
    expect(guessPayday(['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-15', '2026-11-15', '2026-11-30'])?.payday).toBe('last')
  })

  it('forgets alerts from more than about six months before the newest', () => {
    expect(guessPayday(['2026-01-30', '2026-11-30'])).toBeNull()
    expect(guessPayday(['2025-11-30', '2026-01-30', '2026-10-30', '2026-11-30'])?.days).toEqual(['2026-10-30', '2026-11-30'])
  })

  it('ignores junk and repeats', () => {
    expect(guessPayday(['soon', '2026-02-30', '', '2026-10-30', '2026-10-30', '2026-11-30'])?.payday).toBe(30)
    expect(guessPayday(['soon', 'later'])).toBeNull()
  })
})
