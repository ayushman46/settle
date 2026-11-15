import { describe, expect, it } from 'vitest'
import { ME_ID } from '../../domain/types'
import {
  dueDate,
  dueNow,
  firstPeriod,
  ledger,
  leaveCutFor,
  monthSheet,
  openPeriod,
  paymentFrom,
  salaryFor,
  splitShares,
  turnOf,
  workingPeriod,
  yearView,
  type HelpEntry,
  type HelpEntryKind,
  type Helper,
  type MonthSheet,
} from './engine'

const R = 100

function helper(patch: Partial<Helper> = {}): Helper {
  return {
    id: 'h1',
    name: 'Asha didi',
    work: 'maid',
    currency: 'INR',
    salary: 6000 * R,
    raises: [],
    payDay: 1,
    sharers: [{ friendId: ME_ID, parts: 1 }],
    groupId: null,
    upi: null,
    paidLeave: 2,
    cutPay: false,
    startedOn: '2026-11-03',
    entries: [],
    payments: [],
    cuts: {},
    createdAt: 1,
    ...patch,
  }
}

let seq = 0
function entry(kind: HelpEntryKind, date: string, rupees = 0): HelpEntry {
  seq += 1
  return { id: `e${seq}`, kind, date, amount: rupees * R, note: null, byId: ME_ID, expenseId: null, at: seq }
}

function sheetOf(h: Helper, period: string): MonthSheet {
  const sheet = monthSheet(h, period)
  if (!sheet) throw new Error(`no sheet for ${period}`)
  return sheet
}

/** Pays `period` exactly as the sheet says and returns the helper with that payment. */
function pay(h: Helper, period: string, paidOn = `${period}-28`): Helper {
  return { ...h, payments: [...h.payments, paymentFrom(sheetOf(h, period), { paidOn, at: 1, payerId: ME_ID, method: 'cash' })] }
}

/** What a sheet must always satisfy. */
function expectAddsUp(s: MonthSheet): void {
  expect(s.gross).toBe(s.salary - s.leaveCut + s.extra + s.bonus)
  expect(s.toPay).toBe(s.gross - s.advanceCut)
  expect(s.advanceAfter).toBe(s.advanceBefore + s.advanceTaken - s.advanceCut)
  expect(s.toPay).toBeGreaterThanOrEqual(0)
  expect(s.advanceAfter).toBeGreaterThanOrEqual(0)
}

describe('pay days and months', () => {
  it('a pay day early in the month pays for the month before; a late one for its own month', () => {
    expect(dueDate('2026-11', 1)).toBe('2026-12-01')
    expect(dueDate('2026-11', 15)).toBe('2026-12-15')
    expect(dueDate('2026-11', 16)).toBe('2026-11-16')
    expect(dueDate('2026-12', 5)).toBe('2027-01-05')
  })

  it('"the 31st" in a shorter month is its last day, leap day included', () => {
    expect(dueDate('2026-11', 31)).toBe('2026-11-30')
    expect(dueDate('2027-02', 31)).toBe('2027-02-28')
    expect(dueDate('2028-02', 30)).toBe('2028-02-29')
    expect(dueDate('2026-12', 31)).toBe('2026-12-31')
  })

  it('the first month kept is the earliest one whose pay day had not passed when they were added', () => {
    expect(firstPeriod({ startedOn: '2026-11-03', payDay: 1 })).toBe('2026-11')
    // Added on pay day itself: last month's salary is the one to pay today.
    expect(firstPeriod({ startedOn: '2026-12-01', payDay: 1 })).toBe('2026-11')
    expect(firstPeriod({ startedOn: '2026-12-03', payDay: 5 })).toBe('2026-11')
    expect(firstPeriod({ startedOn: '2026-11-15', payDay: 30 })).toBe('2026-11')
    // Added after this month's pay day: nothing is asked for this month.
    expect(firstPeriod({ startedOn: '2026-11-30', payDay: 28 })).toBe('2026-12')
  })

  it('the month being worked is the one the next pay day pays for', () => {
    const h = { startedOn: '2026-11-03', payDay: 1 }
    expect(workingPeriod(h, '2026-11-15')).toBe('2026-11')
    expect(workingPeriod(h, '2026-12-01')).toBe('2026-11')
    expect(workingPeriod(h, '2026-12-02')).toBe('2026-12')
    expect(workingPeriod({ startedOn: '2026-11-03', payDay: 20 }, '2026-12-25')).toBe('2027-01')
    expect(workingPeriod({ startedOn: '2026-11-30', payDay: 28 }, '2026-11-30')).toBe('2026-12')
  })
})

