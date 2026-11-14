/** Starting a new expense in a group: the group's usual split, when it has one that still fits. */
import { useMemo } from 'react'
import type { Group } from '../../domain/types'
import { applyUsual, groupUsualSplit, type ApplicableForm, type GroupUsualSplit } from './engine'
import { getUsualSplit, useUsualSplit } from './store'

/** `form` set to `group`'s usual split, when the form is still the group's untouched default (see `applyUsual`). */
export function withUsualSplit<F extends ApplicableForm>(form: F, group: Pick<Group, 'id' | 'memberIds'> | null): F {
  if (!group) return form
  return applyUsual(form, getUsualSplit(group.id), group.memberIds)
}

/** The usual split new expenses in `group` start from, or null when they start equal (see `groupUsualSplit`). */
export function usualSplitFor(group: Pick<Group, 'id' | 'memberIds'> | null | undefined): GroupUsualSplit | null {
  if (!group) return null
  return groupUsualSplit(getUsualSplit(group.id), group.memberIds)
}

/** Same, in React: updates when the usual split or the group's members change. */
export function useGroupUsualSplit(group: Pick<Group, 'id' | 'memberIds'> | null | undefined): GroupUsualSplit | null {
  const usual = useUsualSplit(group?.id)
  const members = group?.memberIds
  const key = members ? members.join('\u001f') : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the members are read through `key`
  return useMemo(() => (members ? groupUsualSplit(usual, members) : null), [usual, key])
}
