import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { kittyView, roundUpTopUp, suggestedHolder, type KittyConfig } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha' }
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
function expense(total: number, date: string, payerId: string, ids: string[], more: Partial<Expense> = {}): Expense {
  n++
  const each = Math.floor(total / ids.length)
  const shares = Object.fromEntries(ids.map((id, i) => [id, i === 0 ? total - each * (ids.length - 1) : each]))
  return {
    id: `e${n}`,
    kind: 'split',
    title: 'Thing',
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
const ALL = ['me', 'riya', 'sam', 'neha']
const group = (settlements: Settlement[] = [], memberIds = ALL, more: Partial<Group> = {}): Group => ({
  id: 'goa',
  name: 'Goa',
  emoji: '🏖️',
  kind: 'trip',
  currency: 'INR',
  memberIds,
  settlements,
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  ...more,
})
const config = (more: Partial<KittyConfig> = {}): KittyConfig => ({ holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12', ...more })
const TODAY = '2026-11-14'

describe('kittyView', () => {
  it('with no contributions: nobody has put in, nothing is left, nothing runs out', () => {
    const v = kittyView(group(), [], config(), TODAY)!
    expect(v.members.map((m) => [m.id, m.putIn, m.toPutIn, m.done, m.part])).toEqual([
      ['riya', 0, 0, true, 0],
      ['me', 0, 200_000, false, 0],
      ['sam', 0, 200_000, false, 0],
      ['neha', 0, 200_000, false, 0],
    ])
    expect(v).toMatchObject({ fromOthers: 0, spent: 0, left: 0, doneCount: 0, othersCount: 3, runsOutOn: null, daysLeft: null, topUp: null, days: 3, perDay: 0 })
  })

  it('started on a group with old bills and debts: only what happened since the start counts', () => {
    // Before the kitty: bills paid by different people, a part payment, all unsettled.
    const s = [paid('sam', 'riya', 40_000, '2026-11-10'), paid('riya', 'me', 10_000, '2026-11-11')]
    const e = [expense(320_000, '2026-11-09', 'me', ALL), expense(161_200, '2026-11-10', 'riya', ALL), expense(90_000, '2026-11-11', 'neha', ['neha', 'sam'])]
    const v = kittyView(group(s), e, config({ holderId: 'me', startedOn: TODAY }), TODAY)!
    expect(v).toMatchObject({ fromOthers: 0, spent: 0, othersSpent: 0, holderSpent: 0, left: 0, doneCount: 0, runsOutOn: null, topUp: null })
    for (const m of v.members) expect([m.putIn, m.spentOn, m.part]).toEqual([0, 0, 0])
  })

  it('a payment back from the holder is a return: it comes off what that person put in, never below 0', () => {
    const s = [paid('me', 'riya', 200_000, '2026-11-12'), paid('riya', 'me', 50_000, '2026-11-13'), paid('riya', 'sam', 30_000, '2026-11-13'), paid('riya', 'neha', 10_000, '2026-11-01')]
    const v = kittyView(group(s), [], config(), TODAY)!
    expect(v.members.find((m) => m.id === 'me')).toMatchObject({ putIn: 150_000, toPutIn: 50_000, part: 150_000 })
    expect(v.members.find((m) => m.id === 'sam')).toMatchObject({ putIn: 0, part: 0 })
    expect(v.fromOthers).toBe(150_000)
    expect(v.left).toBe(150_000)
  })

  it('counts payments to the holder since the start, and what is left is the others’ money she holds', () => {
    const s = [paid('me', 'riya', 200_000, '2026-11-12'), paid('sam', 'riya', 200_000, '2026-11-13'), paid('neha', 'riya', 150_000, '2026-11-13')]
    // Riya spends ₹4,000 for all four over the 3 days.
    const e = [expense(400_000, '2026-11-13', 'riya', ALL)]
    const v = kittyView(group(s), e, config(), TODAY)!
    expect(v.fromOthers).toBe(550_000)
    expect(v.spent).toBe(400_000)
    expect(v.othersSpent).toBe(300_000)
    expect(v.holderSpent).toBe(100_000)
    // Others put in 5,500 and 3,000 of their shares was spent: 2,500 of their money left.
    expect(v.left).toBe(250_000)
    const neha = v.members.find((m) => m.id === 'neha')!
    expect(neha).toMatchObject({ putIn: 150_000, toPutIn: 50_000, done: false, spentOn: 100_000, part: 50_000 })
    expect(v.members.find((m) => m.id === 'me')!.part).toBe(100_000)
    // Each other member's part adds up to what is left.
    expect(v.members.filter((m) => !m.holder).reduce((sum, m) => sum + m.part, 0)).toBe(v.left)
    expect(v.doneCount).toBe(2)
  })

  it('ignores payments before the start, from the holder, and to someone else', () => {
    const s = [paid('me', 'riya', 100_000, '2026-11-11'), paid('sam', 'me', 100_000, '2026-11-13'), paid('me', 'riya', 50_000, '2026-11-12')]
    const v = kittyView(group(s), [], config(), TODAY)!
    expect(v.members.find((m) => m.id === 'me')!.putIn).toBe(50_000)
    expect(v.members.find((m) => m.id === 'sam')!.putIn).toBe(0)
  })

  it('with only the holder spending (nobody has put in yet): nothing is left and it has run out today', () => {
    const v = kittyView(group(), [expense(120_000, '2026-11-14', 'riya', ALL)], config(), TODAY)!
    expect(v.left).toBe(0)
    expect(v.spent).toBe(120_000)
    expect(v.members.find((m) => m.id === 'sam')!.part).toBe(-30_000)
    expect(v.daysLeft).toBe(0)
    expect(v.runsOutOn).toBe(TODAY)
    // 3 days, others' share ₹900 → ₹300 a day; two days = ₹600, ₹200 each → ₹200 (already a round ₹100).
    expect(v.othersPerDay).toBe(30_000)
    expect(v.topUp).toBe(20_000)
  })

  it('works out the pace and the day it runs out', () => {
    const s = ['me', 'sam', 'neha'].map((id) => paid(id, 'riya', 200_000, '2026-11-12'))
    // ₹2,400 over 3 days for four: others' share ₹1,800 → ₹600 a day; ₹4,200 of theirs left → 7 days.
    const v = kittyView(group(s), [expense(240_000, '2026-11-12', 'riya', ALL)], config(), TODAY)!
    expect(v.perDay).toBe(80_000)
    expect(v.othersPerDay).toBe(60_000)
    expect(v.left).toBe(420_000)
    expect(v.daysLeft).toBe(7)
    expect(v.runsOutOn).toBe('2026-11-21')
    expect(v.topUp).toBeNull()
  })

  it('suggests a top-up rounded up to the next ₹100 when it runs out within a day', () => {
    const s = ['me', 'sam', 'neha'].map((id) => paid(id, 'riya', 100_000, '2026-11-14'))
    // One day, ₹3,600 for four: others' share ₹2,700 a day; ₹300 left. Two days need ₹5,400 − ₹300 = ₹5,100 → ₹1,700 each.
    const v = kittyView(group(s), [expense(360_000, '2026-11-14', 'riya', ALL)], config({ startedOn: TODAY, perHead: 100_000 }), TODAY)!
    expect(v.left).toBe(30_000)
    expect(v.daysLeft).toBe(0)
    expect(v.topUp).toBe(170_000)
    // Sam put in ₹999: ₹299 left, ₹5,101 needed → ₹1,700.34 each → ₹1,800.
    const s2 = [paid('me', 'riya', 100_000, TODAY), paid('sam', 'riya', 99_900, TODAY), paid('neha', 'riya', 100_000, TODAY)]
    const w = kittyView(group(s2), [expense(360_000, '2026-11-14', 'riya', ALL)], config({ startedOn: TODAY, perHead: 100_000 }), TODAY)!
    expect(w.left).toBe(29_900)
    expect(w.topUp).toBe(180_000)
  })

  it('leaves out bills in other currencies, loans, bills paid by others and bills before the start', () => {
    const s = ['me', 'sam', 'neha'].map((id) => paid(id, 'riya', 200_000, '2026-11-12'))
    const e = [
      expense(400_000, '2026-11-13', 'riya', ALL, { currency: 'THB' }),
      expense(50_000, '2026-11-13', 'riya', ['riya', 'sam'], { kind: 'loan', shares: { sam: 50_000 } }),
      expense(80_000, '2026-11-13', 'sam', ALL),
      expense(80_000, '2026-11-10', 'riya', ALL),
    ]
    const v = kittyView(group(s), e, config(), TODAY)!
    expect(v.spent).toBe(0)
    expect(v.othersPerDay).toBe(0)
    expect(v.runsOutOn).toBeNull()
  })

  it('is exact to the paisa with awkward amounts', () => {
    const s = [paid('me', 'riya', 100_001, '2026-11-12'), paid('sam', 'riya', 99_999, '2026-11-12')]
    const v = kittyView(group(s, ['me', 'riya', 'sam']), [expense(100_001, '2026-11-13', 'riya', ['riya', 'me', 'sam'])], config({ perHead: 100_001 }), TODAY)!
    expect(v.fromOthers).toBe(200_000)
    expect(v.spent).toBe(100_001)
    expect(v.othersSpent + v.holderSpent).toBe(v.spent)
    expect(v.left).toBe(133_334)
    expect(v.members.filter((m) => !m.holder).reduce((sum, m) => sum + m.part, 0)).toBe(v.left)
    expect(Number.isInteger(v.perDay) && Number.isInteger(v.othersPerDay)).toBe(true)
    expect(v.members.find((m) => m.id === 'sam')!.toPutIn).toBe(2)
  })

  it('is null when the holder has left the group or the amount is junk', () => {
    expect(kittyView(group([], ['me', 'sam']), [], config(), TODAY)).toBeNull()
    expect(kittyView(group(), [], config({ perHead: 0 }), TODAY)).toBeNull()
    expect(kittyView(group(), [], config({ perHead: 1.5 }), TODAY)).toBeNull()
  })

  it('a start date in the future counts from today', () => {
    const v = kittyView(group([paid('me', 'riya', 200_000, TODAY)]), [], config({ startedOn: '2027-01-01' }), TODAY)!
    expect(v.startedOn).toBe(TODAY)
    expect(v.days).toBe(1)
    expect(v.members.find((m) => m.id === 'me')!.done).toBe(true)
  })

  it('a group of one: only the holder, nothing to collect', () => {
    const v = kittyView(group([], ['riya']), [expense(10_000, TODAY, 'riya', ['riya'])], config(), TODAY)!
    expect(v.members).toHaveLength(1)
    expect(v.left).toBe(0)
    expect(v.topUp).toBeNull()
  })

  it('handles a hundred people', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `p${i}`)
    const s = ids.slice(1).map((id) => paid(id, 'p0', 100_000, TODAY))
    const v = kittyView(group(s, ids), [expense(1_000_000, TODAY, 'p0', ids)], config({ holderId: 'p0', perHead: 100_000, startedOn: TODAY }), TODAY)!
    expect(v.fromOthers).toBe(9_900_000)
    expect(v.left).toBe(9_900_000 - 990_000)
    expect(v.doneCount).toBe(99)
  })
})

describe('roundUpTopUp', () => {
  it('rounds up to the next ₹100, never down', () => {
    expect(roundUpTopUp(1, 'INR')).toBe(10_000)
    expect(roundUpTopUp(10_000, 'INR')).toBe(10_000)
    expect(roundUpTopUp(10_001, 'INR')).toBe(20_000)
    expect(roundUpTopUp(0, 'INR')).toBe(0)
    expect(roundUpTopUp(150, 'JPY')).toBe(200)
  })
})

describe('suggestedHolder', () => {
  it('picks whoever has paid most for the group, ties by name, else you', () => {
    expect(suggestedHolder(group(), [], nameOf)).toBe('me')
    expect(suggestedHolder(group(), [expense(50_000, TODAY, 'sam', ALL), expense(90_000, TODAY, 'neha', ALL)], nameOf)).toBe('neha')
    expect(suggestedHolder(group(), [expense(50_000, TODAY, 'sam', ALL), expense(50_000, TODAY, 'riya', ALL)], nameOf)).toBe('riya')
    // Other currencies and loans don't count.
    expect(suggestedHolder(group(), [expense(900_000, TODAY, 'sam', ALL, { currency: 'USD' }), expense(900_000, TODAY, 'neha', ['neha', 'me'], { kind: 'loan' })], nameOf)).toBe('me')
  })
})
