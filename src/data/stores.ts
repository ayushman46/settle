/** The persisted collections. One localStorage key each, versioned. */
import * as z from 'zod/mini'
import type { ClaimRound, Expense, Friend, Group, Pool, Profile, RecurringTemplate } from '../domain/types'
import {
  claimRoundsSchema,
  defaultProfile,
  expensesSchema,
  friendsSchema,
  groupsSchema,
  meFriend,
  poolsSchema,
  profileSchema,
  recurringListSchema,
  withMe,
} from './schemas'
import { createStore, type ZodType } from './store'

export const STORAGE_VERSION = 1

export const STORAGE_KEYS = {
  profile: 'settle.v3.profile',
  friends: 'settle.v3.friends',
  expenses: 'settle.v3.expenses',
  groups: 'settle.v3.groups',
  recurring: 'settle.v3.recurring',
  claims: 'settle.v4.claims',
  pools: 'settle.v4.pools',
} as const

/** Accepts a bare, un-enveloped value (e.g. hand-edited storage) when the schema can read it. */
function bare<T>(schema: ZodType<T>): (raw: unknown) => T | null {
  return (raw) => {
    const parsed = z.safeParse(schema, raw)
    return parsed.success ? parsed.data : null
  }
}

export const profileStore = createStore<Profile>({
  key: STORAGE_KEYS.profile,
  schema: profileSchema,
  initial: defaultProfile,
  version: STORAGE_VERSION,
  migrate: bare(profileSchema),
})

export const friendsStore = createStore<Friend[]>({
  key: STORAGE_KEYS.friends,
  schema: friendsSchema,
  initial: () => withMe([meFriend(profileStore.get().name)]),
  version: STORAGE_VERSION,
  migrate: bare(friendsSchema),
})

export const expensesStore = createStore<Expense[]>({
  key: STORAGE_KEYS.expenses,
  schema: expensesSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(expensesSchema),
})

export const groupsStore = createStore<Group[]>({
  key: STORAGE_KEYS.groups,
  schema: groupsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(groupsSchema),
})

export const recurringStore = createStore<RecurringTemplate[]>({
  key: STORAGE_KEYS.recurring,
  schema: recurringListSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(recurringListSchema),
})

/** Claim rounds ("Claim your items" links sent for a bill). */
export const claimsStore = createStore<ClaimRound[]>({
  key: STORAGE_KEYS.claims,
  schema: claimRoundsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(claimRoundsSchema),
})

/** Collections (chanda / pools). */
export const poolsStore = createStore<Pool[]>({
  key: STORAGE_KEYS.pools,
  schema: poolsSchema,
  initial: () => [],
  version: STORAGE_VERSION,
  migrate: bare(poolsSchema),
})
