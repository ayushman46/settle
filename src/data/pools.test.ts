import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signPoolReply } from '../share/pool'
import { DataError } from './errors'
import { addFriend } from './friends'
import {
  addContribution,
  applyPoolReply,
  contributionForReply,
  deletePool,
  isPoolDeleted,
  POOL_TOMBSTONES_KEY,
  removeContribution,
  restoreContribution,
  restorePool,
  savePool,
  setPoolClosed,
  updateContribution,
  type PoolDraft,
} from './pools'
import { flushAllStores, reloadAllStores } from './store'
import { poolsStore } from './stores'
import { resetDataForTests } from './testing'

function draft(partial: Partial<PoolDraft> = {}): PoolDraft {
  return {
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: [],
    expectedCount: null,
    deadline: null,
    note: null,
    showAmounts: true,
    ...partial,
  }
}

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  vi.useRealTimers()
  resetDataForTests()
})

describe('savePool', () => {
  it('creates a pool with a fresh secret and keeps only real people', () => {
    const sam = addFriend({ name: 'Sam' })
    const pool = savePool(draft({ memberIds: [sam.id, 'me', 'ghost', sam.id], note: '  A Kindle  ' }))
    expect(pool.id).toBeTruthy()
    expect(pool.secret).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(pool.memberIds).toEqual([sam.id])
    expect(pool.note).toBe('A Kindle')
    expect(pool.contributions).toEqual([])
    expect(pool.closedAt).toBeNull()
    expect(poolsStore.get()).toEqual([pool])
    flushAllStores()
    reloadAllStores()
    expect(poolsStore.get()).toEqual([pool])
  })

  it('updates in place: keeps contributions, secret and createdAt', () => {
    const pool = savePool(draft())
    addContribution(pool.id, { friendId: null, name: 'Priya', amount: 50000, date: '2026-10-21', method: 'cash', via: 'tick', replyId: null })
    const updated = savePool({ ...draft({ title: 'Riya — farewell', perPerson: 60000 }), id: pool.id })
    expect(updated.id).toBe(pool.id)
    expect(updated.secret).toBe(pool.secret)
    expect(updated.createdAt).toBe(pool.createdAt)
    expect(updated.contributions).toHaveLength(1)
    expect(updated.perPerson).toBe(60000)
    expect(poolsStore.get()).toHaveLength(1)
  })

  it('rejects an unusable draft', () => {
    expect(() => savePool(draft({ perPerson: null }))).toThrow(DataError)
    expect(() => savePool(draft({ perPerson: 0 }))).toThrow(DataError)
    expect(() => savePool(draft({ mode: 'target', perPerson: null, target: -1 }))).toThrow(DataError)
    expect(() => savePool(draft({ deadline: '30/10/2026' }))).toThrow(DataError)
    expect(poolsStore.get()).toEqual([])
  })

  it('target mode: goal optional; title falls back to the occasion; head count only for open lists', () => {
    const a = savePool(draft({ mode: 'target', perPerson: 50000, target: null, title: '  ', occasion: 'puja', expectedCount: 15 }))
    expect(a.mode).toBe('target')
    expect(a.perPerson).toBeNull()
    expect(a.target).toBeNull()
    expect(a.title).toBe('Puja chanda')
    expect(a.expectedCount).toBe(15)
    const sam = addFriend({ name: 'Sam' })
    const b = savePool(draft({ memberIds: [sam.id], expectedCount: 15 }))
    expect(b.expectedCount).toBeNull()
    expect(savePool(draft({ expectedCount: 1 })).expectedCount).toBeNull()
  })
})

describe('delete, restore, close', () => {
  it('deletes with undo and remembers a tombstone', () => {
    const pool = savePool(draft())
    expect(isPoolDeleted(pool.id)).toBe(false)
    const removed = deletePool(pool.id)
    expect(removed).toEqual(pool)
    expect(poolsStore.get()).toEqual([])
    expect(isPoolDeleted(pool.id)).toBe(true)
    restorePool(pool)
    expect(poolsStore.get()).toEqual([pool])
    expect(isPoolDeleted(pool.id)).toBe(false)
    expect(deletePool('nope')).toBeNull()
  })

  it('tombstones expire after 30 days and keep at most 100', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T10:00:00'))
    const old = savePool(draft())
    deletePool(old.id)
    vi.setSystemTime(new Date('2026-11-01T10:00:00'))
    expect(isPoolDeleted(old.id)).toBe(false)
    for (let i = 0; i < 105; i++) {
      const p = savePool(draft({ title: `P${i}` }))
      deletePool(p.id)
    }
    const stored = JSON.parse(window.localStorage.getItem(POOL_TOMBSTONES_KEY) ?? '[]') as unknown[]
    expect(stored).toHaveLength(100)
  })

  it('closes and reopens', () => {
    const pool = savePool(draft())
    const closed = setPoolClosed(pool.id, true)
    expect(closed.closedAt).not.toBeNull()
    expect(setPoolClosed(pool.id, true).closedAt).toBe(closed.closedAt)
    expect(setPoolClosed(pool.id, false).closedAt).toBeNull()
    expect(() => setPoolClosed('nope', true)).toThrow(DataError)
  })
})

