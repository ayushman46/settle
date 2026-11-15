/**
 * Udhaar limits, kept on this phone: a ceiling per friend and an optional one for everyone. What
 * anyone owes is never stored here: it is always the app's own balance.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { ME_ID, type Minor } from '../../domain/types'
import { MAX_MINOR } from '../../lib/money'
import { isLimitAmount, type LimitState } from './engine'

/** At most this many friends keep a setting of their own. */
export const MAX_LIMITS = 500

/** Reads each friend's ceiling on its own: one unreadable entry is dropped, never the rest. 0 = "no limit for them". */
const byFriendSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, Minor]> = []
    for (const [friendId, value] of Object.entries(raw)) {
      if (friendId === '' || friendId === ME_ID || friendId.length > 80) continue
      if (value === 0 || isLimitAmount(value)) read.push([friendId, value])
      if (read.length >= MAX_LIMITS) break
    }
    return Object.fromEntries(read) as Record<string, Minor>
  }),
)

export const limitSchema = z.object({
  everyone: z.catch(z.nullable(z.int().check(z.gt(0), z.lte(MAX_MINOR))), null),
  byFriend: z.catch(byFriendSchema, {}),
})

export const limitStore = createStore<LimitState>({
  key: STORAGE_KEYS.limit,
  schema: limitSchema,
  initial: () => ({ everyone: null, byFriend: {} }),
  version: 1,
})

const whole = (state: LimitState): LimitState => state

export function useLimitState(): LimitState {
  return useStore(limitStore, whole)
}

const NOTHING = (): void => undefined

/**
 * A friend's own ceiling: an amount in paise; `'none'` for no limit for them (kept as an
 * exemption only while there is a limit for everyone, otherwise there is nothing to be exempt
 * from); `null` to drop their own setting and follow the one for everyone. Returns an undo that
 * puts that friend's setting back exactly as it was (and touches nobody else's). Ignores yourself,
 * an empty id and amounts that can't be kept.
 */
export function setFriendLimit(friendId: string, amount: Minor | 'none' | null): () => void {
  if (friendId === '' || friendId === ME_ID) return NOTHING
  if (typeof amount === 'number' && !isLimitAmount(amount)) return NOTHING
  const before = limitStore.get()
  const byFriend = { ...before.byFriend }
  delete byFriend[friendId]
  if (typeof amount === 'number') byFriend[friendId] = amount
  else if (amount === 'none' && before.everyone !== null) byFriend[friendId] = 0
  const had = Object.hasOwn(before.byFriend, friendId) ? before.byFriend[friendId] : undefined
  const has = Object.hasOwn(byFriend, friendId) ? byFriend[friendId] : undefined
  if (had === has) return NOTHING
  // The newest setting is kept when the list is full.
  const entries = Object.entries(byFriend)
  const kept = entries.length > MAX_LIMITS ? entries.slice(entries.length - MAX_LIMITS) : entries
  limitStore.set({ ...before, byFriend: Object.fromEntries(kept) })
  return () => {
    const now = limitStore.get()
    const back = { ...now.byFriend }
    delete back[friendId]
    if (had !== undefined) back[friendId] = had
    limitStore.set({ ...now, byFriend: back })
  }
}

/**
 * The ceiling for everyone who has none of their own; null takes it away (and with it the
 * "no limit for them" exemptions, which then mean nothing). Returns an undo that puts the ceiling
 * and those exemptions back.
 */
export function setEveryoneLimit(amount: Minor | null): () => void {
  if (amount !== null && !isLimitAmount(amount)) return NOTHING
  const before = limitStore.get()
  if (before.everyone === amount) return NOTHING
  const exempt = amount === null ? Object.keys(before.byFriend).filter((id) => before.byFriend[id] === 0) : []
  const byFriend = exempt.length > 0 ? Object.fromEntries(Object.entries(before.byFriend).filter(([, value]) => value !== 0)) : before.byFriend
  limitStore.set({ everyone: amount, byFriend })
  return () => {
    const now = limitStore.get()
    const back = { ...now.byFriend }
    // An exemption comes back unless that friend was given a setting of their own meanwhile.
    for (const id of exempt) if (!Object.hasOwn(back, id)) back[id] = 0
    limitStore.set({ everyone: before.everyone, byFriend: back })
  }
}
