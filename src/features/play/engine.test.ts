import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { levelFor, playBoard, POINTS_BILL, POINTS_FAST, POINTS_PAYMENT, POINTS_SQUARE, POINTS_STREAK, weekStart } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha' }
const nameOf = (id: string): string => NAMES[id] ?? id

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
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const paid = (fromId: string, toId: string, amount: number, date: string): Settlement => ({ id: `s${++n}`, fromId, toId, amount, date, createdAt: n, method: 'upi' })
const group = (settlements: Settlement[] = [], memberIds = ['me', 'riya', 'sam']): Group => ({ id: 'goa', name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds, settlements, createdAt: 1, updatedAt: 1, archived: false })
const board = (expenses: Expense[], settlements: Settlement[] = [], today = '2026-11-14', more: Partial<Parameters<typeof playBoard>[0]> = {}) => playBoard({ group: group(settlements), expenses, today, me: 'me', nameOf, ...more })

describe('the leaderboard', () => {
  it('gives points for paying a bill, for settling up, more for settling within a day, and for owing nobody', () => {
    // Mon 9 Nov: Ayush pays ₹900 for three. Riya pays back the next day (fast). Sam hasn't.
    const b = board([expense('Dinner', 90_000, '2026-11-09', 'me', ['me', 'riya', 'sam'])], [paid('riya', 'me', 30_000, '2026-11-10')])
    const row = (id: string) => b.rows.find((r) => r.id === id)!
    expect(row('me').points).toBe(POINTS_BILL + POINTS_SQUARE)
    expect(row('riya').points).toBe(POINTS_PAYMENT + POINTS_FAST + POINTS_SQUARE + POINTS_STREAK)
    expect(row('riya')).toMatchObject({ payments: 1, fastPayments: 1, streak: 1, square: true })
    expect(row('sam')).toMatchObject({ points: 0, square: false, balance: -30_000 })
    expect(b.rows.map((r) => [r.name, r.rank])).toEqual([
      ['Riya', 1],
      ['Ayush', 2],
      ['Sam', 3],
    ])
  })

  it('a slow payment still counts, without the fast bonus or the streak', () => {
    const b = board([expense('Dinner', 60_000, '2026-11-02', 'me', ['me', 'riya'])], [paid('riya', 'me', 30_000, '2026-11-09')])
    expect(b.rows.find((r) => r.id === 'riya')).toMatchObject({ payments: 1, fastPayments: 0, streak: 0, points: POINTS_PAYMENT + POINTS_SQUARE })
  })

  it('people level on points share a rank; names break the order, never ids', () => {
    const b = board([expense('A', 20_000, '2026-11-14', 'riya', ['riya', 'sam']), expense('B', 20_000, '2026-11-14', 'sam', ['riya', 'sam'])])
    expect(b.rows.filter((r) => r.id !== 'me').map((r) => [r.name, r.rank])).toEqual([
      ['Riya', 1],
      ['Sam', 1],
    ])
  })

  it('levels: starter, regular, pro, legend', () => {
    expect(levelFor(0)).toEqual({ id: 'starter', next: 50 })
    expect(levelFor(50)).toEqual({ id: 'regular', next: 150 })
    expect(levelFor(299)).toEqual({ id: 'pro', next: 300 })
    expect(levelFor(900)).toEqual({ id: 'legend', next: null })
  })

  it('an empty group has a Board that says so', () => {
    const b = board([])
    expect(b.started).toBe(false)
    expect(b.quest).toEqual({ kind: 'start' })
    expect(b.rows.every((r) => r.points === 0)).toBe(true)
    expect(b.recap).toBeNull()
  })
})

