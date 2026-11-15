import { describe, expect, it } from 'vitest'
import { addDays } from '../../engine/dates'
import { amountWords, isRate, loanStatement, MAX_RATE_BP, parsePercent, payInterestFirst, percentText, simpleInterest, spanBetween, type LoanPayment, type Rate } from './engine'

const ONE_A_MONTH: Rate = { bp: 100, per: 'month' }
const TWO_A_MONTH: Rate = { bp: 200, per: 'month' }
const TWELVE_A_YEAR: Rate = { bp: 1200, per: 'year' }
const rupees = (n: number): number => n * 100

describe('rates', () => {
  it('a rate is a whole number of hundredths of a percent, from 0.01% to 100%, a month or a year', () => {
    expect(isRate({ bp: 100, per: 'month' })).toBe(true)
    expect(isRate({ bp: MAX_RATE_BP, per: 'year' })).toBe(true)
    for (const bad of [{ bp: 0, per: 'month' }, { bp: -100, per: 'month' }, { bp: 1.5, per: 'month' }, { bp: MAX_RATE_BP + 1, per: 'year' }, { bp: 100, per: 'week' }, { bp: '100', per: 'month' }, null, undefined]) {
      expect(isRate(bad as never)).toBe(false)
    }
  })

  it('reads a typed percent and writes it back', () => {
    expect(parsePercent('1')).toBe(100)
    expect(parsePercent('1.5')).toBe(150)
    expect(parsePercent(' 2 % ')).toBe(200)
    expect(parsePercent('0.75')).toBe(75)
    expect(parsePercent('.5')).toBe(50)
    expect(parsePercent('1,5')).toBe(150)
    expect(parsePercent('100')).toBe(10_000)
    for (const bad of ['', '0', '0.00', '101', '-1', 'two', '1.2.3', '1e2']) expect(parsePercent(bad)).toBeNull()
    expect(percentText(100)).toBe('1')
    expect(percentText(150)).toBe('1.5')
    expect(percentText(1200)).toBe('12')
    expect(percentText(75)).toBe('0.75')
    expect(percentText(105)).toBe('1.05')
  })
})

describe('how time is counted', () => {
  it('a monthly rate counts whole months from the loan’s date, then the days left over', () => {
    expect(spanBetween('2026-08-15', '2026-11-15', 'month')).toEqual({ months: 3, days: 0 })
    expect(spanBetween('2026-01-01', '2026-02-15', 'month')).toEqual({ months: 1, days: 14 })
    expect(spanBetween('2026-01-20', '2026-02-19', 'month')).toEqual({ months: 0, days: 30 })
    expect(spanBetween('2025-11-10', '2027-01-09', 'month')).toEqual({ months: 13, days: 30 })
  })

  it('a loan given on the 31st turns a month old on the last day of a shorter month', () => {
    expect(spanBetween('2026-01-31', '2026-02-27', 'month')).toEqual({ months: 0, days: 27 })
    expect(spanBetween('2026-01-31', '2026-02-28', 'month')).toEqual({ months: 1, days: 0 })
    expect(spanBetween('2026-01-31', '2026-03-01', 'month')).toEqual({ months: 1, days: 1 })
    expect(spanBetween('2026-01-31', '2026-03-31', 'month')).toEqual({ months: 2, days: 0 })
    // In a leap year February has a 29th.
    expect(spanBetween('2028-01-31', '2028-02-28', 'month')).toEqual({ months: 0, days: 28 })
    expect(spanBetween('2028-01-31', '2028-02-29', 'month')).toEqual({ months: 1, days: 0 })
    // A loan given on 29 Feb turns a year old on 28 Feb.
    expect(spanBetween('2028-02-29', '2029-02-28', 'month')).toEqual({ months: 12, days: 0 })
  })

  it('a yearly rate counts the actual days', () => {
    expect(spanBetween('2026-03-01', '2027-03-01', 'year')).toEqual({ months: 0, days: 365 })
    expect(spanBetween('2028-01-01', '2029-01-01', 'year')).toEqual({ months: 0, days: 366 })
    expect(spanBetween('2026-02-28', '2026-03-01', 'year')).toEqual({ months: 0, days: 1 })
    expect(spanBetween('2028-02-28', '2028-03-01', 'year')).toEqual({ months: 0, days: 2 })
  })

  it('no time has passed on the day itself, before it, or with a date that is not a date', () => {
    expect(spanBetween('2026-08-15', '2026-08-15', 'month')).toEqual({ months: 0, days: 0 })
    expect(spanBetween('2026-08-15', '2026-08-01', 'year')).toEqual({ months: 0, days: 0 })
    expect(spanBetween('2026-02-30', '2026-08-01', 'month')).toEqual({ months: 0, days: 0 })
  })

  it('time never runs backwards: a later day never counts as less (two years, day by day, from a 31st)', () => {
    let last = 0
    for (let i = 0; i <= 760; i++) {
      const span = spanBetween('2027-10-31', addDays('2027-10-31', i), 'month')
      const units = span.months * 30 + span.days
      expect(span.days).toBeLessThanOrEqual(30)
      expect(units).toBeGreaterThanOrEqual(last)
      last = units
    }
  })
})

