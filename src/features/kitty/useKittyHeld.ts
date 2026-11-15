import { useMemo } from 'react'
import { useExpenses, useGroup } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { kittyHeld, type KittyHeld } from './engine'
import { withoutFamilyPayments } from './family'
import { useKittyConfig } from './store'

/**
 * The group's running kitty as the balance card needs it: null when there is none, else
 * `{ holderId, held }`, `held` being the others' money the holder has in hand (the sheet's "Left").
 */
export function useKittyHeld(groupId: string): KittyHeld | null {
  const group = useGroup(groupId)
  const config = useKittyConfig(groupId)
  const expenses = useExpenses({ groupId })
  const day = todayIso()
  const found = useMemo(() => (group ? kittyHeld(withoutFamilyPayments(group), expenses, config, day) : null), [group, expenses, config, day])
  const holderId = found?.holderId ?? null
  const held = found?.held ?? 0
  // The same object while the numbers are the same, so it is safe in effect and memo deps.
  return useMemo(() => (holderId === null ? null : { holderId, held }), [holderId, held])
}
