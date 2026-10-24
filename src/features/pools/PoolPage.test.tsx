import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultProfile } from '../../data/schemas'
import { ME_ID, type Contribution, type Friend, type Pool } from '../../domain/types'
import { decodePoolReply, encodePoolLink, poolLinkFromPool, verifyPoolReply } from '../../share/pool'
import { renderAt, resetProScreens } from '../pro/testing'
import { PoolPage } from './PoolPage'

vi.mock('./enabled', () => ({ POOLS_ENABLED: true }))

const SECRET = 'q83vEjRWZq7XJ8sQ2b5r0w'

function friend(id: string, name: string, extra: Partial<Friend> = {}): Friend {
  return { id, name, color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1, ...extra }
}
const FRIENDS: Record<string, Friend> = {
  [ME_ID]: friend(ME_ID, 'Ayush', { phone: '98765 43210' }),
  sam: friend('sam', 'Sam'),
  kabir: friend('kabir', 'Kabir'),
  neha: friend('neha', 'Neha'),
}

function chip(friendId: string | null, name: string, amount: number): Contribution {
  return { id: `c-${name}`, friendId, name, amount, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null, createdAt: 1 }
}

function pool(extra: Partial<Pool> = {}): Pool {
  return {
    id: 'pool-1',
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: ['sam', 'kabir', 'neha'],
    expectedCount: null,
    deadline: '2026-10-30',
    note: 'A Kindle for Riya 🎁',
    showAmounts: true,
    contributions: [chip('kabir', 'Kabir', 50000)],
    secret: SECRET,
    createdAt: 1_761_000_000_000,
    updatedAt: 1_761_200_000_000,
    closedAt: null,
    ...extra,
  }
}

async function open(p: Pool, upiId: string | null = 'ayush@okicici') {
  const url = await encodePoolLink(poolLinkFromPool(p, FRIENDS, { ...defaultProfile(), name: 'Ayush', upiId }), '')
  return renderAt(url, <PoolPage />)
}

function asPhone() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query === '(hover: none) and (pointer: coarse)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

/** Opens "Pay ₹…" (once: it's a toggle) and reads the generic UPI link from the app list. */
async function upiParams(user: ReturnType<typeof userEvent.setup>, amount: string): Promise<Record<string, string>> {
  const cta = screen.getByRole('button', { name: amount })
  if (cta.getAttribute('aria-expanded') !== 'true') await user.click(cta)
  const href = screen.getByRole('link', { name: /Any UPI app/ }).getAttribute('href') ?? ''
  return Object.fromEntries(new URL(href).searchParams)
}

beforeEach(() => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  asPhone()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
})

describe('PoolPage', { timeout: 30_000 }, () => {
  it('shows who is collecting, the progress and the names', async () => {
    await open(pool())
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent("Ayush is collecting for Riya's farewell")
    expect(screen.getByText('“A Kindle for Riya 🎁”')).toBeInTheDocument()
    expect(screen.getByText('by 30 Oct')).toBeInTheDocument()
    expect(screen.getByText('₹500 of ₹1,500 · 1 chipped in')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Collected' })).toHaveAttribute('aria-valuenow', '33')
    expect(screen.getByRole('heading', { name: 'Which one are you?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kabir.*Chipped in ₹500 ✓/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I’m not on the list' })).toBeInTheDocument()
  })

  it('fixed: picking a name shows their part and the exact UPI request', async () => {
    const { user } = await open(pool())
    await user.click(await screen.findByRole('button', { name: 'Sam' }))
    expect(screen.getByText('Your part')).toBeInTheDocument()
    expect(await upiParams(user, 'Pay ₹500')).toMatchObject({ pa: 'ayush@okicici', am: '500.00', cu: 'INR', tn: "Chanda Riya's farewell" })
    await user.click(screen.getByRole('button', { name: 'Give a different amount' }))
    const field = screen.getByRole('textbox', { name: 'Amount' })
    await user.clear(field)
    await user.type(field, '300')
    expect(await upiParams(user, 'Pay ₹300')).toMatchObject({ am: '300.00' })
  })

  it('tell builds a signed reply link for the organiser', async () => {
    vi.useRealTimers()
    const { user } = await open(pool())
    await user.click(await screen.findByRole('button', { name: 'Sam' }))
    const tell = await screen.findByRole('link', { name: 'Tell Ayush you’ve chipped in' })
    expect(tell).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/919876543210\?text=/))
    const text = new URL(tell.getAttribute('href') ?? '').searchParams.get('text') ?? ''
    expect(text).toMatch(/^Chipped in ₹500 for Riya's farewell 👋 — Sam\nTick me off: .*\/app\/pools\/in#/)
    const reply = await decodePoolReply(text)
    expect(reply).toMatchObject({ id: 'pool-1', w: 0, n: 'Sam', a: 50000 })
    expect(reply && verifyPoolReply(SECRET, reply)).toBe(true)
    await user.click(tell)
    expect(screen.getByText('Thanks, Sam! Ayush will tick you off.')).toHaveAttribute('role', 'status')
  })

  it('target: suggests ₹1,300 for the rest, with the occasion chips and Other', async () => {
    const guests = ['A', 'B', 'C', 'D', 'E'].map((n) => chip(null, n, 70000))
    const { user } = await open(
      pool({ title: 'Ganpati puja chanda', occasion: 'puja', emoji: '🙏', mode: 'target', perPerson: null, target: 1000000, memberIds: [], expectedCount: 10, contributions: guests, showAmounts: false }),
    )
    await user.click(await screen.findByRole('button', { name: 'I’m not on the list' }))
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Priya')
    const suggested = screen.getByRole('radio', { name: '₹1,300 (suggested)' })
    expect(suggested).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radiogroup', { name: 'How much?' })).toHaveTextContent('₹1,300 (suggested)₹101₹251₹501Other')
    expect(await upiParams(user, 'Pay ₹1,300')).toMatchObject({ am: '1300.00' })
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '1001')
    expect(await upiParams(user, 'Pay ₹1,001')).toMatchObject({ am: '1001.00' })
  })

  it('someone already ticked sees it, with Pay again', async () => {
    const { user } = await open(pool())
    await user.click(await screen.findByRole('button', { name: /Kabir/ }))
    expect(screen.getByText('You’ve chipped in ✓')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pay ₹500/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Pay again' }))
    expect(screen.getByRole('button', { name: 'Pay ₹500' })).toBeInTheDocument()
  })

  it('no UPI ID or not rupees: pay the usual way; past the deadline still accepts', async () => {
    const { user } = await open(pool({ deadline: '2026-10-20' }), null)
    expect(await screen.findByText('Ended 20 Oct — you can still chip in')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sam' }))
    expect(screen.getByText('Ayush didn’t add a UPI ID — pay the usual way')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Tell Ayush you’ve chipped in' })).toBeInTheDocument()
  })

  it('a broken or missing link explains itself', async () => {
    renderAt('/pool#j.e30', <PoolPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'This collection link doesn’t work' })).toBeInTheDocument()
  })
})
