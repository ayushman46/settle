import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, DataError, expensesStore, groupsStore, resetDataForTests, saveExpense, updateGroup } from '../../data'
import { draft } from '../../data/testKit'
import { STORAGE_KEYS } from '../../data/stores'
import { ME_ID, type Group } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { unitTransfers, type GroupUnits } from './engine'
import {
  getGroupUnits,
  getUnitPayments,
  isWithinFamily,
  MAX_UNIT_GROUPS,
  recordUnitPayment,
  setGroupUnits,
  undoUnitPayment,
  unitsStore,
  withinFamilyIds,
} from './store'

beforeEach(() => resetDataForTests())

const units = (households: GroupUnits['households'], more: Partial<GroupUnits> = {}): GroupUnits => ({ households, basis: 'head', children: 'full', auto: true, ...more })
const pair = (id: string, a: string, b: string) => ({ id, name: '', memberIds: [a, b], childIds: [], payerId: null })

describe('the households store', () => {
  it('sets, replaces and clears a group’s households', () => {
    setGroupUnits('trip', units([pair('h1', 'rahul', 'priya')], { basis: 'family' }))
    expect(getGroupUnits('trip')).toEqual({ households: [pair('h1', 'rahul', 'priya')], basis: 'family', children: 'full', auto: true })
    setGroupUnits('trip', units([pair('h1', 'rahul', 'priya'), pair('h2', 'imran', 'sana')]))
    expect(getGroupUnits('trip')?.households).toHaveLength(2)
    setGroupUnits('trip', null)
    expect(getGroupUnits('trip')).toBeNull()
    expect(getGroupUnits(null)).toBeNull()
  })

  it('keeps only what makes a household: nothing left clears the group', () => {
    setGroupUnits('trip', units([pair('h1', 'rahul', 'priya')]))
    setGroupUnits('trip', units([{ id: 'h1', name: '', memberIds: ['rahul'], childIds: [], payerId: null }]))
    expect(getGroupUnits('trip')).toBeNull()
    setGroupUnits('', units([pair('h1', 'a', 'b')]))
    expect(unitsStore.get().groups).toEqual({})
  })

  it('tidies a typed name', () => {
    setGroupUnits('trip', units([{ ...pair('h1', 'rahul', 'priya'), name: `  The   Sharmas\u0007 ${'x'.repeat(60)}` }]))
    const name = getGroupUnits('trip')?.households[0]?.name ?? ''
    expect(name.startsWith('The Sharmas x')).toBe(true)
    expect(name.length).toBeLessThanOrEqual(40)
  })

  it('caps how many groups it keeps, dropping the ones touched longest ago', () => {
    for (let i = 0; i < MAX_UNIT_GROUPS + 5; i++) setGroupUnits(`g${i}`, units([pair('h', 'a', 'b')]))
    setGroupUnits('g5', units([pair('h', 'a', 'c')]))
    const ids = Object.keys(unitsStore.get().groups)
    expect(ids).toHaveLength(MAX_UNIT_GROUPS)
    expect(ids).not.toContain('g0')
    expect(ids).toContain('g5')
    expect(ids).toContain(`g${MAX_UNIT_GROUPS + 4}`)
  })

  it('reads what it can from junk in storage, dropping only the bad entries', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.units,
      JSON.stringify({
        v: 1,
        data: {
          groups: {
            trip: { households: [pair('h1', 'rahul', 'priya'), { id: 'h2', memberIds: ['solo'] }, 'junk'], basis: 'family', children: 'half', auto: false },
            bad1: { households: [] },
            bad2: 'nope',
            bad3: { households: [{ id: 'h', memberIds: 'ab' }] },
          },
          payments: {
            trip: [
              { id: 'p1', mainId: 's1', withinIds: ['s2', 's2', 's1', 7], fromName: 'The Sharmas', toName: 'The Khans', fromPayerId: 'rahul', toPayerId: 'imran', amount: 340_000, date: '2026-11-14', createdAt: 5 },
              { id: 'p1', mainId: 's9', withinIds: [], fromName: 'Twice', toName: 'x', fromPayerId: 'a', toPayerId: 'b', amount: 5, date: '2026-11-14', createdAt: 5 },
              { id: 'p2', mainId: 's3', fromPayerId: 'a', toPayerId: 'b', amount: 'lots', date: '2026-11-14', createdAt: 5 },
              { id: 'p3', mainId: 's3', fromPayerId: 'a', toPayerId: 'b', amount: 10, date: 'yesterday', createdAt: 5 },
              null,
            ],
            other: 'nope',
            empty: [],
          },
        },
      }),
    )
    unitsStore.reload()
    expect(unitsStore.get().groups).toEqual({ trip: { households: [pair('h1', 'rahul', 'priya')], basis: 'family', children: 'half', auto: false } })
    expect(unitsStore.get().payments).toEqual({
      trip: [{ id: 'p1', mainId: 's1', withinIds: ['s2'], fromName: 'The Sharmas', toName: 'The Khans', fromPayerId: 'rahul', toPayerId: 'imran', amount: 340_000, date: '2026-11-14', createdAt: 5 }],
    })
  })

  it('survives storage that isn’t the right shape, or isn’t JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.units, JSON.stringify({ v: 1, data: { groups: [1, 2], payments: 'x' } }))
    unitsStore.reload()
    expect(unitsStore.get()).toEqual({ groups: {}, payments: {} })
    window.localStorage.setItem(STORAGE_KEYS.units, '{not json')
    unitsStore.reload()
    expect(unitsStore.get()).toEqual({ groups: {}, payments: {} })
  })
})