describe('simple interest', () => {
  it('₹50,000 at 1% a month for 3 months is ₹1,500', () => {
    expect(simpleInterest(rupees(50_000), ONE_A_MONTH, '2026-08-15', '2026-11-15')).toBe(rupees(1_500))
  })

  it('1 month and 14 days at 2% a month on ₹30,000 is ₹880 (600 × (1 + 14/30))', () => {
    expect(simpleInterest(rupees(30_000), TWO_A_MONTH, '2026-01-01', '2026-02-15')).toBe(rupees(880))
  })

  it('12% a year for 365 days is exactly 12%', () => {
    expect(simpleInterest(rupees(100_000), TWELVE_A_YEAR, '2026-03-01', '2027-03-01')).toBe(rupees(12_000))
  })

  it('a leap year’s extra day earns one more day of interest: 366 days is 12% × 366/365', () => {
    // 1,00,000 × 12% × 366 / 365 = 12,032.88 → ₹12,033
    expect(simpleInterest(rupees(100_000), TWELVE_A_YEAR, '2028-01-01', '2029-01-01')).toBe(rupees(12_033))
    expect(simpleInterest(rupees(100_000), TWELVE_A_YEAR, '2028-01-01', '2029-01-01', 1)).toBe(1_203_288)
    // 28 Feb to 1 Mar is two days in a leap year and one otherwise: ₹65.75 against ₹32.88 on ₹1,00,000.
    expect(simpleInterest(rupees(100_000), TWELVE_A_YEAR, '2028-02-28', '2028-03-01', 1)).toBe(6_575)
    expect(simpleInterest(rupees(100_000), TWELVE_A_YEAR, '2026-02-28', '2026-03-01', 1)).toBe(3_288)
  })

  it('rounds to the nearest rupee, halves up; or to the paisa when asked', () => {
    // 10,000 × 1% × 5/30 = 16.67
    expect(simpleInterest(rupees(10_000), ONE_A_MONTH, '2026-01-01', '2026-01-06')).toBe(rupees(17))
    expect(simpleInterest(rupees(10_000), ONE_A_MONTH, '2026-01-01', '2026-01-06', 1)).toBe(1_667)
    // 100 × 1% × 15/30 = exactly 50 paise: up to ₹1.
    expect(simpleInterest(rupees(100), ONE_A_MONTH, '2026-01-01', '2026-01-16')).toBe(rupees(1))
    expect(simpleInterest(rupees(100), ONE_A_MONTH, '2026-01-01', '2026-01-16', 1)).toBe(50)
    // 49 paise: down to nothing.
    expect(simpleInterest(rupees(98), ONE_A_MONTH, '2026-01-01', '2026-01-16')).toBe(0)
  })

  it('is nothing on the day of the loan, for no money, or with a rate that is not a rate', () => {
    expect(simpleInterest(rupees(50_000), ONE_A_MONTH, '2026-08-15', '2026-08-15')).toBe(0)
    expect(simpleInterest(0, ONE_A_MONTH, '2026-08-15', '2027-08-15')).toBe(0)
    expect(simpleInterest(-500, ONE_A_MONTH, '2026-08-15', '2027-08-15')).toBe(0)
    expect(simpleInterest(rupees(50_000), { bp: 0, per: 'month' }, '2026-08-15', '2027-08-15')).toBe(0)
  })

  it('never compounds: twice the time is twice the interest, however long it goes unpaid', () => {
    const year = simpleInterest(rupees(50_000), ONE_A_MONTH, '2026-01-10', '2027-01-10')
    expect(year).toBe(rupees(6_000))
    expect(simpleInterest(rupees(50_000), ONE_A_MONTH, '2026-01-10', '2028-01-10')).toBe(year * 2)
    expect(simpleInterest(rupees(50_000), ONE_A_MONTH, '2026-01-10', '2036-01-10')).toBe(year * 10)
  })

  it('holds the largest amounts the app can: ₹1,000 crore at 100% a year for a century', () => {
    const interest = simpleInterest(1e12, { bp: 10_000, per: 'year' }, '2000-01-01', '2100-01-01')
    // 36,525 days: 1e12 × 36525 / 365
    expect(interest).toBe(Math.round((1e12 * 36_525) / 365 / 100) * 100)
    expect(Number.isSafeInteger(interest)).toBe(true)
  })
})

