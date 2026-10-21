/** Fixtures for data-layer tests. */
import { ME_ID, type Participant } from '../domain/types'
import type { ExpenseDraft } from './expenses'

export const everyone = (...ids: string[]): Participant[] => ids.map((friendId) => ({ friendId, input: null }))

/** A valid equal split of ₹1,000 paid by me, between me and `friendIds` (or just me). */
export function draft(partial: Partial<ExpenseDraft> & { with?: string[] } = {}): ExpenseDraft {
  const { with: friendIds, ...rest } = partial
  return {
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 100000,
    date: '2026-10-21',
    payerId: ME_ID,
    mode: 'equal',
    participants: everyone(ME_ID, ...(friendIds ?? [])),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    recurringId: null,
    source: 'manual',
    ...rest,
  }
}
