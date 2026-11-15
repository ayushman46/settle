import { describe, expect, it } from 'vitest'
import type { Friend } from '../../domain/types'
import {
  askAfter,
  askList,
  askToday,
  bestAsk,
  isPayday,
  isWeekend,
  lastPayday,
  nextPayday,
  paydayDue,
  paydayIn,
  paydayKey,
  paydayWindow,
  weekday,
  workingDayOnOrAfter,
  workingDayOnOrBefore,
  type Payday,
} from './engine'

const friend = (id: string, name: string, upiId: string | null = null): Friend => ({ id, name, color: 0, upiId, phone: null, createdAt: 0, lastUsedAt: 0 })
const people = (...list: Friend[]): Record<string, Friend> => Object.fromEntries(list.map((f) => [f.id, f]))

describe('a payday', () => {
  it('is a day from 1 to 31, the last day or the last working day: nothing else', () => {
    for (const ok of [1, 15, 31, 'last', 'lastWorking']) expect(isPayday(ok)).toBe(true)
    for (const bad of [0, 32, -1, 1.5, Number.NaN, '7', 'first', null, undefined, {}, []]) expect(isPayday(bad)).toBe(false)
    expect(paydayKey(7)).toBe('7')
    expect(paydayKey('last')).toBe('last')
  })
})

describe('weekdays', () => {
  it('knows Saturday and Sunday', () => {
    expect(weekday('2026-11-15')).toBe(0) // Sunday
    expect(weekday('2026-10-31')).toBe(6) // Saturday
    expect(isWeekend('2026-10-31')).toBe(true)
    expect(isWeekend('2026-11-01')).toBe(true)
    expect(isWeekend('2026-11-02')).toBe(false)
    expect(weekday('not a date')).toBe(-1)
    expect(isWeekend('not a date')).toBe(false)
  })

  it('steps back to Friday or on to Monday from a weekend, and stays put on a weekday', () => {
    expect(workingDayOnOrBefore('2026-10-31')).toBe('2026-10-30') // Sat → Fri
    expect(workingDayOnOrBefore('2026-11-01')).toBe('2026-10-30') // Sun → Fri, across the month
    expect(workingDayOnOrBefore('2026-11-02')).toBe('2026-11-02')
    expect(workingDayOnOrAfter('2026-10-31')).toBe('2026-11-02') // Sat → Mon, across the month
    expect(workingDayOnOrAfter('2026-11-01')).toBe('2026-11-02')
    expect(workingDayOnOrAfter('2026-11-03')).toBe('2026-11-03')
  })
})

describe('paydayIn', () => {
  it('is that day of the month', () => {
    expect(paydayIn(1, '2026-11')).toBe('2026-11-01')
    expect(paydayIn(7, '2026-11')).toBe('2026-11-07')
    expect(paydayIn(28, '2026-02')).toBe('2026-02-28')
  })

  it('the 31st means the last day in a shorter month', () => {
    expect(paydayIn(31, '2026-10')).toBe('2026-10-31')
    expect(paydayIn(31, '2026-11')).toBe('2026-11-30')
    expect(paydayIn(31, '2026-02')).toBe('2026-02-28')
    expect(paydayIn(31, '2028-02')).toBe('2028-02-29') // leap year
    expect(paydayIn(30, '2026-02')).toBe('2026-02-28')
    expect(paydayIn(29, '2026-02')).toBe('2026-02-28')
    expect(paydayIn(29, '2028-02')).toBe('2028-02-29')
    expect(paydayIn(30, '2028-02')).toBe('2028-02-29')
  })

  it('the last day follows the month', () => {
    expect(paydayIn('last', '2026-01')).toBe('2026-01-31')
    expect(paydayIn('last', '2026-02')).toBe('2026-02-28')
    expect(paydayIn('last', '2028-02')).toBe('2028-02-29')
    expect(paydayIn('last', '2026-04')).toBe('2026-04-30')
    expect(paydayIn('last', '2026-12')).toBe('2026-12-31')
  })

  it('the last working day skips Saturday and Sunday', () => {
    expect(paydayIn('lastWorking', '2026-10')).toBe('2026-10-30') // the 31st is a Saturday
    expect(paydayIn('lastWorking', '2026-05')).toBe('2026-05-29') // the 31st is a Sunday
    expect(paydayIn('lastWorking', '2026-02')).toBe('2026-02-27') // the 28th is a Saturday
    expect(paydayIn('lastWorking', '2027-02')).toBe('2027-02-26') // the 28th is a Sunday
    expect(paydayIn('lastWorking', '2026-11')).toBe('2026-11-30') // a Monday
    expect(paydayIn('lastWorking', '2028-02')).toBe('2028-02-29') // leap day, a Tuesday
    expect(paydayIn('lastWorking', '2026-12')).toBe('2026-12-31') // a Thursday
  })
})

