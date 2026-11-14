import { describe, expect, it } from 'vitest'
import type { CategoryId, Expense, Group, Settlement } from '../../domain/types'
import { buildStory, hasBurst, hasStory, looksDone, percents, weekdayOf, type Slide } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha', zed: 'Aarav' }
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
const cat = (category: CategoryId): Partial<Expense> => ({ category })
const paid = (fromId: string, toId: string, amount: number, date: string): Settlement => ({ id: `s${++n}`, fromId, toId, amount, date, createdAt: n, method: 'upi' })
const group = (more: Partial<Group> = {}): Group => ({ id: 'goa', name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: ['me', 'riya', 'sam'], settlements: [], createdAt: 1, updatedAt: 1, archived: false, ...more })
const story = (expenses: Expense[], g: Group = group()) => buildStory({ group: g, expenses, nameOf, me: 'me' })
const kinds = (slides: Slide[]) => slides.map((s) => s.kind)
const find = <K extends Slide['kind']>(slides: Slide[], kind: K) => slides.find((s) => s.kind === kind) as Extract<Slide, { kind: K }> | undefined

const ALL = ['me', 'riya', 'sam']

/** A four-day Goa trip: chai every day, one big scuba day, Riya pays for the hotel. */
function goaTrip(): Expense[] {
  return [
    expense('Hotel', 1_200_000, '2026-11-01', 'riya', ALL, cat('travel')),
    expense('Chai', 9_000, '2026-11-01', 'me', ALL),
    expense('Chai', 9_000, '2026-11-02', 'sam', ALL),
    expense('Scuba', 900_000, '2026-11-02', 'me', ALL, cat('entertainment')),
    expense('Dinner', 400_000, '2026-11-02', 'sam', ALL),
    expense('Chai', 9_000, '2026-11-03', 'riya', ALL),
    expense('Cab', 150_000, '2026-11-03', 'me', ALL, cat('transport')),
    expense('Chai', 9_000, '2026-11-04', 'me', ALL),
    expense('Snacks', 30_000, '2026-11-04', 'sam', ALL, cat('groceries')),
  ]
}

