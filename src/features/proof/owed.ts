/** Who owes me money right now, in rupees, from the same balances the friend pages show. */
import type { Expense, Friend, Group } from '../../domain/types'
import { ME_ID } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import type { Owed } from './proofMatch'

export const CURRENCY = 'INR'

/** Everyone whose net balance with me is money they owe me (rupees). */
export function owedList(friends: readonly Friend[], expenses: readonly Expense[], groups: readonly Group[]): Owed[] {
  const owed: Owed[] = []
  for (const friend of friends) {
    if (friend.id === ME_ID) continue
    const amount = netIn(friendBalance(friend.id, expenses, groups, CURRENCY), CURRENCY)
    if (amount > 0) owed.push({ friendId: friend.id, name: friend.name, amount })
  }
  return owed
}
