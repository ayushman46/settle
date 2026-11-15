import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import {
  cleanSettleDay,
  icsEscape,
  icsFold,
  isSquare,
  lastSettleDate,
  nextSettleDate,
  openPayments,
  ordinalSuffix,
  orderPayments,
  settleDateIn,
  settleDayIcs,
  settleDayRule,
  settleDayStatus,
  summarizeOpen,
} from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha', zed: 'Zed' }
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
function expense(total: number, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id: `e${n}`,
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total,
    date: '2026-11-10',
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.entries(shares).map(([friendId, input]) => ({ friendId, input })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'flat',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const paid = (fromId: string, toId: string, amount: number): Settlement => ({ id: `s${++n}`, fromId, toId, amount, date: '2026-11-12', createdAt: n, method: 'upi' })
const group = (settlements: Settlement[] = [], memberIds = ['me', 'riya', 'sam']): Group => ({
  id: 'flat',
  name: 'Flat 4B',
  emoji: '🏠',
  kind: 'home',
  currency: 'INR',
  memberIds,
  settlements,
  createdAt: 1,
  updatedAt: 1,
  archived: false,
})

describe('the day itself', () => {
  it('accepts 1 to 28 and “last”, nothing else', () => {
    expect(cleanSettleDay(1)).toBe(1)
    expect(cleanSettleDay(28)).toBe(28)
    expect(cleanSettleDay('last')).toBe('last')
    for (const junk of [0, 29, 31, -1, 5.5, '5', 'first', null, undefined, NaN, {}]) expect(cleanSettleDay(junk)).toBeNull()
  })

  it('ends ordinals the English way', () => {
    const said = (d: number) => `${d}${ordinalSuffix(d)}`
    expect([1, 2, 3, 4, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 28].map(said)).toEqual([
      '1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '14th', '20th', '21st', '22nd', '23rd', '24th', '28th',
    ])
  })

  it('“last” is the 28th, 29th, 30th or 31st, as the month has it', () => {
    expect(settleDateIn('2026-02', 'last')).toBe('2026-02-28')
    expect(settleDateIn('2028-02', 'last')).toBe('2028-02-29') // leap year
    expect(settleDateIn('2100-02', 'last')).toBe('2100-02-28') // a century that isn't one
    expect(settleDateIn('2026-04', 'last')).toBe('2026-04-30')
    expect(settleDateIn('2026-12', 'last')).toBe('2026-12-31')
    expect(settleDateIn('2026-02', 28)).toBe('2026-02-28')
    expect(settleDateIn('2026-11', 5)).toBe('2026-11-05')
  })
})

describe('the next and the last settle date', () => {
  it('is today on the day, this month before it, next month after it', () => {
    expect(nextSettleDate(5, '2026-11-05')).toBe('2026-11-05')
    expect(nextSettleDate(5, '2026-11-01')).toBe('2026-11-05')
    expect(nextSettleDate(5, '2026-11-06')).toBe('2026-12-05')
    expect(lastSettleDate(5, '2026-11-05')).toBe('2026-11-05')
    expect(lastSettleDate(5, '2026-11-06')).toBe('2026-11-05')
    expect(lastSettleDate(5, '2026-11-04')).toBe('2026-10-05')
  })

  it('rolls over the year end both ways', () => {
    expect(nextSettleDate(5, '2026-12-06')).toBe('2027-01-05')
    expect(lastSettleDate(5, '2027-01-04')).toBe('2026-12-05')
    expect(nextSettleDate('last', '2026-12-31')).toBe('2026-12-31')
    expect(nextSettleDate('last', '2027-01-01')).toBe('2027-01-31')
    expect(lastSettleDate('last', '2027-01-01')).toBe('2026-12-31')
  })

  it('follows “last” through short and long months and a leap day', () => {
    expect(nextSettleDate('last', '2026-01-31')).toBe('2026-01-31')
    expect(nextSettleDate('last', '2026-02-01')).toBe('2026-02-28')
    expect(nextSettleDate('last', '2026-02-28')).toBe('2026-02-28')
    expect(nextSettleDate('last', '2026-03-01')).toBe('2026-03-31')
    expect(nextSettleDate('last', '2028-02-28')).toBe('2028-02-29')
    expect(nextSettleDate('last', '2028-02-29')).toBe('2028-02-29')
    expect(lastSettleDate('last', '2028-03-01')).toBe('2028-02-29')
    expect(lastSettleDate('last', '2026-03-30')).toBe('2026-02-28')
  })

  it('hands back a date it cannot read', () => {
    expect(nextSettleDate(5, 'soon')).toBe('soon')
    expect(lastSettleDate(5, '2026-02-30')).toBe('2026-02-30')
  })
})

describe('where today stands', () => {
  it('counts down to the day', () => {
    expect(settleDayStatus(5, '2026-11-26', { open: true })).toEqual({ phase: 'waiting', date: '2026-12-05', next: '2026-12-05', daysToGo: 9 })
    expect(settleDayStatus(5, '2026-12-04', { open: true })).toMatchObject({ phase: 'waiting', daysToGo: 1 })
    expect(settleDayStatus('last', '2026-02-20', { open: false })).toMatchObject({ phase: 'waiting', date: '2026-02-28', daysToGo: 8 })
    expect(settleDayStatus('last', '2028-02-20', { open: false })).toMatchObject({ date: '2028-02-29', daysToGo: 9 })
  })

  it('is settle day on the day, whether or not anything is open', () => {
    expect(settleDayStatus(5, '2026-12-05', { open: true })).toEqual({ phase: 'today', date: '2026-12-05', next: '2026-12-05', daysToGo: 0 })
    expect(settleDayStatus(5, '2026-12-05', { open: false })).toMatchObject({ phase: 'today' })
    expect(settleDayStatus('last', '2026-04-30', { open: true })).toMatchObject({ phase: 'today', date: '2026-04-30' })
  })

  it('carries over to the day after only while money is open, and no further', () => {
    expect(settleDayStatus(5, '2026-12-06', { open: true })).toEqual({ phase: 'yesterday', date: '2026-12-05', next: '2027-01-05', daysToGo: 30 })
    expect(settleDayStatus(5, '2026-12-06', { open: false })).toMatchObject({ phase: 'waiting', date: '2027-01-05' })
    expect(settleDayStatus(5, '2026-12-07', { open: true })).toMatchObject({ phase: 'waiting', date: '2027-01-05', daysToGo: 29 })
  })

  it('the day after a month end is the 1st, and the day after 31 Dec is 1 Jan', () => {
    expect(settleDayStatus('last', '2026-03-01', { open: true })).toMatchObject({ phase: 'yesterday', date: '2026-02-28', next: '2026-03-31' })
    expect(settleDayStatus('last', '2028-03-01', { open: true })).toMatchObject({ phase: 'yesterday', date: '2028-02-29' })
    expect(settleDayStatus('last', '2027-01-01', { open: true })).toMatchObject({ phase: 'yesterday', date: '2026-12-31', next: '2027-01-31', daysToGo: 30 })
    // When the settle day is the 1st, the last day of the month is not "the day after".
    expect(settleDayStatus(1, '2026-11-30', { open: true })).toMatchObject({ phase: 'waiting', date: '2026-12-01', daysToGo: 1 })
  })

  it('a day picked after it had passed is not shown as missed', () => {
    // Picked on the 6th: yesterday (the 5th) was never this group's settle day.
    expect(settleDayStatus(5, '2026-12-06', { open: true, setOn: '2026-12-06' })).toMatchObject({ phase: 'waiting', date: '2027-01-05' })
    // Picked on the day itself, or earlier: it counts.
    expect(settleDayStatus(5, '2026-12-06', { open: true, setOn: '2026-12-05' })).toMatchObject({ phase: 'yesterday' })
    expect(settleDayStatus(5, '2026-12-06', { open: true, setOn: '2026-10-01' })).toMatchObject({ phase: 'yesterday' })
    expect(settleDayStatus(5, '2026-12-06', { open: true, setOn: null })).toMatchObject({ phase: 'yesterday' })
    // Picked today for today: it is settle day.
    expect(settleDayStatus(6, '2026-12-06', { open: true, setOn: '2026-12-06' })).toMatchObject({ phase: 'today' })
  })
})

describe('what counts as open, and as square', () => {
  it('an empty group is square, with nothing to pay', () => {
    expect(isSquare(group(), [])).toBe(true)
    expect(openPayments(group(), [], 'me', nameOf)).toEqual([])
    expect(summarizeOpen([], 'me')).toEqual({ count: 0, total: 0, youPay: 0, youPayCount: 0, youGet: 0 })
  })

  it('a group of one is always square', () => {
    const solo = group([], ['me'])
    expect(isSquare(solo, [expense(50_000, 'me', { me: 50_000 })])).toBe(true)
  })

  it('lists the app’s own fewest payments: yours to pay first, then yours to get, then the rest', () => {
    // Riya paid ₹900 for three; Sam paid ₹300 for Sam and Neha.
    const g = group([], ['me', 'riya', 'sam', 'neha'])
    const expenses = [expense(90_000, 'riya', { me: 30_000, riya: 30_000, sam: 30_000 }), expense(30_000, 'sam', { sam: 15_000, neha: 15_000 }), expense(20_000, 'me', { me: 10_000, neha: 10_000 })]
    // Balances: riya +600, me −300 +100 = −200, sam −300 +150 = −150, neha −250.
    expect(groupBalances(g, expenses)).toEqual({ me: -20_000, riya: 60_000, sam: -15_000, neha: -25_000 })
    const open = openPayments(g, expenses, 'me', nameOf)
    expect(open).toEqual([
      { fromId: 'me', toId: 'riya', amount: 20_000 },
      { fromId: 'neha', toId: 'riya', amount: 25_000 },
      { fromId: 'sam', toId: 'riya', amount: 15_000 },
    ])
    expect(open.reduce((sum, p) => sum + p.amount, 0)).toBe(60_000)
    expect(summarizeOpen(open, 'me')).toEqual({ count: 3, total: 60_000, youPay: 20_000, youPayCount: 1, youGet: 0 })
    expect(summarizeOpen(open, 'riya')).toMatchObject({ youPay: 0, youGet: 60_000 })
    expect(summarizeOpen(open, 'zed')).toMatchObject({ youPay: 0, youGet: 0, count: 3 })
    expect(isSquare(g, expenses)).toBe(false)
  })

  it('is square once the recorded payments add up to the paisa, and not a paisa before', () => {
    // ₹100 between three: 3,334 + 3,333 + 3,333 paise.
    const expenses = [expense(10_000, 'me', { me: 3_334, riya: 3_333, sam: 3_333 })]
    expect(isSquare(group([paid('riya', 'me', 3_333)]), expenses)).toBe(false)
    expect(isSquare(group([paid('riya', 'me', 3_333), paid('sam', 'me', 3_332)]), expenses)).toBe(false)
    expect(openPayments(group([paid('riya', 'me', 3_333), paid('sam', 'me', 3_332)]), expenses, 'me', nameOf)).toEqual([{ fromId: 'sam', toId: 'me', amount: 1 }])
    expect(isSquare(group([paid('riya', 'me', 3_333), paid('sam', 'me', 3_333)]), expenses)).toBe(true)
  })

  it('money lent in the group is owed too; money in another currency is not the group’s', () => {
    const loan = expense(50_000, 'me', { riya: 50_000 }, { kind: 'loan' })
    expect(openPayments(group(), [loan], 'me', nameOf)).toEqual([{ fromId: 'riya', toId: 'me', amount: 50_000 }])
    const dollars = expense(9_000, 'me', { me: 4_500, riya: 4_500 }, { currency: 'USD' })
    expect(isSquare(group(), [dollars])).toBe(true)
    const elsewhere = expense(9_000, 'me', { me: 4_500, riya: 4_500 }, { groupId: 'goa' })
    expect(isSquare(group(), [elsewhere])).toBe(true)
  })

  it('someone who left the group but still owes stays on the list', () => {
    const g = group([], ['me', 'riya'])
    const expenses = [expense(60_000, 'me', { me: 20_000, riya: 20_000, sam: 20_000 })]
    expect(openPayments(g, expenses, 'me', nameOf).map((p) => p.fromId).sort()).toEqual(['riya', 'sam'])
  })

  it('orders equal payments by name, so every phone shows the same list whatever the ids are', () => {
    const transfers = [
      { fromId: 'id-9', toId: 'x', amount: 500 },
      { fromId: 'id-1', toId: 'x', amount: 500 },
      { fromId: 'id-5', toId: 'x', amount: 900 },
    ]
    const names: Record<string, string> = { 'id-9': 'Asha', 'id-1': 'Zoya', 'id-5': 'Meera', x: 'Riya' }
    expect(orderPayments(transfers, 'me', (id) => names[id] ?? id).map((p) => names[p.fromId])).toEqual(['Meera', 'Asha', 'Zoya'])
    // Same names: still a fixed order.
    expect(orderPayments(transfers, 'me', () => 'Same').map((p) => p.fromId)).toEqual(['id-5', 'id-1', 'id-9'])
  })

  it('handles a large group without losing a paisa', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `p${i}`)
    const shares = Object.fromEntries(ids.map((id, i) => [id, 1_000 + i]))
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    const g = group([], ids)
    const open = openPayments(g, [expense(total, 'p0', shares)], 'p0', nameOf)
    expect(open).toHaveLength(59)
    expect(summarizeOpen(open, 'p0').youGet).toBe(total - 1_000)
  })
})