describe('points can’t be farmed', () => {
  it('a rupee at a time earns nothing: the points go to the payment that pays off what you owe', () => {
    const bills = [expense('Dinner', 60_000, '2026-11-13', 'riya', ['riya', 'me'])]
    const drip = board(bills, [paid('me', 'riya', 100, '2026-11-13'), paid('me', 'riya', 100, '2026-11-13'), paid('me', 'riya', 100, '2026-11-13')])
    expect(drip.rows.find((r) => r.id === 'me')).toMatchObject({ points: 0, payments: 3, fastPayments: 0, balance: -29_700 })
    const paidOff = board(bills, [paid('me', 'riya', 100, '2026-11-13'), paid('me', 'riya', 29_900, '2026-11-14')])
    expect(paidOff.rows.find((r) => r.id === 'me')).toMatchObject({ points: POINTS_PAYMENT + POINTS_FAST + POINTS_SQUARE + POINTS_STREAK, payments: 2, fastPayments: 1 })
  })

  it('a payment when you owe nothing earns nothing', () => {
    const b = board([expense('Dinner', 60_000, '2026-11-13', 'me', ['me', 'riya'])], [paid('me', 'riya', 5_000, '2026-11-13')])
    expect(b.rows.find((r) => r.id === 'me')?.points).toBe(POINTS_BILL + POINTS_SQUARE)
  })

  it('tiny bills, bills for yourself alone, and more than five a day don’t count', () => {
    const tiny = board([expense('Gum', 100, '2026-11-13', 'me', ['me', 'riya']), expense('Mine', 90_000, '2026-11-13', 'me', ['me'])])
    expect(tiny.rows.find((r) => r.id === 'me')?.bills).toBe(0)
    const many = board(Array.from({ length: 8 }, (_, i) => expense(`Round ${i}`, 20_000, '2026-11-13', 'me', ['me', 'riya'])))
    expect(many.rows.find((r) => r.id === 'me')).toMatchObject({ bills: 5, points: 5 * POINTS_BILL + POINTS_SQUARE })
  })
})

describe('titles', () => {
  it('names the banker, the fastest to pay back, who is owed, and who is on the clock', () => {
    const b = board(
      [expense('Hotel', 300_000, '2026-11-02', 'me', ['me', 'riya', 'sam']), expense('Cab', 60_000, '2026-11-03', 'me', ['me', 'riya', 'sam']), expense('Chai', 9_000, '2026-11-04', 'riya', ['me', 'riya', 'sam'])],
      [paid('riya', 'me', 100_000, '2026-11-02')],
    )
    const title = (id: string) => b.titles.find((x) => x.id === id)
    expect(title('banker')).toMatchObject({ name: 'Ayush', value: 240_000 })
    expect(title('regular')).toMatchObject({ name: 'Ayush', value: 2 })
    expect(title('patient')?.name).toBe('Ayush')
    expect(title('clock')).toMatchObject({ name: 'Sam', value: 12 })
    // Everyone's share is level here: nobody is handed "Biggest share".
    expect(title('appetite')).toBeUndefined()
  })
})

describe('streaks and the week', () => {
  it('counts the days the whole group has been all square', () => {
    const b = board([expense('Dinner', 60_000, '2026-11-09', 'me', ['me', 'riya'])], [paid('riya', 'me', 30_000, '2026-11-10')], '2026-11-14')
    expect(b.squareDays).toBe(4)
    expect(b.challenge).toMatchObject({ done: true, square: 2, people: 2 })
    expect(board([expense('Dinner', 60_000, '2026-11-09', 'me', ['me', 'riya'])]).squareDays).toBeNull()
  })

  it('this week runs Monday to Sunday; past weeks ended all square are trophies', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09') // a Saturday
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sunday still belongs to it
    const b = board(
      [expense('Week one', 60_000, '2026-10-27', 'me', ['me', 'riya']), expense('Week two', 60_000, '2026-11-03', 'me', ['me', 'riya']), expense('This week', 60_000, '2026-11-10', 'me', ['me', 'riya'])],
      // Week one settled in its own week; week two not until this week.
      [paid('riya', 'me', 30_000, '2026-10-28'), paid('riya', 'me', 30_000, '2026-11-11')],
    )
    expect(b.challenge).toMatchObject({ from: '2026-11-09', to: '2026-11-15', daysLeft: 1, trophies: 1, done: false, square: 1, people: 2 })
  })
})

