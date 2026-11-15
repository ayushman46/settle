import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { noteSalaryAlerts } from './alerts'
import type { Payday } from './engine'
import {
  bestAskDay,
  declineGuess,
  dismissPaydayCard,
  friendPaydayOf,
  MAX_FRIEND_PAYDAYS,
  MAX_SALARY_DAYS,
  noteSalary,
  openGuess,
  paydayStore,
  setFriendPayday,
  setMyPayday,
} from './store'

beforeEach(() => resetDataForTests())

const at = (y: number, m: number, d: number, h = 10): number => new Date(y, m - 1, d, h).getTime()
const SALARY_SMS = 'Your A/C XXXXX3367 Credited INR 42,500.00 -Salary by NEFT from ACME SOFTWARE PVT LTD. Avl Bal INR 66,612.40-SBI'

describe('the payday store', () => {
  it('starts with nothing known', () => {
    expect(paydayStore.get()).toEqual({ mine: null, friends: {}, dismissed: null, salaryDays: [], declined: [] })
  })

  it('sets and forgets your payday, and Undo puts back exactly what was there', () => {
    const undoFirst = setMyPayday(7)
    expect(paydayStore.get().mine).toBe(7)
    const undoSecond = setMyPayday('lastWorking')
    expect(paydayStore.get().mine).toBe('lastWorking')
    undoSecond()
    expect(paydayStore.get().mine).toBe(7)
    const undoForget = setMyPayday(null)
    expect(paydayStore.get().mine).toBeNull()
    undoForget()
    expect(paydayStore.get().mine).toBe(7)
    undoFirst()
    expect(paydayStore.get().mine).toBeNull()
  })

  it('sets, changes and forgets a friend’s payday, with Undo for each', () => {
    setFriendPayday('riya', 1)
    const undoChange = setFriendPayday('riya', 'last')
    expect(friendPaydayOf('riya')).toBe('last')
    undoChange()
    expect(friendPaydayOf('riya')).toBe(1)
    const undoForget = setFriendPayday('riya', null)
    expect(friendPaydayOf('riya')).toBeNull()
    expect('riya' in paydayStore.get().friends).toBe(false)
    undoForget()
    expect(friendPaydayOf('riya')).toBe(1)
    const undoNew = setFriendPayday('sam', 10)
    undoNew()
    expect(paydayStore.get().friends).toEqual({ riya: 1 })
  })

  it('an Undo only touches what it changed', () => {
    const undoRiya = setFriendPayday('riya', 1)
    setFriendPayday('sam', 7)
    setMyPayday(30)
    undoRiya()
    expect(paydayStore.get().friends).toEqual({ sam: 7 })
    expect(paydayStore.get().mine).toBe(30)
  })

  it('ignores junk', () => {
    setMyPayday(0 as Payday)
    setMyPayday(32 as Payday)
    setMyPayday('first' as Payday)
    setMyPayday(1.5 as Payday)
    expect(paydayStore.get().mine).toBeNull()
    setFriendPayday('', 1)
    setFriendPayday('x'.repeat(81), 1)
    setFriendPayday('riya', 45 as Payday)
    expect(paydayStore.get().friends).toEqual({})
    dismissPaydayCard('yesterday')
    expect(paydayStore.get().dismissed).toBeNull()
    expect(noteSalary('30 Oct')).toBeNull()
    expect(paydayStore.get().salaryDays).toEqual([])
  })

  it('keeps at most 500 friends’ paydays, the newest', () => {
    for (let i = 0; i < MAX_FRIEND_PAYDAYS + 20; i++) setFriendPayday(`f${i}`, ((i % 31) + 1) as Payday)
    const friends = paydayStore.get().friends
    expect(Object.keys(friends)).toHaveLength(MAX_FRIEND_PAYDAYS)
    expect(friends.f0).toBeUndefined()
    expect(friends[`f${MAX_FRIEND_PAYDAYS + 19}`]).toBeDefined()
  })

  it('puts a payday’s card away, and Undo brings it back', () => {
    const undo = dismissPaydayCard('2026-11-07')
    expect(paydayStore.get().dismissed).toBe('2026-11-07')
    undo()
    expect(paydayStore.get().dismissed).toBeNull()
  })

  it('reads what it can from junk in storage, dropping only the bad parts', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.payday,
      JSON.stringify({
        v: 1,
        data: {
          mine: 44,
          friends: { riya: 1, sam: 'last', asha: 'lastWorking', bad1: 0, bad2: '7', bad3: null, bad4: { day: 7 }, '': 5 },
          dismissed: 'last week',
          salaryDays: ['2026-11-30', 'nope', 12, '2026-10-30', '2026-10-30', '2026-02-31'],
          declined: ['30', '', 7, 'x'.repeat(40), '30'],
        },
      }),
    )
    paydayStore.reload()
    expect(paydayStore.get()).toEqual({
      mine: null,
      friends: { riya: 1, sam: 'last', asha: 'lastWorking' },
      dismissed: null,
      salaryDays: ['2026-10-30', '2026-11-30'],
      declined: ['30'],
    })
  })

  it('survives parts of the wrong shape, and storage that isn’t JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.payday, JSON.stringify({ v: 1, data: { mine: 'last', friends: [1, 2], dismissed: 7, salaryDays: 'often', declined: {} } }))
    paydayStore.reload()
    expect(paydayStore.get()).toEqual({ mine: 'last', friends: {}, dismissed: null, salaryDays: [], declined: [] })
    window.localStorage.setItem(STORAGE_KEYS.payday, '{not json')
    paydayStore.reload()
    expect(paydayStore.get().mine).toBeNull()
  })
})