describe('a month', () => {
  it('the brief: salary − advance + extra = to pay', () => {
    const h = helper({ entries: [entry('advance', '2026-11-10', 2000), entry('extra', '2026-11-20', 500)] })
    const s = sheetOf(h, '2026-11')
    expect(s).toMatchObject({ salary: 6000 * R, advanceCut: 2000 * R, extra: 500 * R, gross: 6500 * R, toPay: 4500 * R, advanceAfter: 0, due: '2026-12-01' })
    expectAddsUp(s)
  })

  it('a plain month is just the salary', () => {
    const s = sheetOf(helper(), '2026-11')
    expect(s).toMatchObject({ salary: 6000 * R, leaveCut: 0, extra: 0, bonus: 0, advanceCut: 0, toPay: 6000 * R, daysOff: 0, paid: null })
    expectAddsUp(s)
  })

  it('nothing before the first month kept, and entries dated before it count in the first month', () => {
    const h = helper({ entries: [entry('advance', '2026-10-20', 1000)] })
    expect(monthSheet(h, '2026-10')).toBeNull()
    expect(ledger(h, '2026-10')).toEqual([])
    expect(sheetOf(h, '2026-11').advanceCut).toBe(1000 * R)
  })

  it('a bonus adds on top (Diwali: one month’s salary)', () => {
    const s = sheetOf(helper({ entries: [entry('bonus', '2026-11-08', 6000)] }), '2026-11')
    expect(s).toMatchObject({ bonus: 6000 * R, toPay: 12000 * R })
    expectAddsUp(s)
  })

  it('amounts in paise stay exact', () => {
    const h = helper({ salary: 600_050, entries: [entry('advance', '2026-11-10', 0)] })
    h.entries[0]!.amount = 33_333
    const s = sheetOf(h, '2026-11')
    expect(s.toPay).toBe(600_050 - 33_333)
    expectAddsUp(s)
  })
})

describe('days off', () => {
  const days = (n: number, month = '2026-11'): HelpEntry[] => Array.from({ length: n }, (_, i) => entry('dayOff', `${month}-${String(i + 1).padStart(2, '0')}`))

  it('within the paid leave nothing is cut, whatever the setting', () => {
    for (const cutPay of [false, true]) {
      const s = sheetOf(helper({ cutPay, entries: days(2) }), '2026-11')
      expect(s).toMatchObject({ daysOff: 2, extraDaysOff: 0, leaveCut: 0, toPay: 6000 * R })
    }
  })

  it('beyond the paid leave, nothing is cut unless the family turned cutting on', () => {
    const s = sheetOf(helper({ entries: days(5) }), '2026-11')
    expect(s).toMatchObject({ daysOff: 5, extraDaysOff: 3, leaveCut: 0, toPay: 6000 * R })
  })

  it('with cutting on, each extra day costs a day’s pay for that month', () => {
    // November has 30 days: ₹6,000 ÷ 30 = ₹200 a day; 3 extra days.
    const s = sheetOf(helper({ cutPay: true, entries: days(5) }), '2026-11')
    expect(s).toMatchObject({ extraDaysOff: 3, leaveCut: 600 * R, toPay: 5400 * R })
    expectAddsUp(s)
  })

  it('a day’s pay is to the whole rupee and follows the month’s length', () => {
    expect(leaveCutFor(6500 * R, 1, '2026-12', 'INR')).toBe(210 * R) // 6500 ÷ 31 = 209.68
    expect(leaveCutFor(6500 * R, 2, '2026-12', 'INR')).toBe(419 * R) // 13000 ÷ 31 = 419.35
    expect(leaveCutFor(6000 * R, 1, '2027-02', 'INR')).toBe(214 * R) // 28 days
    expect(leaveCutFor(6000 * R, 1, '2028-02', 'INR')).toBe(207 * R) // 29 days
    expect(leaveCutFor(6000 * R, 0, '2026-11', 'INR')).toBe(0)
    expect(leaveCutFor(60000, 1, '2026-11', 'JPY')).toBe(2000)
  })

  it('a whole month off never cuts more than the salary', () => {
    expect(leaveCutFor(6000 * R, 30, '2026-11', 'INR')).toBe(6000 * R)
    expect(leaveCutFor(6000 * R, 45, '2026-11', 'INR')).toBe(6000 * R)
    const s = sheetOf(helper({ cutPay: true, paidLeave: 0, entries: days(30) }), '2026-11')
    expect(s).toMatchObject({ leaveCut: 6000 * R, toPay: 0 })
  })

  it('the same day written twice is one day off', () => {
    const s = sheetOf(helper({ cutPay: true, paidLeave: 0, entries: [entry('dayOff', '2026-11-05'), entry('dayOff', '2026-11-05')] }), '2026-11')
    expect(s).toMatchObject({ daysOff: 1, leaveCut: 200 * R })
  })

  it('paid leave is per month: days off do not pile up across months', () => {
    const h = helper({ cutPay: true, entries: [...days(2, '2026-11'), ...days(2, '2026-12')] })
    expect(sheetOf(h, '2026-11').leaveCut).toBe(0)
    expect(sheetOf(h, '2026-12').leaveCut).toBe(0)
  })
})