describe('loanStatement', () => {
  const base = { principal: rupees(50_000), rate: ONE_A_MONTH, from: '2026-08-15', asOf: '2026-11-15' }

  it('with nothing paid: the amount, the interest so far and the two together', () => {
    const s = loanStatement(base)
    expect(s).toMatchObject({ principalStart: rupees(50_000), principal: rupees(50_000), principalPaid: 0, interestTotal: rupees(1_500), interestPaid: 0, interestDue: rupees(1_500), due: rupees(51_500), span: { months: 3, days: 0 }, cleared: false })
    expect(s.lines.map((l) => [l.kind, l.date, l.interestAdded, l.principal, l.interestDue])).toEqual([
      ['start', '2026-08-15', 0, rupees(50_000), 0],
      ['asOf', '2026-11-15', rupees(1_500), rupees(50_000), rupees(1_500)],
    ])
  })

  it('on the day of the loan, and before it, nothing is due but the amount', () => {
    expect(loanStatement({ ...base, asOf: '2026-08-15' })).toMatchObject({ interestTotal: 0, due: rupees(50_000), asOf: '2026-08-15' })
    expect(loanStatement({ ...base, asOf: '2026-01-01' })).toMatchObject({ interestTotal: 0, due: rupees(50_000), asOf: '2026-08-15' })
  })

  it('a part payment pays the interest first, then the amount lent; interest then runs on what is left', () => {
    // After 3 months ₹1,500 interest is due. ₹5,000 paid: ₹1,500 to interest, ₹3,500 off the amount.
    const parts = payInterestFirst(rupees(5_000), rupees(1_500), rupees(50_000))
    expect(parts).toEqual({ interest: rupees(1_500), principal: rupees(3_500), extra: 0 })
    const payments: LoanPayment[] = [{ id: 'p1', date: '2026-11-15', ...parts }]
    const s = loanStatement({ ...base, asOf: '2027-01-15', payments })
    // Two more months on ₹46,500 at 1%: ₹930.
    expect(s).toMatchObject({ principal: rupees(46_500), principalPaid: rupees(3_500), interestTotal: rupees(2_430), interestPaid: rupees(1_500), interestDue: rupees(930), due: rupees(47_430) })
    expect(s.lines.map((l) => [l.kind, l.date, l.span, l.interestAdded, l.paid, l.toInterest, l.toPrincipal, l.principal, l.interestDue])).toEqual([
      ['start', '2026-08-15', { months: 0, days: 0 }, 0, 0, 0, 0, rupees(50_000), 0],
      ['payment', '2026-11-15', { months: 3, days: 0 }, rupees(1_500), rupees(5_000), rupees(1_500), rupees(3_500), rupees(46_500), 0],
      ['asOf', '2027-01-15', { months: 2, days: 0 }, rupees(930), 0, 0, 0, rupees(46_500), rupees(930)],
    ])
  })

  it('a payment smaller than the interest leaves the rest of the interest due, and that rest earns no interest', () => {
    const parts = payInterestFirst(rupees(1_000), rupees(1_500), rupees(50_000))
    expect(parts).toEqual({ interest: rupees(1_000), principal: 0, extra: 0 })
    const s = loanStatement({ ...base, asOf: '2026-12-15', payments: [{ id: 'p1', date: '2026-11-15', ...parts }] })
    // Month four adds ₹500 on the ₹50,000 still lent: ₹500 unpaid + ₹500 new. Not ₹505.
    expect(s).toMatchObject({ principal: rupees(50_000), interestTotal: rupees(2_000), interestPaid: rupees(1_000), interestDue: rupees(1_000), due: rupees(51_000) })
  })

  it('paying everything clears it, and nothing more is added afterwards', () => {
    const parts = payInterestFirst(rupees(51_500), rupees(1_500), rupees(50_000))
    expect(parts).toEqual({ interest: rupees(1_500), principal: rupees(50_000), extra: 0 })
    const s = loanStatement({ ...base, asOf: '2030-01-01', payments: [{ id: 'p1', date: '2026-11-15', ...parts }] })
    expect(s).toMatchObject({ principal: 0, interestDue: 0, due: 0, cleared: true, interestTotal: rupees(1_500) })
  })

  it('paying too much: the extra is told apart, never taken as interest or principal', () => {
    expect(payInterestFirst(rupees(60_000), rupees(1_500), rupees(50_000))).toEqual({ interest: rupees(1_500), principal: rupees(50_000), extra: rupees(8_500) })
    expect(payInterestFirst(0, rupees(1_500), rupees(50_000))).toEqual({ interest: 0, principal: 0, extra: 0 })
    expect(payInterestFirst(-500, rupees(1_500), rupees(50_000))).toEqual({ interest: 0, principal: 0, extra: 0 })
    expect(payInterestFirst(Number.NaN, rupees(1_500), rupees(50_000))).toEqual({ interest: 0, principal: 0, extra: 0 })
  })

  it('interest between two days does not depend on when interest was paid in between', () => {
    // 1 Jan to 15 Feb is 1 month and 14 days however it is cut up.
    const whole = loanStatement({ principal: rupees(30_000), rate: TWO_A_MONTH, from: '2026-01-01', asOf: '2026-02-15' })
    expect(whole.interestTotal).toBe(rupees(880))
    for (const day of ['2026-01-02', '2026-01-20', '2026-01-31', '2026-02-01', '2026-02-14']) {
      const before = loanStatement({ principal: rupees(30_000), rate: TWO_A_MONTH, from: '2026-01-01', asOf: day })
      const cut = loanStatement({ principal: rupees(30_000), rate: TWO_A_MONTH, from: '2026-01-01', asOf: '2026-02-15', payments: [{ id: 'p', date: day, interest: before.interestDue, principal: 0 }] })
      expect(cut.interestTotal).toBe(rupees(880))
      expect(cut.interestPaid + cut.interestDue).toBe(rupees(880))
    }
  })

  it('rounding never drifts: interest paid every single day for a year adds up to the year’s interest', () => {
    const from = '2027-06-30'
    const payments: LoanPayment[] = []
    let paid = 0
    for (let i = 1; i <= 366; i++) {
      const date = addDays(from, i)
      const due = loanStatement({ principal: rupees(33_333), rate: { bp: 175, per: 'month' }, from, asOf: date, payments }).interestDue
      payments.push({ id: `d${i}`, date, interest: due, principal: 0 })
      paid += due
    }
    const end = addDays(from, 366)
    const s = loanStatement({ principal: rupees(33_333), rate: { bp: 175, per: 'month' }, from, asOf: end, payments })
    expect(s.interestDue).toBe(0)
    expect(paid).toBe(simpleInterest(rupees(33_333), { bp: 175, per: 'month' }, from, end))
    expect(s.interestTotal).toBe(paid)
  })

  it('several part payments: every line adds up, to the paisa', () => {
    const from = '2026-01-31'
    const rate: Rate = { bp: 150, per: 'month' }
    const payments: LoanPayment[] = []
    for (const [date, amount] of [['2026-02-28', rupees(2_000)], ['2026-04-10', rupees(500)], ['2026-07-01', rupees(20_000)], ['2026-07-01', rupees(1_234)]] as const) {
      const at = loanStatement({ principal: rupees(75_000), rate, from, asOf: date, payments })
      const parts = payInterestFirst(amount, at.interestDue, at.principal)
      expect(parts.extra).toBe(0)
      payments.push({ id: `p${payments.length}`, date, interest: parts.interest, principal: parts.principal })
    }
    const s = loanStatement({ principal: rupees(75_000), rate, from, asOf: '2026-09-30', payments })
    let principal = s.principalStart
    let added = 0
    let toInterest = 0
    for (const line of s.lines) {
      added += line.interestAdded
      toInterest += line.toInterest
      principal -= line.toPrincipal
      expect(line.principal).toBe(principal)
      expect(line.interestDue).toBe(added - toInterest)
      expect(line.paid).toBe(line.toInterest + line.toPrincipal)
      expect(line.interestDue).toBeGreaterThanOrEqual(0)
    }
    expect(s.interestTotal).toBe(added)
    expect(s.principalPaid + s.interestPaid).toBe(rupees(2_000 + 500 + 20_000 + 1_234))
    expect(s.due).toBe(s.principal + s.interestDue)
    // 28 Feb is one whole month from 31 Jan: ₹1,125 interest, so ₹875 of the first ₹2,000 came off the amount.
    expect(s.lines[1]).toMatchObject({ span: { months: 1, days: 0 }, interestAdded: rupees(1_125), toInterest: rupees(1_125), toPrincipal: rupees(875) })
  })

  it('payments are read in date order, ones after the day asked for have not happened yet, ones before the loan count from its date', () => {
    const payments: LoanPayment[] = [
      { id: 'later', date: '2026-12-01', interest: 0, principal: rupees(10_000) },
      { id: 'second', date: '2026-10-15', interest: 0, principal: rupees(5_000) },
      { id: 'early', date: '2026-01-01', interest: 0, principal: rupees(5_000) },
    ]
    const s = loanStatement({ ...base, payments })
    expect(s.lines.map((l) => [l.id, l.date])).toEqual([
      ['start', '2026-08-15'],
      ['early', '2026-08-15'],
      ['second', '2026-10-15'],
      ['asOf', '2026-11-15'],
    ])
    // ₹45,000 for two months (₹900), then ₹40,000 for one (₹400).
    expect(s).toMatchObject({ principal: rupees(40_000), interestTotal: rupees(1_300) })
  })

  it('a payment can never take off more than is there', () => {
    const s = loanStatement({ ...base, payments: [{ id: 'p', date: '2026-09-15', interest: rupees(9_999), principal: rupees(99_999) }] })
    expect(s.lines[1]).toMatchObject({ toInterest: rupees(500), toPrincipal: rupees(50_000), principal: 0, interestDue: 0 })
    expect(s).toMatchObject({ principal: 0, due: 0, cleared: true })
  })

  it('money marked paid back elsewhere in the app comes off the amount, with no interest part', () => {
    const s = loanStatement({ ...base, payments: [{ id: 'o', date: '2026-10-15', interest: 0, principal: rupees(20_000), outside: true }] })
    expect(s.lines[1]).toMatchObject({ outside: true, toInterest: 0, toPrincipal: rupees(20_000), interestDue: rupees(1_000) })
    // ₹1,000 for the first two months, then ₹300 on ₹30,000.
    expect(s).toMatchObject({ principal: rupees(30_000), interestDue: rupees(1_300), due: rupees(31_300) })
  })

  it('a yearly rate through a leap day, with a part payment on 29 February', () => {
    const from = '2027-12-01'
    const rate = TWELVE_A_YEAR
    const at = loanStatement({ principal: rupees(73_000), rate, from, asOf: '2028-02-29' })
    // 90 days: 73,000 × 12% × 90/365 = ₹2,160
    expect(at.span).toEqual({ months: 0, days: 90 })
    expect(at.interestDue).toBe(rupees(2_160))
    const parts = payInterestFirst(rupees(12_160), at.interestDue, at.principal)
    const s = loanStatement({ principal: rupees(73_000), rate, from, asOf: '2028-03-01', payments: [{ id: 'p', date: '2028-02-29', ...parts }] })
    // One day on ₹63,000: 63,000 × 12% / 365 = ₹20.71 → the running total rounds to ₹2,181.
    expect(s).toMatchObject({ principal: rupees(63_000), interestTotal: rupees(2_181), interestDue: rupees(21) })
  })

  it('a currency without paise rounds to the whole unit it has', () => {
    const s = loanStatement({ principal: 50_000, rate: ONE_A_MONTH, from: '2026-08-15', asOf: '2026-08-25', unit: 1 })
    // 50,000 × 1% × 10/30 = 166.67 → ¥167
    expect(s.interestDue).toBe(167)
  })

  it('no money lent: nothing due, and not "cleared" either', () => {
    expect(loanStatement({ ...base, principal: 0 })).toMatchObject({ due: 0, cleared: false, interestTotal: 0 })
  })
})

