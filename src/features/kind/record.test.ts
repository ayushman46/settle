import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  deleteSettlement,
  expensesStore,
  groupsStore,
  saveExpense,
  setPaidBack,
  STORAGE_KEYS,
  updateProfile,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import type { KindEntry } from './engine'
import { kindNote, kindNotesWith, recordKind, type KindInput } from './record'
import { addKindEntry, kindStore, MAX_KIND_ENTRIES, removeKindEntry } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string

const net = (friendId: string, currency = 'INR'): number => netIn(friendBalance(friendId, expensesStore.get(), groupsStore.get(), 'INR'), currency)
const input = (patch: Partial<KindInput> & Pick<KindInput, 'friendId' | 'direction' | 'amount'>): KindInput => ({
  currency: 'INR',
  what: 'ticket',
  text: '',
  date: '2026-11-14',
  ...patch,
})

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
})

describe('recordKind', () => {
  it('settles a split outside groups in full, keeps the note with the share, and Undo puts it all back', () => {
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    expect(net(riya)).toBe(50_000)
    const before = expensesStore.get()

    const recorded = recordKind(input({ friendId: riya, direction: 'in', amount: 50_000 }), 1_000)
    expect(recorded).not.toBeNull()
    expect(net(riya)).toBe(0)
    expect(recorded?.left).toBe(0)
    expect(recorded?.entry).toMatchObject({ friendId: riya, direction: 'in', what: 'ticket', text: null, amount: 50_000, currency: 'INR', date: '2026-11-14', createdAt: 1_000 })
    expect(recorded?.entry.refs).toEqual([{ type: 'share', expenseId: dinner.id, debtorId: riya, paidAt: expect.any(Number) as number }])
    expect(kindNote(dinner.id, riya)?.id).toBe(recorded?.entry.id)
    expect(kindNote(dinner.id)?.id).toBe(recorded?.entry.id)
    expect(kindNote(dinner.id, sam)).toBeNull()
    expect(kindNotesWith(riya).map((e) => e.id)).toEqual([recorded?.entry.id])

    recorded?.undo()
    expect(net(riya)).toBe(50_000)
    expect(expensesStore.get().map((e) => [e.id, e.paidBack, e.partPaid])).toEqual(before.map((e) => [e.id, e.paidBack, e.partPaid]))
    expect(kindStore.get().entries).toEqual([])
    expect(kindNote(dinner.id, riya)).toBeNull()
  })

  it('in a group it is a real payment, marked “Other”, on the day given; the note is found by the payment’s id', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [sam] })
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 100_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    expect(net(sam)).toBe(-50_000)

    const recorded = recordKind(input({ friendId: sam, direction: 'out', amount: 50_000, what: 'favour', date: '2026-11-02' }))
    expect(net(sam)).toBe(0)
    const payments = groupsStore.get().find((g) => g.id === goa.id)?.settlements ?? []
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ fromId: ME_ID, toId: sam, amount: 50_000, method: 'other', date: '2026-11-02' })
    expect(recorded?.entry.refs).toEqual([{ type: 'payment', groupId: goa.id, id: payments[0]?.id }])
    expect(kindNote(payments[0]?.id ?? '')).toMatchObject({ what: 'favour', direction: 'out', amount: 50_000 })

    // The payment deleted from the group later: its note stops showing, and nothing else breaks.
    deleteSettlement(goa.id, payments[0]?.id ?? '')
    expect(kindNote(payments[0]?.id ?? '')).toBeNull()
    expect(kindNotesWith(sam)).toEqual([])
  })

  it('a part: the oldest split is cleared first, the next in part, and the rest stays open', () => {
    const chai = saveExpense(draft({ title: 'Chai', total: 60_000, date: '2026-10-01', participants: everyone(ME_ID, riya) }))
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-10-20', participants: everyone(ME_ID, riya) }))
    expect(net(riya)).toBe(80_000)

    const recorded = recordKind(input({ friendId: riya, direction: 'in', amount: 50_000 }))
    expect(net(riya)).toBe(30_000)
    expect(recorded?.left).toBe(30_000)
    expect(recorded?.entry.amount).toBe(50_000)
    expect(recorded?.entry.refs).toHaveLength(2)
    expect(recorded?.entry.refs).toContainEqual({ type: 'share', expenseId: chai.id, debtorId: riya, paidAt: expect.any(Number) as number })
    expect(recorded?.entry.refs).toContainEqual({ type: 'share', expenseId: dinner.id, debtorId: riya, paidAt: null })
    expect(kindNote(chai.id, riya)).not.toBeNull()
    expect(kindNote(dinner.id, riya)).not.toBeNull()

    recorded?.undo()
    expect(net(riya)).toBe(80_000)
    expect(expensesStore.get().find((e) => e.id === dinner.id)?.partPaid).toBeUndefined()
    expect(kindStore.get().entries).toEqual([])
  })

  it('never settles more than is open: the note says what was really settled', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const recorded = recordKind(input({ friendId: riya, direction: 'in', amount: 9_99_999 }))
    expect(recorded?.entry.amount).toBe(50_000)
    expect(net(riya)).toBe(0)
  })

  it('odd paise: exactly what was open is settled, to the paisa', () => {
    // ₹100 between three: shares of 33.34, 33.33, 33.33.
    saveExpense(draft({ title: 'Auto', total: 10_000, participants: everyone(ME_ID, riya, sam) }))
    const open = net(riya)
    expect([3333, 3334]).toContain(open)
    const recorded = recordKind(input({ friendId: riya, direction: 'in', amount: open }))
    expect(recorded?.entry.amount).toBe(open)
    expect(net(riya)).toBe(0)
    // Sam's share is untouched.
    expect([3333, 3334]).toContain(net(sam))
  })

  it('nothing open, or the wrong way round: nothing is recorded and nothing changes', () => {
    expect(recordKind(input({ friendId: riya, direction: 'in', amount: 50_000 }))).toBeNull()
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const before = expensesStore.get()
    expect(recordKind(input({ friendId: riya, direction: 'out', amount: 50_000 }))).toBeNull()
    expect(recordKind(input({ friendId: riya, direction: 'in', amount: 0 }))).toBeNull()
    expect(expensesStore.get()).toEqual(before)
    expect(kindStore.get().entries).toEqual([])
    expect(net(riya)).toBe(50_000)
  })

  it('another currency is settled on its own, leaving the rupees alone', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Museum', currency: 'USD', total: 4_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    expect(net(riya, 'USD')).toBe(-2_000)
    const recorded = recordKind(input({ friendId: riya, direction: 'out', amount: 2_000, currency: 'USD' }))
    expect(recorded?.entry).toMatchObject({ currency: 'USD', amount: 2_000, direction: 'out' })
    expect(net(riya, 'USD')).toBe(0)
    expect(net(riya)).toBe(50_000)
  })

  it('money both ways nets off: settling the net clears every record between you, and Undo restores each', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya] })
    // Riya owes you ₹800 in Goa; you owe her ₹300 on a split outside it.
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 160_000, participants: everyone(ME_ID, riya) }))
    const cab = saveExpense(draft({ title: 'Cab', total: 60_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    expect(net(riya)).toBe(50_000)

    const recorded = recordKind(input({ friendId: riya, direction: 'in', amount: 50_000 }))
    expect(recorded?.entry.amount).toBe(50_000)
    expect(net(riya)).toBe(0)
    expect(recorded?.entry.refs).toHaveLength(2)
    expect(kindNote(cab.id, ME_ID)).not.toBeNull()

    recorded?.undo()
    expect(net(riya)).toBe(50_000)
    expect(groupsStore.get().find((g) => g.id === goa.id)?.settlements).toEqual([])
    expect(expensesStore.get().find((e) => e.id === cab.id)?.paidBack).toEqual({})
  })

  it('your own words are kept for “something else”, tidied; not for the ready-made choices', () => {
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const other = recordKind(input({ friendId: riya, direction: 'in', amount: 20_000, what: 'other', text: '  Next   dinner’s on her ' }))
    expect(other?.entry.text).toBe('Next dinner’s on her')
    const ticket = recordKind(input({ friendId: riya, direction: 'in', amount: 10_000, what: 'ticket', text: 'ignored' }))
    expect(ticket?.entry.text).toBeNull()
  })

  it('a share unticked and ticked again later no longer carries the old note', () => {
    const dinner = saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 10, 14, 10))
      recordKind(input({ friendId: riya, direction: 'in', amount: 50_000 }))
      expect(kindNote(dinner.id, riya)).not.toBeNull()
      setPaidBack(dinner.id, riya, false)
      expect(kindNote(dinner.id, riya)).toBeNull()
      vi.setSystemTime(new Date(2026, 10, 15, 10))
      setPaidBack(dinner.id, riya, true)
      expect(kindNote(dinner.id, riya)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('kindStore', () => {
  const good: KindEntry = {
    id: 'k1',
    friendId: 'f1',
    direction: 'in',
    what: 'ticket',
    text: null,
    amount: 50_000,
    currency: 'INR',
    date: '2026-11-14',
    createdAt: 100,
    refs: [{ type: 'payment', groupId: 'g1', id: 's1' }],
  }

  it('reads what it can and drops the rest, one entry at a time', () => {
    const stored = {
      v: 1,
      data: {
        entries: [
          good,
          7,
          null,
          { ...good, id: 'k2', amount: -5 },
          { ...good, id: 'k3', what: 'bribe' },
          { ...good, id: 'k4', date: 'yesterday' },
          { ...good, id: 'k5', refs: [] },
          { ...good, id: 'k6', refs: [{ type: 'share', expenseId: 'e1', debtorId: 'f1', paidAt: null }], createdAt: 200 },
          { ...good, id: 'k1', createdAt: 300 },
          { ...good, id: 'k7', text: 42, createdAt: 50 },
        ],
      },
    }
    window.localStorage.setItem(STORAGE_KEYS.kind, JSON.stringify(stored))
    kindStore.reload()
    // Newest first; the duplicate id is dropped; a bad note text is read as none.
    expect(kindStore.get().entries.map((e) => e.id)).toEqual(['k6', 'k1', 'k7'])
    expect(kindStore.get().entries.find((e) => e.id === 'k7')?.text).toBeNull()
  })

  it('starts empty from junk', () => {
    window.localStorage.setItem(STORAGE_KEYS.kind, JSON.stringify({ v: 1, data: { entries: 'nope' } }))
    kindStore.reload()
    expect(kindStore.get().entries).toEqual([])
    window.localStorage.setItem(STORAGE_KEYS.kind, 'not json')
    kindStore.reload()
    expect(kindStore.get().entries).toEqual([])
  })

  it('keeps the newest, up to the cap, and ignores an unreadable entry', () => {
    for (let i = 0; i < MAX_KIND_ENTRIES + 5; i++) addKindEntry({ ...good, id: `k${i}`, createdAt: i })
    expect(kindStore.get().entries).toHaveLength(MAX_KIND_ENTRIES)
    expect(kindStore.get().entries[0]?.id).toBe(`k${MAX_KIND_ENTRIES + 4}`)
    addKindEntry({ ...good, id: 'bad', amount: 0 })
    expect(kindStore.get().entries.some((e) => e.id === 'bad')).toBe(false)
    removeKindEntry(`k${MAX_KIND_ENTRIES + 4}`)
    expect(kindStore.get().entries).toHaveLength(MAX_KIND_ENTRIES - 1)
    removeKindEntry('never-there')
    expect(kindStore.get().entries).toHaveLength(MAX_KIND_ENTRIES - 1)
  })
})