describe('nextPayday and lastPayday', () => {
  it('a payday today counts both ways', () => {
    expect(nextPayday(7, '2026-11-07')).toBe('2026-11-07')
    expect(lastPayday(7, '2026-11-07')).toBe('2026-11-07')
  })

  it('moves to the next month once this month’s has passed, and across the year', () => {
    expect(nextPayday(7, '2026-11-06')).toBe('2026-11-07')
    expect(nextPayday(7, '2026-11-08')).toBe('2026-12-07')
    expect(nextPayday(1, '2026-12-02')).toBe('2027-01-01')
    expect(nextPayday(31, '2026-12-31')).toBe('2026-12-31')
    expect(lastPayday(7, '2026-11-06')).toBe('2026-10-07')
    expect(lastPayday(1, '2027-01-01')).toBe('2027-01-01')
    expect(lastPayday(5, '2027-01-03')).toBe('2026-12-05')
  })

  it('the 31st lands on the last day of each month in turn', () => {
    expect(nextPayday(31, '2026-01-31')).toBe('2026-01-31')
    expect(nextPayday(31, '2026-02-01')).toBe('2026-02-28')
    expect(nextPayday(31, '2026-03-01')).toBe('2026-03-31')
    expect(nextPayday(31, '2026-04-01')).toBe('2026-04-30')
    expect(nextPayday(30, '2026-02-15')).toBe('2026-02-28')
    expect(nextPayday(30, '2028-02-15')).toBe('2028-02-29')
    expect(lastPayday(31, '2026-03-30')).toBe('2026-02-28')
    expect(lastPayday('last', '2026-03-01')).toBe('2026-02-28')
  })

  it('the last working day: the Friday when the month ends on a weekend', () => {
    expect(nextPayday('lastWorking', '2026-10-15')).toBe('2026-10-30')
    // The 31st (a Saturday) is after this month's payday: the next one is November's.
    expect(nextPayday('lastWorking', '2026-10-31')).toBe('2026-11-30')
    expect(lastPayday('lastWorking', '2026-10-31')).toBe('2026-10-30')
    expect(lastPayday('lastWorking', '2026-10-29')).toBe('2026-09-30')
  })

  it('hands back what it was given when that isn’t a date', () => {
    expect(nextPayday(7, 'soon')).toBe('soon')
    expect(lastPayday(7, '')).toBe('')
  })
})

