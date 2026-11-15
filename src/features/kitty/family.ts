import type { Group } from '../../domain/types'
import { withinFamilyIds } from '../units/store'

/**
 * The group as the kitty should see it: a payment that only evens things out inside a household
 * ("Priya paid Rahul" when the Sharmas settled as one) is not money put into the kitty, even when
 * the household's payer is the one holding it.
 */
export function withoutFamilyPayments(group: Group): Group {
  const within = withinFamilyIds(group.id)
  if (within.size === 0) return group
  return { ...group, settlements: group.settlements.filter((s) => !within.has(s.id)) }
}
