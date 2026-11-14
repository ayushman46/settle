import { useMemo } from 'react'
import { useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { friendLabel } from '../../kit/friendName'
import { settleScore, type SettleScore } from './engine'

/** Your Settle Score, worked out on this phone from your own splits (nothing stored, nothing sent). */
export function useScore(): SettleScore {
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const day = todayIso()
  return useMemo(() => {
    const groupName = new Map(groups.map((g) => [g.id, g.name]))
    return settleScore({
      expenses,
      groups,
      today: day,
      me: ME_ID,
      currency: profile.currency,
      nameOf: (kind, id) => (kind === 'group' ? (groupName.get(id) ?? '') : friendLabel(id, friendsById[id])),
    })
  }, [expenses, groups, friendsById, profile.currency, day])
}
