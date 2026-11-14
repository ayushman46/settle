/** Starting a new expense in a group: the group's usual split, when it has one that still fits. */
import type { Group } from '../../domain/types'
import { applyUsual, type ApplicableForm } from './engine'
import { getUsualSplit } from './store'

/** `form` set to `group`'s usual split, when the form is still the group's untouched default (see `applyUsual`). */
export function withUsualSplit<F extends ApplicableForm>(form: F, group: Pick<Group, 'id' | 'memberIds'> | null): F {
  if (!group) return form
  return applyUsual(form, getUsualSplit(group.id), group.memberIds)
}
