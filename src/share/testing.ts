/** Test fixtures for the share kit (imported by tests only). */
import { ME_ID, type Expense, type Friend, type Profile } from '../domain/types'

export function makeFriend(id: string, name: string, extra: Partial<Friend> = {}): Friend {
  return { id, name, color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0, ...extra }
}

export function makeProfile(extra: Partial<Profile> = {}): Profile {
  return {
    name: 'Ayush',
    upiId: 'ayush@okaxis',
    currency: 'INR',
    theme: 'system',
    accent: 'lime',
    haptics: true,
    onboarded: true,
    createdAt: 0,
    ...extra,
  }
}

export const FRIENDS: Record<string, Friend> = {
  [ME_ID]: makeFriend(ME_ID, 'You', { color: 2 }),
  riya: makeFriend('riya', 'Riya', { color: 5, upiId: 'riya@okicici', phone: '98765 43210' }),
  sam: makeFriend('sam', 'Sam', { color: 1 }),
  neha: makeFriend('neha', 'Neha Sharma', { color: 3 }),
}

/** ₹2,766 dinner paid by me, split equally between me, Riya, Sam and Neha (Riya paid me back). */
export function makeExpense(extra: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    kind: 'split',
    title: 'Dinner at Toit',
    category: 'food',
    currency: 'INR',
    total: 276_600,
    date: '2026-10-18',
    createdAt: 0,
    updatedAt: 0,
    payerId: ME_ID,
    mode: 'equal',
    participants: [ME_ID, 'riya', 'sam', 'neha'].map((friendId) => ({ friendId, input: null })),
    shares: { [ME_ID]: 69_150, riya: 69_150, sam: 69_150, neha: 69_150 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: { riya: 1 },
    recurringId: null,
    source: 'manual',
    ...extra,
  }
}
