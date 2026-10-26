/** Who an "I've paid" reply is from, on this phone's copy of the split. */
import type { Expense, Friend, Profile } from '../../domain/types'
import { nameKey } from '../../lib/people'
import type { PaidReplyPayload } from '../../share/paidReply'
import { payLinkFromExpense, payLinkPeopleIds } from '../../share/payLink'
import { matchByName } from '../../share/pool'

/**
 * Who the reply is from: the person at its place in the expense's pay link when the name still
 * matches, else the one person in the split with that name. Never the payer.
 */
export function whoPaid(expense: Expense, reply: PaidReplyPayload, friendsById: Readonly<Record<string, Friend>>, profile: Profile): string | null {
  const ids = payLinkPeopleIds(expense)
  const link = payLinkFromExpense(expense, friendsById, profile)
  const atPlace = ids[reply.i]
  let id: string | null = atPlace !== undefined && nameKey(link.p[reply.i]?.n ?? '') === nameKey(reply.n) ? atPlace : null
  if (id === null) id = matchByName(reply.n, link.p.map((p, i) => ({ name: p.n, id: ids[i] ?? '' })))?.id ?? null
  if (id === null || id === '' || id === expense.payerId || !((expense.shares[id] ?? 0) > 0)) return null
  return id
}