describe('who should pay next', () => {
  it('is whoever is furthest behind, with the bill that squares them up', () => {
    const b = board([expense('Hotel', 90_000, '2026-11-13', 'me', ['me', 'riya', 'sam']), expense('Cab', 30_000, '2026-11-13', 'riya', ['me', 'riya', 'sam'])])
    // Sam owes ₹400 in all: a ₹600 bill split three ways puts him ₹400 up.
    expect(b.next).toEqual({ id: 'sam', name: 'Sam', behind: 40_000, bill: 60_000 })
    expect(board([expense('Dinner', 60_000, '2026-11-09', 'me', ['me', 'riya'])], [paid('riya', 'me', 30_000, '2026-11-10')]).next).toBeNull()
  })
})

describe('repeat in one tap', () => {
  it('offers what the group buys again and again, the latest one of each', () => {
    const b = board([
      expense('Chai', 6_000, '2026-11-10', 'me', ['me', 'riya']),
      expense('chai ', 8_000, '2026-11-12', 'riya', ['me', 'riya', 'sam']),
      expense('Cab', 30_000, '2026-11-11', 'me', ['me', 'riya']),
      expense('Cab', 35_000, '2026-11-13', 'me', ['me', 'riya']),
      expense('Cab', 32_000, '2026-11-12', 'me', ['me', 'riya']),
      expense('Hotel', 300_000, '2026-11-10', 'me', ['me', 'riya']),
    ])
    expect(b.again.map((e) => [e.title, e.total])).toEqual([
      ['Cab', 35_000],
      ['chai ', 8_000],
    ])
  })
})

describe('added twice?', () => {
  it('catches the same bill added by two people: same day, same amount, same name', () => {
    const first = expense('Dinner at Toit', 240_000, '2026-11-13', 'me', ['me', 'riya', 'sam'])
    const second = expense('dinner', 240_000, '2026-11-13', 'riya', ['me', 'riya', 'sam'])
    const other = expense('Dinner', 240_000, '2026-11-12', 'me', ['me', 'riya', 'sam'])
    const b = board([first, second, other])
    expect(b.duplicates).toHaveLength(1)
    expect(b.duplicates[0]).toMatchObject({ keep: { id: first.id }, drop: { id: second.id } })
    // Said to be different bills: not asked again.
    expect(board([first, second, other], [], '2026-11-14', { notDuplicates: new Set([b.duplicates[0]!.key]) }).duplicates).toEqual([])
  })

  it('two different things for the same amount on the same day are left alone, whoever paid', () => {
    expect(board([expense('Lunch', 50_000, '2026-11-13', 'me', ['me', 'riya']), expense('Cab', 50_000, '2026-11-13', 'riya', ['me', 'riya'])]).duplicates).toEqual([])
    expect(board([expense('Cab', 50_000, '2026-11-13', 'me', ['me', 'riya']), expense('Snacks', 50_000, '2026-11-13', 'me', ['me', 'riya'])]).duplicates).toEqual([])
    expect(board([expense('Item1', 100, '2026-11-13', 'me', ['me', 'riya']), expense('Item3', 100, '2026-11-13', 'me', ['me', 'riya'])]).duplicates).toEqual([])
  })

  it('“Biggest share” isn’t handed out when shares are level', () => {
    const level = board([expense('Dinner', 90_000, '2026-11-13', 'me', ['me', 'riya', 'sam'])])
    expect(level.titles.find((x) => x.id === 'appetite')).toBeUndefined()
  })
})

