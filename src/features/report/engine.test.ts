import { describe, expect, it } from 'vitest'
import type { Expense, Group } from '../../domain/types'
import { buildReport, claimableGroups, defaultScope, monthRange, reportCandidates, reportPeriod, rupeesInWords, summarize, type ReportScope } from './engine'
import { reportCsv } from './reportCsv'

const NAMES: Record<string, string> = { me: 'Ayush Kumar', riya: 'Riya', sam: 'Sam' }
const nameOf = (id: string): string => NAMES[id] ?? 'Someone'

let n = 0
function expense(title: string, total: number, date: string, payerId: string, ids: string[], more: Partial<Expense> = {}): Expense {
  n++
  const each = Math.floor(total / ids.length)
  const shares = Object.fromEntries(ids.map((id, i) => [id, i === 0 ? total - each * (ids.length - 1) : each]))
  return {
    id: `e${n}`,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total,
    date,
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'equal',
    participants: ids.map((friendId) => ({ friendId, input: null })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'pune',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const group = (id: string, name: string, more: Partial<Group> = {}): Group => ({
  id,
  name,
  emoji: '🧳',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  settlements: [],
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  ...more,
})
const PUNE: ReportScope = { kind: 'group', groupId: 'pune' }

describe('reportCandidates', () => {
  const hotel = expense('Hotel', 600_000, '2026-11-03', 'me', ['me', 'riya', 'sam'], { category: 'travel' })
  const cab = expense('Cab to client', 90_000, '2026-11-02', 'riya', ['me', 'riya', 'sam'], { category: 'transport' })
  const lunch = expense('Lunch', 45_000, '2026-11-03', 'me', ['me', 'riya', 'sam'])
  const loan = expense('Cash to Sam', 50_000, '2026-11-03', 'me', ['sam'], { kind: 'loan' })
  const elsewhere = expense('Goa dinner', 80_000, '2026-11-03', 'me', ['me', 'riya'], { groupId: 'goa' })
  const all = [hotel, cab, lunch, loan, elsewhere]

  it('what I paid: the full amount of what I paid for, sorted by date then title, loans never', () => {
    const rows = reportCandidates({ expenses: all, scope: PUNE, basis: 'paid', nameOf })
    expect(rows.map((r) => [r.date, r.title, r.amount, r.paidBy])).toEqual([
      ['2026-11-03', 'Hotel', 600_000, 'Ayush Kumar'],
      ['2026-11-03', 'Lunch', 45_000, 'Ayush Kumar'],
    ])
  })

  it('my share: my part of each, whoever paid', () => {
    const rows = reportCandidates({ expenses: all, scope: PUNE, basis: 'share', nameOf })
    expect(rows.map((r) => [r.title, r.amount, r.paidBy, r.categoryLabel])).toEqual([
      ['Cab to client', 30_000, 'Riya', 'Transport'],
      ['Hotel', 200_000, 'Ayush Kumar', 'Travel & stays'],
      ['Lunch', 15_000, 'Ayush Kumar', 'Food & drinks'],
    ])
  })

  it('a date range takes every expense in it, any group or none, both ends included', () => {
    const solo = expense('Coffee', 25_000, '2026-11-01', 'me', ['me'], { groupId: null })
    const late = expense('Late', 10_000, '2026-12-01', 'me', ['me'], { groupId: null })
    const rows = reportCandidates({ expenses: [...all, solo, late], scope: { kind: 'dates', ...monthRange('2026-11-14') }, basis: 'paid', nameOf })
    expect(rows.map((r) => r.title)).toEqual(['Coffee', 'Goa dinner', 'Hotel', 'Lunch'])
    // Backwards dates still work.
    const flipped = reportCandidates({ expenses: [solo], scope: { kind: 'dates', from: '2026-11-30', to: '2026-11-01' }, basis: 'paid', nameOf })
    expect(flipped).toHaveLength(1)
  })

  it('marks rows that have a bill to attach', () => {
    const scanned = expense('Train', 120_000, '2026-11-04', 'me', ['me'], { source: 'scan' })
    const rows = reportCandidates({ expenses: [scanned, lunch], scope: PUNE, basis: 'paid', nameOf })
    expect(rows.map((r) => [r.title, r.hasBill])).toEqual([
      ['Lunch', false],
      ['Train', true],
    ])
  })
})

describe('buildReport', () => {
  it('totals per category (biggest first) and per currency, with the rupees in words', () => {
    const report = buildReport({
      expenses: [
        expense('Hotel', 600_000, '2026-11-03', 'me', ['me'], { category: 'travel' }),
        expense('Lunch', 45_050, '2026-11-03', 'me', ['me']),
        expense('Dinner', 30_000, '2026-11-04', 'me', ['me']),
      ],
      scope: PUNE,
      basis: 'paid',
      nameOf,
    })
    expect(report.categories.map((c) => [c.label, c.amount, c.count])).toEqual([
      ['Travel & stays', 600_000, 1],
      ['Food & drinks', 75_050, 2],
    ])
    expect(report.totals).toEqual([{ currency: 'INR', amount: 675_050, count: 3 }])
    expect(report.words).toBe('Six thousand seven hundred fifty rupees and fifty paise')
  })

  it('leaves out what is unticked', () => {
    const a = expense('A', 10_000, '2026-11-01', 'me', ['me'])
    const b = expense('B', 20_000, '2026-11-02', 'me', ['me'])
    const report = buildReport({ expenses: [a, b], scope: PUNE, basis: 'paid', nameOf, skipped: new Set([a.id]) })
    expect(report.rows.map((r) => r.title)).toEqual(['B'])
    expect(report.totals[0]?.amount).toBe(20_000)
  })

  it('switching the basis changes every amount', () => {
    const e = [expense('Dinner', 100_000, '2026-11-01', 'me', ['me', 'riya', 'sam'])]
    expect(buildReport({ expenses: e, scope: PUNE, basis: 'paid', nameOf }).totals[0]?.amount).toBe(100_000)
    expect(buildReport({ expenses: e, scope: PUNE, basis: 'share', nameOf }).totals[0]?.amount).toBe(33_334)
  })

  it('a trip abroad keeps the amount paid and the rate; my share of it is the same part of the foreign amount', () => {
    const fx = { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-11-02', source: 'ecb' as const }
    const e = expense('Dinner in Bangkok', 301_344, '2026-11-02', 'me', ['me', 'riya'], { fx })
    const paid = buildReport({ expenses: [e], scope: PUNE, basis: 'paid', nameOf })
    expect(paid.rows[0]?.original).toEqual({ amount: 125_000, bill: 125_000, whole: true, currency: 'THB', rate: '2.410751226', rateShown: '2.4108' })
    const share = buildReport({ expenses: [e], scope: PUNE, basis: 'share', nameOf })
    // My share keeps the whole bill too, so the sheet never makes the receipt look smaller than it was.
    expect(share.rows[0]).toMatchObject({ amount: 150_672, currency: 'INR', original: { amount: 62_500, bill: 125_000, whole: false, currency: 'THB' } })
  })

  it('the rate is shown with 4 decimals at most, like the expense page', () => {
    const fx = { amount: 2_000, currency: 'USD', rate: '94.24312342', rateDate: '2026-11-02', source: 'ecb' as const }
    const e = expense('Zoom', 188_486, '2026-11-02', 'me', ['me', 'riya', 'sam'], { fx })
    expect(buildReport({ expenses: [e], scope: PUNE, basis: 'share', nameOf }).rows[0]?.original).toMatchObject({
      amount: 667,
      bill: 2_000,
      whole: false,
      rate: '94.24312342',
      rateShown: '94.2431',
    })
  })

  it('a group in dollars totals in dollars, rupees listed first, words only for rupees', () => {
    const report = buildReport({
      expenses: [expense('Taxi', 4_500, '2026-11-01', 'me', ['me'], { currency: 'USD' }), expense('Chai', 2_000, '2026-11-02', 'me', ['me'])],
      scope: PUNE,
      basis: 'paid',
      nameOf,
    })
    expect(report.totals.map((t) => [t.currency, t.amount])).toEqual([
      ['INR', 2_000],
      ['USD', 4_500],
    ])
    expect(report.words).toBe('Twenty rupees')
    const dollarsOnly = buildReport({ expenses: [expense('Taxi', 4_500, '2026-11-01', 'me', ['me'], { currency: 'USD' })], scope: PUNE, basis: 'paid', nameOf })
    expect(dollarsOnly.words).toBeNull()
  })

  it('empty data makes an empty report', () => {
    expect(summarize([])).toEqual({ rows: [], categories: [], totals: [], words: null })
  })

  it('a huge list adds up to the paisa', () => {
    const many = Array.from({ length: 2_000 }, (_, i) => expense(`Item ${i}`, 1_001 + i, '2026-11-01', 'me', ['me', 'riya', 'sam']))
    const report = buildReport({ expenses: many, scope: PUNE, basis: 'share', nameOf })
    const sum = many.reduce((s, e) => s + (e.shares.me ?? 0), 0)
    expect(report.totals[0]?.amount).toBe(sum)
    expect(report.categories[0]?.amount).toBe(sum)
  })
})

describe('reportPeriod', () => {
  it('runs from the first to the last expense on the sheet, whatever the order', () => {
    expect(reportPeriod([{ date: '2026-11-14' }, { date: '2026-11-12' }, { date: '2026-11-13' }])).toEqual({ from: '2026-11-12', to: '2026-11-14' })
    expect(reportPeriod([{ date: '2026-11-12' }])).toEqual({ from: '2026-11-12', to: '2026-11-12' })
    expect(reportPeriod([])).toBeNull()
  })
})

describe('rupeesInWords', () => {
  it('reads rupees and paise on the Indian system', () => {
    expect(rupeesInWords(1)).toBe('One paisa')
    expect(rupeesInWords(100)).toBe('One rupee')
    expect(rupeesInWords(24_000_000)).toBe('Two lakh forty thousand rupees')
    expect(rupeesInWords(0)).toBeNull()
    expect(rupeesInWords(-5)).toBeNull()
  })
})

describe('defaultScope and claimableGroups', () => {
  const groups = [group('pune', 'Pune visit'), group('goa', 'Goa offsite'), group('flat', 'Flat')]
  it('starts on the group with the latest claimable expense; else this month', () => {
    const expenses = [expense('A', 1_000, '2026-11-01', 'me', ['me']), expense('B', 1_000, '2026-11-05', 'riya', ['riya', 'me'], { groupId: 'goa' })]
    expect(defaultScope(groups, expenses, '2026-11-14')).toEqual({ kind: 'group', groupId: 'goa' })
    expect(claimableGroups(groups, expenses).map((g) => g.id)).toEqual(['goa', 'pune'])
    expect(defaultScope(groups, [], '2026-02-14')).toEqual({ kind: 'dates', from: '2026-02-01', to: '2026-02-28' })
  })

  it('a group with only loans, or only other people’s spending, is not claimable', () => {
    const expenses = [
      expense('Loan', 1_000, '2026-11-09', 'me', ['riya'], { kind: 'loan', groupId: 'flat' }),
      expense('Theirs', 1_000, '2026-11-09', 'riya', ['riya', 'sam'], { groupId: 'goa' }),
    ]
    expect(claimableGroups(groups, expenses)).toEqual([])
  })

  it('ties on the date go by name', () => {
    const expenses = [expense('A', 1_000, '2026-11-01', 'me', ['me']), expense('B', 1_000, '2026-11-01', 'me', ['me'], { groupId: 'goa' })]
    expect(defaultScope(groups, expenses, '2026-11-14')).toEqual({ kind: 'group', groupId: 'goa' })
  })
})

describe('reportCsv', () => {
  it('a header, one row per expense with the fx columns, then a total per currency', () => {
    const fx = { amount: 125_000, currency: 'THB', rate: '2.41', rateDate: null, source: 'manual_rate' as const }
    const report = buildReport({
      expenses: [expense('Dinner, Bangkok', 301_250, '2026-11-02', 'me', ['me'], { fx }), expense('=SUM(A1)', 5_000, '2026-11-03', 'me', ['me'])],
      scope: PUNE,
      basis: 'paid',
      nameOf,
    })
    expect(reportCsv(report).split('\r\n')).toEqual([
      'Date,Title,Category,Paid by,Amount,Currency,Bill amount,Bill currency,Rate,Share of bill',
      '2026-11-02,"Dinner, Bangkok",Food & drinks,Ayush Kumar,3012.50,INR,1250.00,THB,2.41,',
      "2026-11-03,'=SUM(A1),Food & drinks,Ayush Kumar,50.00,INR,,,,",
      ',Total,,,3062.50,INR,,,,',
      '',
    ])
  })

  it('my share of a bill abroad: the whole bill as on the receipt, the share in its own column, the rate to 4 decimals', () => {
    const fx = { amount: 2_000, currency: 'USD', rate: '94.24312342', rateDate: '2026-11-02', source: 'ecb' as const }
    const report = buildReport({ expenses: [expense('Zoom', 188_486, '2026-11-02', 'me', ['me', 'riya', 'sam'], { fx })], scope: PUNE, basis: 'share', nameOf })
    expect(reportCsv(report).split('\r\n')[1]).toBe('2026-11-02,Zoom,Food & drinks,Ayush Kumar,628.30,INR,20.00,USD,94.2431,6.67')
  })

  it('a tiny rate keeps its digits in the spreadsheet', () => {
    const fx = { amount: 10_000_000, currency: 'IDR', rate: '0.005316', rateDate: null, source: 'manual_rate' as const }
    const report = buildReport({ expenses: [expense('Warung', 53_160, '2026-11-02', 'me', ['me'], { fx })], scope: PUNE, basis: 'paid', nameOf })
    expect(reportCsv(report).split('\r\n')[1]).toContain(',IDR,0.005316,')
  })
})
