import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, poolsStore, updateProfile } from '../../data'
import { addContribution, savePool, type PoolDraft } from '../../data/pools'
import type { Pool } from '../../domain/types'
import { renderAt, resetProScreens } from '../pro/testing'
import { PoolDetailScreen } from './PoolDetailScreen'

vi.mock('./enabled', () => ({ POOLS_ENABLED: true }))

let ids: Record<string, string>

beforeEach(() => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okicici', onboarded: true })
  ids = Object.fromEntries(['Sam', 'Kabir', 'Neha'].map((name) => [name, addFriend({ name }).id]))
})

afterEach(() => {
  vi.useRealTimers()
  resetProScreens()
})

function farewell(extra: Partial<PoolDraft> = {}): Pool {
  return savePool({
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: [ids.Sam ?? '', ids.Kabir ?? '', ids.Neha ?? ''],
    expectedCount: null,
    deadline: '2026-10-30',
    note: 'A Kindle for Riya 🎁',
    showAmounts: true,
    ...extra,
  })
}

function tick(pool: Pool, name: string, amount = 50000) {
  addContribution(pool.id, { friendId: ids[name] ?? null, name, amount, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null })
}

describe('PoolDetailScreen', { timeout: 30_000 }, () => {
  it('shows fixed progress, the hero and each person', async () => {
    const pool = farewell()
    tick(pool, 'Sam')
    tick(pool, 'Kabir', 30000)
    renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    expect(screen.getByRole('heading', { level: 1, name: "Riya's farewell" })).toBeInTheDocument()
    expect(screen.getByText('Collecting to Ayush')).toBeInTheDocument()
    expect(screen.getByText('by 30 Oct')).toBeInTheDocument()
    expect(screen.getByText('₹800')).toBeInTheDocument()
    expect(screen.getByText('of ₹1,500 (3 × ₹500)')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 in · 2 to go')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Collected' })).toBeInTheDocument()
    expect(screen.getByText('53%')).toBeInTheDocument()
    expect(screen.getByText('₹500 · 21 Oct · UPI')).toBeInTheDocument()
    expect(screen.getByText('₹300 of ₹500 · ₹200 to go')).toBeInTheDocument()
    expect(screen.getByText('Not yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tick Neha off as paid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tick Kabir off as paid' })).toBeNull()
  })

  it('target and open lists word their progress differently; over the goal celebrates', () => {
    const pool = farewell({ mode: 'target', perPerson: null, target: 500000, memberIds: [], showAmounts: false })
    addContribution(pool.id, { friendId: null, name: 'Priya', amount: 550000, date: '2026-10-21', method: 'cash', via: 'tick', replyId: null })
    renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    expect(screen.getByText('of ₹5,000 goal')).toBeInTheDocument()
    expect(screen.getByText('₹500 over the goal 🎉')).toBeInTheDocument()
    expect(screen.getByText('₹5,500 · 21 Oct · Cash')).toBeInTheDocument()
  })

  it('ticks someone off with undo', async () => {
    const pool = farewell()
    const { user } = renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Tick Sam off as paid' }))
    expect(poolsStore.get()[0]?.contributions).toMatchObject([{ friendId: ids.Sam, amount: 50000, method: 'upi', date: '2026-10-23' }])
    expect(await screen.findByText('Sam ticked off ✓')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 in · 2 to go')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(poolsStore.get()[0]?.contributions).toEqual([])
  })

  it('reminds one person in three tones, and everyone in one message', async () => {
    const pool = farewell()
    tick(pool, 'Sam')
    const { user } = renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy link' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Remind Kabir' }))
    const sheet = screen.getByRole('dialog', { name: 'Remind Kabir' })
    const text = () => within(sheet).getByTestId('pool-reminder-text').textContent ?? ''
    expect(text()).toMatch(/^Hi Kabir! We're chipping in ₹500 for Riya's farewell 👋 — 1 of 3 done\. Here's the link: http.*\/pool#/)
    await user.click(within(sheet).getByRole('radio', { name: 'Funny' }))
    expect(text()).toMatch(/^Kabir, the gift for Riya is almost wrapped 🎁 — just your ₹500 missing! http/)
    await user.click(within(sheet).getByRole('radio', { name: 'Firm' }))
    expect(text()).toMatch(/^Hi Kabir, a reminder to send ₹500 for Riya's farewell by 30 Oct: http/)
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Remind all who haven’t chipped in' }))
    const all = screen.getByRole('dialog', { name: 'Remind everyone' })
    expect(within(all).getByTestId('pool-reminder-text').textContent).toMatch(
      /^Riya's farewell 👋 — 1 of 3 in! Still to chip in: Kabir, Neha\. http/,
    )
  })

  it('shares the latest progress on WhatsApp', async () => {
    const pool = farewell({ deadline: null })
    tick(pool, 'Sam')
    renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    const link = await screen.findByRole('link', { name: 'Share on WhatsApp' })
    await waitFor(() => expect(link).toHaveAttribute('href', expect.stringContaining('wa.me')))
    const text = new URL(link.getAttribute('href') ?? '').searchParams.get('text') ?? ''
    expect(text).toMatch(/^👋 Riya's farewell — ₹500 each\n₹500 of ₹1,500 in so far\. Chip in here \(any UPI app\):\nhttp.*\/pool#/)
  })

  it('closes, reopens and deletes with undo', async () => {
    const pool = farewell()
    tick(pool, 'Sam')
    const { user } = renderAt(`/app/pools/${pool.id}`, <PoolDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(screen.getByRole('button', { name: 'Close collection' }))
    const confirm = screen.getByRole('dialog', { name: 'Collected ₹500 — close it?' })
    await user.click(within(confirm).getByRole('button', { name: 'Close collection' }))
    expect(poolsStore.get()[0]?.closedAt).not.toBeNull()
    expect(screen.getByText('This collection is closed. Reopen it to take more payments.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reopen collection' }))
    expect(poolsStore.get()[0]?.closedAt).toBeNull()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(poolsStore.get()).toEqual([])
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(poolsStore.get()).toHaveLength(1)
  })
})