describe('the best day to ask', () => {
  it('is the day after their payday', () => {
    expect(askAfter(1, '2026-11-25')).toEqual({ paidOn: '2026-12-01', askOn: '2026-12-02', inDays: 7 })
    expect(askAfter(7, '2026-11-01')).toEqual({ paidOn: '2026-11-07', askOn: '2026-11-08', inDays: 7 })
  })

  it('payday yesterday: ask today. Payday today: ask tomorrow', () => {
    expect(askAfter(7, '2026-11-08')).toEqual({ paidOn: '2026-11-07', askOn: '2026-11-08', inDays: 0 })
    expect(askAfter(7, '2026-11-07')).toEqual({ paidOn: '2026-11-07', askOn: '2026-11-08', inDays: 1 })
  })

  it('two days after their payday the moment has passed: the next one is a month away', () => {
    expect(askAfter(7, '2026-11-09')).toEqual({ paidOn: '2026-12-07', askOn: '2026-12-08', inDays: 29 })
    expect(bestAsk(7, '2026-11-09')).toBeNull()
  })

  it('crosses the month and the year: paid on the last day, ask on the 1st', () => {
    expect(askAfter('last', '2026-12-01')).toEqual({ paidOn: '2026-11-30', askOn: '2026-12-01', inDays: 0 })
    expect(askAfter(31, '2026-12-01')).toEqual({ paidOn: '2026-11-30', askOn: '2026-12-01', inDays: 0 })
    expect(askAfter('last', '2026-12-28')).toEqual({ paidOn: '2026-12-31', askOn: '2027-01-01', inDays: 4 })
    expect(askAfter('last', '2027-01-01')).toEqual({ paidOn: '2026-12-31', askOn: '2027-01-01', inDays: 0 })
    expect(askAfter(31, '2026-02-25')).toEqual({ paidOn: '2026-02-28', askOn: '2026-03-01', inDays: 4 })
    expect(askAfter(31, '2028-02-25')).toEqual({ paidOn: '2028-02-29', askOn: '2028-03-01', inDays: 5 })
  })

  it('after a last working day that is a Friday, the day to ask is the Saturday', () => {
    expect(askAfter('lastWorking', '2026-10-28')).toEqual({ paidOn: '2026-10-30', askOn: '2026-10-31', inDays: 3 })
    expect(askAfter('lastWorking', '2026-10-31')).toEqual({ paidOn: '2026-10-30', askOn: '2026-10-31', inDays: 0 })
    expect(askAfter('lastWorking', '2026-11-01')?.paidOn).toBe('2026-11-30')
  })

  it('only within the next 10 days, today included', () => {
    expect(bestAsk(1, '2026-11-22')?.askOn).toBe('2026-12-02') // 10 days away
    expect(bestAsk(1, '2026-11-21')).toBeNull() // 11 days away
    expect(bestAsk(1, '2026-12-02')?.askOn).toBe('2026-12-02')
    expect(bestAsk(1, '2026-12-03')).toBeNull()
  })

  it('nothing when the payday isn’t known, or today isn’t a date', () => {
    expect(bestAsk(null, '2026-11-22')).toBeNull()
    expect(bestAsk(undefined, '2026-11-22')).toBeNull()
    expect(bestAsk(1, 'today')).toBeNull()
    expect(askAfter(40 as Payday, '2026-11-22')).toBeNull()
  })

  it('holds for every day of a leap year and every kind of payday: tomorrow at the latest after a payday, never in the past', () => {
    const paydays: Payday[] = [1, 5, 7, 10, 15, 28, 29, 30, 31, 'last', 'lastWorking']
    for (const payday of paydays) {
      let day = '2028-01-01'
      for (let i = 0; i < 366; i++) {
        const ask = askAfter(payday, day)
        expect(ask).not.toBeNull()
        if (!ask) continue
        expect(ask.inDays).toBeGreaterThanOrEqual(0)
        // A month at the most; a last working day on Friday the 29th can be 33 days before the next.
        expect(ask.inDays).toBeLessThanOrEqual(payday === 'lastWorking' ? 33 : 31)
        expect(ask.askOn >= day).toBe(true)
        // The payday it follows is that month's real payday.
        expect(paydayIn(payday, ask.paidOn.slice(0, 7))).toBe(ask.paidOn)
        // On a payday, the day to ask is tomorrow.
        if (nextPayday(payday, day) === day) expect(ask.inDays).toBe(1)
        const [y, m, d] = day.split('-').map(Number)
        day = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10)
      }
    }
  })
})