describe('amounts in words, the Indian way', () => {
  it('thousand, lakh and crore', () => {
    expect(amountWords(rupees(50_000), 'INR')).toBe('Rupees fifty thousand only')
    expect(amountWords(rupees(150_000), 'INR')).toBe('Rupees one lakh fifty thousand only')
    expect(amountWords(rupees(1_00_000), 'INR')).toBe('Rupees one lakh only')
    expect(amountWords(rupees(25_000_000), 'INR')).toBe('Rupees two crore fifty lakh only')
    expect(amountWords(rupees(10_000_000), 'INR')).toBe('Rupees one crore only')
    expect(amountWords(rupees(123_456_789), 'INR')).toBe('Rupees twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine only')
    expect(amountWords(rupees(1_000_000_000), 'INR')).toBe('Rupees one hundred crore only')
    expect(amountWords(rupees(99_99_999), 'INR')).toBe('Rupees ninety-nine lakh ninety-nine thousand nine hundred ninety-nine only')
  })

  it('small amounts and paise', () => {
    expect(amountWords(rupees(1), 'INR')).toBe('Rupees one only')
    expect(amountWords(rupees(501), 'INR')).toBe('Rupees five hundred one only')
    expect(amountWords(2_500_000_050, 'INR')).toBe('Rupees two crore fifty lakh and fifty paise only')
    expect(amountWords(50, 'INR')).toBe('Fifty paise only')
    expect(amountWords(1, 'INR')).toBe('One paisa only')
    expect(amountWords(101, 'INR')).toBe('Rupees one and one paisa only')
  })

  it('only rupees, and only a real amount', () => {
    expect(amountWords(rupees(50_000), 'USD')).toBeNull()
    expect(amountWords(0, 'INR')).toBeNull()
    expect(amountWords(-100, 'INR')).toBeNull()
    expect(amountWords(10.5, 'INR')).toBeNull()
  })
})