describe('contributions', () => {
  it('adds, updates and removes (with undo)', () => {
    const sam = addFriend({ name: 'Sam' })
    const pool = savePool(draft({ memberIds: [sam.id] }))
    const c = addContribution(pool.id, { friendId: sam.id, name: '', amount: 50000, date: '2026-10-21', method: 'upi', via: 'tick', replyId: 'x' })
    expect(c).toMatchObject({ friendId: sam.id, name: 'Sam', amount: 50000, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null })
    const u = updateContribution(pool.id, c.id, { amount: 30000, method: 'cash', date: 'bad' })
    expect(u).toMatchObject({ amount: 30000, method: 'cash', date: '2026-10-21' })
    expect(() => updateContribution(pool.id, c.id, { amount: 0 })).toThrow(DataError)
    const removed = removeContribution(pool.id, c.id)
    expect(removed?.id).toBe(c.id)
    expect(poolsStore.get()[0]?.contributions).toEqual([])
    if (removed) restoreContribution(pool.id, removed)
    expect(poolsStore.get()[0]?.contributions).toEqual([u])
    expect(removeContribution(pool.id, 'nope')).toBeNull()
  })

  it('rejects bad amounts and nameless guests', () => {
    const pool = savePool(draft())
    const base = { friendId: null, name: 'Priya', amount: 100, date: '2026-10-21', method: 'upi' as const, via: 'tick' as const, replyId: null }
    expect(() => addContribution(pool.id, { ...base, amount: 0 })).toThrow(DataError)
    expect(() => addContribution(pool.id, { ...base, amount: 1.5 })).toThrow(DataError)
    expect(() => addContribution(pool.id, { ...base, name: '   ' })).toThrow(DataError)
    expect(() => addContribution('nope', base)).toThrow(DataError)
    expect(addContribution(pool.id, { ...base, friendId: 'me', date: '' }).friendId).toBeNull()
  })
})

describe('applyPoolReply', () => {
  function reply(poolId: string, secret: string, extra: Partial<{ n: string; a: number; w: number | null }> = {}) {
    return signPoolReply(secret, { v: 1, k: 'chip', id: poolId, w: 0, n: 'Sam', a: 50000, at: Math.floor(Date.now() / 1000) - 60, ...extra })
  }

  it('adds once, then says duplicate', () => {
    const sam = addFriend({ name: 'Sam' })
    const pool = savePool(draft({ memberIds: [sam.id] }))
    const r = reply(pool.id, pool.secret)
    const first = applyPoolReply(r, { friendId: sam.id })
    expect(first.kind).toBe('added')
    if (first.kind !== 'added') return
    expect(first.contribution).toMatchObject({ friendId: sam.id, name: 'Sam', amount: 50000, method: 'upi', via: 'reply' })
    expect(first.contribution.replyId).toMatch(/^[A-Za-z0-9_-]{16}$/)
    expect(contributionForReply(r)?.id).toBe(first.contribution.id)
    expect(applyPoolReply(r, { friendId: sam.id })).toEqual({ kind: 'duplicate' })
    expect(poolsStore.get()[0]?.contributions).toHaveLength(1)
  })

  it('takes a different amount when the organiser says so; guests stay guests', () => {
    const pool = savePool(draft())
    const result = applyPoolReply(reply(pool.id, pool.secret, { n: 'Priya from HR', w: null, a: 30000 }), { friendId: 'ghost', amount: 30000 })
    expect(result.kind === 'added' && result.contribution).toMatchObject({ friendId: null, name: 'Priya from HR', amount: 30000 })
  })

  it('unknown pool, bad signature, closed pool', () => {
    const pool = savePool(draft())
    expect(applyPoolReply(reply('other', pool.secret), { friendId: null })).toEqual({ kind: 'unknown_pool' })
    const tampered = { ...reply(pool.id, pool.secret), a: 5000000 }
    expect(applyPoolReply(tampered, { friendId: null })).toEqual({ kind: 'bad_signature' })
    expect(applyPoolReply(reply(pool.id, 'AAAAAAAAAAAAAAAAAAAAAA'), { friendId: null })).toEqual({ kind: 'bad_signature' })
    setPoolClosed(pool.id, true)
    // The screen asks "Tick anyway?" first; the action itself still records it.
    expect(applyPoolReply(reply(pool.id, pool.secret), { friendId: null }).kind).toBe('added')
  })
})