describe('advances', () => {
  it('an advance larger than the month’s pay carries over until it is cleared', () => {
    const h = helper({ entries: [entry('advance', '2026-11-10', 15000)] })
    const rows = ledger(h, '2027-01')
    expect(rows.map((s) => [s.period, s.advanceBefore, s.advanceCut, s.toPay, s.advanceAfter])).toEqual([
      ['2026-11', 0, 6000 * R, 0, 9000 * R],
      ['2026-12', 9000 * R, 6000 * R, 0, 3000 * R],
      ['2027-01', 3000 * R, 3000 * R, 3000 * R, 0],
    ])
    rows.forEach(expectAddsUp)
    // Every rupee of the advance comes back exactly once.
    expect(rows.reduce((a, s) => a + s.advanceCut, 0)).toBe(15000 * R)
  })

  it('an advance counts in the month it was taken', () => {
    const h = helper({ entries: [entry('advance', '2026-12-01', 1000)] })
    expect(sheetOf(h, '2026-11').advanceCut).toBe(0)
    expect(sheetOf(h, '2026-12')).toMatchObject({ advanceTaken: 1000 * R, advanceCut: 1000 * R, toPay: 5000 * R })
  })

  it('a cut chosen by hand takes less now and carries the rest', () => {
    const h = helper({ entries: [entry('advance', '2026-11-10', 10000)], cuts: { '2026-11': 2000 * R, '2026-12': 2000 * R } })
    const rows = ledger(h, '2027-03')
    expect(rows.map((s) => s.advanceCut)).toEqual([2000 * R, 2000 * R, 6000 * R, 0, 0])
    expect(rows.map((s) => s.toPay)).toEqual([4000 * R, 4000 * R, 0, 6000 * R, 6000 * R])
    rows.forEach(expectAddsUp)
  })

  it('a chosen cut is never more than what is open or what the month pays', () => {
    const open = sheetOf(helper({ entries: [entry('advance', '2026-11-10', 500)], cuts: { '2026-11': 9000 * R } }), '2026-11')
    expect(open.advanceCut).toBe(500 * R)
    const big = sheetOf(helper({ entries: [entry('advance', '2026-11-10', 20000)], cuts: { '2026-11': 9000 * R } }), '2026-11')
    expect(big).toMatchObject({ advanceCut: 6000 * R, toPay: 0, advanceAfter: 14000 * R })
    const none = sheetOf(helper({ entries: [entry('advance', '2026-11-10', 500)], cuts: { '2026-11': 0 } }), '2026-11')
    expect(none).toMatchObject({ advanceCut: 0, toPay: 6000 * R, advanceAfter: 500 * R })
  })

  it('a paid month keeps the cut it was paid with; the rest carries on from there', () => {
    let h = helper({ entries: [entry('advance', '2026-11-10', 5000)], cuts: { '2026-11': 1000 * R } })
    h = pay(h, '2026-11', '2026-12-01')
    // Changing the plan afterwards does not rewrite November.
    h = { ...h, cuts: {} }
    const [nov, dec] = ledger(h, '2026-12')
    expect(nov).toMatchObject({ advanceCut: 1000 * R, toPay: 5000 * R, advanceAfter: 4000 * R })
    expect(nov?.paid?.amount).toBe(5000 * R)
    expect(dec).toMatchObject({ advanceBefore: 4000 * R, advanceCut: 4000 * R, toPay: 2000 * R, advanceAfter: 0 })
  })

  it('a second advance while one is open adds to it', () => {
    const h = helper({ entries: [entry('advance', '2026-11-10', 8000), entry('advance', '2026-12-05', 1000)] })
    const [nov, dec] = ledger(h, '2026-12')
    expect(nov?.advanceAfter).toBe(2000 * R)
    expect(dec).toMatchObject({ advanceBefore: 2000 * R, advanceTaken: 1000 * R, advanceCut: 3000 * R, toPay: 3000 * R })
  })
})