describe('the calendar file', () => {
  const input = {
    day: 5 as const,
    today: '2026-11-15',
    now: new Date(Date.UTC(2026, 10, 15, 9, 30, 7)),
    uid: 'settle-day-flat@settle',
    summary: 'Settle day: Flat 4B',
    description: 'Clear what everyone owes in Flat 4B. Open Settle to see who pays whom.',
  }

  it('is one all-day entry on the next settle date, repeating every month', () => {
    expect(settleDayIcs(input)).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Settle//Settle Day//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:settle-day-flat@settle',
        'DTSTAMP:20261115T093007Z',
        'DTSTART;VALUE=DATE:20261205',
        'DTEND;VALUE=DATE:20261206',
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=5',
        'SUMMARY:Settle day: Flat 4B',
        'DESCRIPTION:Clear what everyone owes in Flat 4B. Open Settle to see who pay',
        ' s whom.',
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Settle day: Flat 4B',
        'TRIGGER:PT9H',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
    )
  })

  it('starts today when today is the day', () => {
    const text = settleDayIcs({ ...input, today: '2026-12-05' })
    expect(text).toContain('DTSTART;VALUE=DATE:20261205\r\n')
    expect(text).toContain('DTEND;VALUE=DATE:20261206\r\n')
  })

  it('“last day” repeats on the last day of every month, and ends on the 1st', () => {
    expect(settleDayRule('last')).toBe('FREQ=MONTHLY;BYMONTHDAY=-1')
    expect(settleDayRule(28)).toBe('FREQ=MONTHLY;BYMONTHDAY=28')
    const nov = settleDayIcs({ ...input, day: 'last' })
    expect(nov).toContain('DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1\r\n')
    const dec = settleDayIcs({ ...input, day: 'last', today: '2026-12-10' })
    expect(dec).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n')
    const leap = settleDayIcs({ ...input, day: 'last', today: '2028-02-01' })
    expect(leap).toContain('DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301\r\n')
  })

  it('every line ends CRLF and none is longer than 75 bytes', () => {
    const text = settleDayIcs({ ...input, summary: 'Settle day: ' + 'घर का खर्चा 🏠 '.repeat(12), description: 'x'.repeat(400) })
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // Unfolding gives the text back, whole characters and all.
    expect(text.replace(/\r\n /g, '')).toContain('SUMMARY:Settle day: ' + 'घर का खर्चा 🏠 '.repeat(12))
  })

  it('escapes what a calendar would misread', () => {
    expect(icsEscape('Rent, bills; and\\or food\nline two')).toBe('Rent\\, bills\\; and\\\\or food\\nline two')
    expect(icsEscape('a\r\nb')).toBe('a\\nb')
    const text = settleDayIcs({ ...input, summary: 'Settle day: Goa, 2026; boys' })
    expect(text).toContain('SUMMARY:Settle day: Goa\\, 2026\\; boys\r\n')
  })

  it('folds exactly at 75 bytes, with a space starting each continuation', () => {
    expect(icsFold('a'.repeat(75))).toBe('a'.repeat(75))
    expect(icsFold('a'.repeat(76))).toBe(`${'a'.repeat(75)}\r\n a`)
    expect(icsFold('a'.repeat(75 + 74 + 1))).toBe(`${'a'.repeat(75)}\r\n ${'a'.repeat(74)}\r\n a`)
    // ₹ is three bytes: it moves whole to the next line.
    expect(icsFold(`${'a'.repeat(74)}₹`)).toBe(`${'a'.repeat(74)}\r\n ₹`)
  })

  it('keeps the id safe and the stamp sane', () => {
    const text = settleDayIcs({ ...input, uid: 'settle day/één\r\nX:1@settle', now: new Date(NaN) })
    expect(text).toContain('UID:settle-day---n--X-1@settle\r\n')
    expect(text).toContain('DTSTAMP:19700101T000000Z\r\n')
  })
})