describe('your payday’s three days', () => {
  it('payday and the two days after, no more', () => {
    expect(paydayWindow(7, '2026-11-06')).toBeNull()
    expect(paydayWindow(7, '2026-11-07')).toEqual({ paidOn: '2026-11-07', daysSince: 0 })
    expect(paydayWindow(7, '2026-11-08')).toEqual({ paidOn: '2026-11-07', daysSince: 1 })
    expect(paydayWindow(7, '2026-11-09')).toEqual({ paidOn: '2026-11-07', daysSince: 2 })
    expect(paydayWindow(7, '2026-11-10')).toBeNull()
  })

  it('carries over the end of the month and of the year', () => {
    expect(paydayWindow('last', '2026-12-31')).toEqual({ paidOn: '2026-12-31', daysSince: 0 })
    expect(paydayWindow('last', '2027-01-02')).toEqual({ paidOn: '2026-12-31', daysSince: 2 })
    expect(paydayWindow('last', '2027-01-03')).toBeNull()
    expect(paydayWindow(31, '2026-03-02')).toEqual({ paidOn: '2026-02-28', daysSince: 2 })
    expect(paydayWindow(30, '2028-03-01')).toEqual({ paidOn: '2028-02-29', daysSince: 1 })
  })

  it('the last working day: Friday, and the weekend after it', () => {
    expect(paydayWindow('lastWorking', '2026-10-30')).toEqual({ paidOn: '2026-10-30', daysSince: 0 })
    expect(paydayWindow('lastWorking', '2026-11-01')).toEqual({ paidOn: '2026-10-30', daysSince: 2 })
    expect(paydayWindow('lastWorking', '2026-11-02')).toBeNull()
  })

  it('nothing without a payday or a date', () => {
    expect(paydayWindow(null, '2026-11-07')).toBeNull()
    expect(paydayWindow(undefined, '2026-11-07')).toBeNull()
    expect(paydayWindow(7, 'x')).toBeNull()
    expect(paydayWindow(0 as Payday, '2026-11-07')).toBeNull()
  })
})

describe('who to ask when', () => {
  const riya = friend('r', 'Riya')
  const sam = friend('s', 'Sam')
  const asha = friend('a', 'Asha')
  const dev = friend('d', 'Dev')
  const all = people(riya, sam, asha, dev)

  it('lists only people who owe you, the soonest day to ask first, the unknown last', () => {
    const rows = askList({ r: 50_000, s: 120_000, a: 30_000, d: -40_000 }, all, { r: 1, s: 7 }, '2026-11-05')
    expect(rows.map((r) => r.friendId)).toEqual(['s', 'r', 'a'])
    expect(rows[0]).toEqual({ friendId: 's', name: 'Sam', amount: 120_000, payday: 7, ask: { paidOn: '2026-11-07', askOn: '2026-11-08', inDays: 3 } })
    expect(rows[1]?.ask).toEqual({ paidOn: '2026-12-01', askOn: '2026-12-02', inDays: 27 })
    expect(rows[2]).toEqual({ friendId: 'a', name: 'Asha', amount: 30_000, payday: null, ask: null })
  })

  it('the same day: the larger amount first, then by name (not by id, which differs per phone)', () => {
    const z = friend('1', 'Zoya')
    const a = friend('9', 'Aman')
    const b = friend('5', 'bina')
    const rows = askList({ 1: 10_000, 9: 10_000, 5: 99_900 }, people(z, a, b), { 1: 1, 9: 1, 5: 1 }, '2026-11-25')
    expect(rows.map((r) => r.name)).toEqual(['bina', 'Aman', 'Zoya'])
    const unknown = askList({ 1: 10_000, 9: 10_000 }, people(z, a), {}, '2026-11-25')
    expect(unknown.map((r) => r.name)).toEqual(['Aman', 'Zoya'])
  })

  it('leaves out yourself, people who were removed, people you owe, and junk', () => {
    const rows = askList({ me: 50_000, gone: 50_000, r: 0, s: -1, a: 1.5, d: 1 }, all, { gone: 1, d: 99 as Payday }, '2026-11-05')
    expect(rows).toEqual([{ friendId: 'd', name: 'Dev', amount: 1, payday: null, ask: null }])
    expect(askList({}, all, { r: 1 }, '2026-11-05')).toEqual([])
    expect(askList({ r: 100 }, {}, { r: 1 }, '2026-11-05')).toEqual([])
  })

  it('picks out the people to ask today', () => {
    const rows = askList({ r: 50_000, s: 120_000, a: 30_000 }, all, { r: 1, s: 7, a: 'last' }, '2026-12-01')
    // Asha was paid on 30 Nov (the last day): today. Riya is paid today: tomorrow.
    expect(askToday(rows).map((r) => r.friendId)).toEqual(['a'])
    expect(rows.map((r) => [r.friendId, r.ask?.inDays])).toEqual([['a', 0], ['r', 1], ['s', 7]])
  })

  it('keeps up with a long list', () => {
    const many: Friend[] = Array.from({ length: 2000 }, (_, i) => friend(`f${i}`, `Friend ${i}`))
    const nets = Object.fromEntries(many.map((f, i) => [f.id, (i % 7) * 100 + 100]))
    const paydays = Object.fromEntries(many.map((f, i) => [f.id, ((i % 31) + 1) as Payday]))
    const rows = askList(nets, people(...many), paydays, '2026-11-15')
    expect(rows).toHaveLength(2000)
    for (let i = 1; i < rows.length; i++) expect((rows[i - 1]?.ask?.askOn ?? '') <= (rows[i]?.ask?.askOn ?? '')).toBe(true)
  })
})

