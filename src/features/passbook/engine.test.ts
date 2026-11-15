import { describe, expect, it } from 'vitest'
import { ME_ID, type Expense, type Group, type Settlement } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import { passbook, rangeStart, type Passbook } from './engine'

const TODAY = '2026-11-15'
/** Noon, local time, on a day: a timestamp whose local day is that day on any machine. */
const noon = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12).getTime()
}

let seq = 0
function expense(p: Partial<Expense> & { payerId: string; shares: Record<string, number> }): Expense {
  seq += 1
  const total = Object.values(p.shares).reduce((a, b) => a + b, 0)
  const date = p.date ?? '2026-10-01'
  return {
    id: `e${seq}`,
    kind: 'split',
    title: `Bill ${seq}`,
    category: 'food',
    currency: 'INR',
    total,
    date,
    createdAt: noon(date) + seq,
    updatedAt: noon(date) + seq,
    mode: 'exact',
    participants: Object.keys(p.shares).map((friendId) => ({ friendId, input: p.shares[friendId] ?? 0 })),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...p,
  }
}

function group(p: Partial<Group> & { id: string; memberIds: string[] }): Group {
  return { name: `Group ${p.id}`, emoji: '🏖️', kind: 'trip', currency: 'INR', settlements: [], createdAt: 1, updatedAt: 1, archived: false, ...p }
}

function payment(p: Partial<Settlement> & { fromId: string; toId: string; amount: number }): Settlement {
  seq += 1
  const date = p.date ?? '2026-10-10'
  return { id: `s${seq}`, date, createdAt: noon(date) + seq, method: 'upi', ...p }
}

const book = (friendId: string, expenses: Expense[], groups: Group[] = [], range: 'month' | 'three' | 'all' = 'all', currency = 'INR'): Passbook =>
  passbook({ friendId, expenses, groups, currency, today: TODAY, range })

/** The promise of the feature: each ledger closes on the friend page's number, and every currency on the page has a ledger. */
function expectMatchesFriendPage(friendId: string, expenses: Expense[], groups: Group[], currency = 'INR'): void {
  const page = friendBalance(friendId, expenses, groups, currency)
  for (const range of ['all', 'three', 'month'] as const) {
    const made = book(friendId, expenses, groups, range, currency)
    for (const ledger of made.ledgers) {
      expect(ledger.closing, `${friendId} ${ledger.currency} ${range}`).toBe(netIn(page, ledger.currency))
      expect(ledger.matches).toBe(true)
      // The lines themselves add up: opening, plus every line, is the closing balance; and each line carries the running balance.
      let running = ledger.opening
      for (const entry of ledger.entries) {
        expect(entry.amount).not.toBe(0)
        running += entry.amount
        expect(entry.balance).toBe(running)
      }
      expect(running).toBe(ledger.closing)
      expect(ledger.gave - ledger.got).toBe(ledger.closing - ledger.opening)
    }
    for (const total of page.totals) expect(made.ledgers.some((l) => l.currency === total.currency)).toBe(true)
  }
}

describe('rangeStart', () => {
  it('this month starts on the 1st; three months runs from the same day three months back; all has no start', () => {
    expect(rangeStart('month', '2026-11-15')).toBe('2026-11-01')
    expect(rangeStart('three', '2026-11-15')).toBe('2026-08-15')
    expect(rangeStart('all', '2026-11-15')).toBeNull()
  })

  it('the 31st three months back in a 30-day month is its last day, and it crosses a year', () => {
    expect(rangeStart('three', '2026-05-31')).toBe('2026-02-28')
    expect(rangeStart('three', '2028-05-31')).toBe('2028-02-29')
    expect(rangeStart('three', '2026-01-20')).toBe('2025-10-20')
  })
})