describe('the story', () => {
  it('rich data: every slide the data supports, in order, with the right numbers', () => {
    const slides = story(goaTrip())
    expect(kinds(slides)).toEqual(['headline', 'perDay', 'bigDay', 'bigBill', 'categories', 'fronted', 'repeat', 'you', 'closing'])
    const total = 1_200_000 + 9_000 * 4 + 900_000 + 400_000 + 150_000 + 30_000
    expect(find(slides, 'headline')).toEqual({ kind: 'headline', total, days: 4, people: 3, count: 9, from: '2026-11-01', to: '2026-11-04' })
    expect(find(slides, 'perDay')).toEqual({ kind: 'perDay', perDay: Math.round(total / 4), days: 4, people: 3, perPersonPerDay: Math.round(total / 4 / 3) })
    // 2 Nov: ₹9,000 scuba + ₹4,000 dinner + ₹90 chai beats 1 Nov's hotel.
    expect(find(slides, 'bigDay')).toEqual({ kind: 'bigDay', date: '2026-11-02', total: 1_309_000, count: 3, titles: ['Scuba', 'Dinner', 'Chai'] })
    expect(find(slides, 'bigBill')).toMatchObject({ title: 'Hotel', total: 1_200_000, payerId: 'riya', date: '2026-11-01' })
    expect(find(slides, 'fronted')).toEqual({ kind: 'fronted', id: 'riya', amount: 800_000 + 6_000 })
    expect(find(slides, 'repeat')).toEqual({ kind: 'repeat', title: 'Chai', count: 4, total: 36_000 })
    const you = find(slides, 'you')!
    expect(you.paid).toBe(9_000 + 900_000 + 150_000 + 9_000)
    expect(you.share).toBe(goaTrip().reduce((s, e) => s + (e.shares.me ?? 0), 0))
    expect(find(slides, 'closing')!.payments).toBeGreaterThan(0)
  })

  it('where the money went: the top three and the rest, adding up to exactly 100%', () => {
    const shares = find(story(goaTrip()), 'categories')!.shares
    expect(shares.map((s) => s.id)).toEqual(['travel', 'entertainment', 'food', null])
    expect(shares.reduce((s, x) => s + x.percent, 0)).toBe(100)
    expect(shares.reduce((s, x) => s + x.total, 0)).toBe(find(story(goaTrip()), 'headline')!.total)
  })

  it('percents always add up to 100, even in thirds', () => {
    expect(percents([1, 1, 1])).toEqual([34, 33, 33])
    expect(percents([2, 1])).toEqual([67, 33])
    expect(percents([0, 0])).toEqual([0, 0])
    for (const parts of [[7, 13, 29, 51], [1, 1, 1, 1, 1, 1, 1], [999, 1, 1]]) expect(percents(parts).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('thin data: under three expenses there is no story', () => {
    const two = [expense('A', 10_000, '2026-11-01', 'me', ALL), expense('B', 10_000, '2026-11-02', 'me', ALL)]
    expect(story(two)).toEqual([])
    expect(hasStory(group(), two)).toBe(false)
  })

  it('three plain expenses on one day: only what is true (no per-day, no big day, no category split)', () => {
    const slides = story([expense('A', 10_000, '2026-11-01', 'me', ALL), expense('B', 20_000, '2026-11-01', 'riya', ALL), expense('C', 30_000, '2026-11-01', 'sam', ALL)])
    expect(kinds(slides)).toEqual(['headline', 'bigBill', 'fronted', 'you', 'closing'])
    expect(hasStory(group(), [expense('A', 1, '2026-11-01', 'me', ALL), expense('B', 1, '2026-11-01', 'me', ALL), expense('C', 1, '2026-11-01', 'me', ALL)])).toBe(true)
  })

  it('a group of one: no people slides, and it is all square', () => {
    const solo = group({ memberIds: ['me'] })
    const slides = story([expense('Chai', 2_000, '2026-11-01', 'me', ['me']), expense('Chai', 2_000, '2026-11-02', 'me', ['me']), expense('Chai', 2_000, '2026-11-03', 'me', ['me'])], solo)
    expect(kinds(slides)).toEqual(['headline', 'perDay', 'repeat', 'closing'])
    expect(find(slides, 'headline')!.people).toBe(1)
    expect(find(slides, 'perDay')!.perPersonPerDay).toBeNull()
    expect(find(slides, 'closing')).toEqual({ kind: 'closing', payments: 0, total: 0 })
  })

  it('ties: the earlier day, the name first in the alphabet', () => {
    const slides = story([
      expense('Lunch', 30_000, '2026-11-02', 'sam', ['sam', 'riya']),
      expense('Lunch', 30_000, '2026-11-01', 'riya', ['riya', 'sam']),
      expense('Tea', 5_000, '2026-11-01', 'me', ALL),
      expense('Tea', 5_000, '2026-11-02', 'me', ALL),
    ])
    expect(find(slides, 'bigDay')!.date).toBe('2026-11-01')
    // Riya and Sam each fronted ₹150: Riya comes first by name.
    expect(find(slides, 'fronted')!.id).toBe('riya')
  })

  it('loans are not spending, and other currencies stay out of the totals', () => {
    const trip = goaTrip()
    const extra = [
      expense('Cash to Sam', 500_000, '2026-11-03', 'me', ['sam'], { kind: 'loan' }),
      expense('Dinner in Bali', 4_000_000, '2026-11-03', 'me', ALL, { currency: 'IDR' }),
    ]
    const plain = story(trip)
    const mixed = story([...trip, ...extra])
    expect(find(mixed, 'headline')).toEqual(find(plain, 'headline'))
    expect(find(mixed, 'bigBill')).toEqual(find(plain, 'bigBill'))
    expect(find(mixed, 'you')).toEqual(find(plain, 'you'))
    // …but the loan is still owed, so it counts in what settles it.
    expect(find(mixed, 'closing')!.total).not.toBe(find(plain, 'closing')!.total)
    expect(hasStory(group(), [...extra, trip[0]!, trip[1]!])).toBe(false)
  })

  it('the fastest to pay back and how fast', () => {
    const g = group({ settlements: [paid('riya', 'me', 30_000, '2026-11-01'), paid('sam', 'me', 30_000, '2026-11-05')] })
    const slides = story([expense('Dinner', 90_000, '2026-11-01', 'me', ALL), expense('Chai', 3_000, '2026-11-01', 'me', ['me']), expense('Water', 3_000, '2026-11-01', 'me', ['me'])], g)
    expect(find(slides, 'flash')).toEqual({ kind: 'flash', id: 'riya', days: 0 })
  })

  it('a weekday only when it is real', () => {
    // Two weeks of Saturdays (big) and a few small weekday bills.
    const sats = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map((d) => expense('Party', 200_000, d, 'me', ALL))
    const rest = ['2026-10-05', '2026-10-07', '2026-10-13', '2026-10-20'].map((d) => expense('Milk', 10_000, d, 'riya', ALL))
    expect(weekdayOf('2026-10-03')).toBe(6)
    expect(find(story([...sats, ...rest]), 'weekday')).toEqual({ kind: 'weekday', day: 6, percent: 95 })
    // Spread evenly over the week: no pattern.
    const even = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-18'].map((d) => expense('Food', 10_000, d, 'me', ALL))
    expect(find(story(even), 'weekday')).toBeUndefined()
    // A short trip never has a pattern.
    expect(find(story(goaTrip()), 'weekday')).toBeUndefined()
  })

  it('all square at the end says so', () => {
    const e = [expense('A', 30_000, '2026-11-01', 'me', ['me', 'riya']), expense('B', 30_000, '2026-11-01', 'riya', ['me', 'riya']), expense('C', 10_000, '2026-11-02', 'me', ['me', 'riya'])]
    const g = group({ settlements: [paid('riya', 'me', 5_000, '2026-11-03')] })
    expect(find(story(e, g), 'closing')).toEqual({ kind: 'closing', payments: 0, total: 0 })
  })

  it('huge lists stay quick and exact', () => {
    const many: Expense[] = []
    for (let i = 0; i < 3000; i++) many.push(expense(i % 3 === 0 ? 'Chai' : `Thing ${i}`, 1_000 + (i % 97), `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, ALL[i % 3]!, ALL))
    const slides = story(many)
    expect(find(slides, 'headline')!.total).toBe(many.reduce((s, e) => s + e.total, 0))
    expect(find(slides, 'repeat')).toMatchObject({ title: 'Chai', count: 1000 })
  })
})

describe('looks done', () => {
  /** A burst: three bills over three days, ending on `last`. */
  const burst = (last: string): Expense[] => {
    const d = (k: number) => {
      const [y, m, day] = last.split('-').map(Number)
      return new Date(Date.UTC(y!, m! - 1, day! - k)).toISOString().slice(0, 10)
    }
    return [expense('Hotel', 600_000, d(2), 'riya', ALL), expense('Dinner', 90_000, d(1), 'me', ALL), expense('Cab', 30_000, d(0), 'sam', ALL)]
  }
  const TODAY = '2026-11-14'

  it('two days after the last bill, with money owed: how many payments and how much, and mine', () => {
    const done = looksDone(group(), burst('2026-11-12'), TODAY, 'me')
    expect(done).toMatchObject({ last: '2026-11-12', daysAgo: 2, payments: 2 })
    // Sam pays Riya ₹2,100 and Ayush pays Riya ₹1,500.
    expect(done!.total).toBe(360_000)
    // Ayush paid ₹900 and his shares are ₹2,000 + ₹300 + ₹100: owes ₹1,500.
    expect(done!.mine).toBe(-150_000)
  })

  it('boundaries: 1 day is too soon, 2 and 21 are in, 22 is too late', () => {
    const at = (days: number) => looksDone(group(), burst('2026-10-01'), new Date(Date.UTC(2026, 9, 1 + days)).toISOString().slice(0, 10), 'me')
    expect(at(1)).toBeNull()
    expect(at(2)).not.toBeNull()
    expect(at(21)).not.toBeNull()
    expect(at(22)).toBeNull()
  })

  it('no burst: three bills spread over weeks is a home, not a trip', () => {
    const spread = [expense('Rent', 100_000, '2026-10-01', 'me', ALL), expense('Wifi', 10_000, '2026-10-08', 'me', ALL), expense('Milk', 5_000, '2026-11-10', 'me', ALL)]
    expect(looksDone(group(), spread, TODAY, 'me')).toBeNull()
    expect(hasBurst(['2026-10-01', '2026-10-05', '2026-10-03'])).toBe(true)
    expect(hasBurst(['2026-10-01', '2026-10-06', '2026-10-03'])).toBe(false)
  })

  it('settled: nothing owed, nothing to say', () => {
    const e = burst('2026-11-10')
    const g = group()
    // Pay everything back.
    const sets = [paid('me', 'riya', 150_000, '2026-11-11'), paid('sam', 'riya', 210_000, '2026-11-11')]
    expect(looksDone({ ...g, settlements: sets }, e, TODAY, 'me')).toBeNull()
  })

  it('archived groups never look done', () => {
    expect(looksDone(group({ archived: true }), burst('2026-11-10'), TODAY, 'me')).toBeNull()
  })

  it('loans are not a burst of spending', () => {
    const loans = [0, 1, 2].map((k) => expense('Cash', 10_000, `2026-11-1${k}`, 'me', ['riya'], { kind: 'loan' }))
    expect(looksDone(group(), loans, TODAY, 'me')).toBeNull()
  })

  it('put away: stays away for a bill or two, comes back with a new burst', () => {
    const first = burst('2026-11-01')
    expect(looksDone(group(), first, '2026-11-05', 'me', { last: '2026-11-01' })).toBeNull()
    const one = [...first, expense('Souvenir', 20_000, '2026-11-08', 'me', ALL)]
    expect(looksDone(group(), one, '2026-11-12', 'me', { last: '2026-11-01' })).toBeNull()
    const again = [...one, ...burst('2026-11-11')]
    expect(looksDone(group(), again, TODAY, 'me', { last: '2026-11-01' })).toMatchObject({ last: '2026-11-11' })
  })

  it('a future-dated bill does not count as the last one', () => {
    expect(looksDone(group(), [...burst('2026-11-10'), expense('Flight', 10_000, '2026-12-20', 'me', ALL)], TODAY, 'me')).toMatchObject({ last: '2026-11-10' })
  })
})
