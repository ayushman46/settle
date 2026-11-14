import { useMemo } from 'react'
import { useExpenses, useFriendsById } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { friendLabel } from '../../kit/friendName'
import { playBoard, type PlayBoard } from './engine'
import { useBudget, useDifferent } from './store'

/** The Board for a group, worked out on this phone from the group's expenses and payments. */
export function useBoard(group: Group): PlayBoard {
  const expenses = useExpenses({ groupId: group.id })
  const friendsById = useFriendsById()
  const budget = useBudget(group.id)
  const different = useDifferent(group.id)
  const day = todayIso()
  return useMemo(
    () => playBoard({ group, expenses, today: day, me: ME_ID, nameOf: (id) => friendLabel(id, friendsById[id]), budget, notDuplicates: new Set(different) }),
    [group, expenses, day, friendsById, budget, different],
  )
}