describe('a raise', () => {
  const h = helper({ raises: [{ from: '2027-01', salary: 6500 * R }] })

  it('applies from its month; earlier months keep the old salary', () => {
    expect(salaryFor(h, '2026-12')).toBe(6000 * R)
    expect(salaryFor(h, '2027-01')).toBe(6500 * R)
    expect(salaryFor(h, '2027-06')).toBe(6500 * R)
    expect(ledger(h, '2027-02').map((s) => s.toPay)).toEqual([6000 * R, 6000 * R, 6500 * R, 6500 * R])
  })

  it('the latest raise that has started wins, whatever order they were saved in', () => {
    const two = helper({ raises: [{ from: '2027-06', salary: 7000 * R }, { from: '2027-01', salary: 6500 * R }] })
    expect(salaryFor(two, '2027-05')).toBe(6500 * R)
    expect(salaryFor(two, '2027-06')).toBe(7000 * R)
    expect(salaryFor(two, '2026-11')).toBe(6000 * R)
  })

  it('a month already paid is not changed by a raise dated back into it', () => {
    const paid = pay(helper(), '2026-11')
    const backdated = { ...paid, raises: [{ from: '2026-11', salary: 9000 * R }] }
    expect(sheetOf(backdated, '2026-11')).toMatchObject({ salary: 6000 * R, toPay: 6000 * R })
    expect(sheetOf(backdated, '2026-12').salary).toBe(9000 * R)
  })

  it('the day’s pay cut follows the salary of that month', () => {
    const cut = helper({ cutPay: true, paidLeave: 0, raises: [{ from: '2027-01', salary: 6200 * R }], entries: [entry('dayOff', '2026-12-10'), entry('dayOff', '2027-01-10')] })
    expect(sheetOf(cut, '2026-12').leaveCut).toBe(194 * R) // 6000 ÷ 31 = 193.55
    expect(sheetOf(cut, '2027-01').leaveCut).toBe(200 * R) // 6200 ÷ 31
  })
})

describe('what is due', () => {
  it('opens on the oldest month not paid, then moves on', () => {
    let h = helper()
    expect(openPeriod(h, '2026-11-15')).toBe('2026-11')
    expect(openPeriod(h, '2027-01-10')).toBe('2026-11')
    h = pay(h, '2026-11')
    expect(openPeriod(h, '2027-01-10')).toBe('2026-12')
    h = pay(pay(h, '2026-12'), '2027-01')
    // All paid, even the month being worked: stay on it.
    expect(openPeriod(h, '2027-01-10')).toBe('2027-01')
  })

  it('nothing is due before the pay day; on the day it is due; after it, late', () => {
    const h = helper({ entries: [entry('advance', '2026-11-10', 2000)] })
    expect(dueNow(h, '2026-11-30')).toBeNull()
    const onDay = dueNow(h, '2026-12-01')
    expect(onDay?.daysLate).toBe(0)
    expect(onDay?.sheet).toMatchObject({ period: '2026-11', toPay: 4000 * R, advanceCut: 2000 * R })
    expect(dueNow(h, '2026-12-04')?.daysLate).toBe(3)
  })

  it('paid means nothing is due, until the next pay day', () => {
    const h = pay(helper(), '2026-11', '2026-12-01')
    expect(dueNow(h, '2026-12-01')).toBeNull()
    expect(dueNow(h, '2026-12-20')).toBeNull()
    expect(dueNow(h, '2027-01-01')?.sheet.period).toBe('2026-12')
  })

  it('a pay day late in the month is due inside its own month', () => {
    const h = helper({ payDay: 31 })
    expect(dueNow(h, '2026-11-29')).toBeNull()
    expect(dueNow(h, '2026-11-30')?.sheet.period).toBe('2026-11')
    expect(dueNow(h, '2026-12-02')?.daysLate).toBe(2)
  })

  it('a pay day in the middle of the month looks back far enough', () => {
    const h = helper({ payDay: 10, startedOn: '2026-10-01' })
    // 5 Dec: November is not due until the 10th; October (due 10 Nov) is the one waiting.
    expect(dueNow(h, '2026-12-05')?.sheet.period).toBe('2026-10')
    expect(dueNow(h, '2026-12-10')?.sheet.period).toBe('2026-11')
  })
})

