/**
 * Collections (chanda / pools): create and change them, tick people off, and take in signed
 * "I've chipped in" replies. Validated like the stored schema; actions throw `DataError`.
 */
import {
  ME_ID,
  POOL_OCCASIONS,
  type Contribution,
  type Minor,
  type Pool,
  type PoolMode,
  type PoolOccasion,
} from '../domain/types'
import { isIsoDate, toIsoDate, today } from '../engine/dates'
import { isValidTotal } from '../engine/split'
import { newId, randomB64u } from '../lib/ids'
import { poolReplyId, verifyPoolReply, type PoolReplyPayload } from '../share/pool'
import { DataError } from './errors'
import { touchFriends } from './friends'
import {
  cleanCurrency,
  cleanText,
  MAX_CONTRIBUTOR_NAME_LENGTH,
  MAX_POOL_CONTRIBUTIONS,
  MAX_POOL_MEMBERS,
  MAX_POOL_NOTE_LENGTH,
  MAX_POOL_TITLE_LENGTH,
  MAX_POOLS,
  POOL_OCCASION_DEFAULTS,
} from './schemas'
import { friendsStore, poolsStore, profileStore } from './stores'

export type PoolDraft = Omit<Pool, 'id' | 'contributions' | 'secret' | 'createdAt' | 'updatedAt' | 'closedAt'> & { id?: string }

export type PoolReplyResult =
  | { kind: 'added'; contribution: Contribution }
  | { kind: 'duplicate' }
  | { kind: 'unknown_pool' }
  | { kind: 'bad_signature' }

/** Where deleted pools' ids are remembered (30 days, ≤ 100) so a late reply can say so. */
export const POOL_TOMBSTONES_KEY = 'settle.v4.pools-deleted'
const TOMBSTONE_DAYS = 30
const MAX_TOMBSTONES = 100
const DAY_MS = 86_400_000

const METHODS: ReadonlySet<Contribution['method']> = new Set(['upi', 'cash', 'other'])

/* ------------------------------------------------------------------ helpers */

function findPool(id: string): Pool {
  const pool = poolsStore.get().find((p) => p.id === id)
  if (!pool) throw new DataError('not_found')
  return pool
}

function replacePool(next: Pool): Pool {
  poolsStore.update((pools) => pools.map((p) => (p.id === next.id ? next : p)))
  return next
}

function cleanMethod(method: unknown): Contribution['method'] {
  return typeof method === 'string' && METHODS.has(method as Contribution['method']) ? (method as Contribution['method']) : 'upi'
}

function cleanMembers(ids: readonly string[] | undefined): string[] {
  const known = new Set(friendsStore.get().map((f) => f.id))
  const out: string[] = []
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || id === ME_ID || !known.has(id) || out.includes(id)) continue
    out.push(id)
    if (out.length >= MAX_POOL_MEMBERS) break
  }
  return out
}

function friendName(id: string | null): string | null {
  if (!id) return null
  return friendsStore.get().find((f) => f.id === id)?.name ?? null
}

/* ------------------------------------------------------------------ pools */

