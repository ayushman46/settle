import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { addDays } from '../../engine/dates'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { bandFor, FULL_HISTORY, NEUTRAL_SCORE, settleScore, type Factor, type FactorId, type SettleScore } from './engine'

const TODAY = '2026-11-14'
const noonOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12).getTime()
}

let n = 0
function expense(total: number, date: string, payerId: string, ids: string[], more: Partial<Expense> = {}): Expense {
  n++
  const each = Math.floor(total / ids.length)
  const shares = Object.fromEntries(ids.map((id, i) => [id, i === 0 ? total - each * (ids.length - 1) : each]))
  return {
    id: `e${n}`,
    kind: 'split',
    title: `Bill ${n}`,
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
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
/** Someone else paid; I owe my half. Paid back `after` days later (or still open). */
const owed = (date: string, after: number | null, payer = 'sam', total = 80_000): Expense =>
  expense(total, date, payer, [payer, 'me'], after === null ? {} : { paidBack: { me: noonOf(addDays(date, after)) } })
const fronted = (date: string, total = 60_000): Expense => expense(total, date, 'me', ['me', 'riya'])
const paid = (fromId: string, toId: string, amount: number, date: string): Settlement => ({ id: `s${++n}`, fromId, toId, amount, date, createdAt: n, method: 'upi' })
const group = (settlements: Settlement[] = [], id = 'goa'): Group => ({ id, name: id === 'goa' ? 'Goa' : 'Flat', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: ['me', 'riya', 'sam'], settlements, createdAt: 1, updatedAt: 1, archived: false })

const score = (expenses: Expense[], groups: Group[] = [], today = TODAY): SettleScore => settleScore({ expenses, groups, today, nameOf: (_k, id) => id })
const factor = <K extends FactorId>(s: SettleScore, id: K): Extract<Factor, { id: K }> => s.factors.find((f) => f.id === id) as Extract<Factor, { id: K }>

describe('a new user', () => {
  it('starts at a neutral 600 and isn’t ready yet', () => {
    const s = score([])
    expect(s.score).toBe(NEUTRAL_SCORE)
    expect(s.band).toBe('getting')
    expect(s.ready).toBe(false)
    expect(s.next).toBeNull()
    expect(s.factors.map((f) => f.id)).toEqual(['speed', 'onTime', 'overdue', 'fronted', 'history'])
    expect(s.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100)
  })

  it('two perfect splits can’t make a gold standard', () => {
    const s = score([owed('2026-11-10', 0), owed('2026-11-11', 0)])
    expect(s.splits).toBe(2)
    expect(s.ready).toBe(false)
    expect(s.score).toBeGreaterThan(NEUTRAL_SCORE)
    expect(s.score).toBeLessThan(700)
  })

  it('a long, fast history reaches gold; a long, slow one is slow to settle', () => {
    const fast = Array.from({ length: 14 }, (_, i) => owed(addDays('2026-09-01', i * 4), 0))
    const fastScore = score([...fast, ...Array.from({ length: 10 }, (_, i) => fronted(addDays('2026-09-02', i * 4)))])
    expect(fastScore.ready).toBe(true)
    expect(fastScore.band).toBe('gold')
    const slow = Array.from({ length: 14 }, (_, i) => owed(addDays('2026-08-01', i * 4), null))
    const slowScore = score(slow)
    expect(slowScore.band).toBe('warming')
    expect(slowScore.score).toBeGreaterThanOrEqual(300)
  })
})

describe('bands', () => {
  it('names every range', () => {
    expect(bandFor(300)).toBe('warming')
    expect(bandFor(549)).toBe('warming')
    expect(bandFor(550)).toBe('getting')
    expect(bandFor(699)).toBe('getting')
    expect(bandFor(700)).toBe('solid')
    expect(bandFor(799)).toBe('solid')
    expect(bandFor(800)).toBe('gold')
    expect(bandFor(900)).toBe('gold')
  })
})

describe('the factors', () => {
  it('speed is the median days to pay back (open debts count their age so far)', () => {
    const s = score([owed('2026-11-01', 1), owed('2026-11-01', 3), owed('2026-11-01', 10)])
    expect(factor(s, 'speed')).toMatchObject({ medianDays: 3, count: 3, sub: 85 })
    const open = score([owed('2026-11-04', null)])
    expect(factor(open, 'speed').medianDays).toBe(10)
  })

  it('on time: paid within 3 days; an open debt counts only once it’s late', () => {
    const s = score([owed('2026-11-01', 2), owed('2026-11-01', 5), owed('2026-11-13', null), owed('2026-11-01', null)])
    expect(factor(s, 'onTime')).toMatchObject({ onTime: 1, counted: 3, sub: 33 })
  })

  it('what you’ve owed for more than a week hurts, more the older it is', () => {
    const none = score([owed('2026-11-10', null)])
    expect(factor(none, 'overdue')).toMatchObject({ count: 0, sub: 100 })
    const one = score([owed('2026-11-04', null, 'sam', 80_000)])
    expect(factor(one, 'overdue')).toMatchObject({ count: 1, oldestDays: 10, amount: 40_000, sub: 100 - (30 + 3) })
    const older = score([owed('2026-10-01', null)])
    expect(factor(older, 'overdue').sub).toBe(100 - 60)
  })

  it('bills you paid for others help, capped', () => {
    expect(factor(score([fronted('2026-11-01')]), 'fronted')).toMatchObject({ bills: 1, sub: 10 })
    expect(factor(score(Array.from({ length: 15 }, () => fronted('2026-11-01'))), 'fronted').sub).toBe(100)
    // A ₹20 chai isn't a bill for the factor (it still counts as history).
    const chai = score([fronted('2026-11-01', 2_000)])
    expect(factor(chai, 'fronted').bills).toBe(0)
    expect(chai.splits).toBe(1)
  })

  it('history grows to full at 12 splits', () => {
    expect(factor(score(Array.from({ length: 6 }, () => fronted('2026-11-01'))), 'history').sub).toBe(50)
    expect(factor(score(Array.from({ length: FULL_HISTORY + 3 }, () => fronted('2026-11-01'))), 'history').sub).toBe(100)
  })
})

describe('what counts', () => {
  it('loans are ignored, and so is the future', () => {
    const loan = expense(50_000, '2026-10-01', 'sam', ['me'], { kind: 'loan', shares: { me: 50_000 } })
    expect(score([loan])).toEqual(score([]))
    expect(score([owed('2026-11-20', null)])).toEqual(score([]))
  })

  it('a split I’m not in, or one where I paid only for myself, doesn’t count', () => {
    expect(score([expense(10_000, '2026-11-01', 'sam', ['sam', 'riya']), expense(10_000, '2026-11-01', 'me', ['me'])]).splits).toBe(0)
  })

  it('in a group: owing starts when my balance goes below zero and ends with the payment', () => {
    const e = expense(90_000, '2026-11-01', 'riya', ['riya', 'me', 'sam'], { groupId: 'goa' })
    const s = score([e], [group([paid('me', 'riya', 30_000, '2026-11-03')])])
    expect(factor(s, 'speed')).toMatchObject({ medianDays: 2, count: 1 })
    expect(factor(s, 'onTime')).toMatchObject({ onTime: 1, counted: 1 })
    expect(s.next).toBeNull()

    const open = score([e], [group()])
    expect(factor(open, 'overdue')).toMatchObject({ count: 1, oldestDays: 13, amount: 30_000 })
    expect(open.next).toMatchObject({ kind: 'group', groupId: 'goa', amount: 30_000 })
    expect(open.next!.gain).toBeGreaterThan(0)
  })

  it('a group expense in another currency is settled person to person', () => {
    const e = expense(90_000, '2026-11-01', 'riya', ['riya', 'me'], { groupId: 'goa', currency: 'THB' })
    const s = score([e], [group()])
    expect(s.next).toMatchObject({ kind: 'friend', friendId: 'riya', currency: 'THB', amount: 45_000 })
    // The overdue amount is told in the profile currency only.
    expect(factor(s, 'overdue')).toMatchObject({ count: 1, amount: 0 })
  })

  it('the next step is the payment that adds most; ties go by amount, then name', () => {
    const s = score([owed('2026-10-01', null, 'sam', 80_000), owed('2026-11-12', null, 'neha', 20_000)])
    expect(s.next).toMatchObject({ kind: 'friend', friendId: 'sam', amount: 40_000 })
    const tie = score([owed('2026-10-01', null, 'zoe', 80_000), owed('2026-10-01', null, 'amit', 80_000)])
    expect(tie.next).toMatchObject({ friendId: 'amit' })
  })

  it('is the same whatever order the data comes in', () => {
    const list = [owed('2026-10-01', 2), owed('2026-10-05', null), fronted('2026-10-06'), owed('2026-11-01', 9, 'riya')]
    expect(score([...list].reverse())).toEqual(score(list))
  })
})

/* ------------------------------------------------------------------ the promise: paying never lowers it */

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 0x1_0000_0000
  }
}

