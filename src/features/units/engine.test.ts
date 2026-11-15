import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { splitAmount } from '../../engine/split'
import {
  addHousehold,
  addToHousehold,
  applyUnits,
  cleanGroupUnits,
  emptyUnits,
  hasHouseholds,
  householdOf,
  isEqualWeights,
  matchesUnitsSplit,
  needsAmount,
  planUnitPayment,
  removeFromHousehold,
  removeHousehold,
  renameHousehold,
  resolveUnits,
  setChild,
  setPayer,
  unitBalances,
  unitShares,
  unitsSplitFor,
  unitsSummary,
  unitTransfers,
  unitWeights,
  unitWeightsFor,
  type GroupUnits,
  type Household,
  type PlannedPayment,
} from './engine'

// The Sharmas: Rahul, Priya and their children Anu and Kabir. The Khans: Imran and Sana. Sam is on his own.
const SHARMAS = ['rahul', 'priya', 'anu', 'kabir']
const KHANS = ['imran', 'sana']
const MEMBERS = ['me', ...SHARMAS, ...KHANS, 'sam']
const NAMES: Record<string, string> = { me: 'Ayush', rahul: 'Rahul', priya: 'Priya', anu: 'Anu', kabir: 'Kabir', imran: 'Imran', sana: 'Sana', sam: 'Sam' }
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
function expense(total: number, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id: `e${n}`,
    kind: 'split',
    title: `Expense ${n}`,
    category: 'food',
    currency: 'INR',
    total,
    date: '2026-11-14',
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.keys(shares).map((friendId) => ({ friendId, input: shares[friendId] ?? 0 })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'trip',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const group = (memberIds: string[] = MEMBERS, settlements: Settlement[] = [], more: Partial<Group> = {}): Group => ({
  id: 'trip',
  name: 'Manali',
  emoji: '🏔️',
  kind: 'trip',
  currency: 'INR',
  memberIds,
  settlements,
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  ...more,
})
const household = (id: string, memberIds: string[], more: Partial<Household> = {}): Household => ({ id, name: '', memberIds, childIds: [], payerId: null, ...more })
const units = (more: Partial<GroupUnits> = {}): GroupUnits => ({
  households: [household('h-sharma', SHARMAS, { name: 'The Sharmas', childIds: ['anu', 'kabir'] }), household('h-khan', KHANS, { name: 'The Khans' })],
  basis: 'head',
  children: 'full',
  auto: true,
  ...more,
})
/** The group with a plan's entries recorded as payments. */
const settled = (g: Group, plan: readonly PlannedPayment[]): Group => ({
  ...g,
  settlements: [...g.settlements, ...plan.map((p, i) => ({ id: `s${i}`, fromId: p.fromId, toId: p.toId, amount: p.amount, date: '2026-11-15', createdAt: i, method: 'other' as const }))],
})
const sum = (values: Iterable<number>): number => [...values].reduce((a, b) => a + b, 0)

/** Imran paid ₹8,000 of hotel for all eight (₹1,000 each); Priya paid ₹1,600 of food for the Sharmas and the Khans. */
const tripExpenses = (): Expense[] => [
  expense(800_000, 'imran', Object.fromEntries(MEMBERS.map((id) => [id, 100_000]))),
  expense(160_000, 'priya', { rahul: 30_000, priya: 30_000, anu: 20_000, kabir: 20_000, imran: 30_000, sana: 30_000 }),
]

describe('households as they stand', () => {
  it('lists households and everyone else on their own, in the group’s order', () => {
    const list = resolveUnits(group(), units())
    expect(list.map((u) => [u.id, u.household, u.memberIds.length])).toEqual([
      ['me', false, 1],
      ['h-sharma', true, 4],
      ['h-khan', true, 2],
      ['sam', false, 1],
    ])
    expect(list[1]).toMatchObject({ name: 'The Sharmas', childIds: ['anu', 'kabir'], payerId: 'rahul' })
    expect(list[0]).toMatchObject({ payerId: 'me', name: '' })
  })

  it('with no households, everyone is on their own', () => {
    expect(resolveUnits(group(), null).map((u) => u.id)).toEqual(MEMBERS)
    expect(hasHouseholds(group(), null)).toBe(false)
    expect(hasHouseholds(group(), units())).toBe(true)
  })

  it('keeps the chosen payer, and falls back to the first adult when the payer leaves the group', () => {
    const chosen = units({ households: [household('h-sharma', SHARMAS, { childIds: ['anu', 'kabir'], payerId: 'priya' })] })
    expect(resolveUnits(group(), chosen).find((u) => u.id === 'h-sharma')?.payerId).toBe('priya')
    // Priya leaves the group: Rahul pays; she is no longer part of the household.
    const without = group(MEMBERS.filter((id) => id !== 'priya'))
    const sharmas = resolveUnits(without, chosen).find((u) => u.id === 'h-sharma')
    expect(sharmas).toMatchObject({ payerId: 'rahul', memberIds: ['rahul', 'anu', 'kabir'] })
  })

  it('never lets a child be the payer, and treats a household of only children as adults', () => {
    const childPays = units({ households: [household('h-sharma', SHARMAS, { childIds: ['anu', 'kabir'], payerId: 'anu' })] })
    expect(resolveUnits(group(), childPays).find((u) => u.id === 'h-sharma')?.payerId).toBe('rahul')
    // Both parents leave: the two children are a household with no child marks.
    const kidsOnly = group(MEMBERS.filter((id) => id !== 'rahul' && id !== 'priya'))
    expect(resolveUnits(kidsOnly, childPays).find((u) => u.id === 'h-sharma')).toMatchObject({ memberIds: ['anu', 'kabir'], childIds: [], payerId: 'anu' })
  })

  it('a household left with one person in the group is that person on their own', () => {
    const list = resolveUnits(group(MEMBERS.filter((id) => id !== 'sana')), units())
    expect(list.find((u) => u.memberIds.includes('imran'))).toEqual({ id: 'imran', household: false, name: '', memberIds: ['imran'], childIds: [], payerId: 'imran' })
    expect(list.some((u) => u.id === 'h-khan')).toBe(false)
  })

  it('puts nobody in two households, whatever was stored', () => {
    const twice = units({ households: [household('a', ['rahul', 'priya']), household('b', ['priya', 'imran', 'sana'])] })
    const list = resolveUnits(group(), twice)
    expect(list.find((u) => u.id === 'a')?.memberIds).toEqual(['rahul', 'priya'])
    expect(list.find((u) => u.id === 'b')?.memberIds).toEqual(['imran', 'sana'])
  })

  it('lists people who left but still have a balance on their own, after the group', () => {
    const list = resolveUnits(group(['me', 'sam']), null, ['gone', 'me', ''])
    expect(list.map((u) => u.id)).toEqual(['me', 'sam', 'gone'])
  })
})

describe('household balances', () => {
  it('a household’s balance is the sum of its members’, and the households add up to zero', () => {
    const rows = unitBalances(group(), tripExpenses(), units())
    const byId = Object.fromEntries(rows.map((r) => [r.unit.id, r.net]))
    // Sharmas: −4,000 hotel; food: Priya paid 1,600 and the Sharmas had 1,000 of it → +600. Net −3,400.
    expect(byId).toEqual({ me: -100_000, 'h-sharma': -340_000, 'h-khan': 540_000, sam: -100_000 })
    expect(sum(rows.map((r) => r.net))).toBe(0)
    const sharmas = rows.find((r) => r.unit.id === 'h-sharma')
    expect(sharmas?.members).toEqual([
      { id: 'rahul', net: -130_000 },
      { id: 'priya', net: 30_000 },
      { id: 'anu', net: -120_000 },
      { id: 'kabir', net: -120_000 },
    ])
  })

  it('matches the people’s own balances exactly, paise included', () => {
    const odd = [expense(100_001, 'rahul', { rahul: 33_335, imran: 33_333, sam: 33_333 }), expense(7, 'sana', { priya: 3, sana: 2, me: 2 })]
    const rows = unitBalances(group(), odd, units())
    const people = groupBalances(group(), odd)
    for (const row of rows) expect(row.net).toBe(sum(row.unit.memberIds.map((id) => people[id] ?? 0)))
    expect(sum(rows.map((r) => r.net))).toBe(0)
  })

  it('counts recorded payments, and ignores expenses in another currency or another group', () => {
    const paid: Settlement = { id: 's1', fromId: 'rahul', toId: 'imran', amount: 100_000, date: '2026-11-14', createdAt: 1, method: 'upi' }
    const list = [...tripExpenses(), expense(50_000, 'sam', { sam: 25_000, me: 25_000 }, { currency: 'USD' }), expense(50_000, 'sam', { sam: 25_000, me: 25_000 }, { groupId: 'other' })]
    const byId = Object.fromEntries(unitBalances(group(MEMBERS, [paid]), list, units()).map((r) => [r.unit.id, r.net]))
    expect(byId).toEqual({ me: -100_000, 'h-sharma': -240_000, 'h-khan': 440_000, sam: -100_000 })
  })

  it('an empty group, a group of one and no expenses are all zeros', () => {
    expect(unitBalances(group([]), [], units())).toEqual([])
    expect(unitBalances(group(['me']), [], null).map((r) => r.net)).toEqual([0])
    expect(unitBalances(group(), [], units()).every((r) => r.net === 0)).toBe(true)
    expect(unitTransfers(group(), [], units())).toEqual([])
  })

  it('a loan between two households moves their balances like any other entry', () => {
    const loan = expense(50_000, 'rahul', { sana: 50_000 }, { kind: 'loan' })
    const byId = Object.fromEntries(unitBalances(group(), [loan], units()).map((r) => [r.unit.id, r.net]))
    expect(byId).toMatchObject({ 'h-sharma': 50_000, 'h-khan': -50_000 })
  })

  it('someone who left the group and is still owed is listed on their own', () => {
    const e = expense(60_000, 'gone', { gone: 20_000, me: 20_000, sam: 20_000 })
    const rows = unitBalances(group(['me', 'sam']), [e], null)
    expect(rows.map((r) => [r.unit.id, r.net])).toEqual([
      ['me', -20_000],
      ['sam', -20_000],
      ['gone', 40_000],
    ])
  })
})

describe('payments between households', () => {
  it('one payment per household: the Sharmas pay the Khans ₹3,400', () => {
    const transfers = unitTransfers(group(), tripExpenses(), units(), nameOf)
    expect(transfers.map((t) => [t.from.id, t.to.id, t.amount])).toEqual([
      ['h-sharma', 'h-khan', 340_000],
      ['me', 'h-khan', 100_000],
      ['sam', 'h-khan', 100_000],
    ])
    expect(sum(transfers.map((t) => t.amount))).toBe(540_000)
  })

  it('needs fewer payments than person by person', () => {
    // Inside the Sharmas the money is one wallet: what Priya is owed and what Rahul owes cancel.
    const e = [expense(40_000, 'priya', { priya: 20_000, imran: 20_000 }), expense(40_000, 'sana', { sana: 20_000, rahul: 20_000 })]
    expect(unitTransfers(group(), e, units())).toEqual([])
    expect(unitTransfers(group(), e, null)).toHaveLength(2)
  })

  it('breaks ties by name, not by id', () => {
    // Zed and Amy each owe ₹100; ids sort the other way round from their names.
    const g = group(['me', 'a-id', 'z-id'])
    const names: Record<string, string> = { me: 'Me', 'a-id': 'Zed', 'z-id': 'Amy' }
    const e = [expense(30_000, 'me', { me: 10_000, 'a-id': 10_000, 'z-id': 10_000 })]
    const order = unitTransfers(g, e, null, (id) => names[id] ?? id).map((t) => t.from.id)
    expect(order).toEqual(['z-id', 'a-id'])
  })

  it('with no households it is the group’s own list of payments', () => {
    const transfers = unitTransfers(group(), tripExpenses(), null, nameOf)
    expect(sum(transfers.map((t) => t.amount))).toBe(sum(Object.values(groupBalances(group(), tripExpenses())).filter((v) => v > 0)))
    expect(transfers.every((t) => !t.from.household && !t.to.household)).toBe(true)
  })
})

describe('recording one household payment', () => {
  it('leaves every member of both households square when the payment clears them', () => {
    // Only the Sharmas and the Khans: the Sharmas owe the Khans.
    const g = group([...SHARMAS, ...KHANS])
    const e = [expense(600_000, 'imran', Object.fromEntries([...SHARMAS, ...KHANS].map((id) => [id, 100_000]))), expense(60_000, 'priya', { priya: 30_000, sana: 30_000 })]
    const [transfer, ...rest] = unitTransfers(g, e, units())
    expect(rest).toEqual([])
    expect(transfer).toMatchObject({ amount: 370_000 })
    const plan = planUnitPayment(g, e, transfer!)
    // The payment between the two payers comes first, and is the only one that isn't inside a family.
    expect(plan[0]).toEqual({ fromId: 'rahul', toId: 'imran', amount: 370_000, within: false })
    expect(plan.filter((p) => !p.within)).toHaveLength(1)
    expect(plan.filter((p) => p.within)).toEqual([
      { fromId: 'priya', toId: 'rahul', amount: 70_000, within: true },
      { fromId: 'anu', toId: 'rahul', amount: 100_000, within: true },
      { fromId: 'kabir', toId: 'rahul', amount: 100_000, within: true },
      { fromId: 'sana', toId: 'imran', amount: 130_000, within: true },
    ])
    const after = groupBalances(settled(g, plan), e)
    for (const id of [...SHARMAS, ...KHANS]) expect(after[id]).toBe(0)
    expect(unitTransfers(settled(g, plan), e, units())).toEqual([])
  })

  it('someone owed inside the family is evened out too (their payer "pays" them)', () => {
    const g = group([...SHARMAS, ...KHANS])
    // Hotel ₹6,000 between the six; Priya paid ₹1,600 of food, so she is owed ₹300 herself.
    const e = [expense(600_000, 'imran', Object.fromEntries([...SHARMAS, ...KHANS].map((id) => [id, 100_000]))), tripExpenses()[1]!]
    const transfer = unitTransfers(g, e, units())[0]!
    const plan = planUnitPayment(g, e, transfer)
    expect(plan).toContainEqual({ fromId: 'rahul', toId: 'priya', amount: 30_000, within: true })
    const after = groupBalances(settled(g, plan), e)
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })

  it('when a household still owes someone else, its payer carries the rest and the others are square', () => {
    const g = group()
    const e = tripExpenses()
    const toKhans = unitTransfers(g, e, units(), nameOf).find((t) => t.from.id === 'h-sharma')!
    const plan = planUnitPayment(g, e, toKhans)
    const after = groupBalances(settled(g, plan), e)
    for (const id of SHARMAS) expect(after[id]).toBe(0)
    // The Khans are still owed ₹1,000 each by Ayush and Sam: it all sits with Imran, their payer.
    expect(after.sana).toBe(0)
    expect(after.imran).toBe(200_000)
    expect(after.me).toBe(-100_000)
    expect(sum(Object.values(after))).toBe(0)
    expect(unitTransfers(settled(g, plan), e, units(), nameOf).map((t) => [t.from.id, t.to.id, t.amount])).toEqual([
      ['me', 'h-khan', 100_000],
      ['sam', 'h-khan', 100_000],
    ])
  })

  it('two people on their own is just the one payment', () => {
    const g = group(['me', 'sam'])
    const e = [expense(50_000, 'sam', { sam: 25_000, me: 25_000 })]
    const transfer = unitTransfers(g, e, null)[0]!
    expect(planUnitPayment(g, e, transfer)).toEqual([{ fromId: 'me', toId: 'sam', amount: 25_000, within: false }])
  })

  it('pays through the first adult when the household’s payer has left the group', () => {
    const chosen = units({ households: [household('h-sharma', SHARMAS, { childIds: ['anu', 'kabir'], payerId: 'priya' }), household('h-khan', KHANS)] })
    const members = MEMBERS.filter((id) => id !== 'priya')
    const g = group(members)
    const e = [expense(700_000, 'imran', Object.fromEntries(members.map((id) => [id, 100_000])))]
    const transfer = unitTransfers(g, e, chosen, nameOf).find((t) => t.from.id === 'h-sharma')!
    expect(transfer.amount).toBe(300_000)
    const plan = planUnitPayment(g, e, transfer)
    expect(plan[0]).toEqual({ fromId: 'rahul', toId: 'imran', amount: 300_000, within: false })
    const after = groupBalances(settled(g, plan), e)
    for (const id of ['rahul', 'anu', 'kabir']) expect(after[id]).toBe(0)
  })

  it('a paisa that does not divide still ends at exactly zero', () => {
    const g = group([...SHARMAS, ...KHANS])
    const e = [expense(100_001, 'sana', { rahul: 16_667, priya: 16_667, anu: 16_667, kabir: 16_667, imran: 16_667, sana: 16_666 })]
    const transfer = unitTransfers(g, e, units())[0]!
    expect(transfer.amount).toBe(66_668)
    const after = groupBalances(settled(g, planUnitPayment(g, e, transfer)), e)
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })

  it('plans nothing for an amount that is not a payment', () => {
    const g = group(['me', 'sam'])
    const e = [expense(50_000, 'sam', { sam: 25_000, me: 25_000 })]
    const transfer = unitTransfers(g, e, null)[0]!
    expect(planUnitPayment(g, e, transfer, 0)).toEqual([])
    expect(planUnitPayment(g, e, transfer, 1.5)).toEqual([])
    expect(planUnitPayment(g, e, { ...transfer, to: transfer.from })).toEqual([])
  })
})

describe('a new expense’s weights', () => {
  it('per head with children in full is a plain equal split', () => {
    const weights = unitWeights(group(), units())!
    expect(isEqualWeights(weights)).toBe(true)
    expect(Object.keys(weights)).toHaveLength(MEMBERS.length)
  })

  it('per head, children at half: an adult counts 2, a child 1', () => {
    expect(unitWeights(group(), units({ children: 'half' }))).toEqual({ me: 2, rahul: 2, priya: 2, anu: 1, kabir: 1, imran: 2, sana: 2, sam: 2 })
  })

  it('per head, children free: children carry nothing', () => {
    expect(unitWeights(group(), units({ children: 'free' }))).toEqual({ me: 1, rahul: 1, priya: 1, anu: 0, kabir: 0, imran: 1, sana: 1, sam: 1 })
  })

  it('per family: every household carries one equal part, shared by its members', () => {
    const weights = unitWeights(group(), units({ basis: 'family' }))!
    expect(weights).toEqual({ me: 4, rahul: 1, priya: 1, anu: 1, kabir: 1, imran: 2, sana: 2, sam: 4 })
    const part = (ids: string[]) => sum(ids.map((id) => weights[id] ?? 0))
    expect([part(['me']), part(SHARMAS), part(KHANS), part(['sam'])]).toEqual([4, 4, 4, 4])
  })

  it('per family with children at half: the household’s part is shared 2 : 2 : 1 : 1', () => {
    const weights = unitWeights(group(), units({ basis: 'family', children: 'half' }))!
    expect(weights).toEqual({ me: 6, rahul: 2, priya: 2, anu: 1, kabir: 1, imran: 3, sana: 3, sam: 6 })
  })

  it('per family with children free: the adults share the household’s part', () => {
    expect(unitWeights(group(), units({ basis: 'family', children: 'free' }))).toEqual({ me: 2, rahul: 1, priya: 1, anu: 0, kabir: 0, imran: 1, sana: 1, sam: 2 })
  })

  it('the amounts add up to the total to the paisa, and identical people differ by at most one paisa', () => {
    for (const total of [1, 7, 100, 99_999, 100_001, 1_234_567]) {
      for (const basis of ['head', 'family'] as const) {
        for (const children of ['full', 'half', 'free'] as const) {
          const shares = unitShares(total, 'imran', MEMBERS, group(), units({ basis, children }))!
          expect(sum(Object.values(shares))).toBe(total)
          expect(Math.abs((shares.anu ?? 0) - (shares.kabir ?? 0))).toBeLessThanOrEqual(1)
          expect(Math.abs((shares.rahul ?? 0) - (shares.priya ?? 0))).toBeLessThanOrEqual(1)
          expect(Math.abs((shares.me ?? 0) - (shares.sam ?? 0))).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('per family, every household’s part is the same to within a paisa per member', () => {
    const shares = unitShares(1_200_000, 'me', MEMBERS, group(), units({ basis: 'family' }))!
    expect(sum(SHARMAS.map((id) => shares[id] ?? 0))).toBe(300_000)
    expect(sum(KHANS.map((id) => shares[id] ?? 0))).toBe(300_000)
    expect(shares.me).toBe(300_000)
    expect(shares.sam).toBe(300_000)
  })

  it('is the same answer the split editor gives for those weights', () => {
    const weights = unitWeights(group(), units({ basis: 'family', children: 'half' }))!
    const editor = splitAmount({ total: 100_001, currency: 'INR', mode: 'shares', payerId: 'sana', participants: MEMBERS.map((friendId) => ({ friendId, input: weights[friendId] ?? 0 })) })
    expect(unitShares(100_001, 'sana', MEMBERS, group(), units({ basis: 'family', children: 'half' }))).toEqual(editor.shares)
  })

  it('works in a currency with no paise', () => {
    const shares = unitShares(1000, 'me', MEMBERS, group(), units({ basis: 'family' }), 'JPY')!
    expect(sum(Object.values(shares))).toBe(1000)
  })

  it('an expense for only some people: a household carries one part for whoever of it is there', () => {
    // Dinner for Rahul, Anu, Imran, Sana and Sam, per family with children at half.
    const weights = unitWeightsFor(['rahul', 'anu', 'imran', 'sana', 'sam'], group(), units({ basis: 'family', children: 'half' }))
    expect(weights).toEqual({ rahul: 4, anu: 2, imran: 3, sana: 3, sam: 6 })
  })

  it('a child with no adult of their own in the expense counts in full', () => {
    expect(unitWeightsFor(['anu', 'kabir', 'sam'], group(), units({ children: 'free' }))).toEqual({ anu: 1, kabir: 1, sam: 1 })
    expect(unitWeightsFor(['anu', 'kabir', 'sam'], group(), units({ basis: 'family', children: 'free' }))).toEqual({ anu: 1, kabir: 1, sam: 2 })
  })

  it('a guest who is not in the group is on their own', () => {
    expect(unitWeightsFor(['imran', 'sana', 'guest'], group(), units({ basis: 'family' }))).toEqual({ imran: 1, sana: 1, guest: 2 })
  })

  it('one person, nobody, and no households', () => {
    expect(unitWeightsFor(['me'], group(), units({ basis: 'family' }))).toEqual({ me: 1 })
    expect(unitWeightsFor([], group(), units())).toEqual({})
    expect(isEqualWeights(unitWeights(group(), null)!)).toBe(true)
    expect(unitShares(0, 'me', MEMBERS, group(), units())).toBeNull()
    expect(unitShares(1.5, 'me', MEMBERS, group(), units())).toBeNull()
  })

  it('a member who is in no household carries a whole part per family and one head per head', () => {
    expect(unitWeights(group(), units({ basis: 'family' }))?.sam).toBe(4)
    expect(unitWeights(group(), units({ children: 'half' }))?.sam).toBe(2)
  })
})

describe('the split a new expense gets', () => {
  const form = (ids: string[] = MEMBERS) => ({ mode: 'equal', participants: ids.map((friendId) => ({ friendId, input: null })) })

  it('gives shares in the form’s own order', () => {
    const order = [...MEMBERS].reverse()
    const split = unitsSplitFor(form(order), group(), units({ basis: 'family' }))
    expect(split?.mode).toBe('shares')
    expect(split?.participants.map((p) => p.friendId)).toEqual(order)
    expect(split?.participants.find((p) => p.friendId === 'sam')?.input).toBe(4)
  })

  it('is nothing when it would be an equal split, or with one person', () => {
    expect(unitsSplitFor(form(), group(), units())).toBeNull()
    expect(unitsSplitFor(form(), group(), null)).toBeNull()
    expect(unitsSplitFor(form(['me']), group(), units({ basis: 'family' }))).toBeNull()
    // Two people on their own, per family: equal.
    expect(unitsSplitFor(form(['me', 'sam']), group(), units({ basis: 'family' }))).toBeNull()
  })

  it('knows when the form is set to it', () => {
    const split = unitsSplitFor(form(), group(), units({ basis: 'family' }))!
    expect(matchesUnitsSplit(form(), split)).toBe(false)
    expect(matchesUnitsSplit({ mode: 'shares', participants: split.participants }, split)).toBe(true)
    const changed = split.participants.map((p) => (p.friendId === 'sam' ? { ...p, input: 1 } : p))
    expect(matchesUnitsSplit({ mode: 'shares', participants: changed }, split)).toBe(false)
    expect(matchesUnitsSplit({ mode: 'shares', participants: split.participants.slice(1) }, split)).toBe(false)
  })

  it('gives exact amounts when the weights are too large for the editor’s shares', () => {
    // Households of 2, 3, 5 and 7 adults, and one of 11: the smallest whole weights go past 99.
    const sizes = [2, 3, 5, 7, 11]
    const ids = sizes.flatMap((size, h) => Array.from({ length: size }, (_, i) => `p${h}-${i}`))
    const big: GroupUnits = { ...emptyUnits(), basis: 'family', households: sizes.map((_, h) => household(`h${h}`, ids.filter((id) => id.startsWith(`p${h}-`)))) }
    const g = group(ids)
    expect(needsAmount(form(ids), g, big)).toBe(true)
    expect(needsAmount(form(), group(), units({ basis: 'family' }))).toBe(false)
    expect(unitsSplitFor(form(ids), g, big)).toBeNull()
    const split = unitsSplitFor(form(ids), g, big, { total: 1_000_000, payerId: 'p0-0' })!
    expect(split.mode).toBe('exact')
    expect(sum(split.participants.map((p) => p.input ?? 0))).toBe(1_000_000)
    // Five households, ₹2,000 each.
    for (let h = 0; h < sizes.length; h++) {
      const part = sum(split.participants.filter((p) => p.friendId.startsWith(`p${h}-`)).map((p) => p.input ?? 0))
      expect(Math.abs(part - 200_000)).toBeLessThanOrEqual(sizes[h]!)
    }
    expect(matchesUnitsSplit({ mode: 'exact', participants: split.participants }, split)).toBe(true)
  })

  it('starts a new expense with it only when the group asks and the form is untouched', () => {
    const family = units({ basis: 'family' })
    expect(applyUnits({ ...form(), participants: form().participants }, group(), family)).toMatchObject({ mode: 'shares' })
    expect(applyUnits({ ...form(), participants: form().participants }, group(), { ...family, auto: false }).mode).toBe('equal')
    expect(applyUnits({ ...form(), participants: form().participants }, group(), null).mode).toBe('equal')
    // Per head with children in full is already equal.
    expect(applyUnits({ ...form(), participants: form().participants }, group(), units()).mode).toBe('equal')
    // Already split some other way, or not everyone: left alone.
    const percent = { mode: 'percent', participants: MEMBERS.map((friendId) => ({ friendId, input: 1250 })) }
    expect(applyUnits(percent, group(), family)).toBe(percent)
    const some = { mode: 'equal', participants: form(['me', ...SHARMAS]).participants }
    expect(applyUnits(some, group(), family)).toBe(some)
    const typed = { mode: 'equal', participants: MEMBERS.map((friendId) => ({ friendId, input: friendId === 'me' ? 5 : null })) }
    expect(applyUnits(typed, group(), family)).toBe(typed)
  })

  it('says it in a few numbers', () => {
    const summary = unitsSummary(MEMBERS, group(), units({ basis: 'family', children: 'half' }))
    expect(summary).toMatchObject({ basis: 'family', children: 'half', parts: 4, households: 2, adults: 6, childCount: 2 })
    expect(summary.largest).toMatchObject({ count: 4 })
    expect(summary.largest?.unit.id).toBe('h-sharma')
    expect(unitsSummary(['me', 'sam'], group(), units()).largest).toBeNull()
    // Children with no adult of their own there are counted as adults.
    expect(unitsSummary(['anu', 'kabir', 'sam'], group(), units({ children: 'half' }))).toMatchObject({ adults: 3, childCount: 0 })
  })
})

describe('changing households', () => {
  it('makes a household of two or more, taking people out of the one they were in', () => {
    const one = addHousehold(null, 'h1', ['rahul', 'priya'])
    expect(one.households).toEqual([{ id: 'h1', name: '', memberIds: ['rahul', 'priya'], childIds: [], payerId: null }])
    expect(one).toMatchObject({ basis: 'head', children: 'full', auto: true })
    // One person is not a household; neither is the same id twice.
    expect(addHousehold(one, 'h2', ['sam']).households).toHaveLength(1)
    expect(addHousehold(one, 'h1', ['sam', 'me']).households).toHaveLength(1)
    // Priya moves: her old household is left with one person and goes.
    const moved = addHousehold(one, 'h2', ['priya', 'sam'])
    expect(moved.households.map((h) => [h.id, h.memberIds])).toEqual([['h2', ['priya', 'sam']]])
  })

  it('adds and removes people; a household left with one person is no household', () => {
    let u = addHousehold(null, 'h1', ['rahul', 'priya'])
    u = addToHousehold(u, 'h1', 'anu')
    expect(householdOf(u, 'anu')?.id).toBe('h1')
    expect(addToHousehold(u, 'h1', 'anu')).toBe(u)
    expect(addToHousehold(u, 'nope', 'sam')).toBe(u)
    u = removeFromHousehold(u, 'anu')
    expect(householdOf(u, 'anu')).toBeNull()
    u = removeFromHousehold(u, 'priya')
    expect(u.households).toEqual([])
  })

  it('moving someone out of a household of two into another keeps both changes honest', () => {
    let u = addHousehold(null, 'h1', ['rahul', 'priya'])
    u = addHousehold(u, 'h2', ['imran', 'sana'])
    u = addToHousehold(u, 'h2', 'priya')
    expect(u.households.map((h) => [h.id, h.memberIds])).toEqual([['h2', ['imran', 'sana', 'priya']]])
  })

  it('marks children, keeps the last adult an adult, and a child stops being the payer', () => {
    let u = addHousehold(null, 'h1', ['rahul', 'priya', 'anu'])
    u = setPayer(u, 'h1', 'priya')
    expect(u.households[0]?.payerId).toBe('priya')
    u = setChild(u, 'anu', true)
    u = setChild(u, 'priya', true)
    expect(u.households[0]).toMatchObject({ childIds: ['anu', 'priya'], payerId: null })
    // Rahul is the last adult.
    expect(setChild(u, 'rahul', true)).toEqual(u)
    // A child can't be chosen to pay.
    expect(setPayer(u, 'h1', 'anu').households[0]?.payerId).toBeNull()
    u = setChild(u, 'priya', false)
    expect(u.households[0]?.childIds).toEqual(['anu'])
  })

  it('removing a member clears their child mark and their payer role', () => {
    let u = addHousehold(null, 'h1', ['rahul', 'priya', 'anu'])
    u = setChild(u, 'anu', true)
    u = setPayer(u, 'h1', 'priya')
    u = removeFromHousehold(u, 'priya')
    expect(u.households[0]).toEqual({ id: 'h1', name: '', memberIds: ['rahul', 'anu'], childIds: ['anu'], payerId: null })
    // Take the only adult out: the child left behind is no household.
    expect(removeFromHousehold(u, 'rahul').households).toEqual([])
  })

  it('renames and removes a household', () => {
    let u = addHousehold(null, 'h1', ['rahul', 'priya'])
    u = renameHousehold(u, 'h1', `  The Sharmas ${'x'.repeat(80)}`)
    expect(u.households[0]?.name.startsWith('The Sharmas')).toBe(true)
    expect(u.households[0]?.name.length).toBeLessThanOrEqual(40)
    expect(removeHousehold(u, 'h1').households).toEqual([])
  })
})

describe('reading stored households', () => {
  it('keeps what reads well and drops the rest, piece by piece', () => {
    const clean = cleanGroupUnits({
      households: [
        { id: 'h1', name: '  The Sharmas ', memberIds: ['rahul', 'priya', 'rahul', 7, ''], childIds: ['priya', 'nobody'], payerId: 'rahul' },
        { id: 'h1', name: 'Twice', memberIds: ['a', 'b'] },
        { id: 'h2', name: 5, memberIds: ['priya', 'imran', 'sana'], childIds: 'no', payerId: 'gone' },
        { id: 'h3', memberIds: ['sam'] },
        { id: '', memberIds: ['x', 'y'] },
        'junk',
        null,
      ],
      basis: 'family',
      children: 'half',
      auto: false,
    })
    expect(clean).toEqual({
      households: [
        { id: 'h1', name: 'The Sharmas', memberIds: ['rahul', 'priya'], childIds: ['priya'], payerId: 'rahul' },
        { id: 'h2', name: '', memberIds: ['imran', 'sana'], childIds: [], payerId: null },
      ],
      basis: 'family',
      children: 'half',
      auto: false,
    })
  })

  it('defaults the settings, never keeps a household of only children, and is null with nothing left', () => {
    expect(cleanGroupUnits({ households: [{ id: 'h', memberIds: ['a', 'b'], childIds: ['a', 'b'] }], basis: 'x', children: 9 })).toEqual({
      households: [{ id: 'h', name: '', memberIds: ['a', 'b'], childIds: [], payerId: null }],
      basis: 'head',
      children: 'full',
      auto: true,
    })
    for (const junk of [null, undefined, 3, 'x', [], {}, { households: 'no' }, { households: [] }, { households: [{ id: 'h', memberIds: ['a'] }] }]) expect(cleanGroupUnits(junk)).toBeNull()
  })

  it('handles a huge list', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `h${i}`, memberIds: [`a${i}`, `b${i}`] }))
    expect(cleanGroupUnits({ households: many })?.households).toHaveLength(50)
    const ids = Array.from({ length: 100 }, (_, i) => `m${i}`)
    const big: GroupUnits = { ...emptyUnits(), basis: 'family', households: [household('h', ids.slice(0, 60))] }
    const weights = unitWeights(group(ids), big)!
    expect(Object.keys(weights)).toHaveLength(100)
    expect(weights.m0).toBe(1)
    expect(weights.m99).toBe(60)
  })
})
