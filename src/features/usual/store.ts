/**
 * Each group's usual split (percentages or shares), on this phone. Set from a new expense in the
 * group, used by every new expense there after, cleared with "Stop using it".
 */
import * as z from 'zod/mini'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isValidUsual, type UsualSplit } from './engine'

export interface UsualState {
  /** Group → its usual split. */
  groups: Record<string, UsualSplit>
}

const MAX_GROUPS = 200
const MAX_PEOPLE = 60

const usualSplitSchema: ZodType<UsualSplit> = z.object({
  mode: z.enum(['percent', 'shares']),
  inputs: z.record(z.string(), z.number()),
  set: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
})

/** Keeps every group's split that reads well and adds up, drops the rest. */
const groupsSchema: ZodType<Record<string, UsualSplit>> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, UsualSplit> = {}
    let n = 0
    for (const [groupId, entry] of Object.entries(raw)) {
      if (n >= MAX_GROUPS) break
      const parsed = z.safeParse(usualSplitSchema, entry)
      if (!parsed.success || Object.keys(parsed.data.inputs).length > MAX_PEOPLE || !isValidUsual(parsed.data)) continue
      out[groupId] = parsed.data
      n++
    }
    return out
  }),
)

export const usualSchema = z.object({ groups: z.catch(groupsSchema, {}) })

export const usualStore = createStore<UsualState>({
  key: STORAGE_KEYS.usual,
  schema: usualSchema,
  initial: () => ({ groups: {} }),
  version: 1,
})

/** The group's usual split, or null. */
export function useUsualSplit(groupId: string | null | undefined): UsualSplit | null {
  return useStore(usualStore, (state) => (groupId ? (state.groups[groupId] ?? null) : null))
}

/** Same, outside React. */
export function getUsualSplit(groupId: string | null | undefined): UsualSplit | null {
  return groupId ? (usualStore.get().groups[groupId] ?? null) : null
}

/** Sets (or, with null, clears) the group's usual split. One that doesn't add up is ignored. */
export function setUsualSplit(groupId: string, usual: UsualSplit | null): void {
  if (!groupId) return
  if (usual !== null && (!isValidUsual(usual) || Object.keys(usual.inputs).length > MAX_PEOPLE)) return
  const state = usualStore.get()
  const groups = { ...state.groups }
  if (usual) groups[groupId] = { mode: usual.mode, inputs: { ...usual.inputs }, set: usual.set }
  else delete groups[groupId]
  const ids = Object.keys(groups)
  if (ids.length > MAX_GROUPS) for (const id of ids.slice(0, ids.length - MAX_GROUPS)) delete groups[id]
  usualStore.set({ ...state, groups })
}