/** Creates (no id, or an unknown one) or updates a pool. Throws DataError 'invalid' for an unusable draft. */
export function savePool(draft: PoolDraft): Pool {
  const occasion: PoolOccasion = POOL_OCCASIONS.includes(draft.occasion) ? draft.occasion : 'other'
  const mode: PoolMode = draft.mode === 'fixed' ? 'fixed' : 'target'
  if (mode === 'fixed' && !isValidTotal(draft.perPerson)) throw new DataError('invalid')
  if (mode === 'target' && draft.target !== null && !isValidTotal(draft.target)) throw new DataError('invalid')
  if (draft.deadline !== null && !isIsoDate(draft.deadline)) throw new DataError('invalid')

  const pools = poolsStore.get()
  const existing = draft.id ? pools.find((p) => p.id === draft.id) : undefined
  if (!existing && pools.length >= MAX_POOLS) throw new DataError('limit')
  const now = Date.now()
  const memberIds = cleanMembers(draft.memberIds)
  const expected = memberIds.length === 0 && Number.isInteger(draft.expectedCount) && (draft.expectedCount ?? 0) >= 2 && (draft.expectedCount ?? 0) <= 500
  const emoji = cleanText(draft.emoji ?? '', 16) || POOL_OCCASION_DEFAULTS[occasion].emoji
  const note = draft.note === null ? '' : cleanText(draft.note, MAX_POOL_NOTE_LENGTH)
  const pool: Pool = {
    id: existing?.id ?? draft.id ?? newId(),
    title: cleanText(draft.title ?? '', MAX_POOL_TITLE_LENGTH) || POOL_OCCASION_DEFAULTS[occasion].title,
    occasion,
    emoji,
    currency: cleanCurrency(draft.currency, existing?.currency ?? profileStore.get().currency),
    mode,
    perPerson: mode === 'fixed' ? draft.perPerson : null,
    target: mode === 'target' ? draft.target : null,
    memberIds,
    expectedCount: expected ? draft.expectedCount : null,
    deadline: draft.deadline,
    note: note || null,
    showAmounts: draft.showAmounts === true,
    contributions: existing?.contributions ?? [],
    secret: existing?.secret ?? randomB64u(16),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    closedAt: existing?.closedAt ?? null,
  }
  poolsStore.set(existing ? pools.map((p) => (p.id === pool.id ? pool : p)) : [pool, ...pools])
  touchFriends(memberIds, now)
  forgetTombstone(pool.id)
  return pool
}

/** Deletes a pool; returns it for "Undo". Remembers the id for 30 days (see `isPoolDeleted`). */
export function deletePool(id: string): Pool | null {
  const pools = poolsStore.get()
  const found = pools.find((p) => p.id === id) ?? null
  if (!found) return null
  poolsStore.set(pools.filter((p) => p.id !== id))
  rememberTombstone(id)
  return found
}

/** Puts back a pool returned by `deletePool`. */
export function restorePool(pool: Pool): void {
  poolsStore.update((pools) => [pool, ...pools.filter((p) => p.id !== pool.id)])
  forgetTombstone(pool.id)
}

/** Closes (no more ticking without asking) or reopens a pool. */
export function setPoolClosed(id: string, closed: boolean): Pool {
  const pool = findPool(id)
  const now = Date.now()
  return replacePool({ ...pool, closedAt: closed ? (pool.closedAt ?? now) : null, updatedAt: now })
}

/* ------------------------------------------------------------------ contributions */

/** Records a payment. The name defaults to your person's; amounts must be whole and above zero. */
export function addContribution(poolId: string, c: Omit<Contribution, 'id' | 'createdAt'>): Contribution {
  const pool = findPool(poolId)
  if (!isValidTotal(c.amount)) throw new DataError('invalid')
  if (pool.contributions.length >= MAX_POOL_CONTRIBUTIONS) throw new DataError('limit')
  const friendId = c.friendId && c.friendId !== ME_ID ? c.friendId : null
  const name = cleanText(c.name ?? '', MAX_CONTRIBUTOR_NAME_LENGTH) || cleanText(friendName(friendId) ?? '', MAX_CONTRIBUTOR_NAME_LENGTH)
  if (!name) throw new DataError('empty_name')
  const now = Date.now()
  const contribution: Contribution = {
    id: newId(),
    friendId,
    name,
    amount: c.amount,
    date: isIsoDate(c.date) ? c.date : today(),
    method: cleanMethod(c.method),
    via: c.via === 'reply' ? 'reply' : 'tick',
    replyId: c.via === 'reply' ? c.replyId : null,
    createdAt: now,
  }
  replacePool({ ...pool, contributions: [...pool.contributions, contribution], updatedAt: now })
  if (friendId) touchFriends([friendId], now)
  return contribution
}

/** Changes a payment's amount, method or date. */
export function updateContribution(
  poolId: string,
  id: string,
  patch: Partial<Pick<Contribution, 'amount' | 'method' | 'date'>>,
): Contribution {
  const pool = findPool(poolId)
  const current = pool.contributions.find((c) => c.id === id)
  if (!current) throw new DataError('not_found')
  if (patch.amount !== undefined && !isValidTotal(patch.amount)) throw new DataError('invalid')
  const next: Contribution = {
    ...current,
    amount: patch.amount ?? current.amount,
    method: patch.method !== undefined ? cleanMethod(patch.method) : current.method,
    date: patch.date !== undefined && isIsoDate(patch.date) ? patch.date : current.date,
  }
  replacePool({ ...pool, contributions: pool.contributions.map((c) => (c.id === id ? next : c)), updatedAt: Date.now() })
  return next
}

