import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  flushAllStores,
  friendsStore,
  groupsStore,
  recordPartPayment,
  reloadAllStores,
  resetDataForTests,
  saveExpense,
  setPaidBack,
  STORAGE_KEYS,
  updateProfile,
  type ExpenseDraft,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type BillSnapshot, type Expense, type Group, type Participant } from '../../domain/types'
import { expenseNet, groupBalances, overallSummary } from '../../engine/balances'
import { putShared, sharedFor } from '../groupsync/store'
import { applyRefund, clearFullRefund, refundDateText, refundNoteLine, takeOffRefund, type ApplyResult } from './actions'
import { MAX_FULL_REFUNDS, refundStore } from './store'

let riya: string
let sam: string
let neha: string
let groupId: string

const NOW = new Date(2026, 10, 14, 12)
const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
const stored = (): string => JSON.stringify(expensesStore.get())
const everything = (): string => JSON.stringify([expensesStore.get(), friendsStore.get(), groupsStore.get().map((g) => g.settlements)])
const find = (id: string): Expense => expensesStore.get().find((e) => e.id === id)!
const balances = (): Record<string, number> => groupBalances(group(), expensesStore.get())
const sum = (shares: Record<string, number>): number => Object.values(shares).reduce((a, b) => a + b, 0)
const inputs = (values: Record<string, number | null>): Participant[] => Object.entries(values).map(([friendId, input]) => ({ friendId, input }))
type Applied = Extract<ApplyResult, { ok: true }>
function refund(expenseId: string, amount: number, toId?: string): Applied {
  const result = applyRefund(expenseId, { amount, toId: toId ?? find(expenseId).payerId, date: '2026-11-14' })
  if (!result.ok) throw new Error(`expected a refund, got ${result.issue}`)
  return result
}
const draftFrom = (e: Expense): ExpenseDraft => {
  const { id: _id, createdAt: _c, updatedAt: _u, shares: _s, paidBack: _p, partPaid: _pp, ...rest } = e
  return rest
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  neha = addFriend({ name: 'Neha' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam, neha] }).id
  // Something else in the group, so positions and balances have company.
  saveExpense(draft({ title: 'Cab', total: 90_000, date: '2026-11-09', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
  vi.setSystemTime(new Date(2026, 10, 14, 12, 5))
})

afterEach(() => {
  vi.useRealTimers()
})

const bill = (feeSplit?: 'equal'): BillSnapshot => ({
  meta: {
    merchant: 'Cafe',
    date: null,
    subtotal: 100_000,
    tax: 5000,
    serviceCharge: null,
    discount: null,
    tip: null,
    total: 111_000,
    ...(feeSplit ? { fees: [{ id: 'f1', kind: 'delivery' as const, label: 'Delivery', amount: 6000 }] } : {}),
  },
  items: [
    { id: 'i1', name: 'Thali', quantity: 2, amount: 70_000 },
    { id: 'i2', name: 'Lassi', quantity: 1, amount: 30_000 },
  ],
  assignments: { i1: { [sam]: 1, [riya]: 1 }, i2: { [ME_ID]: 1 } },
  warnings: [],
  ...(feeSplit ? { feeSplit } : {}),
})

/** Every way an expense can be split, each in the group, paid by Sam. */
const MODES: Array<{ name: string; make: () => Partial<ExpenseDraft>; amount: number }> = [
  { name: 'equal', make: () => ({ total: 240_000, participants: everyone(sam, riya, ME_ID) }), amount: 30_000 },
  { name: 'equal, paise that do not divide', make: () => ({ total: 100_000, participants: everyone(sam, riya, ME_ID) }), amount: 3331 },
  { name: 'exact', make: () => ({ mode: 'exact', total: 240_000, participants: inputs({ [sam]: 120_000, [riya]: 80_001, [ME_ID]: 39_999 }) }), amount: 60_007 },
  { name: 'percent', make: () => ({ mode: 'percent', total: 240_000, participants: inputs({ [sam]: 5000, [riya]: 3333, [ME_ID]: 1667 }) }), amount: 30_001 },
  { name: 'shares', make: () => ({ mode: 'shares', total: 240_000, participants: inputs({ [sam]: 2, [riya]: 1, [ME_ID]: 3 }) }), amount: 40_000 },
  { name: 'what each had', make: () => ({ mode: 'had', total: 110_000, participants: inputs({ [sam]: 50_000, [riya]: 30_000, [ME_ID]: 20_000 }) }), amount: 11_000 },
  { name: 'itemised bill', make: () => ({ kind: 'bill', mode: 'items', total: 105_000, participants: everyone(sam, riya, ME_ID), bill: bill() }), amount: 21_000 },
  { name: 'itemised bill, fees shared equally', make: () => ({ kind: 'bill', mode: 'items', total: 111_000, participants: everyone(sam, riya, ME_ID), bill: bill('equal') }), amount: 21_000 },
  { name: 'rounded to whole rupees', make: () => ({ total: 100_000, roundedToWhole: true, participants: everyone(sam, riya, ME_ID) }), amount: 5000 },
  { name: 'paid in another currency', make: () => ({ total: 240_000, participants: everyone(sam, riya, ME_ID), fx: { amount: 100_000, currency: 'THB', rate: '2.4', rateDate: '2026-11-09', source: 'ecb' as const } }), amount: 60_000 },
]

describe.each(MODES)('a refund on a group expense split by: $name', ({ make, amount }) => {
  let original: Expense
  let before: string
  let beforeExpenses: string

  beforeEach(() => {
    original = saveExpense(draft({ title: 'Dinner', date: '2026-11-10', payerId: sam, groupId, note: 'Barbeque Nation', ...make() }))
    vi.setSystemTime(new Date(2026, 10, 14, 12, 10))
    before = everything()
    beforeExpenses = stored()
  })

  it('brings every share down in proportion, sums to the paisa, and stays recognisable', () => {
    const { plan, record } = refund(original.id, amount)
    const now = find(original.id)
    expect(now.total).toBe(original.total - amount)
    expect(sum(now.shares)).toBe(original.total - amount)
    expect(now.shares).toEqual(plan.shares)
    expect(Object.keys(now.shares).sort()).toEqual(Object.keys(original.shares).sort())
    // Recognisable: the same expense, title, date, people, payer and (for a bill) items.
    expect(now).toMatchObject({ id: original.id, title: 'Dinner', date: '2026-11-10', payerId: sam, mode: original.mode, kind: original.kind, groupId, createdAt: original.createdAt, bill: original.bill })
    expect(now.note).toBe(`Barbeque Nation\n${refundNoteLine(original, amount, sam, '2026-11-14')}`)
    expect(now.note).toContain('refunded on 14 Nov 2026')
    expect(record).toMatchObject({ kind: 'lower', amount, toId: sam, date: '2026-11-14', companionIds: [], savedAt: now.updatedAt })
    expect(record.before).toBe(original)
    // Nothing else was added.
    expect(expensesStore.get()).toHaveLength(2)
  })

  it('leaves the balances exactly as if the bill had been that much smaller', () => {
    const { plan } = refund(original.id, amount)
    const after = balances()
    // The same expense entered from scratch at the smaller total.
    const now = find(original.id)
    const twin = saveExpense({ ...draftFrom(original), total: plan.newTotal, participants: plan.changes!.participants, ...(now.fx ? { fx: now.fx } : {}), groupId: null })
    expect(twin.shares).toEqual(now.shares)
    expect(expenseNet(now)).toEqual(expenseNet(twin))
    expect(Object.values(after).reduce((a, b) => a + b, 0)).toBe(0)
    // Sam paid; what the others owe him for it is their new shares.
    const others = Object.entries(now.shares).filter(([id]) => id !== sam)
    expect(expenseNet(now)[sam]).toBe(others.reduce((a, [, share]) => a + share, 0))
  })

  it('saves an expense the app agrees with: editing it again, or reloading, changes nothing', () => {
    refund(original.id, amount)
    const now = find(original.id)
    const snapshot = JSON.stringify(now)
    flushAllStores()
    reloadAllStores()
    expect(JSON.stringify(find(original.id))).toBe(snapshot)
    const resaved = saveExpense({ ...draftFrom(now), id: now.id })
    expect(resaved.shares).toEqual(now.shares)
    expect(resaved.total).toBe(now.total)
  })

  it('Undo restores everything byte for byte', () => {
    const { undo } = refund(original.id, amount)
    expect(everything()).not.toBe(before)
    undo()
    expect(everything()).toBe(before)
    expect(find(original.id)).toBe(original)
    expect(refundStore.get().refunds).toEqual([])
  })

  it('taking it off later restores the original byte for byte, and undoing that restores the refund byte for byte', () => {
    const { record } = refund(original.id, amount)
    const refunded = stored()
    const records = JSON.stringify(refundStore.get())
    const undo = takeOffRefund(record.id)!
    expect(stored()).toBe(beforeExpenses)
    expect(refundStore.get().refunds).toEqual([])
    undo()
    expect(stored()).toBe(refunded)
    expect(JSON.stringify(refundStore.get())).toBe(records)
  })
})

describe('proportions', () => {
  it('identical people get identical shares (within a paisa) after a refund', () => {
    const e = saveExpense(draft({ title: 'Snacks', total: 100_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID, neha) }))
    refund(e.id, 33_337)
    const shares = Object.values(find(e.id).shares)
    expect(sum(find(e.id).shares)).toBe(66_663)
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
  })

  it('two refunds add up: the second works from what the first left', () => {
    const e = saveExpense(draft({ title: 'Hotel', total: 600_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    const first = refund(e.id, 60_000)
    vi.setSystemTime(new Date(2026, 10, 14, 13))
    const second = refund(e.id, 90_000)
    expect(find(e.id).total).toBe(450_000)
    expect(find(e.id).shares).toEqual({ [sam]: 150_000, [riya]: 150_000, [ME_ID]: 150_000 })
    expect(find(e.id).note!.split('\n')).toEqual(['₹600 refunded on 14 Nov 2026', '₹900 refunded on 14 Nov 2026'])
    // Only the newer one comes off first; then the older one can.
    expect(takeOffRefund(first.record.id)).toBeNull()
    expect(takeOffRefund(second.record.id)).not.toBeNull()
    expect(find(e.id).total).toBe(540_000)
    expect(takeOffRefund(first.record.id)).not.toBeNull()
    expect(find(e.id)).toBe(e)
  })
})

describe('the money went to someone other than the payer', () => {
  it('in a group: shares come down, and whoever got it owes the payer the refund', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    const was = balances()
    const before = everything()
    const { record, undo } = refund(e.id, 30_000, riya)
    expect(find(e.id).shares).toEqual({ [sam]: 70_000, [riya]: 70_000, [ME_ID]: 70_000 })
    expect(find(e.id).note).toBe('₹300 refunded on 14 Nov 2026, to Riya')
    expect(record.companionIds).toHaveLength(1)
    const entry = find(record.companionIds[0]!)
    expect(entry).toMatchObject({ kind: 'loan', title: 'Refund on Dinner', total: 30_000, payerId: sam, groupId, date: '2026-11-14', shares: { [riya]: 30_000 } })
    expect(entry.note).toBe('Riya got the ₹300 refund on Dinner (14 Nov 2026). Sam had paid, so Riya owes it to Sam.')
    // Against before: you owe ₹100 less; Riya owes ₹100 less but holds Sam's ₹300; Sam is owed ₹200 less on shares and ₹300 more from Riya.
    const now = balances()
    expect(now[ME_ID]! - was[ME_ID]!).toBe(10_000)
    expect(now[riya]! - was[riya]!).toBe(10_000 - 30_000)
    expect(now[sam]! - was[sam]!).toBe(-20_000 + 30_000)
    expect(Object.values(now).reduce((a, b) => a + b, 0)).toBe(0)
    undo()
    expect(everything()).toBe(before)
  })

  it('to you, outside a group: you owe the payer the refund on top of your smaller share', () => {
    const e = saveExpense(draft({ title: 'Tickets', total: 120_000, payerId: sam, participants: everyone(sam, ME_ID) }))
    const net = (): number => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend[sam] ?? 0
    expect(net()).toBe(-60_000)
    const { record } = refund(e.id, 20_000, ME_ID)
    // Share ₹500 now, plus Sam's ₹200 that came to you.
    expect(net()).toBe(-50_000 - 20_000)
    expect(find(record.companionIds[0]!)).toMatchObject({ kind: 'loan', payerId: sam, groupId: null, shares: { [ME_ID]: 20_000 } })
  })
})

describe('outside a group, someone had already paid the payer back', () => {
  /** What is open between you and `id` outside groups (the group's cab is not part of this). */
  const net = (id: string): number => overallSummary(expensesStore.get().filter((e) => e.groupId === null), [], ME_ID, 'INR').byFriend[id] ?? 0

  it('you paid, Riya had paid you in full: you owe her the difference, and Undo restores everything', () => {
    const e = saveExpense(draft({ title: 'Movie', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya, sam, neha) }))
    setPaidBack(e.id, riya, true)
    const before = everything()
    expect(net(riya)).toBe(0)
    expect(net(sam)).toBe(60_000)
    const { record, undo } = refund(e.id, 60_000)
    // Shares are ₹450 now. Riya had paid ₹600, so ₹150 goes back to her; Sam and Neha owe ₹450.
    expect(net(riya)).toBe(-15_000)
    expect(net(sam)).toBe(45_000)
    expect(net(neha)).toBe(45_000)
    expect(find(e.id).paidBack[riya]).toBeTypeOf('number')
    expect(record.companionIds).toHaveLength(1)
    expect(find(record.companionIds[0]!)).toMatchObject({ kind: 'loan', title: 'Refund on Movie', payerId: riya, total: 15_000, groupId: null, shares: { [ME_ID]: 15_000 } })
    expect(find(record.companionIds[0]!).note).toBe('Movie was refunded on 14 Nov 2026. Riya had already paid Ayush back, so Ayush owes Riya ₹150.')
    undo()
    expect(everything()).toBe(before)
  })

  it('a part payment over the new share comes back; one under it just leaves less to pay', () => {
    const e = saveExpense(draft({ title: 'Movie', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya, sam, neha) }))
    recordPartPayment(e.id, riya, 50_000)
    recordPartPayment(e.id, sam, 20_000)
    refund(e.id, 60_000)
    // Riya paid ₹500 of what is now ₹450: ticked off, ₹50 back. Sam paid ₹200: ₹250 to go.
    expect(net(riya)).toBe(-5000)
    expect(net(sam)).toBe(25_000)
    expect(find(e.id).paidBack[riya]).toBeTypeOf('number')
    expect(find(e.id).partPaid).toEqual({ [sam]: 20_000 })
  })

  it('all of it came back: the expense is out, and whoever had paid gets that back', () => {
    const e = saveExpense(draft({ title: 'Movie', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya, sam, neha) }))
    setPaidBack(e.id, riya, true)
    const before = everything()
    const { record, undo } = refund(e.id, 240_000)
    expect(expensesStore.get().some((x) => x.id === e.id)).toBe(false)
    expect(net(riya)).toBe(-60_000)
    expect(net(sam)).toBe(0)
    expect(record.kind).toBe('remove')
    undo()
    expect(everything()).toBe(before)
  })
})