describe('flatmates’ parts', () => {
  const three = [{ friendId: 'a', parts: 1 }, { friendId: 'b', parts: 1 }, { friendId: 'c', parts: 1 }]
  const total = (shares: { amount: number }[]): number => shares.reduce((a, s) => a + s.amount, 0)

  it('one person bears it all', () => {
    expect(splitShares(450_000, [{ friendId: ME_ID, parts: 1 }])).toEqual([{ friendId: ME_ID, amount: 450_000 }])
    expect(splitShares(450_000, [])).toEqual([])
  })

  it('equal parts that divide are equal', () => {
    expect(splitShares(450_000, three).map((s) => s.amount)).toEqual([150_000, 150_000, 150_000])
  })

  it('paise that do not divide: sums to the total, nobody more than a paisa apart', () => {
    for (const amount of [500_000, 100, 1, 2, 999_999, 0]) {
      for (let turn = 0; turn < 6; turn += 1) {
        const shares = splitShares(amount, three, turn)
        expect(total(shares)).toBe(amount)
        const amounts = shares.map((s) => s.amount)
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the odd paise go round: a different person each month, not always the first', () => {
    // ₹5,000 between three: 1666.66 each and two odd paise.
    expect(splitShares(500_000, three, 0).map((s) => s.amount)).toEqual([166_667, 166_667, 166_666])
    expect(splitShares(500_000, three, 1).map((s) => s.amount)).toEqual([166_666, 166_667, 166_667])
    expect(splitShares(500_000, three, 2).map((s) => s.amount)).toEqual([166_667, 166_666, 166_667])
    expect(turnOf('2026-12') - turnOf('2026-11')).toBe(1)
    expect(turnOf('2027-01') - turnOf('2026-12')).toBe(1)
    // Over three months each has paid the same.
    const sums = [0, 0, 0]
    for (const period of ['2026-11', '2026-12', '2027-01']) splitShares(500_000, three, turnOf(period)).forEach((s, i) => (sums[i] = (sums[i] ?? 0) + s.amount))
    expect(new Set(sums).size).toBe(1)
  })

  it('in parts: 2 parts pays twice 1 part, to the paisa', () => {
    const parts = [{ friendId: 'a', parts: 2 }, { friendId: 'b', parts: 1 }, { friendId: 'c', parts: 1 }]
    expect(splitShares(600_000, parts).map((s) => s.amount)).toEqual([300_000, 150_000, 150_000])
    for (let turn = 0; turn < 4; turn += 1) {
      const odd = splitShares(500_001, parts, turn)
      expect(total(odd)).toBe(500_001)
      // The two people with one part each are never more than a paisa apart.
      expect(Math.abs((odd[1]?.amount ?? 0) - (odd[2]?.amount ?? 0))).toBeLessThanOrEqual(1)
    }
  })

  it('junk parts count as one part', () => {
    const shares = splitShares(300, [{ friendId: 'a', parts: 0 }, { friendId: 'b', parts: Number.NaN }, { friendId: 'c', parts: -4 }])
    expect(shares.map((s) => s.amount)).toEqual([100, 100, 100])
  })
})

describe('the year', () => {
  it('paid each month, bonus given, advance still open', () => {
    let h = helper({
      startedOn: '2026-10-20',
      entries: [entry('bonus', '2026-11-08', 6000), entry('advance', '2026-12-10', 9000), entry('extra', '2026-10-25', 300)],
    })
    h = pay(h, '2026-10', '2026-11-01')
    h = pay(h, '2026-11', '2026-12-01')
    const y = yearView(h, 2026, '2026-12-20')
    expect(y.rows.map((r) => r.period)).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(y).toMatchObject({ paid: (6300 + 12000) * R, monthsPaid: 2, bonus: 6000 * R, advanceTaken: 9000 * R, advanceOpen: 3000 * R })
    // The paid total is exactly the sum of the months’ payments.
    expect(y.paid).toBe(h.payments.reduce((a, p) => a + p.amount, 0))
  })

  it('a year with nothing kept is empty; next year starts where this one left the advance', () => {
    const h = helper({ entries: [entry('advance', '2026-12-10', 9000)] })
    expect(yearView(h, 2025, '2027-02-10')).toMatchObject({ rows: [], paid: 0, advanceOpen: 0 })
    const next = yearView(h, 2027, '2027-02-10')
    expect(next.rows.map((r) => r.period)).toEqual(['2027-01', '2027-02'])
    expect(next.rows[0]?.sheet.advanceBefore).toBe(3000 * R)
    expect(next.advanceOpen).toBe(0)
  })

  it('ten years of months stay exact', () => {
    const entries: HelpEntry[] = []
    for (let i = 0; i < 120; i += 1) entries.push(entry('advance', `${2027 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-10`, 1000))
    const rows = ledger(helper({ entries }), '2036-12')
    expect(rows).toHaveLength(122)
    rows.forEach(expectAddsUp)
    expect(rows.reduce((a, s) => a + s.advanceCut, 0)).toBe(120 * 1000 * R)
  })
})