function history(seed: number): { expenses: Expense[]; groups: Group[] } {
  const r = rng(seed)
  const pick = <T,>(list: T[]): T => list[Math.floor(r() * list.length)] as T
  const expenses: Expense[] = []
  const settlements: Settlement[] = []
  const count = 1 + Math.floor(r() * 25)
  for (let i = 0; i < count; i++) {
    const date = addDays(TODAY, -Math.floor(r() * 60))
    const inGroup = r() < 0.4
    const payer = pick(['me', 'riya', 'sam'])
    const total = 1_000 + Math.floor(r() * 200_000)
    const kind = r() < 0.08 ? 'loan' : 'split'
    const ids = kind === 'loan' ? [payer === 'me' ? 'riya' : 'me'] : ['me', 'riya', 'sam'].filter((id) => id === payer || id === 'me' || r() < 0.6)
    const e = expense(total, date, payer, ids, { groupId: inGroup ? 'goa' : null, kind })
    if (kind === 'loan') e.shares = { [ids[0] as string]: total }
    if (!inGroup && payer !== 'me' && r() < 0.5) e.paidBack = { me: noonOf(addDays(date, Math.floor(r() * 15))) }
    if (!inGroup && payer !== 'me' && !e.paidBack.me && r() < 0.2) e.partPaid = { me: Math.max(1, Math.floor((e.shares.me ?? 2) / 2)) }
    expenses.push(e)
    if (inGroup && r() < 0.4) settlements.push(paid(r() < 0.6 ? 'me' : 'riya', r() < 0.5 ? 'sam' : 'riya', 1_000 + Math.floor(r() * 50_000), addDays(date, Math.floor(r() * 10))))
  }
  return { expenses, groups: [group(settlements.filter((s) => s.date <= TODAY && s.fromId !== s.toId))] }
}