describe('passbook: outside groups', () => {
  it('has nothing for nobody, for yourself, and for someone you have no money with', () => {
    expect(book('riya', []).ledgers).toEqual([])
    expect(book(ME_ID, [expense({ payerId: ME_ID, shares: { me: 100, riya: 100 } })]).ledgers).toEqual([])
    expect(book('riya', [expense({ payerId: ME_ID, shares: { me: 100, sam: 100 } })]).count).toBe(0)
    // A bill someone else paid for the two of us is not between us.
    expect(book('riya', [expense({ payerId: 'sam', shares: { me: 100, riya: 100 } })]).count).toBe(0)
  })

  it('a bill I paid adds their share; a bill they paid takes my share off; the lines run oldest first', () => {
    const expenses = [
      expense({ title: 'Dinner', payerId: ME_ID, shares: { me: 40_000, riya: 60_000 }, date: '2026-10-05' }),
      expense({ title: 'Cab', payerId: 'riya', shares: { me: 15_000, riya: 15_000 }, date: '2026-10-02' }),
    ]
    const [ledger] = book('riya', expenses).ledgers
    expect(ledger?.entries.map((e) => [e.date, e.kind, e.title, e.amount, e.balance])).toEqual([
      ['2026-10-02', 'paidForYou', 'Cab', -15_000, -15_000],
      ['2026-10-05', 'paidForThem', 'Dinner', 60_000, 45_000],
    ])
    expect(ledger).toMatchObject({ currency: 'INR', opening: 0, closing: 45_000, gave: 60_000, got: 15_000, earlier: 0, adjusted: [] })
    expectMatchesFriendPage('riya', expenses, [])
  })

  it('ticking a share off is a payment on the day it was ticked, and the bill comes before its own payment', () => {
    const paid = expense({ title: 'Movie', payerId: ME_ID, shares: { me: 30_000, riya: 30_000 }, date: '2026-10-05', paidBack: { riya: noon('2026-10-09') } })
    const sameDay = expense({ title: 'Chai', payerId: 'riya', shares: { me: 2_000, riya: 2_000 }, date: '2026-10-12' })
    // Ticked a moment before the bill's own timestamp (a bill edited afterwards): still listed after the bill.
    sameDay.paidBack = { me: sameDay.createdAt - 5_000 }
    const [ledger] = book('riya', [paid, sameDay]).ledgers
    expect(ledger?.entries.map((e) => [e.date, e.kind, e.amount, e.balance])).toEqual([
      ['2026-10-05', 'paidForThem', 30_000, 30_000],
      ['2026-10-09', 'theyPaid', -30_000, 0],
      ['2026-10-12', 'paidForYou', -2_000, -2_000],
      ['2026-10-12', 'youPaid', 2_000, 0],
    ])
    expect(ledger?.closing).toBe(0)
    expectMatchesFriendPage('riya', [paid, sameDay], [])
  })

  it('a part payment is a payment for the part, marked as a part, and the rest stays open', () => {
    const e = expense({ title: 'Hotel', payerId: ME_ID, shares: { me: 100_000, riya: 42_000 }, date: '2026-10-05', partPaid: { riya: 20_000 } })
    e.updatedAt = noon('2026-10-20')
    const [ledger] = book('riya', [e]).ledgers
    expect(ledger?.entries.map((x) => [x.date, x.kind, x.part, x.amount, x.balance])).toEqual([
      ['2026-10-05', 'paidForThem', false, 42_000, 42_000],
      ['2026-10-20', 'theyPaid', true, -20_000, 22_000],
    ])
    expectMatchesFriendPage('riya', [e], [])
  })

  it('a payment is never dated before its bill, even when the bill was re-dated later', () => {
    const e = expense({ payerId: ME_ID, shares: { me: 100, riya: 5_000 }, date: '2026-11-10', paidBack: { riya: noon('2026-11-02') } })
    const [ledger] = book('riya', [e]).ledgers
    expect(ledger?.entries.map((x) => x.date)).toEqual(['2026-11-10', '2026-11-10'])
    expect(ledger?.closing).toBe(0)
  })

  it('a loan is a loan, not a bill: lent and borrowed', () => {
    const expenses = [
      expense({ kind: 'loan', title: 'Cash', payerId: ME_ID, shares: { riya: 500_000 }, date: '2026-09-01' }),
      expense({ kind: 'loan', title: 'Cash', payerId: 'riya', shares: { me: 120_000 }, date: '2026-09-20' }),
      // The part of the first loan that came back: saved by the app as its own paid-back record.
      expense({ kind: 'loan', title: 'Cash', payerId: ME_ID, shares: { riya: 100_000 }, date: '2026-09-01', paidBack: { riya: noon('2026-10-01') } }),
    ]
    const [ledger] = book('riya', expenses).ledgers
    expect(ledger?.entries.map((e) => [e.kind, e.amount])).toEqual([
      ['lent', 500_000],
      ['lent', 100_000],
      ['borrowed', -120_000],
      ['theyPaid', -100_000],
    ])
    expect(ledger?.closing).toBe(380_000)
    expectMatchesFriendPage('riya', expenses, [])
  })

  it('keeps other currencies apart, the profile currency first, then A to Z', () => {
    const expenses = [
      expense({ payerId: ME_ID, shares: { me: 1_000, riya: 2_500 }, currency: 'USD' }),
      expense({ payerId: 'riya', shares: { me: 9_000, riya: 9_000 }, currency: 'AED' }),
      expense({ payerId: ME_ID, shares: { me: 50_000, riya: 50_000 } }),
    ]
    const made = book('riya', expenses)
    expect(made.ledgers.map((l) => [l.currency, l.closing])).toEqual([
      ['INR', 50_000],
      ['AED', -9_000],
      ['USD', 2_500],
    ])
    expect(made.count).toBe(3)
    expect(book('riya', expenses, [], 'all', 'USD').ledgers.map((l) => l.currency)).toEqual(['USD', 'AED', 'INR'])
    expectMatchesFriendPage('riya', expenses, [])
  })

  it('a currency that is all paid back still has its ledger, closing on zero', () => {
    const e = expense({ payerId: ME_ID, shares: { me: 1_000, riya: 2_500 }, currency: 'USD', paidBack: { riya: noon('2026-10-03') } })
    const made = book('riya', [e])
    expect(made.ledgers).toHaveLength(1)
    expect(made.ledgers[0]).toMatchObject({ currency: 'USD', closing: 0, matches: true })
    expect(made.ledgers[0]?.entries).toHaveLength(2)
  })

  it('ignores shares that are zero, negative or not numbers, and a paid-back mark with no share', () => {
    const expenses = [
      expense({ payerId: ME_ID, shares: { me: 100, riya: 0 }, paidBack: { riya: noon('2026-10-03') } }),
      expense({ payerId: ME_ID, shares: { me: 100, riya: -500 } }),
      expense({ payerId: 'riya', shares: { riya: 100, me: Number.NaN } }),
    ]
    expect(book('riya', expenses).count).toBe(0)
    expectMatchesFriendPage('riya', expenses, [])
  })

  it('part paid more than the share (junk) never takes the balance below what the friend page says', () => {
    const e = expense({ payerId: ME_ID, shares: { me: 100, riya: 5_000 }, partPaid: { riya: 9_000 } })
    expect(book('riya', [e]).ledgers[0]?.closing).toBe(0)
    expectMatchesFriendPage('riya', [e], [])
  })
})