describe('all of it came back', () => {
  let e: Expense
  let before: string

  beforeEach(() => {
    e = saveExpense(draft({ title: 'Movie tickets', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    saveExpense(draft({ title: 'Popcorn', total: 30_000, payerId: ME_ID, groupId, participants: everyone(sam, riya, ME_ID) }))
    before = everything()
  })

  it('takes the expense out of the balances and keeps it whole', () => {
    const was = balances()
    const { record, plan } = refund(e.id, 240_000)
    expect(plan.kind).toBe('remove')
    expect(expensesStore.get().map((x) => x.title)).toEqual(['Popcorn', 'Cab'])
    expect(record).toMatchObject({ kind: 'remove', amount: 240_000, companionIds: [], savedAt: 0 })
    expect(record.before).toBe(e)
    // As if the tickets had never been bought.
    expect(balances()[sam]).toBe(was[sam]! - 160_000)
    expect(balances()[riya]).toBe(was[riya]! + 80_000)
    expect(balances()[ME_ID]).toBe(was[ME_ID]! + 80_000)
  })

  it('Undo, and “Put it back” later, both restore it byte for byte and in its place', () => {
    const first = refund(e.id, 240_000)
    first.undo()
    expect(everything()).toBe(before)
    expect(refundStore.get().refunds).toEqual([])

    const second = refund(e.id, 240_000)
    flushAllStores()
    reloadAllStores()
    const again = takeOffRefund(second.record.id)!
    expect(everything()).toBe(before)
    again()
    expect(expensesStore.get().some((x) => x.id === e.id)).toBe(false)
    expect(refundStore.get().refunds).toHaveLength(1)
  })

  it('to someone else: they owe the payer all of it, as its own entry; putting it back removes that entry', () => {
    const was = balances()
    const { record } = refund(e.id, 240_000, riya)
    expect(find(record.companionIds[0]!)).toMatchObject({ kind: 'loan', payerId: sam, total: 240_000, groupId, shares: { [riya]: 240_000 } })
    // Sam paid ₹2,400 and has none of it back: Riya holds it all.
    expect(balances()[sam]).toBe(was[sam]! - 160_000 + 240_000)
    expect(balances()[riya]).toBe(was[riya]! + 80_000 - 240_000)
    takeOffRefund(record.id)
    expect(everything()).toBe(before)
  })

  it('clearing it from the list forgets it for good, with Undo', () => {
    const { record } = refund(e.id, 240_000)
    const kept = JSON.stringify(refundStore.get())
    const undo = clearFullRefund(record.id)!
    expect(refundStore.get().refunds).toEqual([])
    undo()
    expect(JSON.stringify(refundStore.get())).toBe(kept)
    expect(clearFullRefund('nope')).toBeNull()
  })

  it('refuses when too many are kept, and changes nothing', () => {
    refundStore.set({
      refunds: Array.from({ length: MAX_FULL_REFUNDS }, (_, i) => ({ id: `r${i}`, expenseId: `x${i}`, kind: 'remove' as const, amount: 1, currency: 'INR', toId: sam, date: '2026-11-14', createdAt: i, before: { ...e, id: `x${i}` }, afterId: null, companionIds: [], savedAt: 0 })),
    })
    expect(applyRefund(e.id, { amount: 240_000, toId: sam, date: '2026-11-14' })).toEqual({ ok: false, issue: 'full' })
    expect(everything()).toBe(before)
    // A part refund is still fine.
    expect(applyRefund(e.id, { amount: 1000, toId: sam, date: '2026-11-14' }).ok).toBe(true)
  })
})

describe('when it cannot be done', () => {
  it('says why and changes nothing', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    const loan = saveExpense(draft({ kind: 'loan', title: 'Lent', total: 50_000, payerId: ME_ID, participants: everyone(riya) }))
    const before = everything()
    expect(applyRefund('nope', { amount: 100, toId: sam, date: '2026-11-14' })).toEqual({ ok: false, issue: 'gone' })
    expect(applyRefund(e.id, { amount: 0, toId: sam, date: '2026-11-14' })).toEqual({ ok: false, issue: 'bad_amount' })
    expect(applyRefund(e.id, { amount: 240_001, toId: sam, date: '2026-11-14' })).toEqual({ ok: false, issue: 'too_much' })
    expect(applyRefund(loan.id, { amount: 100, toId: ME_ID, date: '2026-11-14' })).toEqual({ ok: false, issue: 'loan' })
    expect(everything()).toBe(before)
    expect(refundStore.get().refunds).toEqual([])
  })

  it('a save that fails halfway is rolled back completely', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    // The payer is no longer one of your people: the expense can't be saved again.
    friendsStore.set(friendsStore.get().filter((f) => f.id !== sam))
    const before = everything()
    expect(applyRefund(e.id, { amount: 30_000, toId: riya, date: '2026-11-14' })).toEqual({ ok: false, issue: 'failed' })
    expect(everything()).toBe(before)
    expect(refundStore.get().refunds).toEqual([])
  })

  it('a refund on an expense changed since cannot be taken off (it would undo the change too)', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    const { record } = refund(e.id, 40_000)
    vi.setSystemTime(new Date(2026, 10, 15, 9))
    setPaidBack(e.id, riya, true)
    const now = stored()
    expect(takeOffRefund(record.id)).toBeNull()
    expect(stored()).toBe(now)
    expect(takeOffRefund('nope')).toBeNull()
  })

  it('a bad date falls back to today', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    const result = applyRefund(e.id, { amount: 1000, toId: sam, date: 'soon' })
    expect(result.ok && result.record.date).toBe('2026-11-14')
  })
})

