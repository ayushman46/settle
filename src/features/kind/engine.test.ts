import { describe, expect, it } from 'vitest'
import { ME_ID, type Expense, type Group, type Settlement } from '../../domain/types'
import type { FriendBalance } from '../friends/friendBalance'
import {
  cleanKindText,
  findKindEntry,
  kindEntriesWith,
  kindIssue,
  kindOpen,
  MAX_KIND_TEXT,
  recordedRefs,
  refStands,
  type KindEntry,
  type KindRef,
} from './engine'

const RIYA = 'riya'
const SAM = 'sam'

function expense(patch: Partial<Expense> & Pick<Expense, 'id'>): Expense {
  return {
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 100_000,
    date: '2026-11-10',
    createdAt: 1,
    updatedAt: 1,
    payerId: ME_ID,
    mode: 'equal',
    participants: [
      { friendId: ME_ID, input: null },
      { friendId: RIYA, input: null },
    ],
    shares: { [ME_ID]: 50_000, [RIYA]: 50_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...patch,
  }
}

function settlement(patch: Partial<Settlement> & Pick<Settlement, 'id'>): Settlement {
  return { fromId: RIYA, toId: ME_ID, amount: 50_000, date: '2026-11-14', createdAt: 5, method: 'other', ...patch }
}

function group(id: string, settlements: Settlement[] = []): Group {
  return {
    id,
    name: 'Goa',
    emoji: '🏖️',
    kind: 'trip',
    currency: 'INR',
    memberIds: [ME_ID, RIYA, SAM],
    settlements,
    createdAt: 1,
    updatedAt: 1,
    archived: false,
  }
}

function entry(patch: Partial<KindEntry> & Pick<KindEntry, 'id' | 'refs'>): KindEntry {
  return { friendId: RIYA, direction: 'in', what: 'ticket', text: null, amount: 50_000, currency: 'INR', date: '2026-11-14', createdAt: 10, ...patch }
}

const balance = (totals: FriendBalance['totals']): FriendBalance => ({ sources: [], totals })

describe('kindOpen', () => {
  it('nothing open: nothing to settle', () => {
    expect(kindOpen(balance([]))).toEqual([])
    expect(kindOpen(balance([{ currency: 'INR', amount: 0 }]))).toEqual([])
  })

  it('they owe you, you owe them, and each currency on its own line in the balance’s order', () => {
    expect(kindOpen(balance([{ currency: 'INR', amount: 50_000 }]))).toEqual([{ currency: 'INR', amount: 50_000, direction: 'in' }])
    expect(kindOpen(balance([{ currency: 'INR', amount: -1 }]))).toEqual([{ currency: 'INR', amount: 1, direction: 'out' }])
    expect(
      kindOpen(
        balance([
          { currency: 'INR', amount: -120_050 },
          { currency: 'USD', amount: 2_000 },
        ]),
      ),
    ).toEqual([
      { currency: 'INR', amount: 120_050, direction: 'out' },
      { currency: 'USD', amount: 2_000, direction: 'in' },
    ])
  })

  it('drops junk amounts', () => {
    expect(kindOpen(balance([{ currency: 'INR', amount: Number.NaN }, { currency: 'USD', amount: 10.5 }]))).toEqual([])
  })
})

describe('kindIssue', () => {
  const ok = { amount: 50_000, what: 'ticket' as const, text: '' }

  it('a complete form has nothing missing', () => {
    expect(kindIssue(ok, 50_000)).toBeNull()
    expect(kindIssue({ ...ok, amount: 1 }, 50_000)).toBeNull()
    expect(kindIssue({ amount: 20_000, what: 'other', text: ' Next dinner’s on me ' }, 50_000)).toBeNull()
  })

  it('says what is missing, the amount first', () => {
    expect(kindIssue({ ...ok, amount: null }, 50_000)).toBe('amount')
    expect(kindIssue({ ...ok, amount: 0 }, 50_000)).toBe('amount')
    expect(kindIssue({ ...ok, amount: -5 }, 50_000)).toBe('amount')
    expect(kindIssue({ ...ok, amount: 10.5 }, 50_000)).toBe('amount')
    expect(kindIssue({ amount: null, what: null, text: '' }, 50_000)).toBe('amount')
    expect(kindIssue({ ...ok, what: null }, 50_000)).toBe('what')
    expect(kindIssue({ amount: 50_000, what: 'other', text: '   ' }, 50_000)).toBe('text')
  })

  it('never settles more than is open, to the paisa', () => {
    expect(kindIssue({ ...ok, amount: 50_001 }, 50_000)).toBe('over')
    expect(kindIssue({ ...ok, amount: 50_000 }, 50_000)).toBeNull()
  })
})

describe('cleanKindText', () => {
  it('one trimmed line, capped', () => {
    expect(cleanKindText('  Next   dinner’s\non me ')).toBe('Next dinner’s on me')
    expect(cleanKindText('x'.repeat(200))).toHaveLength(MAX_KIND_TEXT)
    expect(cleanKindText('   ')).toBe('')
  })
})

describe('recordedRefs', () => {
  it('nothing changed: nothing recorded', () => {
    const data = { expenses: [expense({ id: 'e1' })], groups: [group('g1')] }
    expect(recordedRefs(data, data, RIYA)).toEqual([])
    expect(recordedRefs({ expenses: [], groups: [] }, { expenses: [], groups: [] }, RIYA)).toEqual([])
  })

  it('finds a payment added in a group between the two of you, in either direction', () => {
    const before = { expenses: [], groups: [group('g1', [settlement({ id: 'old' })])] }
    const after = {
      expenses: [],
      groups: [group('g1', [settlement({ id: 'old' }), settlement({ id: 'new' }), settlement({ id: 'back', fromId: ME_ID, toId: RIYA })])],
    }
    expect(recordedRefs(before, after, RIYA)).toEqual([
      { type: 'payment', groupId: 'g1', id: 'new' },
      { type: 'payment', groupId: 'g1', id: 'back' },
    ])
  })

  it('leaves out payments between other people, and with other friends', () => {
    const before = { expenses: [], groups: [group('g1')] }
    const after = {
      expenses: [],
      groups: [group('g1', [settlement({ id: 's1', fromId: SAM, toId: ME_ID }), settlement({ id: 's2', fromId: RIYA, toId: SAM })])],
    }
    expect(recordedRefs(before, after, RIYA)).toEqual([])
  })

  it('finds a share ticked off, with the moment it was ticked', () => {
    const was = expense({ id: 'e1' })
    const now = { ...was, paidBack: { [RIYA]: 1234 } }
    expect(recordedRefs({ expenses: [was], groups: [] }, { expenses: [now], groups: [] }, RIYA)).toEqual([
      { type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: 1234 },
    ])
  })

  it('finds your own share ticked off on a split they paid', () => {
    const was = expense({ id: 'e1', payerId: RIYA })
    const now = { ...was, paidBack: { [ME_ID]: 99 } }
    expect(recordedRefs({ expenses: [was], groups: [] }, { expenses: [now], groups: [] }, RIYA)).toEqual([
      { type: 'share', expenseId: 'e1', debtorId: ME_ID, paidAt: 99 },
    ])
  })

  it('finds a part payment toward a share', () => {
    const was = expense({ id: 'e1', partPaid: { [RIYA]: 10_000 } })
    const now = { ...was, partPaid: { [RIYA]: 30_000 } }
    expect(recordedRefs({ expenses: [was], groups: [] }, { expenses: [now], groups: [] }, RIYA)).toEqual([
      { type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: null },
    ])
  })

  it('ignores someone else’s share on the same expense, and expenses that were not there before', () => {
    const was = expense({ id: 'e1', shares: { [ME_ID]: 40_000, [RIYA]: 30_000, [SAM]: 30_000 } })
    const now = { ...was, paidBack: { [SAM]: 50 } }
    const brandNew = expense({ id: 'e2', paidBack: { [RIYA]: 60 } })
    expect(recordedRefs({ expenses: [was], groups: [] }, { expenses: [now, brandNew], groups: [] }, RIYA)).toEqual([])
    // A split Sam paid: Riya's share there is between her and Sam, not you.
    const sams = expense({ id: 'e3', payerId: SAM, shares: { [SAM]: 50_000, [RIYA]: 50_000 } })
    expect(recordedRefs({ expenses: [sams], groups: [] }, { expenses: [{ ...sams, paidBack: { [RIYA]: 70 } }], groups: [] }, RIYA)).toEqual([])
  })
})

describe('refStands', () => {
  const payment: KindRef = { type: 'payment', groupId: 'g1', id: 's1' }
  const share: KindRef = { type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: 1234 }
  const part: KindRef = { type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: null }

  it('a payment stands while it is still in its group', () => {
    expect(refStands(payment, { expenses: [], groups: [group('g1', [settlement({ id: 's1' })])] })).toBe(true)
    expect(refStands(payment, { expenses: [], groups: [group('g1')] })).toBe(false)
    expect(refStands(payment, { expenses: [], groups: [group('g2', [settlement({ id: 's1' })])] })).toBe(false)
    expect(refStands(payment, { expenses: [], groups: [] })).toBe(false)
  })

  it('a share stands while it is still ticked off at that same moment', () => {
    expect(refStands(share, { expenses: [expense({ id: 'e1', paidBack: { [RIYA]: 1234 } })], groups: [] })).toBe(true)
    // Unticked.
    expect(refStands(share, { expenses: [expense({ id: 'e1' })], groups: [] })).toBe(false)
    // Unticked and ticked again later (paid some other way): the old note no longer applies.
    expect(refStands(share, { expenses: [expense({ id: 'e1', paidBack: { [RIYA]: 9999 } })], groups: [] })).toBe(false)
    // The expense is gone.
    expect(refStands(share, { expenses: [], groups: [] })).toBe(false)
  })

  it('a part payment stands while money is still counted toward the share', () => {
    expect(refStands(part, { expenses: [expense({ id: 'e1', partPaid: { [RIYA]: 20_000 } })], groups: [] })).toBe(true)
    expect(refStands(part, { expenses: [expense({ id: 'e1', paidBack: { [RIYA]: 5 } })], groups: [] })).toBe(true)
    expect(refStands(part, { expenses: [expense({ id: 'e1' })], groups: [] })).toBe(false)
  })
})

describe('findKindEntry', () => {
  const data = {
    expenses: [expense({ id: 'e1', shares: { [ME_ID]: 40_000, [RIYA]: 30_000, [SAM]: 30_000 }, paidBack: { [RIYA]: 1234, [SAM]: 777 } })],
    groups: [group('g1', [settlement({ id: 's1' })])],
  }
  const byPayment = entry({ id: 'k1', refs: [{ type: 'payment', groupId: 'g1', id: 's1' }] })
  const byShare = entry({ id: 'k2', what: 'favour', refs: [{ type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: 1234 }] })

  it('finds the note by a payment’s id, or by an expense’s id', () => {
    expect(findKindEntry([byPayment, byShare], 's1', undefined, data)?.id).toBe('k1')
    expect(findKindEntry([byPayment, byShare], 'e1', undefined, data)?.id).toBe('k2')
    expect(findKindEntry([byPayment, byShare], 'nope', undefined, data)).toBeNull()
    expect(findKindEntry([], 's1', undefined, data)).toBeNull()
  })

  it('whose share matters when asked: Sam’s share on the same expense has no note', () => {
    expect(findKindEntry([byShare], 'e1', RIYA, data)?.id).toBe('k2')
    expect(findKindEntry([byShare], 'e1', SAM, data)).toBeNull()
  })

  it('a note whose record is gone is not shown', () => {
    expect(findKindEntry([byPayment], 's1', undefined, { expenses: [], groups: [group('g1')] })).toBeNull()
    expect(findKindEntry([byShare], 'e1', RIYA, { expenses: [expense({ id: 'e1' })], groups: [] })).toBeNull()
  })

  it('the newest note wins when a share was settled in two parts', () => {
    const first = entry({ id: 'k3', createdAt: 10, refs: [{ type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: null }] })
    const second = entry({ id: 'k4', createdAt: 20, what: 'cash', refs: [{ type: 'share', expenseId: 'e1', debtorId: RIYA, paidAt: 1234 }] })
    expect(findKindEntry([first, second], 'e1', RIYA, data)?.id).toBe('k4')
    expect(findKindEntry([second, first], 'e1', RIYA, data)?.id).toBe('k4')
  })
})

describe('kindEntriesWith', () => {
  it('one friend’s notes that still stand, newest first', () => {
    const data = { expenses: [], groups: [group('g1', [settlement({ id: 's1' }), settlement({ id: 's2' })])] }
    const older = entry({ id: 'a', createdAt: 10, refs: [{ type: 'payment', groupId: 'g1', id: 's1' }] })
    const newer = entry({ id: 'b', createdAt: 20, refs: [{ type: 'payment', groupId: 'g1', id: 's2' }] })
    const gone = entry({ id: 'c', createdAt: 30, refs: [{ type: 'payment', groupId: 'g1', id: 'deleted' }] })
    const sams = entry({ id: 'd', friendId: SAM, createdAt: 40, refs: [{ type: 'payment', groupId: 'g1', id: 's1' }] })
    expect(kindEntriesWith([older, newer, gone, sams], RIYA, data).map((e) => e.id)).toEqual(['b', 'a'])
    expect(kindEntriesWith([], RIYA, data)).toEqual([])
  })
})
