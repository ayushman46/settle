import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, poolsStore, updateProfile } from '../../data'
import { deletePool, savePool, setPoolClosed } from '../../data/pools'
import type { Pool } from '../../domain/types'
import { encodePoolReply, signPoolReply } from '../../share/pool'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { PoolReplyScreen } from './PoolReplyScreen'

vi.mock('./enabled', () => ({ POOLS_ENABLED: true }))

let samId: string

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okicici', onboarded: true })
  samId = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  resetProScreens()
})

function farewell(memberIds: string[] = [samId]): Pool {
  return savePool({
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds,
    expectedCount: null,
    deadline: null,
    note: null,
    showAmounts: true,
  })
}

async function openReply(pool: Pool, extra: { n?: string; a?: number; at?: number; secret?: string; tamper?: boolean } = {}) {
  const at = extra.at ?? Math.floor(Date.now() / 1000) - 60
  const reply = signPoolReply(extra.secret ?? pool.secret, { v: 1, k: 'chip', id: pool.id, w: 0, n: extra.n ?? 'Sam', a: extra.a ?? 50000, at })
  const url = await encodePoolReply(extra.tamper ? { ...reply, a: reply.a + 1 } : reply, '')
  return renderAt(url, <PoolReplyScreen />)
}

describe('PoolReplyScreen', { timeout: 30_000 }, () => {
  it('new: ticks Sam off and opens the collection', async () => {
    const pool = farewell()
    const { user } = await openReply(pool)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sam chipped in ₹500?' })).toBeInTheDocument()
    expect(screen.getByText('Check your UPI app that it arrived.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, tick Sam off' }))
    expect(poolsStore.get()[0]?.contributions).toMatchObject([{ friendId: samId, name: 'Sam', amount: 50000, via: 'reply' }])
    expect(currentUrl()).toBe(`/app/pools/${pool.id}`)
    expect(await screen.findByText('Sam ticked off ✓')).toBeInTheDocument()
  })

  it('a different amount says so', async () => {
    const pool = farewell()
    const { user } = await openReply(pool, { a: 30000 })
    expect(await screen.findByRole('heading', { level: 1, name: 'Sam chipped in ₹300?' })).toBeInTheDocument()
    expect(screen.getByText('Sam’s part is ₹500 — this says ₹300. Check your UPI app.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tick ₹300' }))
    expect(poolsStore.get()[0]?.contributions[0]?.amount).toBe(30000)
  })

  it('the same reply twice is already ticked', async () => {
    const pool = farewell()
    // The very same reply both times: built a second later, a fresh `at` would make it a new one.
    const at = Math.floor(Date.now() / 1000) - 60
    const first = await openReply(pool, { at })
    await first.user.click(await screen.findByRole('button', { name: 'Yes, tick Sam off' }))
    first.unmount()
    await openReply(pool, { at })
    expect(await screen.findByRole('heading', { level: 1, name: 'Already ticked' })).toBeInTheDocument()
    expect(screen.getByText('Sam’s ₹500 is in.')).toBeInTheDocument()
    expect(poolsStore.get()[0]?.contributions).toHaveLength(1)
  })

  it('unknown and deleted collections', async () => {
    const pool = farewell()
    const reply = signPoolReply(pool.secret, { v: 1, k: 'chip', id: 'not-here', w: null, n: 'Sam', a: 50000, at: 1 })
    const view = renderAt(await encodePoolReply(reply, ''), <PoolReplyScreen />)
    expect(await screen.findByRole('heading', { level: 1, name: 'This collection isn’t on this phone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    view.unmount()
    deletePool(pool.id)
    await openReply(pool)
    expect(await screen.findByRole('heading', { level: 1, name: 'This collection was deleted' })).toBeInTheDocument()
  })

  it('a tampered reply is refused', async () => {
    const pool = farewell()
    await openReply(pool, { tamper: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'This reply doesn’t look right' })).toBeInTheDocument()
    expect(screen.getByText('Ask Sam to send it again.')).toBeInTheDocument()
    expect(poolsStore.get()[0]?.contributions).toEqual([])
  })

  it('a closed collection asks first', async () => {
    const pool = farewell()
    setPoolClosed(pool.id, true)
    const { user } = await openReply(pool)
    expect(await screen.findByText('This collection is closed — tick anyway?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes, tick Sam off' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Tick anyway' }))
    await user.click(screen.getByRole('button', { name: 'Yes, tick Sam off' }))
    await waitFor(() => expect(poolsStore.get()[0]?.contributions).toHaveLength(1))
  })

  it('offers to match a guest to one of your people by name', async () => {
    const pool = farewell([])
    const { user } = await openReply(pool, { n: 'sam' })
    expect(await screen.findByRole('switch', { name: 'This is Sam from your people' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Yes, tick sam off' }))
    expect(poolsStore.get()[0]?.contributions[0]?.friendId).toBe(samId)
  })
})