describe('in a shared group', () => {
  it('Undo marks the restored expense as the newest version, so other phones take it back too', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID) }))
    putShared({ groupId, id: 'shared-1', key: 'k'.repeat(22), me: 'm-me', members: {}, seen: {}, meta: { n: 'Goa', e: '🏖️', k: 'trip', u: 1 }, gone: {}, revived: {}, known: [], by: {}, createdAt: 1, sent: null, synced: null })
    vi.setSystemTime(new Date(2026, 10, 14, 12, 20))
    const { undo } = refund(e.id, 30_000)
    const lowered = find(e.id).updatedAt
    vi.setSystemTime(new Date(2026, 10, 14, 12, 21))
    undo()
    // The record itself is untouched; the group's own stamp is what moved on.
    expect(find(e.id)).toBe(e)
    expect(sharedFor(groupId)!.revived[e.id]).toBeGreaterThan(lowered)
  })
})

describe('the store', () => {
  it('keeps refunds across a reload, the original expense whole, and drops junk one record at a time', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, payerId: sam, groupId, participants: everyone(sam, riya, ME_ID), note: 'Line one\nLine two' }))
    const one = JSON.stringify(e)
    const { record } = refund(e.id, 240_000)
    flushAllStores()
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.refund)!) as { v: number; data: { refunds: unknown[] } }
    raw.data.refunds = ['junk', { id: 'bad', expenseId: 'x', kind: 'lower', amount: 5, currency: 'INR', toId: 'a', date: '2026-11-14', before: { id: 'other' } }, ...raw.data.refunds, { ...(raw.data.refunds[0] as object), id: 'neg', amount: -1 }]
    window.localStorage.setItem(STORAGE_KEYS.refund, JSON.stringify(raw))
    reloadAllStores()
    expect(refundStore.get().refunds.map((r) => r.id)).toEqual([record.id])
    expect(JSON.stringify(refundStore.get().refunds[0]!.before)).toBe(one)
  })
})

describe('what is written in notes', () => {
  it('uses a date that reads the same on every phone, and names instead of “You”', () => {
    expect(refundDateText('2026-11-14')).toBe('14 Nov 2026')
    expect(refundDateText('2028-02-29')).toBe('29 Feb 2028')
    const e = { currency: 'INR', payerId: sam }
    expect(refundNoteLine(e, 30_000, sam, '2026-11-14')).toBe('₹300 refunded on 14 Nov 2026')
    expect(refundNoteLine(e, 30_050, ME_ID, '2026-01-01')).toBe('₹300.50 refunded on 1 Jan 2026, to Ayush')
  })
})