describe('your payday and what you owe', () => {
  const riya = friend('r', 'Riya', 'riya@okicici')
  const sam = friend('s', 'Sam')
  const asha = friend('a', 'Asha')
  const all = people(riya, sam, asha)

  it('on payday: the total and the number of people you owe, to the paisa', () => {
    const due = paydayDue(7, null, { r: -120_050, s: -80_000, a: -29_950 }, all, '2026-11-07')
    expect(due).toEqual({ paidOn: '2026-11-07', daysSince: 0, amount: 230_000, people: 3, only: null })
  })

  it('counts only what you owe: what others owe you is not taken off', () => {
    const due = paydayDue(7, null, { r: -50_000, s: 90_000 }, all, '2026-11-08')
    expect(due).toEqual({ paidOn: '2026-11-07', daysSince: 1, amount: 50_000, people: 1, only: { friendId: 'r', name: 'Riya' } })
  })

  it('nothing when you owe nobody, off the three days, or with no payday', () => {
    expect(paydayDue(7, null, { r: 50_000 }, all, '2026-11-07')).toBeNull()
    expect(paydayDue(7, null, {}, all, '2026-11-07')).toBeNull()
    expect(paydayDue(7, null, { r: -50_000 }, all, '2026-11-10')).toBeNull()
    expect(paydayDue(7, null, { r: -50_000 }, all, '2026-11-06')).toBeNull()
    expect(paydayDue(null, null, { r: -50_000 }, all, '2026-11-07')).toBeNull()
    // Someone removed from your people isn't someone "Clear everything" can pay.
    expect(paydayDue(7, null, { gone: -50_000 }, all, '2026-11-07')).toBeNull()
  })

  it('"not this month" hides this payday’s card on all three days, and the next payday shows again', () => {
    const nets = { r: -50_000 }
    expect(paydayDue(7, '2026-11-07', nets, all, '2026-11-07')).toBeNull()
    expect(paydayDue(7, '2026-11-07', nets, all, '2026-11-09')).toBeNull()
    expect(paydayDue(7, '2026-11-07', nets, all, '2026-12-07')?.paidOn).toBe('2026-12-07')
    // Put away on 31 Dec: still away on 2 Jan.
    expect(paydayDue('last', '2026-12-31', nets, all, '2027-01-02')).toBeNull()
  })
})