/** Removes a payment; returns it for "Undo" (`restoreContribution`). */
export function removeContribution(poolId: string, id: string): Contribution | null {
  const pool = poolsStore.get().find((p) => p.id === poolId)
  const found = pool?.contributions.find((c) => c.id === id) ?? null
  if (!pool || !found) return null
  replacePool({ ...pool, contributions: pool.contributions.filter((c) => c.id !== id), updatedAt: Date.now() })
  return found
}

/** Puts back a payment returned by `removeContribution` (in date order with the others). */
export function restoreContribution(poolId: string, contribution: Contribution): void {
  const pool = poolsStore.get().find((p) => p.id === poolId)
  if (!pool || pool.contributions.some((c) => c.id === contribution.id)) return
  const contributions = [...pool.contributions, contribution].sort((a, b) => a.createdAt - b.createdAt)
  replacePool({ ...pool, contributions, updatedAt: Date.now() })
}

/* ------------------------------------------------------------------ replies */

/** The date a reply says they paid (its timestamp, never in the future), else today. */
function replyDate(at: number): string {
  const ms = at * 1000
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + DAY_MS) return today()
  return toIsoDate(new Date(ms))
}

/**
 * Ticks someone off from their signed reply. `friendId` is who it is in your people (or null for a
 * guest); `amount` overrides the reply's (rarely). Closed pools still take it — the screen asks first.
 */
export function applyPoolReply(reply: PoolReplyPayload, opts: { friendId: string | null; amount?: Minor }): PoolReplyResult {
  const pool = poolsStore.get().find((p) => p.id === reply.id)
  if (!pool) return { kind: 'unknown_pool' }
  if (!verifyPoolReply(pool.secret, reply)) return { kind: 'bad_signature' }
  const replyId = poolReplyId(reply)
  if (pool.contributions.some((c) => c.replyId === replyId)) return { kind: 'duplicate' }
  const friendId = opts.friendId && friendsStore.get().some((f) => f.id === opts.friendId) ? opts.friendId : null
  const contribution = addContribution(pool.id, {
    friendId,
    name: reply.n,
    amount: opts.amount !== undefined && isValidTotal(opts.amount) ? opts.amount : reply.a,
    date: replyDate(reply.at),
    method: 'upi',
    via: 'reply',
    replyId,
  })
  return { kind: 'added', contribution }
}

/** The contribution a reply already made, if it was ticked. */
export function contributionForReply(reply: PoolReplyPayload): Contribution | null {
  const pool = poolsStore.get().find((p) => p.id === reply.id)
  if (!pool) return null
  const replyId = poolReplyId(reply)
  return pool.contributions.find((c) => c.replyId === replyId) ?? null
}

/* ------------------------------------------------------------------ tombstones */

type Tombstones = Array<[string, number]>

function readTombstones(now = Date.now()): Tombstones {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(POOL_TOMBSTONES_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number')
      .filter(([, at]) => now - at < TOMBSTONE_DAYS * DAY_MS && at <= now + DAY_MS)
      .slice(-MAX_TOMBSTONES)
  } catch {
    return []
  }
}

function writeTombstones(list: Tombstones): void {
  try {
    window.localStorage.setItem(POOL_TOMBSTONES_KEY, JSON.stringify(list.slice(-MAX_TOMBSTONES)))
  } catch {
    // Storage full or blocked: the reply screen falls back to "isn't on this phone".
  }
}

function rememberTombstone(id: string): void {
  const now = Date.now()
  writeTombstones([...readTombstones(now).filter(([x]) => x !== id), [id, now]])
}

function forgetTombstone(id: string): void {
  const list = readTombstones()
  if (list.some(([x]) => x === id)) writeTombstones(list.filter(([x]) => x !== id))
}

/** True when a pool with this id was deleted on this phone in the last 30 days. */
export function isPoolDeleted(id: string): boolean {
  return readTombstones().some(([x]) => x === id)
}
