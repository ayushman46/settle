/** A group's households, read for the screen, the card and the sheet: who is in what, what each owes, the payments between them. */
import { useMemo } from 'react'
import { useExpenses, useFriendsById, useProfile } from '../../data'
import type { Group } from '../../domain/types'
import { friendLabel } from '../../kit/friendName'
import { unitBalances, unitTransfers, type GroupUnits, type UnitBalance, type UnitTransfer } from './engine'
import { useGroupUnits } from './store'
import type { UnitPeople } from './unitText'

/** The names households are called by: your people, and your own name for a shared family name. */
export function useUnitPeople(): UnitPeople {
  const friendsById = useFriendsById()
  const profile = useProfile()
  return useMemo(() => ({ friendsById, myName: profile.name }), [friendsById, profile.name])
}

export interface HouseholdsView {
  /** What the group keeps, or null when it has no households. */
  units: GroupUnits | null
  /** Every paying unit with its balance, in the group's order. */
  rows: UnitBalance[]
  /** The payments that square every household. */
  transfers: UnitTransfer[]
  people: UnitPeople
  /** True when at least one household of two or more is still in the group. */
  any: boolean
}

export function useHouseholds(group: Group): HouseholdsView {
  const units = useGroupUnits(group.id)
  const expenses = useExpenses({ groupId: group.id })
  const people = useUnitPeople()
  return useMemo(() => {
    const rows = unitBalances(group, expenses, units)
    const nameOf = (id: string): string => friendLabel(id, people.friendsById[id] ?? null)
    return { units, rows, transfers: unitTransfers(group, expenses, units, nameOf), people, any: rows.some((row) => row.unit.household) }
  }, [group, expenses, units, people])
}