describe('passbook: opening balance and dates', () => {
  const expenses = [
    expense({ title: 'Old trip', payerId: ME_ID, shares: { me: 10_000, riya: 90_000 }, date: '2026-03-02' }),
    expense({ title: 'September dinner', payerId: 'riya', shares: { me: 20_000, riya: 20_000 }, date: '2026-09-10' }),
    expense({ title: 'This month', payerId: ME_ID, shares: { me: 5_000, riya: 5_000 }, date: '2026-11-03' }),
  ]

  it('everything: opens on zero', () => {
    const [ledger] = book('riya', expenses, [], 'all').ledgers
    expect(ledger).toMatchObject({ opening: 0, closing: 75_000, earlier: 0 })
    expect(ledger?.entries).toHaveLength(3)
  })

  it('three months: the opening balance stands for what came before', () => {
    const made = book('riya', expenses, [], 'three')
    expect(made.from).toBe('2026-08-15')
    expect(made.ledgers[0]).toMatchObject({ opening: 90_000, closing: 75_000, earlier: 1, gave: 5_000, got: 20_000 })
    expect(made.ledgers[0]?.entries.map((e) => e.title)).toEqual(['September dinner', 'This month'])
  })

  it('this month: one line, and the same closing balance', () => {
    const [ledger] = book('riya', expenses, [], 'month').ledgers
    expect(ledger).toMatchObject({ opening: 70_000, closing: 75_000, earlier: 2 })
    expect(ledger?.entries.map((e) => e.title)).toEqual(['This month'])
  })

  it('nothing in the dates: no lines, opening equals closing', () => {
    const [ledger] = book('riya', expenses.slice(0, 2), [], 'month').ledgers
    expect(ledger).toMatchObject({ opening: 70_000, closing: 70_000, earlier: 2, gave: 0, got: 0 })
    expect(ledger?.entries).toEqual([])
  })

  it('a bill on the first day of the range is in it', () => {
    const edge = [expense({ payerId: ME_ID, shares: { me: 100, riya: 700 }, date: '2026-11-01' }), expense({ payerId: ME_ID, shares: { me: 100, riya: 300 }, date: '2026-10-31' })]
    const [ledger] = book('riya', edge, [], 'month').ledgers
    expect(ledger).toMatchObject({ opening: 300, closing: 1_000 })
    expect(ledger?.entries).toHaveLength(1)
  })
})

