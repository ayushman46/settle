/** A fixed set of money (today is Saturday 14 Nov 2026) for Ask Settle's tests. Test-only. */
import type { Expense, Friend, Group, Settlement } from '../../domain/types'
import type { AskData } from './engine'

export const TODAY = '2026-11-14'

const noon = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12).getTime()
}

let n = 0
function expense(id: string, title: string, total: number, date: string, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id,
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
    participants: Object.keys(shares).map((friendId) => ({ friendId, input: null })),
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

const friend = (id: string, name: string): Pick<Friend, 'id' | 'name'> => ({ id, name })
export const FRIENDS = [friend('me', 'Ayush'), friend('sam', 'Sam'), friend('riya', 'Riya Sharma'), friend('neha', 'Neha'), friend('arjun', 'Arjun')]

const settle = (id: string, fromId: string, toId: string, amount: number, date: string): Settlement => ({ id, fromId, toId, amount, date, createdAt: 1, method: 'upi' })
const group = (id: string, name: string, memberIds: string[], settlements: Settlement[] = []): Group => ({ id, name, emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds, settlements, createdAt: 1, updatedAt: 1, archived: false })

export const GROUPS: Group[] = [group('goa', 'Goa trip', ['me', 'riya', 'sam'], [settle('s1', 'riya', 'me', 30_000, '2026-11-05')]), group('flat', 'Flat 302', ['me', 'neha']), group('manali', 'Manali', ['me', 'riya'], [settle('s2', 'me', 'riya', 15_000, '2026-08-12')])]

export const EXPENSES: Expense[] = [
  expense('e1', 'Dinner at Thalassa', 120_000, '2026-11-03', 'me', { me: 40_000, riya: 40_000, sam: 40_000 }, { groupId: 'goa' }),
  expense('e2', 'Villa', 900_000, '2026-11-02', 'sam', { me: 300_000, riya: 300_000, sam: 300_000 }, { groupId: 'goa', category: 'travel' }),
  expense('e3', 'Scooter rent', 60_000, '2026-11-04', 'riya', { me: 20_000, riya: 20_000, sam: 20_000 }, { groupId: 'goa', category: 'transport' }),
  expense('e4', 'Rent November', 3_000_000, '2026-11-01', 'me', { me: 1_500_000, neha: 1_500_000 }, { groupId: 'flat', category: 'rent' }),
  expense('e5', 'Electricity', 240_000, '2026-10-10', 'neha', { me: 120_000, neha: 120_000 }, { groupId: 'flat', category: 'utilities' }),
  expense('e6', 'Movie', 80_000, TODAY, 'me', { me: 40_000, arjun: 40_000 }, { category: 'entertainment' }),
  expense('e7', 'Chai', 6_000, '2026-11-13', 'sam', { me: 3_000, sam: 3_000 }, { paidBack: { me: noon('2026-11-13') } }),
  expense('e8', 'Cab to airport', 150_000, '2026-10-20', 'me', { me: 75_000, sam: 75_000 }, { category: 'transport', paidBack: { sam: noon('2026-10-25') } }),
  expense('e9', 'Loan to Arjun', 500_000, '2026-11-10', 'me', { arjun: 500_000 }, { kind: 'loan', category: 'other' }),
  expense('e10', 'Bangkok dinner', 200_000, '2026-11-08', 'me', { me: 100_000, riya: 100_000 }, { currency: 'THB' }),
  expense('e11', 'Groceries', 90_000, '2026-09-15', 'me', { me: 45_000, neha: 45_000 }, { category: 'groceries' }),
  expense('e13', 'Bonfire', 30_000, '2026-08-10', 'riya', { me: 15_000, riya: 15_000 }, { groupId: 'manali', category: 'entertainment' }),
  expense('e12', 'Lunch', 50_000, '2025-12-20', 'arjun', { me: 25_000, arjun: 25_000 }, { paidBack: { me: noon('2025-12-22') } }),
]

export const DATA: AskData = {
  expenses: EXPENSES,
  groups: GROUPS,
  friends: FRIENDS,
  currency: 'INR',
  today: TODAY,
  me: 'me',
  nameOf: (id) => (id === 'me' ? 'You' : (FRIENDS.find((f) => f.id === id)?.name ?? 'Someone')),
}