describe('recording a household payment', () => {
  let rahul: string
  let priya: string
  let anu: string
  let imran: string
  let sana: string
  let groupId: string

  const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
  const expenses = () => expensesStore.get().filter((e) => e.groupId === groupId)
  const balances = () => groupBalances(group(), expenses())
  const households = (): GroupUnits =>
    units([
      { id: 'h-sharma', name: 'The Sharmas', memberIds: [rahul, priya, anu], childIds: [anu], payerId: null },
      { id: 'h-khan', name: 'The Khans', memberIds: [imran, sana], childIds: [], payerId: null },
    ])
  const firstTransfer = () => unitTransfers(group(), expenses(), getGroupUnits(groupId))[0]!
  const record = () => recordUnitPayment({ group: group(), expenses: expenses(), transfer: firstTransfer(), fromName: 'The Sharmas', toName: 'The Khans', method: 'upi', date: '2026-11-15' })

  beforeEach(() => {
    rahul = addFriend({ name: 'Rahul Sharma' }).id
    priya = addFriend({ name: 'Priya Sharma' }).id
    anu = addFriend({ name: 'Anu Sharma' }).id
    imran = addFriend({ name: 'Imran Khan' }).id
    sana = addFriend({ name: 'Sana Khan' }).id
    groupId = createGroup({ name: 'Manali', emoji: '🏔️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, rahul, priya, anu, imran, sana] }).id
    setGroupUnits(groupId, households())
    // Imran paid ₹5,000 of hotel for the five of them (₹1,000 each); Priya paid ₹600 of chai for herself and Sana.
    const five = [rahul, priya, anu, imran, sana]
    saveExpense(draft({ title: 'Hotel', total: 500_000, payerId: imran, groupId, participants: five.map((friendId) => ({ friendId, input: null })) }))
    saveExpense(draft({ title: 'Chai', total: 60_000, payerId: priya, groupId, participants: [priya, sana].map((friendId) => ({ friendId, input: null })) }))
  })

  it('leaves every member of both households at zero, as ordinary group payments', () => {
    expect(firstTransfer()).toMatchObject({ amount: 270_000 })
    const payment = record()
    expect(payment).toMatchObject({ fromName: 'The Sharmas', toName: 'The Khans', fromPayerId: rahul, toPayerId: imran, amount: 270_000, date: '2026-11-15' })
    const settlements = group().settlements
    // Rahul pays Imran; inside the Sharmas, Priya and Anu are evened out with Rahul; inside the Khans, Sana with Imran.
    expect(settlements).toHaveLength(4)
    expect(settlements.find((s) => s.id === payment.mainId)).toMatchObject({ fromId: rahul, toId: imran, amount: 270_000, method: 'upi' })
    expect(payment.withinIds).toHaveLength(3)
    for (const id of [ME_ID, rahul, priya, anu, imran, sana]) expect(balances()[id]).toBe(0)
    expect(unitTransfers(group(), expenses(), getGroupUnits(groupId))).toEqual([])
  })

  it('marks the entries inside a family, so they can be labelled', () => {
    const payment = record()
    expect(withinFamilyIds(groupId)).toEqual(new Set(payment.withinIds))
    expect(isWithinFamily(groupId, payment.mainId)).toBe(false)
    for (const id of payment.withinIds) {
      expect(isWithinFamily(groupId, id)).toBe(true)
      expect(group().settlements.find((s) => s.id === id)?.method).toBe('other')
    }
    expect(isWithinFamily('elsewhere', payment.withinIds[0]!)).toBe(false)
  })

  it('Undo removes all of it and puts every balance back exactly', () => {
    const before = { balances: balances(), settlements: group().settlements, memberIds: group().memberIds }
    const payment = record()
    const restore = undoUnitPayment(groupId, payment.id)
    expect(group().settlements).toEqual(before.settlements)
    expect(group().memberIds).toEqual(before.memberIds)
    expect(balances()).toEqual(before.balances)
    expect(getUnitPayments(groupId)).toEqual([])
    expect(withinFamilyIds(groupId).size).toBe(0)
    expect(getGroupUnits(groupId)).toEqual(households())

    // And it can be put back: the same entries again, square again.
    restore?.()
    expect(group().settlements).toHaveLength(4)
    for (const id of [rahul, priya, anu, imran, sana]) expect(balances()[id]).toBe(0)
    expect(getUnitPayments(groupId)).toHaveLength(1)
    expect(getUnitPayments(groupId)[0]?.withinIds).toHaveLength(3)
    // Putting it back twice does nothing more.
    restore?.()
    expect(group().settlements).toHaveLength(4)
  })

  it('undoing something that isn’t there does nothing', () => {
    expect(undoUnitPayment(groupId, 'nope')).toBeNull()
    expect(group().settlements).toEqual([])
  })

  it('keeps earlier payments in the group untouched when one is undone', () => {
    saveExpense(draft({ title: 'Taxi', total: 20_000, payerId: ME_ID, groupId, participants: [ME_ID, imran].map((friendId) => ({ friendId, input: null })) }))
    const first = record()
    const count = group().settlements.length
    // What is left: the Sharmas still owe you the ₹100 of taxi Imran's household passed on.
    const second = recordUnitPayment({ group: group(), expenses: expenses(), transfer: firstTransfer(), fromName: 'The Sharmas', toName: 'You', method: 'other', date: '2026-11-15' })
    expect(second).toMatchObject({ fromPayerId: rahul, toPayerId: ME_ID, amount: 10_000, withinIds: [] })
    for (const id of [ME_ID, rahul, priya, anu, imran, sana]) expect(balances()[id]).toBe(0)
    undoUnitPayment(groupId, second.id)
    expect(group().settlements).toHaveLength(count)
    expect(getUnitPayments(groupId).map((p) => p.id)).toEqual([first.id])
  })

  it('pays through another adult when the household’s payer has left the group', () => {
    // A second trip where Priya, who pays for the Sharmas, owes nothing herself and leaves.
    const tripId = createGroup({ name: 'Shimla', emoji: '🚞', kind: 'trip', currency: 'INR', memberIds: [ME_ID, rahul, priya, anu, imran, sana] }).id
    const trip = (): Group => groupsStore.get().find((g) => g.id === tripId)!
    const tripExpenses = () => expensesStore.get().filter((e) => e.groupId === tripId)
    setGroupUnits(tripId, units([{ id: 'h-sharma', name: '', memberIds: [rahul, priya, anu], childIds: [anu], payerId: priya }, pair('h-khan', imran, sana)]))
    saveExpense(draft({ title: 'Hotel', total: 400_000, payerId: imran, groupId: tripId, participants: [rahul, anu, imran, sana].map((friendId) => ({ friendId, input: null })) }))
    expect(unitTransfers(trip(), tripExpenses(), getGroupUnits(tripId))[0]?.from.payerId).toBe(priya)

    updateGroup(tripId, { memberIds: [ME_ID, rahul, anu, imran, sana] })
    expect(trip().memberIds).not.toContain(priya)
    const transfer = unitTransfers(trip(), tripExpenses(), getGroupUnits(tripId))[0]!
    expect(transfer).toMatchObject({ amount: 200_000 })
    expect(transfer.from).toMatchObject({ id: 'h-sharma', payerId: rahul, memberIds: [rahul, anu] })
    const payment = recordUnitPayment({ group: trip(), expenses: tripExpenses(), transfer, fromName: 'The Sharmas', toName: 'The Khans', method: 'cash', date: '2026-11-15' })
    expect(payment.fromPayerId).toBe(rahul)
    const after = groupBalances(trip(), tripExpenses())
    for (const id of [rahul, anu, imran, sana]) expect(after[id]).toBe(0)
    // What was stored is untouched: if Priya comes back, she pays for the Sharmas again.
    expect(getGroupUnits(tripId)?.households[0]?.payerId).toBe(priya)
  })

  it('saves nothing when the group is gone', () => {
    const transfer = firstTransfer()
    const gone = { ...group(), id: 'no-such-group' }
    expect(() => recordUnitPayment({ group: gone, expenses: expenses(), transfer, fromName: 'a', toName: 'b', method: 'upi', date: '2026-11-15' })).toThrow(DataError)
    expect(group().settlements).toEqual([])
    expect(getUnitPayments('no-such-group')).toEqual([])
  })
})