describe('passbook: groups', () => {
  it('a group of two needs no extra line: bills and payments are the whole story', () => {
    const flat = group({ id: 'flat', memberIds: [ME_ID, 'riya'], settlements: [payment({ fromId: 'riya', toId: ME_ID, amount: 30_000, date: '2026-10-08' })] })
    const expenses = [
      expense({ title: 'Rent', groupId: 'flat', payerId: ME_ID, shares: { me: 50_000, riya: 50_000 }, date: '2026-10-01' }),
      expense({ title: 'Wifi', groupId: 'flat', payerId: 'riya', shares: { me: 5_000, riya: 5_000 }, date: '2026-10-04' }),
    ]
    const [ledger] = book('riya', expenses, [flat]).ledgers
    expect(ledger?.entries.map((e) => [e.kind, e.groupName, e.amount, e.balance])).toEqual([
      ['paidForThem', 'Group flat', 50_000, 50_000],
      ['paidForYou', 'Group flat', -5_000, 45_000],
      ['theyPaid', 'Group flat', -30_000, 15_000],
    ])
    expect(ledger?.adjusted).toEqual([])
    expectMatchesFriendPage('riya', expenses, [flat])
  })

  it('a payment I made in a group raises what they owe me (or lowers what I owe)', () => {
    const flat = group({ id: 'flat', memberIds: [ME_ID, 'riya'], settlements: [payment({ fromId: ME_ID, toId: 'riya', amount: 5_000 })] })
    const expenses = [expense({ groupId: 'flat', payerId: 'riya', shares: { me: 5_000, riya: 5_000 } })]
    const [ledger] = book('riya', expenses, [flat]).ledgers
    expect(ledger?.entries.map((e) => [e.kind, e.amount])).toEqual([
      ['paidForYou', -5_000],
      ['youPaid', 5_000],
    ])
    expect(ledger?.closing).toBe(0)
    expectMatchesFriendPage('riya', expenses, [flat])
  })

  it('where a group settles in fewer payments, one line says so and the closing is still the friend page’s number', () => {
    // I paid ₹3,000 for Riya only; Riya paid ₹3,000 for Sam only. The group settles as: Sam pays me ₹3,000.
    const trip = group({ id: 'goa', name: 'Goa trip', memberIds: [ME_ID, 'riya', 'sam'] })
    const expenses = [
      expense({ title: 'Scooter', groupId: 'goa', payerId: ME_ID, shares: { riya: 300_000 }, date: '2026-10-02' }),
      expense({ title: 'Ferry', groupId: 'goa', payerId: 'riya', shares: { sam: 300_000 }, date: '2026-10-03' }),
    ]
    const withRiya = book('riya', expenses, [trip]).ledgers[0]
    expect(withRiya?.entries.map((e) => [e.date, e.kind, e.groupName, e.amount, e.balance])).toEqual([
      ['2026-10-02', 'paidForThem', 'Goa trip', 300_000, 300_000],
      [TODAY, 'group', 'Goa trip', -300_000, 0],
    ])
    expect(withRiya?.adjusted).toEqual([{ groupId: 'goa', groupName: 'Goa trip', amount: -300_000 }])
    expect(withRiya?.closing).toBe(0)

    // With Sam there is no bill between us at all, only the group's line.
    const withSam = book('sam', expenses, [trip]).ledgers[0]
    expect(withSam?.entries.map((e) => [e.kind, e.amount, e.balance])).toEqual([['group', 300_000, 300_000]])
    expectMatchesFriendPage('riya', expenses, [trip])
    expectMatchesFriendPage('sam', expenses, [trip])
  })

  it('the group’s line is shown in every range and always comes last, even after a future-dated bill', () => {
    const trip = group({ id: 'goa', memberIds: [ME_ID, 'riya', 'sam'] })
    const expenses = [
      expense({ groupId: 'goa', payerId: ME_ID, shares: { riya: 300_000 }, date: '2026-06-02' }),
      expense({ groupId: 'goa', payerId: 'riya', shares: { sam: 300_000 }, date: '2026-06-03' }),
      expense({ title: 'Tomorrow', payerId: ME_ID, shares: { riya: 1_000 }, date: '2026-11-16' }),
    ]
    const month = book('riya', expenses, [trip], 'month').ledgers[0]
    expect(month?.opening).toBe(300_000)
    expect(month?.entries.map((e) => e.kind)).toEqual(['paidForThem', 'group'])
    expect(month?.closing).toBe(1_000)
    expectMatchesFriendPage('riya', expenses, [trip])
  })

  it('an archived group still counts, as it does on the friend page', () => {
    const old = group({ id: 'old', memberIds: [ME_ID, 'riya'], archived: true })
    const expenses = [expense({ groupId: 'old', payerId: ME_ID, shares: { me: 100, riya: 7_700 } })]
    expect(book('riya', expenses, [old]).ledgers[0]?.closing).toBe(7_700)
    expectMatchesFriendPage('riya', expenses, [old])
  })

  it('a bill in a group but in another currency, or in a group that is gone, is settled person to person', () => {
    const trip = group({ id: 'thai', memberIds: [ME_ID, 'riya', 'sam'], currency: 'INR' })
    const expenses = [
      expense({ title: 'Baht bill', groupId: 'thai', currency: 'THB', payerId: ME_ID, shares: { me: 100, riya: 40_000, sam: 40_000 }, paidBack: { riya: noon('2026-10-06') } }),
      expense({ title: 'Deleted group', groupId: 'gone', payerId: 'riya', shares: { me: 12_300, riya: 100 } }),
    ]
    const made = book('riya', expenses, [trip])
    expect(made.ledgers.map((l) => [l.currency, l.closing, l.entries.map((e) => e.kind)])).toEqual([
      ['INR', -12_300, ['paidForYou']],
      ['THB', 0, ['paidForThem', 'theyPaid']],
    ])
    expectMatchesFriendPage('riya', expenses, [trip])
  })

  it('payments with other people in the group, to yourself, or of no amount are not between the two of us', () => {
    const trip = group({
      id: 'goa',
      memberIds: [ME_ID, 'riya', 'sam'],
      settlements: [
        payment({ fromId: 'sam', toId: ME_ID, amount: 10_000 }),
        payment({ fromId: 'riya', toId: 'sam', amount: 10_000 }),
        payment({ fromId: 'riya', toId: 'riya', amount: 99_000 }),
        payment({ fromId: 'riya', toId: ME_ID, amount: Number.NaN }),
      ],
    })
    const expenses = [expense({ groupId: 'goa', payerId: ME_ID, shares: { me: 10_000, riya: 10_000, sam: 10_000 } })]
    const ledger = book('riya', expenses, [trip]).ledgers[0]
    expect(ledger?.entries.filter((e) => e.kind === 'theyPaid' || e.kind === 'youPaid')).toEqual([])
    expectMatchesFriendPage('riya', expenses, [trip])
    expectMatchesFriendPage('sam', expenses, [trip])
  })

  it('groups, loose splits, loans, payments and three currencies at once', () => {
    const flat = group({ id: 'flat', memberIds: [ME_ID, 'riya', 'sam', 'asha'], settlements: [payment({ fromId: 'riya', toId: ME_ID, amount: 12_345 }), payment({ fromId: ME_ID, toId: 'sam', amount: 501 })] })
    const dubai = group({ id: 'dubai', memberIds: [ME_ID, 'riya'], currency: 'AED', settlements: [payment({ fromId: ME_ID, toId: 'riya', amount: 3_000 })] })
    const expenses = [
      expense({ groupId: 'flat', payerId: ME_ID, shares: { me: 33_334, riya: 33_333, sam: 33_333 } }),
      expense({ groupId: 'flat', payerId: 'sam', shares: { me: 10_001, riya: 20_002, asha: 7 } }),
      expense({ groupId: 'flat', payerId: 'asha', shares: { riya: 99_999 } }),
      expense({ groupId: 'dubai', currency: 'AED', payerId: 'riya', shares: { me: 12_000, riya: 12_000 } }),
      expense({ groupId: 'dubai', currency: 'USD', payerId: ME_ID, shares: { me: 100, riya: 4_200 } }),
      expense({ payerId: ME_ID, shares: { me: 1, riya: 99 }, partPaid: { riya: 50 } }),
      expense({ kind: 'loan', payerId: 'riya', shares: { me: 250_000 } }),
      expense({ kind: 'loan', payerId: ME_ID, shares: { sam: 70_000 }, paidBack: { sam: noon('2026-10-30') } }),
    ]
    for (const friend of ['riya', 'sam', 'asha', 'nobody']) expectMatchesFriendPage(friend, expenses, [flat, dubai])
    expect(book('riya', expenses, [flat, dubai]).ledgers.map((l) => l.currency)).toEqual(['INR', 'AED', 'USD'])
  })
})

