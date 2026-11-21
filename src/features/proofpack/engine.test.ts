import { describe, expect, it } from 'vitest'
import type { Expense, Group } from '../../domain/types'
import { buildStatement, financialYear, statementCsv } from './engine'

let n = 0
function bill(title: string, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id: title,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total: Object.values(shares).reduce((a, b) => a + b, 0),
    date: '2026-10-01',
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.keys(shares).map((friendId) => ({ friendId, input: shares[friendId] ?? null })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  } as Expense
}

const goa: Group = {
  id: 'goa',
  name: 'Goa',
  emoji: '🏖',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  settlements: [
    { id: 'p1', fromId: 'riya', toId: 'me', amount: 5440_00, date: '2026-11-03', createdAt: 1, method: 'upi' },
    { id: 'p2', fromId: 'me', toId: 'sam', amount: 100_00, date: '2026-11-04', createdAt: 2, method: 'cash' },
  ],
  createdAt: 0,
  updatedAt: 0,
  archived: false,
}

// Days as the phone's own calendar gives them (injected).
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const NOV_5 = Date.parse('2026-11-05T10:00:00Z')

const expenses = [
  bill('Villa', 'me', { me: 4800_00, riya: 4800_00, sam: 4800_00 }, { groupId: 'goa', date: '2026-11-01' }),
  bill('Cab', 'me', { me: 640_00, riya: 640_00 }, { groupId: 'goa', date: '2026-11-02' }),
  bill('Pizza', 'me', { me: 300_00, neha: 300_00 }, { paidBack: { neha: NOV_5 } }),
  bill('Lent to Kabir', 'me', { kabir: 2000_00 }, { kind: 'loan', paidBack: { kabir: NOV_5 } }),
  bill('Concert', 'me', { me: 1500_00, tara: 1500_00 }, { partPaid: { tara: 500_00 }, updatedAt: NOV_5 }),
]

describe('buildStatement', () => {
  it('lists every payment to you, with the bills it paid for, apart from loans and gifts', () => {
    const s = buildStatement({
      expenses,
      groups: [goa],
      proofRefs: [{ utr: '412345678901', friendId: 'riya', amount: 5440_00, at: Date.parse('2026-11-03T12:00:00Z') }],
      shagun: [{ id: 'g1', name: 'Mehta family', direction: 'received', amount: 5100_00, gift: null, functionId: null, date: '2026-11-10', note: null, at: 1 }],
      from: '2026-04-01',
      to: '2027-03-31',
      dayOf,
    })
    expect(s.lines.map((l) => [l.date, l.fromId, l.amount, l.kind])).toEqual([
      ['2026-11-03', 'riya', 5440_00, 'repayment'],
      ['2026-11-05', 'kabir', 2000_00, 'loan'],
      ['2026-11-05', 'neha', 300_00, 'repayment'],
      ['2026-11-05', 'tara', 500_00, 'repayment'],
    ])
    const riya = s.lines[0]!
    expect(riya).toMatchObject({ method: 'upi', utr: '412345678901', groupName: 'Goa', ahead: 0 })
    expect(riya.forBills).toEqual([
      { expenseId: 'Villa', title: 'Villa', date: '2026-11-01', total: 14400_00, amount: 4800_00 },
      { expenseId: 'Cab', title: 'Cab', date: '2026-11-02', total: 1280_00, amount: 640_00 },
    ])
    expect(s.lines.find((l) => l.fromId === 'tara')?.undated).toBe(true)
    expect(s.totals).toEqual({ INR: { repayments: 6240_00, loans: 2000_00 } })
    expect(s.gifts).toEqual([{ date: '2026-11-10', name: 'Mehta family', amount: 5100_00, gift: null }])
    expect(s.giftsTotal).toBe(5100_00)
    // Money you sent (to Sam) is never in it.
    expect(s.lines.some((l) => l.fromId === 'sam')).toBe(false)
  })

  it('keeps to the dates and the person asked for', () => {
    const s = buildStatement({ expenses, groups: [goa], proofRefs: [], shagun: [], from: '2026-11-04', to: '2026-11-30', personId: 'neha', dayOf })
    expect(s.lines.map((l) => l.fromId)).toEqual(['neha'])
    expect(s.gifts).toEqual([])
  })

  it('makes a CSV a bank or CA can open', () => {
    const s = buildStatement({ expenses, groups: [goa], proofRefs: [], shagun: [], from: '2026-11-03', to: '2026-11-03', dayOf })
    const csv = statementCsv(s, (id) => ({ riya: 'Riya, S' })[id] ?? id, (m) => (m / 100).toFixed(2))
    expect(csv).toBe(
      'Date,From,Amount,Currency,Type,Method,UPI reference,Group,Paid for\r\n' +
        '2026-11-03,"Riya, S",5440.00,INR,Repayment for shared bills,upi,,Goa,Villa (2026-11-01) 4800.00; Cab (2026-11-02) 640.00\r\n',
    )
  })
})

describe('financialYear', () => {
  it('runs 1 April to 31 March', () => {
    expect(financialYear('2026-11-21')).toEqual({ from: '2026-04-01', to: '2027-03-31', label: 'FY 2026–27' })
    expect(financialYear('2027-02-10')).toEqual({ from: '2026-04-01', to: '2027-03-31', label: 'FY 2026–27' })
    expect(financialYear('2026-04-01').from).toBe('2026-04-01')
  })
})
