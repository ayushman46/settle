/** Starting a new expense in a group: the group's household split, when it asks for one. */
import type { Group } from '../../domain/types'
import { applyUnits, type ApplicableUnitsForm } from './engine'
import { getGroupUnits } from './store'

/**
 * `form` set to `group`'s household split (per family, or children at half or free), when the
 * group starts new expenses that way and the form is still the group's untouched equal split.
 * Call it after `withUsualSplit`: a usual split, already applied, is left alone.
 */
export function withUnitsSplit<F extends ApplicableUnitsForm>(form: F, group: Pick<Group, 'id' | 'memberIds'> | null): F {
  if (!group) return form
  return applyUnits(form, group, getGroupUnits(group.id))
}
