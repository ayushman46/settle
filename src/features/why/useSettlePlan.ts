import { useMemo } from 'react'
import { useFriendsById } from '../../data'
import type { Expense, Group } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { settlePlan, type SettlePlan, type WhyMode } from './engine'
import { useDirectMode } from './store'

export interface SettlePlanView {
  plan: SettlePlan
  /** Which list Settle up shows for this group. */
  mode: WhyMode
  /** That list: the fewest payments, or only between people who directly owe each other. */
  transfers: Transfer[]
}

/**
 * Both ways of settling `group` and the one this phone shows. Ties are ordered by people's real
 * names (the owner's own name, not "You"), so every phone in a shared group lists the same thing.
 */
export function useSettlePlan(group: Group, expenses: readonly Expense[]): SettlePlanView {
  const friendsById = useFriendsById()
  const direct = useDirectMode(group.id)
  const plan = useMemo(() => settlePlan(group, expenses, (id) => friendsById[id]?.name ?? ''), [group, expenses, friendsById])
  return useMemo(() => ({ plan, mode: direct ? 'direct' : 'simple', transfers: direct ? plan.direct : plan.simple }), [plan, direct])
}