describe('budget, today and the recap', () => {
  const trip = [
    expense('Hotel', 600_000, '2026-11-11', 'me', ['me', 'riya', 'sam'], { category: 'travel' }),
    expense('Dinner', 240_000, '2026-11-12', 'riya', ['me', 'riya', 'sam']),
    expense('Cab', 60_000, '2026-11-14', 'me', ['me', 'riya', 'sam'], { category: 'travel' }),
  ]

  it('says what is spent, the pace, and the day the budget runs out at this pace', () => {
    const b = board(trip, [], '2026-11-14', { budget: 1_500_000 })
    expect(b.budget).toEqual({ spent: 900_000, days: 4, perDay: 225_000, budget: 1_500_000, left: 600_000, over: false, reachesOn: '2026-11-16' })
    // One day of spending isn't a pace.
    expect(board([trip[2]!], [], '2026-11-14', { budget: 1_500_000 }).budget).toMatchObject({ days: 1, reachesOn: null })
    expect(board(trip, [], '2026-11-14', { budget: 500_000 }).budget).toMatchObject({ over: true, left: -400_000, reachesOn: null })
    expect(board(trip).budget).toMatchObject({ budget: null, left: null, reachesOn: null })
  })

  it('today: what was spent, my share, and how my balance moved', () => {
    expect(board(trip).today).toEqual({ count: 1, total: 60_000, myShare: 20_000, myChange: 40_000 })
  })

  it('the recap: the total, the pace, the biggest bill, where the money went, who fronted most', () => {
    expect(board(trip).recap).toMatchObject({
      total: 900_000,
      count: 3,
      days: 4,
      perDay: 225_000,
      perPerson: 300_000,
      biggest: { title: 'Hotel', total: 600_000, payerId: 'me' },
      topCategory: { id: 'travel', total: 660_000 },
      bankerId: 'me',
    })
  })
})

describe('milestones', () => {
  it('tick themselves off as the group spends, pays and squares up', () => {
    const b = board([expense('Hotel', 1_200_000, '2026-11-02', 'me', ['me', 'riya']), expense('Cab', 30_000, '2026-11-03', 'riya', ['me', 'riya'])], [paid('riya', 'me', 585_000, '2026-11-03')])
    const at = (id: string) => b.milestones.find((m) => m.id === id)
    expect(at('first')).toEqual({ id: 'first', done: true, have: 1, need: 1 })
    expect(at('ten')).toEqual({ id: 'ten', done: false, have: 2, need: 10 })
    expect(at('spent10k')?.done).toBe(true)
    expect(at('spent50k')).toMatchObject({ done: false, have: 1_230_000, need: 5_000_000 })
    expect(at('everyonePaid')).toMatchObject({ done: true, have: 2, need: 2 })
    expect(at('fast3')).toMatchObject({ done: false, have: 1 })
    expect(at('square')?.done).toBe(true)
    expect(at('trophy')?.done).toBe(true)
  })
})

describe('my move', () => {
  it('I owe: pay, with the points it earns (more today)', () => {
    const b = playBoard({ group: group(), expenses: [expense('Dinner', 60_000, '2026-11-14', 'riya', ['me', 'riya'])], today: '2026-11-14', me: 'me', nameOf })
    expect(b.quest).toEqual({ kind: 'pay', toId: 'riya', to: 'Riya', amount: 30_000, points: POINTS_PAYMENT + POINTS_FAST, fast: true })
    const late = playBoard({ group: group(), expenses: [expense('Dinner', 60_000, '2026-11-05', 'riya', ['me', 'riya'])], today: '2026-11-14', me: 'me', nameOf })
    expect(late.quest).toMatchObject({ kind: 'pay', points: POINTS_PAYMENT, fast: false })
  })

  it('I’m owed: who has kept me waiting longest', () => {
    const b = board([expense('Hotel', 90_000, '2026-11-05', 'me', ['me', 'sam']), expense('Cab', 30_000, '2026-11-12', 'me', ['me', 'riya'])])
    expect(b.quest).toEqual({ kind: 'collect', fromId: 'sam', from: 'Sam', amount: 45_000, days: 9 })
  })

  it('all square: nothing to do', () => {
    expect(board([expense('Dinner', 60_000, '2026-11-09', 'me', ['me', 'riya'])], [paid('riya', 'me', 30_000, '2026-11-10')]).quest).toEqual({ kind: 'square' })
  })
})