describe('passbook: every case a seeded shuffle can construct', () => {
  // A small deterministic generator (mulberry32): the same cases on every run and every machine.
  function rng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const PEOPLE = [ME_ID, 'riya', 'sam', 'asha', 'dev', 'gita']
  const CURRENCIES = ['INR', 'INR', 'INR', 'USD', 'AED']
  const DATES = ['2025-12-31', '2026-02-28', '2026-07-04', '2026-08-15', '2026-08-16', '2026-10-31', '2026-11-01', '2026-11-15', '2026-11-20']

  it('closes on the friend page’s number for every friend, range and currency (300 worlds)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed)
      const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T
      const groups: Group[] = []
      const groupCount = Math.floor(next() * 4)
      for (let g = 0; g < groupCount; g++) {
        const members = PEOPLE.filter((id) => id === ME_ID || next() < 0.6)
        const settlements: Settlement[] = []
        const pays = Math.floor(next() * 4)
        for (let s = 0; s < pays; s++) settlements.push(payment({ fromId: pick(members), toId: pick(members), amount: 1 + Math.floor(next() * 50_000), date: pick(DATES) }))
        groups.push(group({ id: `g${g}`, memberIds: members, currency: pick(CURRENCIES), archived: next() < 0.2, settlements }))
      }
      const expenses: Expense[] = []
      const expenseCount = Math.floor(next() * 14)
      for (let i = 0; i < expenseCount; i++) {
        const g = next() < 0.55 && groups.length > 0 ? pick(groups) : null
        const pool = g ? g.memberIds : PEOPLE
        const payerId = pick(pool)
        const loan = next() < 0.2
        const shares: Record<string, number> = {}
        if (loan) {
          const other = pick(pool.filter((id) => id !== payerId).concat(payerId === ME_ID ? ['riya'] : [ME_ID]))
          shares[other] = 1 + Math.floor(next() * 500_000)
        } else {
          for (const id of pool) if (id === payerId || next() < 0.7) shares[id] = Math.floor(next() * 100_001)
        }
        const paidBack: Record<string, number> = {}
        const partPaid: Record<string, number> = {}
        const date = pick(DATES)
        for (const [id, value] of Object.entries(shares)) {
          if (id === payerId || value === 0) continue
          const roll = next()
          if (roll < 0.3) paidBack[id] = noon(pick(DATES))
          else if (roll < 0.45 && value > 1) partPaid[id] = 1 + Math.floor(next() * (value - 1))
        }
        const e = expense({
          kind: loan ? 'loan' : 'split',
          payerId,
          shares,
          date,
          // Sometimes the group's own currency, sometimes another; sometimes a group that no longer exists.
          currency: g && next() < 0.8 ? g.currency : pick(CURRENCIES),
          groupId: g ? g.id : next() < 0.1 ? 'deleted-group' : null,
          paidBack,
        })
        if (Object.keys(partPaid).length > 0) e.partPaid = partPaid
        expenses.push(e)
      }
      for (const friend of PEOPLE.slice(1)) expectMatchesFriendPage(friend, expenses, groups, pick(CURRENCIES))
    }
  })

  it('a long history stays quick and exact (2,000 bills)', () => {
    const next = rng(7)
    const flat = group({ id: 'flat', memberIds: [ME_ID, 'riya', 'sam'] })
    const expenses: Expense[] = []
    for (let i = 0; i < 2_000; i++) {
      const inGroup = i % 3 === 0
      const payerId = next() < 0.5 ? ME_ID : 'riya'
      expenses.push(
        expense({
          groupId: inGroup ? 'flat' : null,
          payerId,
          shares: { me: 1 + Math.floor(next() * 9_999), riya: 1 + Math.floor(next() * 9_999), ...(inGroup ? { sam: 1 + Math.floor(next() * 9_999) } : {}) },
          date: DATES[i % DATES.length] ?? '2026-10-01',
        }),
      )
    }
    const made = book('riya', expenses, [flat])
    expect(made.count).toBeGreaterThanOrEqual(2_000)
    expectMatchesFriendPage('riya', expenses, [flat])
  })
})