describe('paying something off can never lower the score', () => {
  it('holds over 300 generated histories, for every open debt, in full or in part', () => {
    let checked = 0
    for (let seed = 1; seed <= 300; seed++) {
      const { expenses, groups } = history(seed)
      const before = score(expenses, groups).score
      // Each open share outside a group, ticked off today.
      for (const e of expenses) {
        if (e.groupId !== null || e.kind === 'loan' || e.payerId === 'me' || !(e.shares.me! > 0) || e.paidBack.me !== undefined) continue
        const after = score(
          expenses.map((x) => (x.id === e.id ? { ...x, paidBack: { ...x.paidBack, me: noonOf(TODAY) } } : x)),
          groups,
        ).score
        expect(after, `seed ${seed}, ${e.id}`).toBeGreaterThanOrEqual(before)
        checked++
      }
      // What I owe in the group, paid today: all of it, then half of it.
      const g = groups[0]!
      for (const t of simplifyDebts(groupBalances(g, expenses)).filter((x) => x.fromId === 'me')) {
        for (const amount of [t.amount, Math.max(1, Math.floor(t.amount / 2))]) {
          const after = score(expenses, [{ ...g, settlements: [...g.settlements, paid('me', t.toId, amount, TODAY)] }]).score
          expect(after, `seed ${seed}, group ${amount}`).toBeGreaterThanOrEqual(before)
          checked++
        }
      }
      // The next step, taken, adds what it says (or more).
      const s = score(expenses, groups)
      if (s.next?.kind === 'friend') {
        const friend = s.next.friendId
        const after = score(expenses.map((x) => (x.groupId === null && x.payerId === friend && x.paidBack.me === undefined && x.kind !== 'loan' ? { ...x, paidBack: { ...x.paidBack, me: noonOf(TODAY) } } : x)), groups).score
        expect(after - s.score).toBe(s.next.gain)
      }
    }
    expect(checked).toBeGreaterThan(200)
  })

  it('is always between 300 and 900 and the same every time', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { expenses, groups } = history(seed)
      const a = score(expenses, groups)
      expect(a.score).toBeGreaterThanOrEqual(300)
      expect(a.score).toBeLessThanOrEqual(900)
      expect(score(expenses, groups)).toEqual(a)
    }
  })
})