describe('bestAskDay', () => {
  it('is the day after a friend’s payday when that is within 10 days, else null', () => {
    setFriendPayday('riya', 1)
    expect(bestAskDay('riya', '2026-11-25')).toBe('2026-12-02')
    expect(bestAskDay('riya', '2026-12-01')).toBe('2026-12-02')
    expect(bestAskDay('riya', '2026-12-02')).toBe('2026-12-02')
    expect(bestAskDay('riya', '2026-12-03')).toBeNull()
    expect(bestAskDay('riya', '2026-11-10')).toBeNull()
    expect(bestAskDay('nobody', '2026-11-25')).toBeNull()
  })
})

describe('noteSalary', () => {
  it('offers nothing after one salary day, and a guess once a second month agrees: it never sets your payday', () => {
    expect(noteSalary('2026-10-30')).toBeNull()
    expect(noteSalary('2026-11-30')).toEqual({ payday: 30, days: ['2026-10-30', '2026-11-30'] })
    expect(paydayStore.get().mine).toBeNull()
    expect(paydayStore.get().salaryDays).toEqual(['2026-10-30', '2026-11-30'])
  })

  it('counts a day once, keeps them in order, and keeps the newest 12', () => {
    noteSalary('2026-11-30')
    noteSalary('2026-10-30')
    noteSalary('2026-11-30')
    expect(paydayStore.get().salaryDays).toEqual(['2026-10-30', '2026-11-30'])
    for (let month = 1; month <= 12; month++) noteSalary(`2027-${String(month).padStart(2, '0')}-28`)
    const days = paydayStore.get().salaryDays
    expect(days).toHaveLength(MAX_SALARY_DAYS)
    expect(days[0]).toBe('2027-01-28')
    expect(days.at(-1)).toBe('2027-12-28')
  })

  it('offers nothing once you have a payday, whatever the alerts say', () => {
    setMyPayday(7)
    noteSalary('2026-10-30')
    expect(noteSalary('2026-11-30')).toBeNull()
    expect(paydayStore.get().mine).toBe(7)
    // Forget it, and the guess is there to offer.
    setMyPayday(null)
    expect(openGuess(paydayStore.get())?.payday).toBe(30)
  })

  it('"Not now" puts that guess away (Undo brings it back); a different guess later can still be offered', () => {
    noteSalary('2026-10-30')
    noteSalary('2026-11-30')
    const undo = declineGuess(30)
    expect(openGuess(paydayStore.get())).toBeNull()
    undo()
    expect(openGuess(paydayStore.get())?.payday).toBe(30)
    declineGuess(30)
    declineGuess(30)
    expect(paydayStore.get().declined).toEqual(['30'])
    // December's lands on the 31st: now it reads as the last working day.
    expect(noteSalary('2026-12-31')?.payday).toBe('lastWorking')
  })
})

describe('noteSalaryAlerts', () => {
  it('notes only the day of a salary alert, and offers a guess after two months', () => {
    expect(noteSalaryAlerts([{ app: 'com.google.android.apps.messaging', title: 'AD-SBIBNK', text: SALARY_SMS, postedAt: at(2026, 10, 30) }])).toBeNull()
    const guess = noteSalaryAlerts([
      { app: 'com.google.android.apps.messaging', title: 'AD-SBIBNK', text: SALARY_SMS, postedAt: at(2026, 11, 30, 23) },
      { app: 'com.google.android.apps.messaging', title: 'AD-HDFCBK', text: 'Rs.420.00 credited to a/c XX4821 by a/c linked to VPA riya.s@okhdfcbank (UPI Ref No 630112345678).', postedAt: at(2026, 11, 12) },
    ])
    expect(guess?.payday).toBe(30)
    const state = paydayStore.get()
    expect(state.salaryDays).toEqual(['2026-10-30', '2026-11-30'])
    expect(state.mine).toBeNull()
    // Nothing of the alert itself is kept.
    expect(JSON.stringify(state)).not.toContain('42,500')
    expect(JSON.stringify(state)).not.toContain('ACME')
  })

  it('never takes a UPI app’s alert as salary, even with "salary" in the note', () => {
    const upi = { app: 'com.google.android.apps.nbu.paisa.user', title: 'Google Pay', text: 'Received ₹15,000 from Rahul Verma\nsalary' }
    noteSalaryAlerts([{ ...upi, postedAt: at(2026, 10, 5) }, { ...upi, postedAt: at(2026, 11, 5) }])
    expect(paydayStore.get().salaryDays).toEqual([])
  })

  it('reads an alert with no title or app, and never throws on junk', () => {
    expect(noteSalaryAlerts([{ text: SALARY_SMS, postedAt: at(2026, 10, 30) }])).toBeNull()
    expect(paydayStore.get().salaryDays).toEqual(['2026-10-30'])
    expect(noteSalaryAlerts([{ text: SALARY_SMS, postedAt: Number.NaN }, { text: SALARY_SMS, postedAt: -5 }])).toBeNull()
    expect(noteSalaryAlerts(null as unknown as [])).toBeNull()
    expect(noteSalaryAlerts([null, 7, { text: 12 }] as unknown as [])).toBeNull()
    expect(paydayStore.get().salaryDays).toEqual(['2026-10-30'])
  })
})
